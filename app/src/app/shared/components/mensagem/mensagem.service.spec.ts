import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { MensagemService } from './mensagem.service';

/** Deixa a fila (Promise) andar e o Angular renderizar o diálogo. */
async function estabilizar() {
  await new Promise(r => setTimeout(r));
  TestBed.tick();
}

function mensagensAbertas() {
  return Array.from(document.querySelectorAll('app-mensagem'));
}

function botao(rotulo: string): HTMLButtonElement {
  const alvo = Array.from(document.querySelectorAll<HTMLButtonElement>('app-mensagem button'))
    .find(b => b.textContent?.trim() === rotulo);
  if (!alvo) throw new Error(`Botão "${rotulo}" não encontrado`);
  return alvo;
}

describe('MensagemService', () => {
  let service: MensagemService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(MensagemService);
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach(el => el.remove());
  });

  it('abre a mensagem sem precisar de subscribe', async () => {
    service.erro('Falhou ao salvar.', 'Erro');
    await estabilizar();

    const [mensagem] = mensagensAbertas();
    expect(mensagem.textContent).toContain('Falhou ao salvar.');
    expect(mensagem.getAttribute('data-tom')).toBe('perigo');
  });

  it('mostra uma mensagem por vez, na ordem em que foram disparadas', async () => {
    service.info('primeira');
    service.info('segunda');
    await estabilizar();

    expect(mensagensAbertas().length).toBe(1);
    expect(mensagensAbertas()[0].textContent).toContain('primeira');

    botao('Ok').click();
    await estabilizar();

    expect(mensagensAbertas().length).toBe(1);
    expect(mensagensAbertas()[0].textContent).toContain('segunda');
  });

  it('confirmar emite true ao confirmar e false ao cancelar', async () => {
    const respostas: boolean[] = [];

    service.confirmar('Continuar?').subscribe(r => respostas.push(r));
    await estabilizar();
    botao('Confirmar').click();
    await estabilizar();

    service.confirmar({ mensagem: 'De novo?', rotuloCancelar: 'Não' }).subscribe(r => respostas.push(r));
    await estabilizar();
    botao('Não').click();
    await estabilizar();

    expect(respostas).toEqual([true, false]);
  });

  it('com aoConfirmar, só fecha quando a ação completa', async () => {
    const acao = new Subject<void>();
    let resposta: boolean | undefined;

    service.confirmar({ mensagem: 'Desativar?', rotuloConfirmar: 'Desativar', aoConfirmar: () => acao })
      .subscribe(r => resposta = r);
    await estabilizar();

    botao('Desativar').click();
    await estabilizar();
    expect(mensagensAbertas().length).toBe(1);
    expect(botao('Salvando...').disabled).toBe(true);

    acao.complete();
    await estabilizar();
    expect(mensagensAbertas().length).toBe(0);
    expect(resposta).toBe(true);
  });

  it('com aoConfirmar, mostra o erro e mantém o diálogo aberto', async () => {
    service.confirmar({ mensagem: 'Desativar?', aoConfirmar: () => throwError(() => new Error('Sem permissão')) });
    await estabilizar();

    botao('Confirmar').click();
    await estabilizar();

    expect(mensagensAbertas().length).toBe(1);
    expect(document.querySelector('app-mensagem app-alert')?.textContent).toContain('Sem permissão');
    expect(botao('Confirmar').disabled).toBe(false);
  });
});
