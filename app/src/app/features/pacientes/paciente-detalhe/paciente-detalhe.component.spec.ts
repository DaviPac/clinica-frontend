import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PacienteDetalheComponent } from './paciente-detalhe.component'

describe('PacienteDetalhe', () => {
  let component: PacienteDetalheComponent;
  let fixture: ComponentFixture<PacienteDetalheComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacienteDetalheComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PacienteDetalheComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
