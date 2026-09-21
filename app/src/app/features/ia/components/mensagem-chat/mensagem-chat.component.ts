import { Component, input, signal } from '@angular/core';
import { MensagemTexto } from '../../../../core/ia/models/chat.model';
import { MarkdownComponent } from '../../../../shared/ui/markdown/markdown.component';

/**
 * Bolha de mensagem.
 *
 * A do usuário é interpolada (nunca innerHTML). A do assistente passa pelo pipe
 * de markdown, que sanitiza antes — e vai sem bolha, em texto corrido, como nos
 * assistentes de referência.
 */
@Component({
  selector: 'app-mensagem-chat',
  standalone: true,
  imports: [MarkdownComponent],
  templateUrl: './mensagem-chat.component.html',
  styleUrl: './mensagem-chat.component.css',
})
export class MensagemChatComponent {
  readonly mensagem = input.required<MensagemTexto>();
  readonly copiado = signal(false);

  async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Clipboard bloqueado (contexto inseguro) — silencioso, não é crítico.
    }
  }
}
