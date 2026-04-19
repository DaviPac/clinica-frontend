import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PacientesListaComponent } from './pacientes-lista.component';

describe('PacientesLista', () => {
  let component: PacientesListaComponent;
  let fixture: ComponentFixture<PacientesListaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacientesListaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PacientesListaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
