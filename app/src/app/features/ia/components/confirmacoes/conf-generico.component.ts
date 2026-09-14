import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CatalogoService } from '../../../../core/ia/catalogo.service';
import { StatusAgendamento } from '../../../../core/models/agendamento.model';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { formatarDataHora, formatarMoeda } from '../../../../core/utils/data.utils';
import { transicoesPermitidas } from '../../../agendamentos/agendamento.regras';
import {
  CAMPOS_POR_FERRAMENTA,
  CampoConfirmacao,
  Entidade,
  camposDerivados,
} from './campos-confirmacao';
import { comoBooleano, comoNumero, comoTexto, paraDatetimeLocal } from './contrato';

/**
 * Formulário de confirmação dirigido pelos descritores de `campos-confirmacao`.
 *
 * Cobre todas as ferramentas de escrita menos `criar_agendamento`. Os selects de
 * entidade são populados pelo CatalogoService, então o usuário pode trocar o
 * paciente, o serviço ou o agendamento que a IA escolheu antes de confirmar.
 */
@Component({
  selector: 'app-conf-generico',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="flex flex-col gap-3">
      @for (campo of camposVisiveis(); track campo.nome) {
        <div class="flex flex-col gap-1">
          <label class="ui-label mb-0" [attr.for]="idDe(campo)">
            {{ campo.rotulo }}
            @if (campo.obrigatorio || (campo.obrigatorioSeAdmin && ehAdmin())) {
              <span class="text-red-500">*</span>
            }
          </label>

          @switch (campo.tipo) {
            @case ('booleano') {
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [id]="idDe(campo)"
                  [formControlName]="campo.nome"
                  class="w-4 h-4 accent-brand-400 cursor-pointer" />
                <span class="text-sm text-stone-700">
                  {{ form.get(campo.nome)?.value ? 'Sim' : 'Não' }}
                </span>
              </label>
            }

            @case ('enum') {
              <select [id]="idDe(campo)" [formControlName]="campo.nome" class="ui-input">
                <option value="">Selecione…</option>
                @for (opcao of opcoesEnumDe(campo); track opcao.valor) {
                  <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                }
              </select>
              @if (campo.opcoesConformeStatusDe && !opcoesEnumDe(campo).length) {
                <p class="text-[11px] text-amber-700 leading-snug">
                  Este agendamento está num status final — não há transição possível.
                </p>
              }
            }

            @case ('entidade') {
              <select [id]="idDe(campo)" [formControlName]="campo.nome" class="ui-input">
                <option [value]="0">Selecione…</option>
                @for (opcao of opcoesDe(campo); track opcao.id) {
                  <option [value]="opcao.id">{{ opcao.rotulo }}</option>
                }
              </select>
            }

            @case ('textarea') {
              <textarea
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                rows="2"
                class="ui-input resize-y"></textarea>
            }

            @case ('moeda') {
              <input
                type="number"
                step="0.01"
                [attr.min]="campo.min ?? 0"
                [attr.max]="campo.max"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('numero') {
              <input
                type="number"
                [attr.min]="campo.min"
                [attr.max]="campo.max"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('data') {
              <input
                type="date"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('datahora') {
              <input
                type="datetime-local"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('mes') {
              <input
                type="month"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('senha') {
              <input
                type="password"
                autocomplete="new-password"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @default {
              <input
                type="text"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }
          }

          @if (erroDe(campo); as erro) {
            <p class="text-[11px] text-red-600 leading-snug">{{ erro }}</p>
          } @else if (campo.ajuda) {
            <p class="text-[11px] text-stone-500 leading-snug">{{ campo.ajuda }}</p>
          }
        </div>
      }
    </form>
  `,
})
export class ConfGenericoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly catalogo = inject(CatalogoService);
  private readonly auth = inject(AuthService);

  readonly ferramenta = input.required<string>();
  readonly args = input.required<Record<string, unknown>>();

  readonly alterado = output<Record<string, unknown>>();
  readonly valido = output<boolean>();

  readonly form: FormGroup = this.fb.group({});
  private readonly campos = signal<CampoConfirmacao[]>([]);
  private readonly gatilhoDependencia = signal(0);
  /**
   * Valores do registro carregado pelo pré-preenchimento. Servem de linha de
   * base para enviar só o que mudou — como faz a tela de edição de paciente.
   */
  private baseline: Record<string, unknown> | null = null;

  readonly ehAdmin = this.auth.isAdmin;

  readonly camposVisiveis = computed(() => {
    this.gatilhoDependencia();
    const isAdmin = this.auth.isAdmin();
    return this.campos().filter((c) => {
      if (c.somenteAdmin && !isAdmin) return false;
      if (c.dependeDe && !this.form.get(c.dependeDe)?.value) return false;
      return true;
    });
  });

  async ngOnInit(): Promise<void> {
    const args = this.args();
    const descritores = CAMPOS_POR_FERRAMENTA[this.ferramenta()] ?? camposDerivados(args);
    this.campos.set(descritores);

    for (const campo of descritores) {
      this.form.addControl(
        campo.nome,
        this.fb.nonNullable.control(this.valorInicial(campo, args), this.validadoresDe(campo)),
      );
    }

    this.form.valueChanges.subscribe(() => {
      this.gatilhoDependencia.update((n) => n + 1);
      this.emitir();
    });
    this.emitir();

    // Depois do catálogo carregar, as telas de edição abrem preenchidas — aqui
    // também. Fica por último para não atrasar a exibição do formulário.
    await this.catalogo.garantirCarregado();
    this.gatilhoDependencia.update((n) => n + 1);
    this.configurarPreenchimento(descritores, args);
  }

  /** Espelha, um a um, os Validators do formulário da tela correspondente. */
  private validadoresDe(campo: CampoConfirmacao): ValidatorFn[] {
    const validadores: ValidatorFn[] = [];

    if (campo.obrigatorio || (campo.obrigatorioSeAdmin && this.auth.isAdmin())) {
      validadores.push(Validators.required);
      // Num select de entidade, "nenhum selecionado" é 0, que passa pelo required.
      if (campo.tipo === 'entidade') validadores.push(Validators.min(1));
    }
    if (campo.min !== undefined) validadores.push(Validators.min(campo.min));
    if (campo.max !== undefined) validadores.push(Validators.max(campo.max));
    if (campo.minLength !== undefined) validadores.push(Validators.minLength(campo.minLength));
    if (campo.maxLength !== undefined) validadores.push(Validators.maxLength(campo.maxLength));
    if (campo.email) validadores.push(Validators.email);

    return validadores;
  }

  /**
   * Quando o campo de entidade muda, carrega o registro escolhido nos demais.
   * O valor proposto pela IA vence o valor atual — é a alteração que ela pediu,
   * e sobrescrevê-la faria a proposta sumir ao trocar de registro.
   */
  private configurarPreenchimento(
    descritores: CampoConfirmacao[],
    args: Record<string, unknown>,
  ): void {
    const gatilho = descritores.find((c) => c.preencherDemais);
    if (!gatilho) return;

    const aplicar = (id: number, respeitarIA: boolean) => {
      const registro = this.registroDe(gatilho.preencherDemais!, id);
      if (!registro) return; // best-effort: fora do catálogo, mantém o que já está

      const base: Record<string, unknown> = {};
      for (const campo of descritores) {
        if (campo.nome === gatilho.nome) continue;

        const atual = registro[campo.nome];
        if (atual !== null && atual !== undefined) {
          base[campo.nome] = this.normalizarParaControle(campo, atual);
        }
        if (respeitarIA && args[campo.nome] !== undefined) continue;
        if (atual === null || atual === undefined) continue;

        this.form.get(campo.nome)?.setValue(this.normalizarParaControle(campo, atual));
      }
      this.baseline = base;
      this.emitir();
    };

    aplicar(Number(this.form.get(gatilho.nome)?.value), true);
    this.form
      .get(gatilho.nome)
      ?.valueChanges.subscribe((id) => aplicar(Number(id), false));
  }

  private registroDe(entidade: Entidade, id: number): Record<string, unknown> | undefined {
    if (!id) return undefined;
    const achar = <T extends { id: number }>(lista: T[]) => lista.find((r) => r.id === id);

    switch (entidade) {
      case 'paciente':
        return achar(this.catalogo.pacientes()) as unknown as Record<string, unknown>;
      case 'servico': {
        const s = achar(this.catalogo.servicos());
        // A leitura devolve `is_pacote`; o formulário e a escrita usam `pacote`.
        return s ? { ...s, pacote: s.is_pacote } : undefined;
      }
      case 'profissional':
        return achar(this.catalogo.profissionais()) as unknown as Record<string, unknown>;
      case 'agendamento':
        return achar(this.catalogo.agendamentos()) as unknown as Record<string, unknown>;
      case 'despesa':
        return achar(this.catalogo.despesas()) as unknown as Record<string, unknown>;
      default:
        return undefined;
    }
  }

  private normalizarParaControle(campo: CampoConfirmacao, valor: unknown): unknown {
    switch (campo.tipo) {
      case 'booleano':
        return comoBooleano(valor);
      case 'numero':
      case 'moeda':
      case 'entidade':
        return comoNumero(valor);
      case 'datahora':
        return paraDatetimeLocal(valor);
      case 'data':
        return comoTexto(valor).slice(0, 10);
      default:
        return comoTexto(valor);
    }
  }

  idDe(campo: CampoConfirmacao): string {
    return `conf-${this.ferramenta()}-${campo.nome}`;
  }

  /** Mensagem de erro inline, no mesmo espírito das telas. */
  erroDe(campo: CampoConfirmacao): string | null {
    const ctrl = this.form.get(campo.nome);
    if (!ctrl || ctrl.valid || !(ctrl.touched || ctrl.dirty)) return null;

    const e = ctrl.errors ?? {};
    if (e['required']) return `Informe ${campo.rotulo.toLowerCase()}.`;
    if (e['min'] && campo.tipo === 'entidade') return `Selecione ${campo.rotulo.toLowerCase()}.`;
    if (e['min']) return `O valor mínimo é ${campo.min}.`;
    if (e['max']) return `O valor máximo é ${campo.max}.`;
    if (e['minlength']) return `Use ao menos ${campo.minLength} caracteres.`;
    if (e['maxlength']) return `Use no máximo ${campo.maxLength} caracteres.`;
    if (e['email']) return 'Informe um e-mail válido.';
    return 'Valor inválido.';
  }

  /** Enum de status é filtrado pelas transições válidas do agendamento escolhido. */
  opcoesEnumDe(campo: CampoConfirmacao): { valor: string; rotulo: string }[] {
    const todas = campo.opcoes ?? [];
    if (!campo.opcoesConformeStatusDe) return todas;

    const id = Number(this.form.get(campo.opcoesConformeStatusDe)?.value);
    const agendamento = this.catalogo.agendamentos().find((a) => a.id === id);
    // Sem o agendamento em cache, oferecer tudo é melhor que travar o usuário.
    if (!agendamento) return todas;

    const permitidas = transicoesPermitidas(agendamento.status);
    return todas.filter((o) => permitidas.includes(o.valor as StatusAgendamento));
  }

  opcoesDe(campo: CampoConfirmacao): { id: number; rotulo: string }[] {
    switch (campo.entidade) {
      case 'paciente':
        return this.catalogo.pacientes().map((p) => ({ id: p.id, rotulo: p.nome }));
      case 'servico':
        return this.catalogo
          .servicos()
          .map((s) => ({
            id: s.id,
            rotulo: `${s.nome} — ${formatarMoeda(s.valor_atual)}${s.is_pacote ? ' (pacote)' : ''}`,
          }));
      case 'profissional':
        return this.catalogo.profissionais().map((u) => ({ id: u.id, rotulo: u.nome }));
      case 'agendamento':
        return this.catalogo
          .agendamentos()
          .filter((a) => !campo.somenteRecorrentes || a.recorrenciaGroupId)
          .map((a) => ({
            id: a.id,
            rotulo: `#${a.id} — ${this.catalogo.nomePaciente(a.pacienteId)} — ${formatarDataHora(a.dataHoraInicio)}`,
          }));
      case 'despesa':
        return this.catalogo
          .despesas()
          .map((d) => ({ id: d.id, rotulo: `${d.descricao} — ${formatarMoeda(d.valor)}` }));
      default:
        return [];
    }
  }

  private valorInicial(campo: CampoConfirmacao, args: Record<string, unknown>): unknown {
    // Sem valor da IA, vale o default da tela (categoria FIXA, comissão 40, …).
    const bruto = args[campo.nome] ?? campo.padrao;
    switch (campo.tipo) {
      case 'booleano':
        return comoBooleano(bruto);
      case 'numero':
      case 'moeda':
      case 'entidade':
        return comoNumero(bruto);
      case 'datahora':
        return paraDatetimeLocal(bruto);
      default:
        return comoTexto(bruto);
    }
  }

  /** Emite os argumentos já normalizados — o card pai nunca vê `unknown`. */
  private emitir(): void {
    const bruto = this.form.getRawValue() as Record<string, unknown>;
    const saida: Record<string, unknown> = {};

    for (const campo of this.campos()) {
      if (campo.somenteAdmin && !this.auth.isAdmin()) continue;

      const valor = bruto[campo.nome];
      if (valor === '' || valor === null || valor === undefined) continue;

      // Numa atualização, só vai o que o usuário de fato mudou — a tela de
      // edição faz o mesmo diff, e um PATCH completo sobrescreveria uma
      // alteração feita em paralelo.
      if (
        this.baseline &&
        campo.nome in this.baseline &&
        this.baseline[campo.nome] === valor
      ) {
        continue;
      }

      switch (campo.tipo) {
        case 'numero':
        case 'moeda':
        case 'entidade': {
          const n = Number(valor);
          if (!Number.isFinite(n) || n === 0) break;
          saida[campo.nome] = n;
          break;
        }
        case 'booleano':
          saida[campo.nome] = Boolean(valor);
          break;
        default:
          saida[campo.nome] = valor;
      }
    }

    this.alterado.emit(saida);
    this.valido.emit(this.form.valid);
  }
}
