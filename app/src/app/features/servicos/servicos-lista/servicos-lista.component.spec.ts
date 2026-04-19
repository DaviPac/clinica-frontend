import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicosListaComponent } from './servicos-lista.component';

describe('ServicosListaComponent', () => {
  let component: ServicosListaComponent;
  let fixture: ComponentFixture<ServicosListaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicosListaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicosListaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
