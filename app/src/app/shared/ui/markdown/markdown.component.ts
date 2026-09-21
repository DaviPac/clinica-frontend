import { Component, ViewEncapsulation, input } from '@angular/core';
import { MarkdownPipe } from '../../markdown/markdown.pipe';

/**
 * Renderiza a resposta do assistente.
 *
 * Usa `ViewEncapsulation.None` porque o HTML é criado em runtime pelo `marked`
 * e injetado por `[innerHTML]` — encapsulação emulada não alcança esse DOM.
 * Em troca, TODO seletor deste arquivo fica aninhado sob `.md`, para os estilos
 * não escaparem para o resto da aplicação.
 */
@Component({
  selector: 'app-markdown',
  standalone: true,
  imports: [MarkdownPipe],
  template: `<div class="md" [innerHTML]="texto() | markdown"></div>`,
  styleUrl: './markdown.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class MarkdownComponent {
  texto = input('');
}
