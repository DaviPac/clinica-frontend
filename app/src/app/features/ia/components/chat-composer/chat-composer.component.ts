import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  template: `
    <div class="px-4 sm:px-6 py-3">
      <div class="mx-auto w-full max-w-3xl">
        <div
          class="flex items-end gap-2 border border-stone-200 rounded-2xl bg-white px-3 py-2
                 focus-within:ring-2 focus-within:ring-brand-400 transition-shadow">
          <textarea
            #entrada
            rows="1"
            [value]="texto()"
            [disabled]="bloqueado()"
            [placeholder]="placeholder()"
            (input)="aoDigitar($event)"
            (keydown)="aoTeclar($event)"
            class="flex-1 resize-none bg-transparent border-none outline-none text-sm
                   text-stone-900 placeholder:text-stone-400 py-1.5 max-h-[200px]
                   disabled:opacity-60"></textarea>

          @if (ocupado()) {
            <button
              type="button"
              (click)="parar.emit()"
              aria-label="Parar geração"
              class="shrink-0 w-8 h-8 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700
                     flex items-center justify-center cursor-pointer border-none transition-colors">
              <span class="block w-2.5 h-2.5 bg-current rounded-[2px]"></span>
            </button>
          } @else {
            <button
              type="button"
              (click)="enviarTexto()"
              [disabled]="!texto().trim() || bloqueado()"
              aria-label="Enviar mensagem"
              class="shrink-0 w-8 h-8 rounded-lg bg-brand-400 hover:bg-brand-500 text-white
                     flex items-center justify-center cursor-pointer border-none transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          }
        </div>

        <p class="mt-1.5 text-center text-[11px] text-stone-400">
          @if (aguardandoConfirmacao()) {
            Há uma ação aguardando sua confirmação acima.
          } @else {
            O assistente pede sua confirmação antes de qualquer alteração.
          }
        </p>
      </div>
    </div>
  `,
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
