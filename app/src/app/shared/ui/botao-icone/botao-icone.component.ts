import { Component, input } from '@angular/core';

/**
 * Botão quadrado só com ícone: fechar, editar, filtrar.
 * Fundo transparente até o hover.
 *
 *   <button appBotaoIcone aria-label="Fechar" (click)="fechar()">×</button>
 */
@Component({
  selector: 'button[appBotaoIcone]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './botao-icone.component.css',
  host: { '[attr.data-tamanho]': 'tamanho()' },
})
export class BotaoIconeComponent {
  tamanho = input<'p' | 'm' | 'g'>('m');
}
