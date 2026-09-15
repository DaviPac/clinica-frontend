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
  templateUrl: './conf-generico.component.html',
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
