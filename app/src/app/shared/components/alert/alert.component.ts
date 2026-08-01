import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertVariant = 'error' | 'success' | 'info';

/** Banner de feedback (erro/sucesso/info) com ícone, usado no topo das telas e modais. */
@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      role="alert"
      class="flex items-start gap-2 px-4 py-3 border text-xs rounded-xl"
      [ngClass]="{
        'bg-red-50 border-red-100 text-red-700': variant() === 'error',
        'bg-teal-50 border-teal-100 text-teal-800': variant() === 'success',
        'bg-brand-50 border-brand-200 text-brand-800': variant() === 'info'
      }">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0 mt-px">
        @if (variant() === 'success') {
          <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        } @else {
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
          <path d="M7 4v3M7 9.5h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        }
      </svg>
      <div class="min-w-0 leading-relaxed"><ng-content /></div>
    </div>
  `,
})
export class AlertComponent {
  variant = input<AlertVariant>('error');
}
