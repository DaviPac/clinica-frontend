import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDespesasComponent } from './admin-despesas.component';

describe('AdminDespesasComponent', () => {
  let component: AdminDespesasComponent;
  let fixture: ComponentFixture<AdminDespesasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDespesasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDespesasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
