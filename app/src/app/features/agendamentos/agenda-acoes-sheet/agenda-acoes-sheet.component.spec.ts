import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AgendaAcoesSheetComponent } from './agenda-acoes-sheet.component';
import { Agendamento } from '../../../core/models/agendamento.model';

function agendamento(over: Partial<Agendamento> = {}): Agendamento {
  return {
    id: 7,
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

describe('AgendaAcoesSheetComponent', () => {
  let fixture: ComponentFixture<AgendaAcoesSheetComponent>;
  let el: HTMLElement;

  async function montar(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AgendaAcoesSheetComponent);
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
      imports: [AgendaAcoesSheetComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('resume a sessão no cabeçalho', async () => {
    await montar();
    expect(el.textContent).toContain('Maria Souza');
    expect(el.textContent).toContain('Dra. Ana');
    expect(el.textContent).toContain('Fonoaudiologia');
  });

  it('oferece "Ver detalhes" apontando para a página da sessão', async () => {
    await montar();
    const link = el.querySelector('a')!;
    expect(link.textContent).toContain('Ver detalhes');
    expect(link.getAttribute('href')).toBe('/agendamentos/7');
  });

  it('esconde "Alterar status" quando a sessão está cancelada', async () => {
    await montar({ agendamento: agendamento({ status: 'CANCELADO' }) });
    expect(el.textContent).not.toContain('Alterar status');
  });

  it('só oferece "Cancelar série" em sessão agendada com recorrência', async () => {
    await montar();
    expect(el.textContent).not.toContain('Cancelar série');

    await montar({ agendamento: agendamento({ recorrenciaGroupId: 'serie-1' }) });
    expect(el.textContent).toContain('Cancelar série');
  });

  it('alterna o rótulo do botão de pagamento', async () => {
    await montar();
    expect(el.textContent).toContain('Marcar como pago');

    await montar({ agendamento: agendamento({ pagoPeloPaciente: true }) });
    expect(el.textContent).toContain('Desmarcar pagamento');
  });

  it('bloqueia o pagamento para não-admin quando o profissional não recebe', async () => {
    await montar({ agendamento: agendamento({ profissionalRecebe: false }), isAdmin: false });
    expect(fixture.componentInstance.pagamentoBloqueado()).toBe(true);
  });

  it('emite cada ação', async () => {
    const chamados: string[] = [];
    await montar({ agendamento: agendamento({ recorrenciaGroupId: 'serie-1' }), isAdmin: true });
    fixture.componentInstance.status.subscribe(() => chamados.push('status'));
    fixture.componentInstance.pagamento.subscribe(() => chamados.push('pagamento'));
    fixture.componentInstance.cancelarSerie.subscribe(() => chamados.push('cancelarSerie'));

    const rotulos = ['Alterar status', 'Marcar como pago', 'Cancelar série'];
    for (const rotulo of rotulos) {
      const botao = Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent?.includes(rotulo));
      botao!.click();
    }

    expect(chamados).toEqual(['status', 'pagamento', 'cancelarSerie']);
  });
});
