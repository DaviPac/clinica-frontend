import { TestBed } from '@angular/core/testing';

import { ViewportService } from './viewport.service';

/** MediaQueryList mínimo e controlável, para disparar `change` à vontade. */
function fakeMatchMedia(inicial: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches: inicial,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: () => {},
  };
  return {
    matchMedia: () => mql,
    emitir: (matches: boolean) => listeners.forEach(cb => cb({ matches })),
  };
}

describe('ViewportService', () => {
  const matchMediaOriginal = window.matchMedia;

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  it('assume desktop quando matchMedia não existe (jsdom/SSR)', () => {
    (window as any).matchMedia = undefined;

    TestBed.resetTestingModule();
    const service = TestBed.inject(ViewportService);

    expect(service.isMobile()).toBe(false);
  });

  it('inicia com o valor corrente da media query', () => {
    const fake = fakeMatchMedia(true);
    window.matchMedia = fake.matchMedia as any;

    TestBed.resetTestingModule();
    const service = TestBed.inject(ViewportService);

    expect(service.isMobile()).toBe(true);
  });

  it('atualiza o sinal quando a media query muda', () => {
    const fake = fakeMatchMedia(false);
    window.matchMedia = fake.matchMedia as any;

    TestBed.resetTestingModule();
    const service = TestBed.inject(ViewportService);
    expect(service.isMobile()).toBe(false);

    fake.emitir(true);
    expect(service.isMobile()).toBe(true);

    fake.emitir(false);
    expect(service.isMobile()).toBe(false);
  });
});
