import { Component, input } from '@angular/core';
import { StatusAgendamento } from '../../../core/models/agendamento.model';
import { SeloComponent, TomSelo } from '../../ui/selo/selo.component';

const CONFIG: Record<StatusAgendamento, { label: string; tom: TomSelo }> = {
  AGENDADO:  { label: 'Agendado',  tom: 'azul' },
  REALIZADO: { label: 'Realizado', tom: 'teal' },
  FALTA:     { label: 'Falta',     tom: 'ambar' },
  CANCELADO: { label: 'Cancelado', tom: 'vermelho' },
};

/** Selo de status de agendamento — mapeia o status para o tom do <app-selo>. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [SeloComponent],
  templateUrl: './status-badge.component.html',
})
export class StatusBadgeComponent {
  status = input.required<StatusAgendamento>();
  get config() { return CONFIG[this.status()]; }
}
