import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgendamentosModalComponent } from './agendamentos-modal.component';

describe('AgendamentosModalComponent', () => {
  let component: AgendamentosModalComponent;
  let fixture: ComponentFixture<AgendamentosModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendamentosModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendamentosModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
