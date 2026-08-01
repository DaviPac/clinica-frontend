import { Component, HostListener, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ConfirmVariant = 'primary' | 'danger' | 'success';

/**
 * Diálogo de confirmação reutilizável.
 * Conteúdo extra (valores, avisos) pode ser projetado via <ng-content>.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-label]="titulo()"
      (click)="cancelar.emit()">

      <div
        class="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-gray-100 shadow-xl
               max-h-[92dvh] overflow-y-auto p-6 flex flex-col gap-4"
        (click)="$event.stopPropagation()">

        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
            [ngClass]="{
              'bg-red-50 border-red-100 text-red-500': variant() === 'danger',
              'bg-brand-100 border-brand-200 text-brand-700': variant() === 'primary',
              'bg-teal-50 border-teal-100 text-teal-600': variant() === 'success'
            }">
            @if (variant() === 'danger') {
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 7v4.5M10 14h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <path d="M8.257 2.906h3.486a1 1 0 0 1 .857.486l7 11.5A1 1 0 0 1 18.743 16H1.257a1 1 0 0 1-.857-1.514l7-11.5a1 1 0 0 1 .857-.48Z" stroke="currentColor" stroke-width="1.4"/>
              </svg>
            } @else if (variant() === 'success') {
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4.5 4.5L16 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            } @else {
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 9v4M10 6.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            }
          </div>

          <div class="min-w-0 pt-1">
            <h2 class="text-sm font-semibold text-gray-900">{{ titulo() }}</h2>
            @if (mensagem()) {
              <p class="text-xs text-gray-500 leading-relaxed mt-1.5">{{ mensagem() }}</p>
            }
          </div>
        </div>

        <ng-content />

        <div class="flex gap-2.5">
          <button
            type="button"
            (click)="cancelar.emit()"
            [disabled]="loading()"
            class="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs font-medium text-gray-700
                   hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            (click)="confirmar.emit()"
            [disabled]="loading()"
            class="flex-1 rounded-xl py-2.5 text-xs font-semibold text-white transition-colors
                   cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            [ngClass]="{
              'bg-red-500 hover:bg-red-600': variant() === 'danger',
              'bg-brand-400 hover:bg-brand-500': variant() === 'primary',
              'bg-teal-600 hover:bg-teal-700': variant() === 'success'
            }">
            {{ loading() ? loadingLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  titulo = input.required<string>();
  mensagem = input('');
  confirmLabel = input('Confirmar');
  cancelLabel = input('Cancelar');
  loadingLabel = input('Salvando...');
  variant = input<ConfirmVariant>('primary');
  loading = input(false);

  confirmar = output<void>();
  cancelar = output<void>();

  @HostListener('document:keydown.escape')
  onEsc() { if (!this.loading()) this.cancelar.emit(); }
}
