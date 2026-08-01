import { Component, HostListener, input, output } from '@angular/core';

/**
 * Shell de modal reutilizável.
 * - Desktop: caixa centralizada; Mobile: bottom-sheet ocupando a largura toda.
 * - Fecha ao clicar no backdrop, no botão × ou com Esc.
 * - Conteúdo rola internamente (max-h) — nunca estoura a viewport.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="titulo()"
      (click)="fechar.emit()">

      <div
        class="bg-white w-full rounded-t-2xl sm:rounded-xl border border-gray-200 shadow-xl
               max-h-[92dvh] overflow-y-auto p-5 sm:p-7 {{ maxWidth() }}"
        (click)="$event.stopPropagation()">

        <div class="flex items-center justify-between gap-4 mb-6">
          <h2 class="text-base font-medium text-gray-900">{{ titulo() }}</h2>
          <button
            type="button"
            aria-label="Fechar"
            (click)="fechar.emit()"
            class="w-8 h-8 -mr-2 flex items-center justify-center rounded-lg text-gray-400
                   hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer
                   bg-transparent border-none text-xl leading-none shrink-0">×</button>
        </div>

        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  titulo = input('');
  /** Classe Tailwind de largura máxima aplicada à caixa (desktop). */
  maxWidth = input('max-w-md');
  fechar = output<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.fechar.emit(); }
}
