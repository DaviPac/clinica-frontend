import { Component, input } from '@angular/core';

export type TomKpi = 'neutro' | 'aviso' | 'perigo' | 'destaque' | 'sucesso';

/**
 * Cartão de indicador do dashboard: ícone à esquerda, rótulo, número e
 * um detalhe abaixo. O ícone é projetado porque cada indicador tem o seu.
 *
 *   <app-kpi rotulo="Pendentes" [valor]="5" detalhe="sem confirmar status"
 *            tom="aviso" [alerta]="true"><svg …/></app-kpi>
 */
@Component({
  selector: 'app-kpi',
  standalone: true,
  templateUrl: './kpi.component.html',
  styleUrl: './kpi.component.css',
  host: {
    '[attr.data-tom]': 'tom()',
    '[attr.data-alerta]': 'alerta() ? "sim" : null',
    '[attr.data-tamanho]': 'tamanho()',
  },
})
export class KpiComponent {
  readonly rotulo = input.required<string>();
  readonly valor = input.required<string | number>();
  readonly detalhe = input('');
  readonly tom = input<TomKpi>('neutro');
  /** Realça a borda do cartão quando há algo a resolver. */
  readonly alerta = input(false);
  /** `medio` é o valor em texto (dinheiro, rótulos); `grande`, a contagem. */
  readonly tamanho = input<'grande' | 'medio'>('grande');
  /** Números alinham melhor com largura tabular. */
  readonly tabular = input(true);
}
