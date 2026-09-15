import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgendamentosListaComponent } from './agendamentos-lista.component';
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

describe('AgendamentosListaComponent', () => {
  let component: AgendamentosListaComponent;
  let fixture: ComponentFixture<AgendamentosListaComponent>;

  /** Junho/2026 com sessões conhecidas, sem depender do calendário real. */
  function comAgendamentosDeJunho() {
    component.dataReferencia.set(new Date(2026, 5, 1));
    component.agendamentos.set([
      agendamento({ id: 1, dataHoraInicio: '2026-06-01T09:00:00' }),
      agendamento({ id: 2, dataHoraInicio: '2026-06-01T10:00:00' }),
      agendamento({ id: 3, dataHoraInicio: '2026-06-01T11:00:00' }),
      agendamento({ id: 4, dataHoraInicio: '2026-06-01T12:00:00' }),
      agendamento({ id: 5, dataHoraInicio: '2026-06-02T09:00:00', status: 'CANCELADO' }),
    ]);
  }

  function diaDe(dataISO: string) {
    return component.diasCalendario().find(d => d.dataISO === dataISO)!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendamentosListaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendamentosListaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('densidade da grade mensal', () => {
    it('limita as bolinhas e conta o excedente em "+N"', () => {
      comAgendamentosDeJunho();

      const dia1 = diaDe('2026-06-01');
      expect(dia1.agendamentos.length).toBe(4);
      expect(dia1.dots.length).toBe(3);
      expect(dia1.extras).toBe(1);
    });

    it('não gera bolinhas nem excedente em dia vazio', () => {
      comAgendamentosDeJunho();

      const dia10 = diaDe('2026-06-10');
      expect(dia10.dots).toEqual([]);
      expect(dia10.extras).toBe(0);
    });

    it('células de preenchimento não têm data', () => {
      comAgendamentosDeJunho();

      // 01/06/2026 é segunda, então há exatamente uma célula vazia antes.
      expect(component.diasCalendario()[0].diaNumero).toBeNull();
      expect(component.diasCalendario()[0].dataISO).toBeNull();
    });
  });

  describe('sheet do dia', () => {
    it('abre no dia tocado e ignora dia sem sessões', () => {
      comAgendamentosDeJunho();

      component.abrirDia(diaDe('2026-06-10'));
      expect(component.diaSelecionado()).toBeNull();

      component.abrirDia(diaDe('2026-06-01'));
      expect(component.diaSelecionado()).toBe('2026-06-01');
    });

    it('lista as sessões do dia e esconde canceladas por padrão', () => {
      comAgendamentosDeJunho();

      component.diaSelecionado.set('2026-06-01');
      expect(component.agendamentosDoDia().map(a => a.id)).toEqual([1, 2, 3, 4]);

      component.diaSelecionado.set('2026-06-02');
      expect(component.agendamentosDoDia()).toEqual([]);

      component.mostrarInativos.set(true);
      expect(component.agendamentosDoDia().map(a => a.id)).toEqual([5]);
    });

    it('acompanha mudanças na lista de agendamentos', () => {
      comAgendamentosDeJunho();
      component.diaSelecionado.set('2026-06-01');
      expect(component.agendamentosDoDia().length).toBe(4);

      // Simula o refetch depois de uma alteração de status.
      component.agendamentos.set([agendamento({ id: 1, dataHoraInicio: '2026-06-01T09:00:00' })]);
      expect(component.agendamentosDoDia().map(a => a.id)).toEqual([1]);
    });

    it('rotula o dia selecionado por extenso', () => {
      component.diaSelecionado.set('2026-06-01');
      expect(component.labelDiaSelecionado()).toContain('junho');
      expect(component.labelDiaSelecionado()).toContain('01');
    });
  });

  describe('sheet de ações', () => {
    it('não fecha enquanto houver um diálogo por cima', () => {
      const ag = agendamento();
      component.agendamentoParaAcoes.set(ag);

      component.agendamentoParaStatus.set(ag);
      component.fecharAcoes();
      expect(component.agendamentoParaAcoes()).toBe(ag);

      component.agendamentoParaStatus.set(null);
      component.agendamentoParaCancelarSerie.set(ag);
      component.fecharAcoes();
      expect(component.agendamentoParaAcoes()).toBe(ag);

      component.agendamentoParaCancelarSerie.set(null);
      component.fecharAcoes();
      expect(component.agendamentoParaAcoes()).toBeNull();
    });
  });

  describe('navegação fecha as sheets', () => {
    beforeEach(() => {
      component.diaSelecionado.set('2026-06-01');
      component.agendamentoParaAcoes.set(agendamento());
    });

    it('ao trocar de modo', () => {
      component.setModoView('semanal');
      expect(component.diaSelecionado()).toBeNull();
      expect(component.agendamentoParaAcoes()).toBeNull();
    });

    it('ao navegar de período', () => {
      component.navegar(1);
      expect(component.diaSelecionado()).toBeNull();
      expect(component.agendamentoParaAcoes()).toBeNull();
    });

    it('ao voltar para hoje', () => {
      component.irParaHoje();
      expect(component.diaSelecionado()).toBeNull();
      expect(component.agendamentoParaAcoes()).toBeNull();
    });

    it('ao trocar o filtro de profissional', () => {
      component.onFiltroChange('20');
      expect(component.diaSelecionado()).toBeNull();
      expect(component.agendamentoParaAcoes()).toBeNull();
    });
  });

  it('mapeia cada status para uma cor de bolinha', () => {
    expect(component.dotClass('AGENDADO')).toBe('bg-blue-500');
    expect(component.dotClass('REALIZADO')).toBe('bg-teal-500');
    expect(component.dotClass('FALTA')).toBe('bg-amber-500');
    expect(component.dotClass('CANCELADO')).toBe('bg-gray-400');
  });
});
