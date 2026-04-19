import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRelatorioComponent } from './admin-relatorio.component';

describe('AdminRelatorioComponent', () => {
  let component: AdminRelatorioComponent;
  let fixture: ComponentFixture<AdminRelatorioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRelatorioComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRelatorioComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
