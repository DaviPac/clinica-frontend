import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

import { CampoAlternador, CampoNumero, CampoSelecao, CampoTexto, Nota } from './campos';
import { ErroFormulario } from './contexto';
import { EstadoFormulario } from './estado-formulario';
import { FormularioComponent } from './formulario.component';
import { DefinicaoFormulario, definirFormulario } from './formulario.model';
import type { MensagemService } from '../mensagem/mensagem.service';
import type { OpcoesConfirmacao } from '../mensagem/mensagem.model';

/**
 * Cada bloco reproduz um formulário que hoje existe no projeto, só com a
 * API declarativa — é a prova de que dá para migrar sem perder comportamento.
 */

const motor = (def: DefinicaoFormulario<any, any>, mensagem: MensagemService | null = null) =>
  new EstadoFormulario(def, mensagem, 't');

const vista = (e: EstadoFormulario<any>, chave: string) =>
  e.vistas.find(v => v.tipo === 'campo' && v.campo.chave === chave) as Extract<EstadoFormulario['vistas'][number], { tipo: 'campo' }>;

// ── agendamentos-modal ───────────────────────────────────────────────

describe('Novo agendamento', () => {
  const pacientesPor: Record<number, { id: number; nome: string }[]> = {
    1: [{ id: 10, nome: 'Paciente da Ana' }],
    2: [{ id: 20, nome: 'Paciente da Bia' }],
  };
  const servicos = [
    { id: 100, nome: 'Avulso', is_pacote: false, valor_atual: 150 },
    { id: 101, nome: 'Pacote', is_pacote: true, valor_atual: 1000 },
  ];
  let cargasPacientes: number[];

  const definicao = () => definirFormulario({
    campos: [
      new CampoSelecao({
        chave: 'usuario_id', rotulo: 'Profissional', obrigatorio: true, placeholder: 'Selecione um profissional',
        carregarOpcoes: () => of([{ valor: 1, rotulo: 'Ana' }, { valor: 2, rotulo: 'Bia' }]),
        aoMudar: (_, ctx) => ctx.definir('paciente_id', null),
      }),
      new CampoSelecao({
        chave: 'paciente_id', rotulo: 'Paciente', obrigatorio: true, placeholder: 'Selecione um paciente',
        recarregarQuando: ['usuario_id'],
        carregarOpcoes: ctx => {
          cargasPacientes.push(ctx.valores['usuario_id']);
          return of((pacientesPor[ctx.valores['usuario_id']] ?? []).map(p => ({ valor: p.id, rotulo: p.nome })));
        },
      }),
      new CampoSelecao({
        chave: 'servico_id', rotulo: 'Serviço', obrigatorio: true, placeholder: 'Selecione um serviço',
        carregarOpcoes: () => of(servicos.map(s => ({ valor: s.id, rotulo: s.nome, dados: s }))),
        aoMudar: (_, ctx) => {
          const s = ctx.opcao('servico_id')?.dados;
          if (s) ctx.preencher({ recorrente: s.is_pacote, pacote: s.is_pacote, valor_combinado: s.valor_atual });
        },
      }),
      new CampoNumero({
        chave: 'valor_combinado', obrigatorio: true, minimo: 0.01, passo: 0.01,
        rotulo: ctx => ctx.valores['pacote'] ? 'Valor total do pacote (R$)' : 'Valor combinado por sessão (R$)',
        ajuda: ctx => ctx.valores['pacote']
          ? `${ctx.valores['valor_combinado'] / ctx.valores['total_sessoes']} por sessão`
          : 'Pré-preenchido com o valor do serviço.',
      }),
      new CampoAlternador({
        chave: 'recorrente', rotulo: 'Sessão recorrente',
        desabilitado: ctx => !!ctx.opcao('servico_id')?.dados?.is_pacote,
        descricao: ctx => ctx.opcao('servico_id')?.dados?.is_pacote ? 'obrigatório para pacotes' : '',
      }),
      new CampoAlternador({ chave: 'pacote', rotulo: '', visivel: false }),
      new CampoNumero({
        chave: 'total_sessoes', rotulo: 'Nº de sessões', valorInicial: 10, minimo: 2, obrigatorio: true,
        largura: 'metade', visivel: ctx => ctx.valores['recorrente'],
      }),
      new Nota({ texto: ctx => `${ctx.valores['total_sessoes']} sessões`, visivel: ctx => ctx.valores['recorrente'] }),
    ],
  });

  beforeEach(() => cargasPacientes = []);

  it('recarrega pacientes só quando o profissional muda, e limpa o paciente escolhido', () => {
    const e = motor(definicao());
    expect(cargasPacientes).toEqual([null]);

    e.ctx.definir('usuario_id', 1);
    e.ctx.definir('paciente_id', 10);
    e.ctx.definir('valor_combinado', 99);   // não é dependência: não recarrega
    expect(cargasPacientes).toEqual([null, 1]);
    expect(e.ctx.opcoes('paciente_id').map(o => o.rotulo)).toEqual(['Paciente da Ana']);

    e.ctx.definir('usuario_id', 2);
    expect(cargasPacientes).toEqual([null, 1, 2]);
    expect(e.ctx.valores['paciente_id']).toBeNull();
    expect(e.ctx.opcoes('paciente_id').map(o => o.rotulo)).toEqual(['Paciente da Bia']);
  });

  it('pacote preenche o valor, liga e trava a recorrência, e troca rótulo e ajuda', () => {
    const e = motor(definicao());

    e.ctx.definir('servico_id', 101);

    expect(e.ctx.valores).toMatchObject({ valor_combinado: 1000, recorrente: true, pacote: true });
    expect(vista(e, 'recorrente').controle.disabled).toBe(true);
    expect(vista(e, 'recorrente').descricao()).toBe('obrigatório para pacotes');
    expect(vista(e, 'valor_combinado').rotulo()).toBe('Valor total do pacote (R$)');
    expect(vista(e, 'valor_combinado').ajuda()).toBe('100 por sessão');
    expect(vista(e, 'total_sessoes').visivel()).toBe(true);

    e.ctx.definir('servico_id', 100);

    expect(e.ctx.valores).toMatchObject({ valor_combinado: 150, recorrente: false, pacote: false });
    expect(vista(e, 'recorrente').controle.disabled).toBe(false);
    expect(vista(e, 'total_sessoes').visivel()).toBe(false);
  });

  it('campo escondido não bloqueia o envio, mas volta a validar quando aparece', () => {
    const e = motor(definicao());
    e.ctx.definir('usuario_id', 1);   // trocar o profissional limpa o paciente, então vem antes
    e.ctx.preencher({ paciente_id: 10, servico_id: 100, total_sessoes: 1 });
    expect(e.valido()).toBe(true);

    e.ctx.definir('recorrente', true);
    expect(e.valido()).toBe(false);   // total_sessoes = 1 < 2
  });
});

// ── perfil (alterar senha) ───────────────────────────────────────────

describe('Alterar senha', () => {
  const definicao = (mudarSenha: () => Observable<unknown>) => definirFormulario({
    modoValidacao: 'bloquear',
    campos: [
      new CampoTexto({ chave: 'senhaAntiga', rotulo: 'Senha atual', formato: 'password', alternarVisibilidade: true, obrigatorio: true }),
      new CampoTexto({ chave: 'novaSenha', rotulo: 'Nova senha', formato: 'password', obrigatorio: true, minimoCaracteres: 6 }),
      new CampoTexto({ chave: 'confirmarNova', rotulo: 'Confirmar', formato: 'password', obrigatorio: true }),
    ],
    validar: v => v.novaSenha && v.confirmarNova && v.novaSenha !== v.confirmarNova
      ? { confirmarNova: 'As senhas não coincidem.' } : null,
    aoConfirmar: () => mudarSenha(),
    aoConcluir: (_, ctx) => {
      ctx.redefinir();
      ctx.avisar('Senha alterada com sucesso.', 'success', 4000);
    },
  });

  it('acusa senhas diferentes no campo de confirmação', () => {
    const e = motor(definicao(() => of(null)));
    e.ctx.preencher({ senhaAntiga: 'x', novaSenha: 'abcdef', confirmarNova: 'abcdeg' });
    vista(e, 'confirmarNova').controle.markAsTouched();

    expect(e.valido()).toBe(false);
    expect(e.erroDe(vista(e, 'confirmarNova'))?.texto).toBe('As senhas não coincidem.');
  });

  it('ao concluir, limpa o formulário e avisa o sucesso', () => {
    const e = motor(definicao(() => of(null)));
    e.ctx.preencher({ senhaAntiga: 'x', novaSenha: 'abcdef', confirmarNova: 'abcdef' });

    e.enviar();

    expect(e.ctx.valores).toEqual({ senhaAntiga: '', novaSenha: '', confirmarNova: '' });
    expect(vista(e, 'novaSenha').controle.touched).toBe(false);
    expect(e.aviso()).toEqual({ texto: 'Senha alterada com sucesso.', variante: 'success' });
    e.destruir();
  });
});

// ── paciente-editar ──────────────────────────────────────────────────

describe('Editar paciente', () => {
  it('marca em âmbar os campos que o envio recusou, até que sejam alterados', () => {
    const e = motor(definirFormulario({
      valores: { nome: 'Maria', telefone: '' },
      campos: [
        new CampoTexto({ chave: 'nome', rotulo: 'Nome', obrigatorio: true, minimoCaracteres: 3 }),
        new CampoTexto({ chave: 'telefone', rotulo: 'Telefone' }),
      ],
      aoConfirmar: () => throwError(() => new ErroFormulario(
        'Limpar campos ainda não é suportado.',
        { telefone: 'Não é possível limpar este campo no momento.' },
        'aviso',
      )),
    }));

    e.enviar();

    expect(e.erro()).toBe('Limpar campos ainda não é suportado.');
    expect(e.erroDe(vista(e, 'telefone'))).toEqual({ texto: 'Não é possível limpar este campo no momento.', tom: 'aviso' });

    e.ctx.definir('telefone', '81 99999-0000');
    expect(e.erroDe(vista(e, 'telefone'))).toBeNull();
  });
});

// ── financeiro-profissional (registrar repasse) ──────────────────────

describe('Registrar repasse', () => {
  const definicao = (criar: () => Observable<unknown>) => definirFormulario({
    modoValidacao: 'bloquear',
    botoes: { confirmar: 'Registrar repasse', processando: 'Registrando...', cancelar: null, disposicao: 'largura-total' },
    campos: [
      new CampoSelecao({
        chave: 'profissionalId', rotulo: 'Profissional', obrigatorio: true,
        placeholder: 'Selecione o profissional...', placeholderSelecionavel: true,
        opcoes: [{ valor: 7, rotulo: 'Ana' }],
        // Trocar o profissional busca o saldo e preenche valor e destino
        aoMudar: (id, ctx) => id == null ? undefined : of({ saldo_a_receber: -80 }).pipe(
          tap(s => ctx.preencher({ valor_pago: Math.abs(s.saldo_a_receber), profissionalRecebe: s.saldo_a_receber >= 0 })),
        ),
      }),
      new CampoNumero({ chave: 'valor_pago', rotulo: 'Valor (R$)', obrigatorio: true, minimo: 0.01, passo: 0.01, valorInicial: 0 }),
      new CampoAlternador({ chave: 'profissionalRecebe', rotulo: 'Repasse para o profissional?', apresentacao: 'simples', valorInicial: true }),
    ],
    confirmacao: v => ({
      titulo: 'Confirmar repasse',
      mensagem: `Registrar este repasse ${v.profissionalRecebe ? 'para o profissional' : 'para a clínica'}?`,
      variante: 'perigo',
      rotuloProcessando: 'Registrando...',
    }),
    aoConfirmar: () => criar(),
    aoConcluir: (_, ctx) => {
      ctx.preencher({ valor_pago: 0, profissionalRecebe: true });
      ctx.avisar('Repasse registrado com sucesso.', 'success', 3000);
    },
  });

  /** MensagemService de mentira: responde a confirmação com `resposta`. */
  function mensagemQueResponde(resposta: boolean) {
    const pedidas: OpcoesConfirmacao[] = [];
    const fake = {
      confirmar: (o: OpcoesConfirmacao) => {
        pedidas.push(o);
        if (!resposta) return of(false);
        return new Observable<boolean>(sub => {
          o.aoConfirmar!().subscribe({ complete: () => { sub.next(true); sub.complete(); } });
        });
      },
    } as unknown as MensagemService;
    return { fake, pedidas };
  }

  it('preenche valor e destino a partir do saldo do profissional', () => {
    const e = motor(definicao(() => of(null)));
    e.ctx.definir('profissionalId', 7);
    expect(e.ctx.valores).toMatchObject({ valor_pago: 80, profissionalRecebe: false });
  });

  it('pede confirmação; cancelar não envia', () => {
    let enviou = false;
    const { fake, pedidas } = mensagemQueResponde(false);
    const e = motor(definicao(() => { enviou = true; return of(null); }), fake);
    e.ctx.definir('profissionalId', 7);

    e.enviar();

    expect(pedidas[0].mensagem).toBe('Registrar este repasse para a clínica?');
    expect(enviou).toBe(false);
    expect(e.processando()).toBe(false);
  });

  it('confirmado: envia, mantém o profissional e zera o resto', () => {
    const { fake } = mensagemQueResponde(true);
    const e = motor(definicao(() => of({ id: 1 })), fake);
    e.ctx.definir('profissionalId', 7);

    e.enviar();

    expect(e.ctx.valores).toEqual({ profissionalId: 7, valor_pago: 0, profissionalRecebe: true });
    expect(e.aviso()?.texto).toBe('Repasse registrado com sucesso.');
    e.destruir();
  });

  it('erro da API fecha a confirmação e aparece no formulário', () => {
    const { fake } = mensagemQueResponde(true);
    const e = motor(definicao(() => throwError(() => new Error('Saldo insuficiente'))), fake);
    e.ctx.definir('profissionalId', 7);

    e.enviar();

    expect(e.erro()).toBe('Saldo insuficiente');
    expect(e.processando()).toBe(false);
  });
});

// ── pacientes-modal (paciente já cadastrado) ─────────────────────────

describe('Novo paciente', () => {
  it('avisa o sucesso dentro do formulário e só conclui quando a ação termina', () => {
    const fim = new Subject<void>();
    let concluiu = false;
    const e = motor(definirFormulario({
      valores: { nome: 'Maria' },
      campos: [new CampoTexto({ chave: 'nome', rotulo: 'Nome', obrigatorio: true })],
      aoConfirmar: (_, ctx) => {
        ctx.avisar('Paciente já cadastrado no sistema — vinculado ao seu perfil.', 'success');
        return fim;   // na tela real: of(res).pipe(delay(1500))
      },
      aoConcluir: () => concluiu = true,
    }));

    e.enviar();
    expect(e.aviso()?.variante).toBe('success');
    expect(e.processando()).toBe(true);
    expect(concluiu).toBe(false);

    fim.complete();
    expect(concluiu).toBe(true);
  });
});

// ── confirmações da IA (formulário controlado de fora) ───────────────

@Component({
  imports: [FormularioComponent],
  template: `<app-formulario [definicao]="def" (alterado)="valores.set($event)" (validade)="valido.set($event)" />`,
})
class HostIaComponent {
  valores = signal<Record<string, any>>({});
  valido = signal<boolean | null>(null);
  readonly agendamentos = [
    { id: 1, rotulo: 'Sessão de segunda', status: 'AGENDADO' },
    { id: 2, rotulo: 'Sessão de terça', status: 'REALIZADO' },
  ];
  def = definirFormulario({
    botoes: false,
    valores: { agendamento_id: 1 },
    campos: [
      new CampoSelecao({
        chave: 'agendamento_id', rotulo: 'Agendamento', obrigatorio: true,
        opcoes: this.agendamentos.map(a => ({ valor: a.id, rotulo: a.rotulo, dados: a })),
      }),
      new CampoSelecao({
        chave: 'status', rotulo: 'Novo status', obrigatorio: true, placeholder: 'Selecione…',
        // Só as transições válidas a partir do status do agendamento escolhido
        opcoes: ctx => ctx.opcao('agendamento_id')?.dados?.status === 'AGENDADO'
          ? [{ valor: 'REALIZADO', rotulo: 'Realizado' }, { valor: 'FALTA', rotulo: 'Falta' }]
          : [{ valor: 'AGENDADO', rotulo: 'Agendado' }],
      }),
    ],
  });
}

describe('Confirmação da IA', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('sem botões; opções filtradas pelo outro campo; emite valores e validade', async () => {
    const fixture = TestBed.createComponent(HostIaComponent);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('button[type="submit"]')).toBeNull();
    expect(host.valido()).toBe(false);

    const status = el.querySelector<HTMLSelectElement>('select[id$="-status"]')!;
    expect(Array.from(status.options).map(o => o.textContent?.trim())).toEqual(['Selecione…', 'Realizado', 'Falta']);

    status.selectedIndex = 1;
    status.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(host.valores()).toEqual({ agendamento_id: 1, status: 'REALIZADO' });
    expect(host.valido()).toBe(true);
  });
});
