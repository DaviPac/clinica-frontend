import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusAgendamento } from '../../../core/models/agendamento.model';

const CONFIG: Record<StatusAgendamento, { label: string; classes: string }> = {
  AGENDADO:  { label: 'Agendado',  classes: 'bg-blue-50 text-blue-800' },
  REALIZADO: { label: 'Realizado', classes: 'bg-teal-50 text-teal-800' },
  FALTA:     { label: 'Falta',     classes: 'bg-amber-50 text-amber-800' },
  CANCELADO: { label: 'Cancelado', classes: 'bg-red-50 text-red-800' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="text-xs font-medium px-2 py-0.5 rounded {{ config.classes }}">
      {{ config.label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  status = input.required<StatusAgendamento>();
  get config() { return CONFIG[this.status()]; }
}