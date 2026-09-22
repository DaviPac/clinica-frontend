import { Component, input } from '@angular/core';

export type TomSelo =
  'neutro' | 'marca' | 'info' | 'sucesso' | 'aviso' | 'perigo' | 'destaque';
export type FormatoSelo = 'retangular' | 'pilula';
export type TamanhoSelo = 'padrao' | 'miudo';

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
    '[attr.data-tamanho]': 'tamanho()',
    '[attr.data-anel]': 'anel() ? "sim" : null',
  },
})
export class SeloComponent {
  tom = input<TomSelo>('neutro');
  formato = input<FormatoSelo>('retangular');
  /** `miudo` é o selo das tabelas densas do relatório. */
  tamanho = input<TamanhoSelo>('padrao');
  /** Contorno interno suave, usado nas tabelas do relatório. */
  anel = input(false);
}
