import { Component, input } from '@angular/core';

/**
 * Par rótulo + valor, o bloco que descreve um dado numa ficha.
 *
 *   <app-item-descricao rotulo="Profissão">Fisioterapeuta</app-item-descricao>
 */
@Component({
  selector: 'app-item-descricao',
  standalone: true,
  templateUrl: './item-descricao.component.html',
  styleUrl: './item-descricao.component.css',
  host: { '[attr.data-fonte]': 'mono() ? "mono" : null' },
})
export class ItemDescricaoComponent {
  rotulo = input('');
  /** Valores numéricos alinham melhor em fonte monoespaçada. */
  mono = input(false);
}
