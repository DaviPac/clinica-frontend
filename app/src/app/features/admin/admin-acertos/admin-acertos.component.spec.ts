import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAcertosComponent } from './admin-acertos.component';

describe('AdminAcertosComponent', () => {
  let component: AdminAcertosComponent;
  let fixture: ComponentFixture<AdminAcertosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAcertosComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAcertosComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
