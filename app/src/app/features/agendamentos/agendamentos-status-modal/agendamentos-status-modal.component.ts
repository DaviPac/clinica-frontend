import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

const TRANSICOES: Record<StatusAgendamento, StatusAgendamento[]> = {
  AGENDADO:  ['REALIZADO', 'FALTA', 'CANCELADO'],
  REALIZADO: ['AGENDADO'],
  FALTA:     ['AGENDADO', 'CANCELADO'],
  CANCELADO: [],
};

@Component({
  selector: 'app-agendamentos-status-modal',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './agendamentos-status-modal.component.html',
})
export class AgendamentosStatusModalComponent {
  agendamento = input.required<Agendamento>();
  fechar = output<void>();
  atualizado = output<{ id: number; status: StatusAgendamento }>();

  loading = signal<StatusAgendamento | null>(null);
  erro = signal<string | null>(null);

  get opcoes(): StatusAgendamento[] {
    return TRANSICOES[this.agendamento().status] ?? [];
  }

  readonly labels: Record<StatusAgendamento, string> = {
    AGENDADO:  'Marcar como Agendado',
    REALIZADO: 'Marcar como Realizado',
    FALTA:     'Registrar Falta',
    CANCELADO: 'Cancelar sessão',
  };

  readonly btnClass: Record<StatusAgendamento, string> = {
    AGENDADO:  'border-blue-200 text-blue-800 hover:bg-blue-50',
    REALIZADO: 'border-teal-200 text-teal-800 hover:bg-teal-50',
    FALTA:     'border-amber-200 text-amber-800 hover:bg-amber-50',
    CANCELADO: 'border-red-200 text-red-700 hover:bg-red-50',
  };

  constructor(private service: AgendamentoService) {}

  selecionar(status: StatusAgendamento) {
    this.loading.set(status);
    this.erro.set(null);

    this.service.atualizarStatus(this.agendamento().id, status).subscribe({
      next: () => this.atualizado.emit({ id: this.agendamento().id, status }),
      error: (err: Error) => {
        this.erro.set(err.message);
        this.loading.set(null);
      },
    });
  }
}