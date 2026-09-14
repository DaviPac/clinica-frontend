import { Injectable, Signal, signal } from '@angular/core';

/**
 * Sinais reativos de breakpoint, baseados em `matchMedia`.
 *
 * Usado para decidir no TypeScript o que nem deve ser construído no mobile
 * (ex.: os cards dentro das células da grade mensal), em vez de renderizar
 * tudo e esconder via CSS.
 *
 * Singleton de raiz de propósito: um único listener por ciclo de vida da
 * aplicação, que vive enquanto a aba existir — por isso não há teardown.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  /** `true` abaixo de 640px — o breakpoint `sm` do Tailwind. */
  readonly isMobile = this.media('(max-width: 639.98px)');

  private media(query: string): Signal<boolean> {
    // jsdom (vitest) e ambientes sem DOM não têm matchMedia: assume desktop.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return signal(false).asReadonly();
    }

    const mql = window.matchMedia(query);
    const correspondencia = signal(mql.matches);
    mql.addEventListener('change', (e) => correspondencia.set(e.matches));
    return correspondencia.asReadonly();
  }
}
