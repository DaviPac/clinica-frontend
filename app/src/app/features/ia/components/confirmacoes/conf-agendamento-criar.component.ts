import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogoService } from '../../../../core/ia/catalogo.service';
import { Paciente } from '../../../../core/models/paciente.model';
import { Servico } from '../../../../core/models/servico.model';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { addSemanas, formatarMoeda } from '../../../../core/utils/data.utils';
import {
  aplicarRegrasDoServico,
  valorPorSessao,
} from '../../../agendamentos/agendamento.regras';
import { comoBooleano, comoNumero, paraDatetimeLocal } from './contrato';

/**
 * Formulário de confirmação de `criar_agendamento`.
 *
 * É o único com componente próprio porque os campos reagem entre si: escolher um
 * serviço que é pacote trava a recorrência e troca o significado do campo de
 * valor. As regras vêm de `agendamento.regras.ts`, compartilhadas com o modal de
 * agendamentos, para as duas telas nunca divergirem.
 */
@Component({
  selector: 'app-conf-agendamento-criar',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="flex flex-col gap-3">
      @if (isAdmin) {
        <div class="flex flex-col gap-1">
          <label class="ui-label mb-0" for="conf-ag-prof">Profissional <span class="text-red-500">*</span></label>
          <select id="conf-ag-prof" formControlName="profissional_id" class="ui-input">
            <option [value]="0">Selecione…</option>
            @for (p of catalogo.profissionais(); track p.id) {
              <option [value]="p.id">{{ p.nome }}</option>
            }
          </select>
        </div>
      }

      <div class="flex flex-col gap-1">
        <label class="ui-label mb-0" for="conf-ag-pac">Paciente <span class="text-red-500">*</span></label>
        <select id="conf-ag-pac" formControlName="paciente_id" class="ui-input">
          <option [value]="0">Selecione…</option>
          @for (p of pacientes(); track p.id) {
            <option [value]="p.id">{{ p.nome }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="ui-label mb-0" for="conf-ag-serv">Serviço <span class="text-red-500">*</span></label>
        <select id="conf-ag-serv" formControlName="servico_id" class="ui-input">
          <option [value]="0">Selecione…</option>
          @for (s of servicos(); track s.id) {
            <option [value]="s.id">
              {{ s.nome }} — {{ moeda(s.valor_atual) }}{{ s.is_pacote ? ' (pacote)' : '' }}
            </option>
          }
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="ui-label mb-0" for="conf-ag-ini">Início <span class="text-red-500">*</span></label>
          <input id="conf-ag-ini" type="datetime-local" formControlName="data_hora_inicio" class="ui-input" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="ui-label mb-0" for="conf-ag-dur">Duração (min) <span class="text-red-500">*</span></label>
          <input id="conf-ag-dur" type="number" min="1" formControlName="duracao_minutos" class="ui-input" />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="ui-label mb-0" for="conf-ag-valor">
          {{ ehPacote() ? 'Valor total do pacote' : 'Valor combinado' }}
          <span class="text-red-500">*</span>
        </label>
        <input id="conf-ag-valor" type="number" step="0.01" min="0" formControlName="valor_combinado" class="ui-input" />
        @if (ehPacote() && valorSessao() !== null) {
          <p class="text-[11px] text-stone-500">
            Equivale a {{ moeda(valorSessao()!) }} por sessão.
          </p>
        }
      </div>

      <div class="flex flex-col gap-2 pt-1 border-t border-stone-100">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            formControlName="recorrente"
            class="w-4 h-4 accent-brand-400 cursor-pointer" />
          <span class="text-sm text-stone-700">Sessões recorrentes</span>
        </label>
        @if (ehPacote()) {
          <p class="text-[11px] text-stone-500 -mt-1">
            Pacotes são sempre recorrentes e o valor informado é o total do pacote.
          </p>
        }

        @if (recorrente()) {
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="ui-label mb-0" for="conf-ag-sessoes">Total de sessões</label>
              <input id="conf-ag-sessoes" type="number" min="1" formControlName="total_sessoes" class="ui-input" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="ui-label mb-0" for="conf-ag-intervalo">Intervalo (semanas)</label>
              <input id="conf-ag-intervalo" type="number" min="1" formControlName="intervalo_semanas" class="ui-input" />
            </div>
          </div>
          @if (ultimaSessao(); as ultima) {
            <p class="text-[11px] text-stone-500">Última sessão em {{ ultima }}.</p>
          }
        }
      </div>
    </form>
  `,
})
export class ConfAgendamentoCriarComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly catalogo = inject(CatalogoService);

  readonly args = input.required<Record<string, unknown>>();
  readonly alterado = output<Record<string, unknown>>();
  readonly valido = output<boolean>();

  readonly isAdmin = this.auth.isAdmin();
  readonly moeda = formatarMoeda;

  readonly pacientes = signal<Paciente[]>([]);
  readonly servicos = signal<Servico[]>([]);
  private readonly gatilho = signal(0);

  readonly form: FormGroup = this.fb.nonNullable.group({
    profissional_id: [0],
    paciente_id: [0, [Validators.required, Validators.min(1)]],
    servico_id: [0, [Validators.required, Validators.min(1)]],
    data_hora_inicio: ['', Validators.required],
    duracao_minutos: [60, [Validators.required, Validators.min(1)]],
    valor_combinado: [0, [Validators.required, Validators.min(0.01)]],
    recorrente: [false],
    pacote: [false],
    total_sessoes: [10, Validators.min(1)],
    intervalo_semanas: [1, Validators.min(1)],
  });

  readonly ehPacote = computed(() => {
    this.gatilho();
    return this.form.getRawValue().pacote === true;
  });

  readonly recorrente = computed(() => {
    this.gatilho();
    return this.form.getRawValue().recorrente === true;
  });

  readonly valorSessao = computed(() => {
    this.gatilho();
    const bruto = this.form.getRawValue();
    return valorPorSessao(Number(bruto.valor_combinado), Number(bruto.total_sessoes));
  });

  readonly ultimaSessao = computed<string | null>(() => {
    this.gatilho();
    const bruto = this.form.getRawValue();
    const total = Number(bruto.total_sessoes);
    if (!bruto.data_hora_inicio || total < 2) return null;

    const inicio = new Date(bruto.data_hora_inicio);
    if (Number.isNaN(inicio.getTime())) return null;

    return addSemanas(inicio, (total - 1) * Number(bruto.intervalo_semanas || 1)).toLocaleDateString(
      'pt-BR',
      { day: '2-digit', month: '2-digit', year: 'numeric' },
    );
  });

  async ngOnInit(): Promise<void> {
    await this.catalogo.garantirCarregado();

    const args = this.args();
    const profissionalId = this.isAdmin
      ? comoNumero(args['profissional_id'], this.auth.usuario()?.id ?? 0)
      : (this.auth.usuario()?.id ?? 0);

    this.form.patchValue({
      profissional_id: profissionalId,
      paciente_id: comoNumero(args['paciente_id']),
      servico_id: comoNumero(args['servico_id']),
      data_hora_inicio: paraDatetimeLocal(args['data_hora_inicio']),
      duracao_minutos: comoNumero(args['duracao_minutos'], 60),
      valor_combinado: comoNumero(args['valor_combinado']),
      recorrente: comoBooleano(args['recorrente']),
      pacote: comoBooleano(args['pacote']),
      total_sessoes: comoNumero(args['total_sessoes'], 10),
      intervalo_semanas: comoNumero(args['intervalo_semanas'], 1),
    });

    await this.carregarListas(profissionalId);
    this.aplicarServico(comoNumero(args['servico_id']), false);

    this.form.controls['profissional_id'].valueChanges.subscribe(async (id) => {
      this.form.controls['paciente_id'].setValue(0);
      this.form.controls['servico_id'].setValue(0);
      await this.carregarListas(Number(id));
    });

    this.form.controls['servico_id'].valueChanges.subscribe((id) => {
      this.aplicarServico(Number(id), true);
    });

    this.form.valueChanges.subscribe(() => {
      this.gatilho.update((n) => n + 1);
      this.emitir();
    });
    this.emitir();
  }

  private async carregarListas(profissionalId: number): Promise<void> {
    if (this.isAdmin && profissionalId > 0) {
      const { pacientes, servicos } = await this.catalogo.doProfissional(profissionalId);
      this.pacientes.set(pacientes);
      this.servicos.set(servicos);
      return;
    }
    this.pacientes.set(this.catalogo.pacientes());
    this.servicos.set(this.catalogo.servicos());
  }

  /**
   * `sobrescreverValor` é false na carga inicial: o valor sugerido pela IA (que
   * pode ser um desconto combinado) não deve ser substituído pela tabela.
   */
  private aplicarServico(servicoId: number, sobrescreverValor: boolean): void {
    const servico = this.servicos().find((s) => s.id === servicoId) ?? null;
    if (!servico) return;

    const valorAnterior = this.form.getRawValue().valor_combinado;
    aplicarRegrasDoServico(
      {
        recorrente: this.form.controls['recorrente'],
        pacote: this.form.controls['pacote'],
        valor_combinado: this.form.controls['valor_combinado'],
      },
      servico,
    );
    if (!sobrescreverValor && valorAnterior > 0) {
      this.form.controls['valor_combinado'].setValue(valorAnterior);
    }
    this.gatilho.update((n) => n + 1);
  }

  private emitir(): void {
    const bruto = this.form.getRawValue();
    const recorrente = bruto.recorrente === true;

    const saida: Record<string, unknown> = {
      paciente_id: Number(bruto.paciente_id),
      servico_id: Number(bruto.servico_id),
      data_hora_inicio: bruto.data_hora_inicio,
      duracao_minutos: Number(bruto.duracao_minutos),
      valor_combinado: Number(bruto.valor_combinado),
      recorrente,
      pacote: bruto.pacote === true,
      ...(recorrente
        ? {
            total_sessoes: Number(bruto.total_sessoes),
            intervalo_semanas: Number(bruto.intervalo_semanas),
          }
        : {}),
      ...(this.isAdmin && Number(bruto.profissional_id) > 0
        ? { profissional_id: Number(bruto.profissional_id) }
        : {}),
    };

    this.alterado.emit(saida);
    this.valido.emit(this.form.valid);
  }
}
