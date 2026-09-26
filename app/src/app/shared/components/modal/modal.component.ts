import { Component, HostListener, input, output } from '@angular/core';
import { BotaoIconeComponent } from '../../ui/botao-icone/botao-icone.component';

export type TamanhoModal = 'pequeno' | 'medio';

/**
 * Shell de modal reutilizável.
 * - Desktop: caixa centralizada; Mobile: bottom-sheet ocupando a largura toda.
 * - Fecha ao clicar no backdrop, no botão × ou com Esc.
 * - Conteúdo rola internamente (max-height) — nunca estoura a viewport.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [BotaoIconeComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  host: { '[attr.data-tamanho]': 'tamanho()' },
})
export class ModalComponent {
  titulo = input('');
  tamanho = input<TamanhoModal>('medio');
  fechar = output<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.fechar.emit(); }
}
