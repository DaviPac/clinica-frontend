import { Component, input } from '@angular/core';

/**
 * Faixa de valor em destaque dentro de diálogos de confirmação.
 *
 *   <app-destaque-valor rotulo="Valor total do pacote" valor="R$ 1.500" tom="teal" />
 */
@Component({
  selector: 'app-destaque-valor',
  standalone: true,
  templateUrl: './destaque-valor.component.html',
  styleUrl: './destaque-valor.component.css',
  host: { '[attr.data-tom]': 'tom()' },
})
export class DestaqueValorComponent {
  rotulo = input('');
  valor = input<string | number>('');
  tom = input<'sucesso' | 'destaque' | 'neutro'>('neutro');
}
