import { Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'escuro';

const STORAGE_KEY = 'tema';

/**
 * Tema visual da aplicação.
 *
 * O tema ativo vive no atributo `data-theme` do <html>; o CSS faz o resto
 * (veja `styles/tokens.css`). Na primeira visita seguimos a preferência do
 * sistema operacional; a partir da primeira escolha manual, vale o que
 * ficou salvo no localStorage.
 *
 * O `index.html` aplica o mesmo atributo num script inline antes da
 * aplicação subir, para não haver flash do tema errado.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly _tema = signal<Tema>(this.temaInicial());

  readonly tema = this._tema.asReadonly();

  constructor() {
    this.aplicar(this._tema());
    this.acompanharSistema();
  }

  definir(tema: Tema) {
    this._tema.set(tema);
    this.aplicar(tema);
    try {
      localStorage.setItem(STORAGE_KEY, tema);
    } catch {
      // modo privativo/armazenamento bloqueado: o tema só não persiste
    }
  }

  alternar() {
    this.definir(this._tema() === 'escuro' ? 'claro' : 'escuro');
  }

  private aplicar(tema: Tema) {
    document.documentElement.dataset['theme'] = tema;
  }

  private temaInicial(): Tema {
    const salvo = this.lerSalvo();
    if (salvo) return salvo;
    return this.prefereEscuro() ? 'escuro' : 'claro';
  }

  private lerSalvo(): Tema | null {
    try {
      const valor = localStorage.getItem(STORAGE_KEY);
      return valor === 'claro' || valor === 'escuro' ? valor : null;
    } catch {
      return null;
    }
  }

  private prefereEscuro(): boolean {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  /**
   * Enquanto o usuário não escolher um tema, acompanhamos o sistema em
   * tempo real — se ele trocar para escuro no SO, a aplicação acompanha.
   */
  private acompanharSistema() {
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', (e) => {
      if (this.lerSalvo()) return;
      this._tema.set(e.matches ? 'escuro' : 'claro');
      this.aplicar(this._tema());
    });
  }
}
