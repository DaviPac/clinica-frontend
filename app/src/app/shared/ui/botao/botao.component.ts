import { Component, input } from '@angular/core';

export type VarianteBotao = 'primario' | 'contorno' | 'perigo';
export type TamanhoBotao = 'pequeno' | 'padrao' | 'grande';

/**
 * Botão da aplicação.
 *
 * É um componente de atributo, não um wrapper: aplicado sobre um <button>
 * nativo, ele traz o CSS junto sem tirar `type="submit"`, `disabled`,
 * `formControlName` nem o comportamento de foco do elemento original.
 *
 *   <button appBotao variante="primario" type="submit">Salvar</button>
 */
@Component({
  selector: 'button[appBotao]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './botao.component.css',
  host: {
    '[attr.data-variante]': 'variante()',
    '[attr.data-tamanho]': 'tamanho()',
    '[attr.data-largura]': 'larguraTotal() ? "total" : null',
  },
})
export class BotaoComponent {
  variante = input<VarianteBotao>('primario');
  tamanho = input<TamanhoBotao>('padrao');
  /** Ocupa a linha inteira — usado em modais e no mobile. */
  larguraTotal = input(false);
}
