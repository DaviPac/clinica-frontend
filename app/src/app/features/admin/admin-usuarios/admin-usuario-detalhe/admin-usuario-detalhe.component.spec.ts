import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUsuarioDetalheComponent } from './admin-usuario-detalhe.component'

describe('AdminUsuarioDetalhe', () => {
  let component: AdminUsuarioDetalheComponent;
  let fixture: ComponentFixture<AdminUsuarioDetalheComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsuarioDetalheComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsuarioDetalheComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
