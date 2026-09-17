import { Injectable, computed, signal } from '@angular/core';

/** O que o usuário escolheu na tela de perfil. */
export type PreferenciaTema = 'claro' | 'escuro' | 'sistema';

/** O tema que acaba valendo na tela — 'sistema' sempre resolve para um destes. */
export type Tema = 'claro' | 'escuro';

const STORAGE_KEY = 'tema';
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

/**
 * Tema visual da aplicação.
 *
 * O tema aplicado vive no atributo `data-theme` do <html>; o CSS faz o resto
 * (veja `styles/tokens.css`). A preferência fica no localStorage e o padrão é
 * 'sistema', que acompanha o sistema operacional em tempo real.
 *
 * O `index.html` aplica o mesmo atributo num script inline antes da aplicação
 * subir, para não haver flash do tema errado.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly _preferencia = signal<PreferenciaTema>(this.lerSalvo() ?? 'sistema');
  private readonly _sistemaEscuro = signal<boolean>(this.sistemaPrefereEscuro());

  readonly preferencia = this._preferencia.asReadonly();

  /** O tema efetivamente aplicado agora. */
  readonly tema = computed<Tema>(() => {
    const p = this._preferencia();
    if (p !== 'sistema') return p;
    return this._sistemaEscuro() ? 'escuro' : 'claro';
  });

  constructor() {
    this.aplicar(this.tema());
    this.acompanharSistema();
  }

  definir(preferencia: PreferenciaTema) {
    this._preferencia.set(preferencia);
    this.aplicar(this.tema());
    try {
      localStorage.setItem(STORAGE_KEY, preferencia);
    } catch {
      // modo privativo/armazenamento bloqueado: a escolha só não persiste
    }
  }

  private aplicar(tema: Tema) {
    document.documentElement.dataset['theme'] = tema;
  }

  private lerSalvo(): PreferenciaTema | null {
    try {
      const valor = localStorage.getItem(STORAGE_KEY);
      return valor === 'claro' || valor === 'escuro' || valor === 'sistema' ? valor : null;
    } catch {
      return null;
    }
  }

  private sistemaPrefereEscuro(): boolean {
    return globalThis.matchMedia?.(CONSULTA_ESCURO).matches ?? false;
  }

  /**
   * Quem está em 'sistema' acompanha o SO sem precisar recarregar a página.
   * O listener roda sempre: se a preferência for fixa, o sinal muda mas o
   * tema computado ignora.
   */
  private acompanharSistema() {
    globalThis.matchMedia?.(CONSULTA_ESCURO).addEventListener('change', (e) => {
      this._sistemaEscuro.set(e.matches);
      this.aplicar(this.tema());
    });
  }
}
