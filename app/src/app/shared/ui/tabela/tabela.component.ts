import { Component, ViewEncapsulation, input } from '@angular/core';

/**
 * Caixa de tabela: borda arredondada, fundo de superfície e rolagem
 * horizontal no mobile.
 *
 * Usa `ViewEncapsulation.None` porque a `<table>` é projetada e portanto
 * pertence ao escopo de quem chama — sem isso, o cabeçalho e o respiro das
 * células teriam que ser recopiados nas seis telas de listagem. Em troca,
 * todo seletor deste arquivo começa em `.tabela`.
 *
 * Fica de fora de propósito: a cor das linhas e a largura das colunas, que
 * mudam de tela para tela e vivem no CSS de cada uma.
 *
 *   <app-tabela [larguraMinima]="640">
 *     <table>…</table>
 *   </app-tabela>
 */
@Component({
  selector: 'app-tabela',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './tabela.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'tabela',
    '[style.--tabela-largura-minima.px]': 'larguraMinima() || null',
  },
})
export class TabelaComponent {
  /** Largura mínima da tabela, em px — abaixo disso a caixa rola. */
  larguraMinima = input(0);
}
