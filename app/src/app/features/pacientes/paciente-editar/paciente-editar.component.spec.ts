import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PacienteEditarComponent } from './paciente-editar.component';

describe('PacienteEditarComponent', () => {
  let component: PacienteEditarComponent;
  let fixture: ComponentFixture<PacienteEditarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacienteEditarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PacienteEditarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
