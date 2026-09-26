import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MesCelulaComponent } from './mes-celula.component';

describe('MesCelulaComponent', () => {
  let fixture: ComponentFixture<MesCelulaComponent>;
  let componente: MesCelulaComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MesCelulaComponent] }).compileComponents();
    fixture = TestBed.createComponent(MesCelulaComponent);
    componente = fixture.componentInstance;
  });

  it('mapeia cada status para um modificador de bolinha', () => {
    expect(componente.classePonto('AGENDADO')).toBe('celula__ponto--agendado');
    expect(componente.classePonto('REALIZADO')).toBe('celula__ponto--realizado');
    expect(componente.classePonto('FALTA')).toBe('celula__ponto--falta');
    expect(componente.classePonto('CANCELADO')).toBe('celula__ponto--cancelado');
  });
});
