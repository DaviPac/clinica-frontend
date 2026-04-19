import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PacientesModalComponent } from './pacientes-modal.component';

describe('PacientesModal', () => {
  let component: PacientesModalComponent;
  let fixture: ComponentFixture<PacientesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacientesModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PacientesModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
