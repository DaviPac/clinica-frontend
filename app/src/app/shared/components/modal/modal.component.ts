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
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  titulo = input('');
  /** Classe Tailwind de largura máxima aplicada à caixa (desktop). */
  maxWidth = input('max-w-md');
  fechar = output<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.fechar.emit(); }
}
