import { Component, input } from '@angular/core';

export type TomSelo =
  | 'azul' | 'teal' | 'ambar' | 'vermelho' | 'violeta' | 'roxo' | 'verde' | 'cinza' | 'marca';
export type FormatoSelo = 'retangular' | 'pilula';

/**
 * Etiqueta curta de estado ou categoria.
 *
 *   <app-selo tom="teal">Ativo</app-selo>
 */
@Component({
  selector: 'app-selo',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './selo.component.css',
  host: {
    '[attr.data-tom]': 'tom()',
    '[attr.data-formato]': 'formato()',
    '[attr.data-anel]': 'anel() ? "sim" : null',
  },
})
export class SeloComponent {
  tom = input<TomSelo>('cinza');
  formato = input<FormatoSelo>('retangular');
  /** Contorno interno suave, usado nas tabelas do relatório. */
  anel = input(false);
}
