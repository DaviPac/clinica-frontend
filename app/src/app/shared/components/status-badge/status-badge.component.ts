import { Component, input } from '@angular/core';
import { StatusAgendamento } from '../../../core/models/agendamento.model';
import { SeloComponent, TomSelo } from '../../ui/selo/selo.component';

const CONFIG: Record<StatusAgendamento, { label: string; tom: TomSelo }> = {
  AGENDADO:  { label: 'Agendado',  tom: 'info' },
  REALIZADO: { label: 'Realizado', tom: 'sucesso' },
  FALTA:     { label: 'Falta',     tom: 'aviso' },
  CANCELADO: { label: 'Cancelado', tom: 'perigo' },
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
