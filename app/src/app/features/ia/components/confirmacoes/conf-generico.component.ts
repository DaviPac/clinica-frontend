import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogoService } from '../../../../core/ia/catalogo.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { formatarDataHora, formatarMoeda } from '../../../../core/utils/data.utils';
import {
  CAMPOS_POR_FERRAMENTA,
  CampoConfirmacao,
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
            @if (campo.obrigatorio) {
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
                @for (opcao of campo.opcoes ?? []; track opcao.valor) {
                  <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                }
              </select>
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
                min="0"
                [id]="idDe(campo)"
                [formControlName]="campo.nome"
                class="ui-input" />
            }

            @case ('numero') {
              <input
                type="number"
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

          @if (campo.ajuda) {
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

  readonly camposVisiveis = computed(() => {
    this.gatilhoDependencia();
    const isAdmin = this.auth.isAdmin();
    return this.campos().filter((c) => {
      if (c.somenteAdmin && !isAdmin) return false;
      if (c.dependeDe && !this.form.get(c.dependeDe)?.value) return false;
      return true;
    });
  });

  ngOnInit(): void {
    void this.catalogo.garantirCarregado();

    const args = this.args();
    const descritores = CAMPOS_POR_FERRAMENTA[this.ferramenta()] ?? camposDerivados(args);
    this.campos.set(descritores);

    for (const campo of descritores) {
      const validadores = campo.obrigatorio ? [Validators.required] : [];
      if (campo.nome === 'senha') validadores.push(Validators.minLength(6));
      this.form.addControl(
        campo.nome,
        this.fb.nonNullable.control(this.valorInicial(campo, args), validadores),
      );
    }

    this.form.valueChanges.subscribe(() => {
      this.gatilhoDependencia.update((n) => n + 1);
      this.emitir();
    });
    this.emitir();
  }

  idDe(campo: CampoConfirmacao): string {
    return `conf-${this.ferramenta()}-${campo.nome}`;
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
        return this.catalogo.agendamentos().map((a) => ({
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
    const bruto = args[campo.nome];
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
