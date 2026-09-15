import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AgendaCardComponent } from './agenda-card.component';
import { Agendamento } from '../../../core/models/agendamento.model';

function agendamento(over: Partial<Agendamento> = {}): Agendamento {
  return {
    id: 1,
    pacienteId: 10,
    profissionalId: 20,
    servicoId: 30,
    dataHoraInicio: '2026-06-01T14:30:00',
    dataHoraFim: '2026-06-01T15:30:00',
    valorCombinado: 150,
    valorPacote: null,
    percentualComissaoMomento: 50,
    status: 'AGENDADO',
    pagoPeloPaciente: false,
    recorrenciaGroupId: null,
    criadoEm: '2026-05-01T10:00:00',
    profissionalRecebe: true,
    ...over,
  };
}

describe('AgendaCardComponent', () => {
  let fixture: ComponentFixture<AgendaCardComponent>;
  let el: HTMLElement;

  async function montar(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AgendaCardComponent);
    fixture.componentRef.setInput('agendamento', agendamento());
    fixture.componentRef.setInput('pacienteNome', 'Maria Souza');
    fixture.componentRef.setInput('profissionalNome', 'Dra. Ana');
    fixture.componentRef.setInput('servicoNome', 'Fonoaudiologia');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // A regressão que motivou a mudança: no mobile o card só mostrava a hora.
  it('mostra paciente, profissional e serviço no desktop', async () => {
    await montar();
    expect(el.textContent).toContain('Maria Souza');
    expect(el.textContent).toContain('Dra. Ana');
    expect(el.textContent).toContain('Fonoaudiologia');
  });

  it('mostra paciente, profissional e serviço também no modo toque', async () => {
    await montar({ modoToque: true });
    expect(el.textContent).toContain('Maria Souza');
    expect(el.textContent).toContain('Dra. Ana');
    expect(el.textContent).toContain('Fonoaudiologia');
  });

  // Antes os botões viviam dentro do <a routerLink>, exigindo
  // stopPropagation()/preventDefault() em cada clique.
  it('não aninha botões dentro do link do card', async () => {
    await montar();
    expect(el.querySelectorAll('a button').length).toBe(0);
  });

  it('no modo toque o card inteiro é um botão e não renderiza a linha de ações', async () => {
    const emitidos: number[] = [];
    await montar({ modoToque: true });
    fixture.componentInstance.acoes.subscribe(() => emitidos.push(1));

    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('.agenda-card__actions')).toBeNull();

    el.querySelector('button')!.click();
    expect(emitidos.length).toBe(1);
  });

  it('emite status, pagamento e cancelarSerie a partir dos botões do desktop', async () => {
    const chamados: string[] = [];
    await montar({ agendamento: agendamento({ recorrenciaGroupId: 'serie-1' }) });
    fixture.componentInstance.status.subscribe(() => chamados.push('status'));
    fixture.componentInstance.pagamento.subscribe(() => chamados.push('pagamento'));
    fixture.componentInstance.cancelarSerie.subscribe(() => chamados.push('cancelarSerie'));

    const botoes = Array.from(el.querySelectorAll<HTMLButtonElement>('.agenda-card__actions button'));
    botoes.forEach(b => b.click());

    expect(chamados).toEqual(['status', 'pagamento', 'cancelarSerie']);
  });

  it('esconde "Status" quando a sessão está cancelada', async () => {
    await montar({ agendamento: agendamento({ status: 'CANCELADO' }) });
    expect(el.textContent).not.toContain('Status');
    expect(fixture.componentInstance.podeAlterarStatus()).toBe(false);
  });

  it('só oferece "Cancelar série" em sessão agendada com recorrência', async () => {
    await montar();
    expect(el.textContent).not.toContain('Cancelar série');

    await montar({ agendamento: agendamento({ recorrenciaGroupId: 'serie-1' }) });
    expect(el.textContent).toContain('Cancelar série');

    await montar({ agendamento: agendamento({ status: 'REALIZADO', recorrenciaGroupId: 'serie-1' }) });
    expect(el.textContent).not.toContain('Cancelar série');
  });

  it('bloqueia o pagamento para não-admin quando o profissional não recebe', async () => {
    await montar({ agendamento: agendamento({ profissionalRecebe: false }), isAdmin: false });
    expect(fixture.componentInstance.pagamentoBloqueado()).toBe(true);

    await montar({ agendamento: agendamento({ profissionalRecebe: false }), isAdmin: true });
    expect(fixture.componentInstance.pagamentoBloqueado()).toBe(false);
  });

  it('bloqueia o pagamento enquanto o próprio card está atualizando', async () => {
    await montar({ isAdmin: true, atualizandoPagamento: true });
    expect(fixture.componentInstance.pagamentoBloqueado()).toBe(true);
  });

  it('aplica a variante de cor do status', async () => {
    await montar({ agendamento: agendamento({ status: 'FALTA' }) });
    expect(el.querySelector('.agenda-card--falta')).not.toBeNull();
  });
});
