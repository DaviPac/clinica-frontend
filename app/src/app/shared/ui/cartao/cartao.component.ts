import { Component, input } from '@angular/core';

export type EspacoCartao = 'padrao' | 'compacto' | 'solto';
export type EspacoTitulo = 'compacto' | 'padrao' | 'solto';

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
  host: { '[attr.data-espaco]': 'espaco()', '[attr.data-espaco-titulo]': 'espacoTitulo()' },
})
export class CartaoComponent {
  titulo = input('');
  subtitulo = input('');
  espaco = input<EspacoCartao>('padrao');
  /** Respiro entre o cabeçalho e o conteúdo. */
  espacoTitulo = input<EspacoTitulo>('padrao');
}
