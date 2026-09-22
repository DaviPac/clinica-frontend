import { Component, input } from '@angular/core';

/**
 * Bloco de número: rótulo em cima, valor em destaque, detalhe embaixo.
 *
 *   <app-estatistica rotulo="Sessões" valor="12" detalhe="Total R$ 1.200" />
 */
@Component({
  selector: 'app-estatistica',
  standalone: true,
  templateUrl: './estatistica.component.html',
  styleUrl: './estatistica.component.css',
  host: { '[attr.data-superficie]': 'superficie()', '[attr.data-fonte]': 'mono() ? "mono" : null' },
})
export class EstatisticaComponent {
  rotulo = input('');
  valor = input<string | number>('');
  detalhe = input('');
  /** `cartao` desenha borda em vez do fundo suave. */
  superficie = input<'suave' | 'cartao'>('suave');
  /** Números alinham melhor em monoespaçada; textos, não. */
  mono = input(true);
}
