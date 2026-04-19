import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicosModalComponent } from './servicos-modal.component';

describe('ServicosModalComponent', () => {
  let component: ServicosModalComponent;
  let fixture: ComponentFixture<ServicosModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicosModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicosModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
