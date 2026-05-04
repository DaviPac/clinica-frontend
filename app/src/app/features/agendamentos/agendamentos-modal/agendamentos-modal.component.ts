import { Component, OnInit, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { AgendamentoDto, AgendamentoService, AgendamentoRecorrenteResponse } from '../../../core/services/agendamento/agendamento.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { ServicoService } from '../../../core/services/servico/servico.service';
import { Paciente } from '../../../core/models/paciente.model';
import { Servico } from '../../../core/models/servico.model';
import { toRFC3339Brasilia, addSemanas } from '../../../core/utils/data.utils';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';

interface Usuario {
  id: number;
  nome?: string;
  email: string;
}

interface FormRawValue {
  usuario_id: number;
  paciente_id: number;
  servico_id: number;
  data_hora_inicio: string;
  duracao_minutos: number;
  valor_combinado: number;
  recorrente: boolean;
  pacote: boolean;
  total_sessoes: number;
  intervalo_semanas: number;
}

@Component({
  selector: 'app-agendamentos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agendamentos-modal.component.html',
})
export class AgendamentosModalComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly agendamentoService = inject(AgendamentoService);
  private readonly pacienteService = inject(PacienteService);
  private readonly servicoService = inject(ServicoService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.authService.isAdmin();
  readonly fechar = output<void>();
  readonly salvo = output<void>();

  readonly pacientes = signal<Paciente[]>([]);
  readonly servicos = signal<Servico[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  readonly loading = signal(false);
  readonly erro = signal<string | null>(null);
  readonly totalSessoes = signal<number>(10);

  /** Serviço atualmente selecionado */
  readonly servicoSelecionado = signal<Servico | null>(null);

  /**
   * Valor por sessão exibido no campo.
   * - Pacote: valor_total / total_sessoes
   * - Normal: valor_combinado direto
   */
  readonly valorPorSessaoDisplay = computed<number | null>(() => {
    const servico = this.servicoSelecionado();
    if (!servico?.is_pacote) return null;
    const sessoes = this.totalSessoes();
    return sessoes > 0 ? servico.valor_atual / sessoes : null;
  });

  /** Preview da última sessão da série */
  readonly previewUltimaSessao = computed<string | null>(() => {
    const raw = this.form.getRawValue() as FormRawValue;
    const { recorrente, data_hora_inicio, total_sessoes, intervalo_semanas } = raw;
    if (!recorrente || !data_hora_inicio || total_sessoes < 2) return null;
    const inicio = new Date(data_hora_inicio);
    if (isNaN(inicio.getTime())) return null;
    const ultima = addSemanas(inicio, (total_sessoes - 1) * intervalo_semanas);
    return ultima.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  });

  get recorrente(): boolean { return this.form.controls['recorrente'].value as boolean; }
  get isPacote(): boolean    { return this.form.controls['pacote'].value as boolean; }

  /** Controle tipado para facilitar acesso no template */
  get ctrl(): FormGroup['controls'] { return this.form.controls; }

  readonly form: FormGroup = this.fb.nonNullable.group({
    usuario_id:        [this.authService.usuario()?.id ?? 0],
    paciente_id:       [0, [Validators.required, Validators.min(1)]],
    servico_id:        [0, [Validators.required, Validators.min(1)]],
    data_hora_inicio:  ['', Validators.required],
    duracao_minutos:   [60, [Validators.required, Validators.min(1)]],
    valor_combinado:   [0, [Validators.required, Validators.min(0.01)]],
    recorrente:        [false],
    pacote:            [false],
    total_sessoes:     [10],
    intervalo_semanas: [1],
  });

  constructor() {
    if (this.isAdmin) {
      this.ctrl['usuario_id'].addValidators([Validators.required, Validators.min(1)]);
    }
  }

  ngOnInit(): void {
    if (this.isAdmin) {
      this.usuarioService.listar().subscribe((u: Usuario[]) => this.usuarios.set(u));

      this.ctrl['usuario_id'].valueChanges.subscribe((id: number) => {
        this.ctrl['paciente_id'].setValue(0);
        if (id) {
          this.pacienteService.listar(false, false, id.toString()).subscribe(p => this.pacientes.set(p));
          this.servicoService.listar({ profissionalId: id, incluirInativos: true }).subscribe(s => this.servicos.set(s))
        } else {
          this.pacientes.set([]);
          this.servicos.set([]);
        }
      });

      const initialId = this.ctrl['usuario_id'].value as number;
      if (initialId) {
        this.pacienteService.listar(false, false, initialId.toString()).subscribe(p => this.pacientes.set(p));
        this.servicoService.listar({ profissionalId: initialId, incluirInativos: true }).subscribe(s => this.servicos.set(s))
      }
    } else {
      this.pacienteService.listar().subscribe(p => this.pacientes.set(p));
      this.servicoService.listar().subscribe(s => this.servicos.set(s))
    }

    this.ctrl['total_sessoes'].valueChanges.subscribe((v: number) => {
      this.totalSessoes.set(v);
    });

    this.ctrl['servico_id'].valueChanges.subscribe((id: number) => {
      const servico = this.servicos().find(sv => sv.id === +id) ?? null;
      this.servicoSelecionado.set(servico);

      if (!servico) return;

      if (servico.is_pacote) {
        // Pacote: força recorrente, marca pacote, pré-preenche sessões se disponível
        this.ctrl['recorrente'].setValue(true);
        this.ctrl['pacote'].setValue(true);
        this.ctrl['recorrente'].disable();

        // valor_combinado = valor total do pacote (backend espera o total)
        this.ctrl['valor_combinado'].setValue(servico.valor_atual);
      } else {
        // Serviço avulso: libera recorrente, limpa pacote
        this.ctrl['recorrente'].enable();
        this.ctrl['recorrente'].setValue(false);
        this.ctrl['pacote'].setValue(false);
        this.ctrl['valor_combinado'].setValue(servico.valor_atual);
      }
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);

    const raw = this.form.getRawValue() as FormRawValue;

    const dto: AgendamentoDto = {
      paciente_id:      Number(raw.paciente_id),
      servico_id:       Number(raw.servico_id),
      data_hora_inicio: toRFC3339Brasilia(new Date(raw.data_hora_inicio)),
      duracao_minutos:  raw.duracao_minutos,
      valor_combinado:  raw.valor_combinado,
      recorrente:       raw.recorrente,
      pacote:           raw.pacote,
      ...(raw.recorrente ? {
        total_sessoes:     raw.total_sessoes,
        intervalo_semanas: raw.intervalo_semanas,
      } : {}),
    };

    const profissionalID: string | undefined =
      this.isAdmin && raw.usuario_id ? raw.usuario_id.toString() : undefined;

    this.agendamentoService.criar(dto, profissionalID).subscribe({
      next: () => this.salvo.emit(),
      error: (err: Error) => {
        const msg = err.message.toLowerCase().includes('conflito')
          ? 'Conflito de horário com outro agendamento. Escolha outro horário.'
          : err.message;
        this.erro.set(msg);
        this.loading.set(false);
      },
    });
  }
}