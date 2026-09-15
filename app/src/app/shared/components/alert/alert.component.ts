import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertVariant = 'error' | 'success' | 'info';

/** Banner de feedback (erro/sucesso/info) com ícone, usado no topo das telas e modais. */
@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
})
export class AlertComponent {
  variant = input<AlertVariant>('error');
}
