import { Component, OnInit, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { ServicoService } from '../../../core/services/servico/servico.service';
import { Paciente } from '../../../core/models/paciente.model';
import { Servico } from '../../../core/models/servico.model';
import { toRFC3339Brasilia, addSemanas } from '../../../core/utils/data.utils';

@Component({
  selector: 'app-agendamentos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agendamentos-modal.component.html',
})
export class AgendamentosModalComponent implements OnInit {
  fechar = output<void>();
  salvo = output<void>();

  pacientes = signal<Paciente[]>([]);
  servicos = signal<Servico[]>([]);
  loading = signal(false);
  erro = signal<string | null>(null);

  form: FormGroup;

  // Preview da última sessão da série
  previewUltimaSessao = computed(() => {
    const { recorrente, data_hora_inicio, total_sessoes, intervalo_semanas } = this.form.getRawValue();
    if (!recorrente || !data_hora_inicio || total_sessoes < 2) return null;
    const inicio = new Date(data_hora_inicio);
    if (isNaN(inicio.getTime())) return null;
    const ultima = addSemanas(inicio, (total_sessoes - 1) * intervalo_semanas);
    return ultima.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  });

  get recorrente() { return this.form.controls['recorrente'].value; }

  constructor(
    private fb: FormBuilder,
    private agendamentoService: AgendamentoService,
    private pacienteService: PacienteService,
    private servicoService: ServicoService,
  ) {
    this.form = this.fb.nonNullable.group({
      paciente_id: [0, [Validators.required, Validators.min(1)]],
      servico_id:  [0, [Validators.required, Validators.min(1)]],
      data_hora_inicio: ['', Validators.required],
      data_hora_fim:    ['', Validators.required],
      valor_combinado:  [0, [Validators.required, Validators.min(0.01)]],
      recorrente:       [false],
      total_sessoes:    [10],
      intervalo_semanas:[1],
    });
  }

  ngOnInit() {
    this.pacienteService.listar().subscribe(p => this.pacientes.set(p));
    this.servicoService.listar().subscribe(s => this.servicos.set(s));

    // Ao selecionar um serviço, pré-preenche o valor combinado
    this.form.controls['servico_id'].valueChanges.subscribe(id => {
      const s = this.servicos().find(sv => sv.id === +id);
      if (s) this.form.controls['valor_combinado'].setValue(s.valor_atual);
    });
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);

    const raw = this.form.getRawValue();

    // Converte datetime-local (sem timezone) para RFC3339 com -03:00
    const inicio = new Date(raw.data_hora_inicio);
    const fim    = new Date(raw.data_hora_fim);

    if (fim <= inicio) {
      this.erro.set('O horário de fim deve ser após o início.');
      this.loading.set(false);
      return;
    }

    const dto = {
      paciente_id: Number(raw.paciente_id),
      servico_id:  Number(raw.servico_id),
      data_hora_inicio: toRFC3339Brasilia(inicio),
      data_hora_fim:    toRFC3339Brasilia(fim),
      valor_combinado:  raw.valor_combinado,
      recorrente: raw.recorrente,
      ...(raw.recorrente ? {
        total_sessoes:     raw.total_sessoes,
        intervalo_semanas: raw.intervalo_semanas,
      } : {}),
    };

    this.agendamentoService.criar(dto).subscribe({
      next: () => this.salvo.emit(),
      error: (err: Error) => {
        // Trata 409 Conflict com mensagem amigável
        const msg = err.message.toLowerCase().includes('conflito')
          ? 'Conflito de horário com outro agendamento. Escolha outro horário.'
          : err.message;
        this.erro.set(msg);
        this.loading.set(false);
      },
    });
  }
}