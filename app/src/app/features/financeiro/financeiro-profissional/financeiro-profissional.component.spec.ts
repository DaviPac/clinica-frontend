import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinanceiroProfissionalComponent } from './financeiro-profissional.component';

describe('FinanceiroProfissionalComponent', () => {
  let component: FinanceiroProfissionalComponent;
  let fixture: ComponentFixture<FinanceiroProfissionalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceiroProfissionalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceiroProfissionalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
