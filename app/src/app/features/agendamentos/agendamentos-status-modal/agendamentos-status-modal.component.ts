import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { transicoesPermitidas } from '../agendamento.regras';

@Component({
  selector: 'app-agendamentos-status-modal',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, ModalComponent, AlertComponent],
  templateUrl: './agendamentos-status-modal.component.html',
  styleUrl: './agendamentos-status-modal.component.css',
})
export class AgendamentosStatusModalComponent {
  agendamento = input.required<Agendamento>();
  fechar = output<void>();
  atualizado = output<{ id: number; status: StatusAgendamento }>();

  loading = signal<StatusAgendamento | null>(null);
  erro = signal<string | null>(null);

  get opcoes(): StatusAgendamento[] {
    return transicoesPermitidas(this.agendamento().status);
  }

  readonly labels: Record<StatusAgendamento, string> = {
    AGENDADO:  'Marcar como Agendado',
    REALIZADO: 'Marcar como Realizado',
    FALTA:     'Registrar Falta',
    CANCELADO: 'Cancelar sessão',
  };

  readonly btnClass: Record<StatusAgendamento, string> = {
    AGENDADO:  'status__opcao--agendado',
    REALIZADO: 'status__opcao--realizado',
    FALTA:     'status__opcao--falta',
    CANCELADO: 'status__opcao--cancelado',
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