import { Component, input } from '@angular/core';

export type AlertVariant = 'error' | 'success' | 'info';

/** Banner de feedback (erro/sucesso/info) com ícone, usado no topo das telas e modais. */
@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.css',
  host: {
    role: 'alert',
    '[attr.data-variante]': 'variant()',
  },
})
export class AlertComponent {
  variant = input<AlertVariant>('error');
}
