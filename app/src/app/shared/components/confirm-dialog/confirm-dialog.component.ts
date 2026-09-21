import { Component, HostListener, input, output } from '@angular/core';

export type ConfirmVariant = 'primary' | 'danger' | 'success';

/**
 * Diálogo de confirmação reutilizável.
 * Conteúdo extra (valores, avisos) pode ser projetado via <ng-content>.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  host: { '[attr.data-variante]': 'variant()' },
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
