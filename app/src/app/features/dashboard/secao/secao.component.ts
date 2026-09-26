import { Component, input } from '@angular/core';

export type TomSecao = 'marca' | 'aviso' | 'perigo' | 'destaque';

/**
 * Bloco do dashboard: superfície com um cabeçalho marcado por uma barrinha
 * colorida, um contador ou ação à direita e uma nota logo abaixo.
 *
 * O que vai à direita do título entra pelo slot `acao`.
 */
@Component({
  selector: 'app-secao-dashboard',
  standalone: true,
  templateUrl: './secao.component.html',
  styleUrl: './secao.component.css',
  host: { '[attr.data-tom]': 'tom()' },
})
export class SecaoDashboardComponent {
  readonly titulo = input('');
  readonly tom = input<TomSecao>('marca');
  readonly contador = input<number | null>(null);
  readonly nota = input('');
}
