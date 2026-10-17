import { Component, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { BotaoIconeComponent } from '../../ui/botao-icone/botao-icone.component';

/**
 * Casco visual de um diálogo aberto pelo `DialogoService`.
 * Cabeçalho com título e ×, corpo rolável e rodapé opcional — tudo que
 * levar o atributo `rodape` vai para a barra de ações, alinhada à direita:
 *
 *   <app-dialogo titulo="Novo serviço">
 *     <form>...</form>
 *     <button rodape appBotao variante="contorno" (click)="ref.close()">Cancelar</button>
 *     <button rodape appBotao (click)="salvar()">Salvar</button>
 *   </app-dialogo>
 *
 * O × fecha o `DialogRef` sem resultado. Ele fica fora da ordem de tabulação
 * para o foco inicial cair no primeiro campo; Esc continua fechando.
 */
@Component({
  selector: 'app-dialogo',
  standalone: true,
  imports: [BotaoIconeComponent],
  templateUrl: './dialogo.component.html',
  styleUrl: './dialogo.component.css',
})
export class DialogoComponent {
  private readonly ref = inject(DialogRef, { optional: true });

  titulo = input('');
  ocultarFechar = input(false);

  fechar() {
    this.ref?.close();
  }
}
