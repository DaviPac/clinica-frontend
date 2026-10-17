import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FormularioService } from './formulario.service';
import { CampoAlternador, CampoNumero, CampoSelecao, CampoTexto, ValorFormulario } from './campos';

function campo(chave: string): HTMLInputElement | HTMLSelectElement {
  const el = document.querySelector<HTMLInputElement>(`app-formulario [id$="-${chave}"]`);
  if (!el) throw new Error(`Campo "${chave}" não encontrado`);
  return el;
}

function digitar(chave: string, valor: string) {
  const el = campo(chave);
  el.value = valor;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('change'));
  TestBed.tick();
}

function enviar() {
  document.querySelector<HTMLFormElement>('app-formulario form')!
    .dispatchEvent(new Event('submit'));
  TestBed.tick();
}

const camposDespesa = () => [
  new CampoTexto({ chave: 'descricao', rotulo: 'Descrição', obrigatorio: true }),
  new CampoNumero({ chave: 'valor', rotulo: 'Valor', obrigatorio: true, minimo: 0.01 }),
  new CampoSelecao({ chave: 'categoria', rotulo: 'Categoria', opcoes: [
    { valor: 'FIXA', rotulo: 'Fixa' },
    { valor: 'VARIAVEL', rotulo: 'Variável' },
  ] }),
] as const;

describe('FormularioService', () => {
  let service: FormularioService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(FormularioService);
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach(el => el.remove());
  });

  it('infere o tipo do valor a partir dos campos', () => {
    const valor: ValorFormulario<ReturnType<typeof camposDespesa>> = {
      descricao: 'Aluguel',
      valor: 1200,
      categoria: 'FIXA',
    };
    // @ts-expect-error — 'OUTRA' não está entre as opções
    valor.categoria = 'OUTRA';
    expect(valor.descricao).toBe('Aluguel');
  });

  it('não envia com campo obrigatório vazio e mostra o erro', () => {
    let fechou = false;
    service.abrir({ titulo: 'Nova despesa', campos: camposDespesa() }).subscribe(() => fechou = true);
    TestBed.tick();

    enviar();

    expect(fechou).toBe(false);
    expect(document.querySelector('app-formulario')!.textContent).toContain('Campo obrigatório.');
  });

  it('devolve os valores preenchidos, partindo dos valores iniciais', () => {
    let resultado: unknown;
    service.abrir({
      titulo: 'Editar despesa',
      campos: camposDespesa(),
      valores: { categoria: 'VARIAVEL' },
    }).subscribe(r => resultado = r);
    TestBed.tick();

    digitar('descricao', 'Aluguel');
    digitar('valor', '1200');
    enviar();

    expect(resultado).toEqual({
      valor: { descricao: 'Aluguel', valor: 1200, categoria: 'VARIAVEL' },
      resposta: undefined,
    });
  });

  it('com aoConfirmar, devolve a resposta da ação', () => {
    let resultado: unknown;
    service.abrir({
      titulo: 'Nova despesa',
      campos: camposDespesa(),
      valores: { descricao: 'Luz', valor: 90 },
      aoConfirmar: v => of({ id: 7, ...v }),
    }).subscribe(r => resultado = r);
    TestBed.tick();

    enviar();

    expect(resultado).toEqual({
      valor: { descricao: 'Luz', valor: 90, categoria: 'FIXA' },
      resposta: { id: 7, descricao: 'Luz', valor: 90, categoria: 'FIXA' },
    });
  });

  it('com aoConfirmar que falha, mostra o erro e continua aberto', () => {
    let fechou = false;
    service.abrir({
      titulo: 'Nova despesa',
      campos: camposDespesa(),
      valores: { descricao: 'Luz', valor: 90 },
      aoConfirmar: () => throwError(() => new Error('Servidor fora do ar')),
    }).subscribe(() => fechou = true);
    TestBed.tick();

    enviar();

    expect(fechou).toBe(false);
    expect(document.querySelector('app-formulario app-alert')!.textContent).toContain('Servidor fora do ar');
  });

  it('esconde e deixa de validar campos com visivel() falso', () => {
    let resultado: unknown;
    service.abrir({
      titulo: 'Novo serviço',
      campos: [
        new CampoAlternador({ chave: 'pacote', rotulo: 'Pacote de sessões' }),
        new CampoNumero({ chave: 'sessoes', rotulo: 'Sessões', obrigatorio: true, visivel: ctx => !!ctx.valores['pacote'] }),
      ],
    }).subscribe(r => resultado = r);
    TestBed.tick();

    expect(document.querySelector('app-formulario [id$="-sessoes"]')).toBeNull();

    enviar();
    expect(resultado).toEqual({ valor: { pacote: false, sessoes: null }, resposta: undefined });
  });
});
