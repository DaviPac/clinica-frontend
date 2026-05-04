import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiltroProfissionalComponent } from './filtro-profissional.component';

describe('FiltroProfissionalComponent', () => {
  let component: FiltroProfissionalComponent;
  let fixture: ComponentFixture<FiltroProfissionalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltroProfissionalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FiltroProfissionalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
