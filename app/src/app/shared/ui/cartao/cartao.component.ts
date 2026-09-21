import { Component, input } from '@angular/core';

export type EspacoCartao = 'padrao' | 'compacto' | 'solto';

/**
 * Superfície de conteúdo: fundo, borda e cantos arredondados.
 * Com `titulo`, já desenha o cabeçalho da seção.
 *
 *   <app-cartao titulo="Alterar senha" subtitulo="Mínimo 6 caracteres">…</app-cartao>
 */
@Component({
  selector: 'app-cartao',
  standalone: true,
  templateUrl: './cartao.component.html',
  styleUrl: './cartao.component.css',
  host: { '[attr.data-espaco]': 'espaco()' },
})
export class CartaoComponent {
  titulo = input('');
  subtitulo = input('');
  espaco = input<EspacoCartao>('padrao');
}
