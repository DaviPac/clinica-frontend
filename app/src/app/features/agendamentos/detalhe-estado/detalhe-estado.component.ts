import { Component, input } from '@angular/core';
import { StatusAgendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

/** Andamento e situação de pagamento de um agendamento, lado a lado. */
@Component({
  selector: 'app-detalhe-estado',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './detalhe-estado.component.html',
  styleUrl: './detalhe-estado.component.css',
})
export class DetalheEstadoComponent {
  readonly status = input.required<StatusAgendamento>();
  readonly pago = input(false);
}
