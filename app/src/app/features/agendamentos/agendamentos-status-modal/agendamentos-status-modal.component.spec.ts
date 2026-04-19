import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgendamentosStatusModalComponent } from './agendamentos-status-modal.component';

describe('AgendamentosStatusModalComponent', () => {
  let component: AgendamentosStatusModalComponent;
  let fixture: ComponentFixture<AgendamentosStatusModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendamentosStatusModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendamentosStatusModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
