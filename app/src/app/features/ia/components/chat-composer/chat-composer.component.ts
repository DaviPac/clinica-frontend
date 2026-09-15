import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  templateUrl: './chat-composer.component.html',
})
export class ChatComposerComponent {
  readonly ocupado = input(false);
  readonly aguardandoConfirmacao = input(false);

  readonly enviar = output<string>();
  readonly parar = output<void>();

  private readonly entrada = viewChild<ElementRef<HTMLTextAreaElement>>('entrada');
  readonly texto = signal('');

  bloqueado(): boolean {
    return this.ocupado() || this.aguardandoConfirmacao();
  }

  placeholder(): string {
    if (this.aguardandoConfirmacao()) return 'Confirme ou cancele a ação acima para continuar';
    if (this.ocupado()) return 'Gerando resposta…';
    return 'Pergunte algo ou peça uma ação…';
  }

  aoDigitar(evento: Event): void {
    const el = evento.target as HTMLTextAreaElement;
    this.texto.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  /**
   * `isComposing` é essencial num teclado pt-BR: sem ele, o Enter que confirma
   * um acento (´ + a) enviaria a mensagem no meio da palavra.
   */
  aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      this.enviarTexto();
    }
  }

  enviarTexto(): void {
    const conteudo = this.texto().trim();
    if (!conteudo || this.bloqueado()) return;

    this.enviar.emit(conteudo);
    this.texto.set('');

    const el = this.entrada()?.nativeElement;
    if (el) {
      el.style.height = 'auto';
      el.focus();
    }
  }
}
