import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DIALOG_DATA } from '@angular/cdk/dialog';

import { DialogoService } from './dialogo.service';

@Component({ template: '<p class="teste">{{ dados }}</p>' })
class DialogoTesteComponent {
  dados = inject<string>(DIALOG_DATA);
}

@Component({ template: '' })
class VazioComponent {}

describe('DialogoService', () => {
  let service: DialogoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'outra', component: VazioComponent }])],
    });
    service = TestBed.inject(DialogoService);
  });

  afterEach(() => {
    service.fecharTodos();
    document.querySelectorAll('.cdk-overlay-container').forEach(el => el.remove());
  });

  it('entrega os dados ao componente e devolve o resultado do close', () => {
    const ref = service.abrir<string>(DialogoTesteComponent, { dados: 'olá' });
    TestBed.tick();

    expect(document.querySelector('.teste')?.textContent).toBe('olá');

    let resultado: string | undefined;
    ref.closed.subscribe(r => resultado = r);
    ref.close('pronto');

    expect(resultado).toBe('pronto');
  });

  it('fecha quando o router navega', async () => {
    const ref = service.abrir(DialogoTesteComponent, { dados: 'x' });
    let fechou = false;
    ref.closed.subscribe(() => fechou = true);

    await TestBed.inject(Router).navigateByUrl('/outra');

    expect(fechou).toBe(true);
  });

  it('continua aberto na navegação com fecharAoNavegar: false', async () => {
    const ref = service.abrir(DialogoTesteComponent, { dados: 'x', fecharAoNavegar: false });
    let fechou = false;
    ref.closed.subscribe(() => fechou = true);

    await TestBed.inject(Router).navigateByUrl('/outra');

    expect(fechou).toBe(false);
  });
});
