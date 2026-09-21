import { Component, input } from '@angular/core';

/**
 * Estado vazio: a mensagem que ocupa o lugar de uma lista sem itens.
 *
 *   <app-vazio mensagem="Nenhum paciente encontrado." />
 */
@Component({
  selector: 'app-vazio',
  standalone: true,
  template: `{{ mensagem() }}<ng-content />`,
  styleUrl: './vazio.component.css',
  host: { '[attr.data-espaco]': 'espaco()' },
})
export class VazioComponent {
  mensagem = input('');
  /** `apertado` para dentro de modais e painéis pequenos. */
  espaco = input<'padrao' | 'apertado'>('padrao');
}
