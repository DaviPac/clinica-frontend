import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';

import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { ServicoService } from '../../../core/services/servico/servico.service';

import { AgendamentosModalComponent } from '../agendamentos-modal/agendamentos-modal.component';
import { AgendamentosStatusModalComponent } from '../agendamentos-status-modal/agendamentos-status-modal.component';
import { formatarDataHora, formatarHora } from '../../../core/utils/data.utils';
import { FiltroProfissionalComponent } from '../../../shared/components/filtro-profissional/filtro-profissional.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ViewportService } from '../../../core/services/viewport/viewport.service';
import { AgendaCardComponent } from '../agenda-card/agenda-card.component';
import { AgendaAcoesSheetComponent } from '../agenda-acoes-sheet/agenda-acoes-sheet.component';

type ModoVisualizacao = 'mensal' | 'semanal';

/** Quantas bolinhas de densidade cabem numa célula da grade mensal no mobile. */
const MAX_DOTS = 3;

interface DiaCalendario {
  diaNumero: number | null;
  /** 'YYYY-MM-DD' — chave usada para abrir a sheet do dia. */
  dataISO: string | null;
  agendamentos: Agendamento[];
  isToday: boolean;
  /** Status das primeiras sessões, para as bolinhas do mobile. */
  dots: StatusAgendamento[];
  /** Quantas sessões ficaram além das bolinhas ("+N"). */
  extras: number;
}

interface DiaSemana {
  data: Date;
  diaNumero: number;
  nomeDia: string;
  agendamentos: Agendamento[];
  isToday: boolean;
}

@Component({
  selector: 'app-agendamentos-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    AgendamentosModalComponent, AgendamentosStatusModalComponent,
    FiltroProfissionalComponent, ToggleComponent,
    AlertComponent, ConfirmDialogComponent, ModalComponent,
    AgendaCardComponent, AgendaAcoesSheetComponent
  ],
  templateUrl: './agendamentos-lista.component.html',
  styleUrl: './agendamentos-lista.component.css'
})
export class AgendamentosListaComponent implements OnInit {
  private authService = inject(AuthService);
  private pacienteService = inject(PacienteService);
  private usuarioService = inject(UsuarioService);
  private servicoService = inject(ServicoService);
  private service = inject(AgendamentoService);
  private viewport = inject(ViewportService);

  isMobile = this.viewport.isMobile;

  agendamentos = signal<Agendamento[]>([]);
  carregando = signal(true);
  erro = signal<string | null>(null);

  isAdmin = this.authService.isAdmin;
  mostrarInativos = signal(false);
  filtroProfissionalId = signal<string | undefined>(undefined);

  // NOVO: modo de visualização (mês x semana) e data de referência única
  modoView = signal<ModoVisualizacao>('mensal');
  dataReferencia = signal<Date>(new Date());

  pacientesDict = signal<Record<number, string>>({});
  usuariosDict = signal<Record<number, string>>({});
  servicosDict = signal<Record<number, string>>({});

  /** Mobile: a barra de filtros fica recolhida por padrão. */
  filtrosAbertos = signal(false);

  /** Mobile: dia ('YYYY-MM-DD') cuja bottom sheet de sessões está aberta. */
  diaSelecionado = signal<string | null>(null);
  /** Mobile: sessão cuja bottom sheet de ações está aberta. */
  agendamentoParaAcoes = signal<Agendamento | null>(null);

  modalCriacaoAberto = signal(false);
  agendamentoParaStatus = signal<Agendamento | null>(null);
  atualizandoPagamento = signal<number | null>(null);
  agendamentoParaCancelarSerie = signal<Agendamento | null>(null);
  cancelandoSerie = signal(false);

  // modal de confirmação de pagamento de pacote
  agendamentoParaConfirmarPagamento = signal<Agendamento | null>(null);
  agendamentoParaCancelarPagamento = signal<Agendamento | null>(null);

  // Retorna o domingo (00:00) da semana que contém a data informada
  private inicioSemana(d: Date): Date {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() - r.getDay()); // getDay(): 0 = domingo
    return r;
  }

  private formatarISO(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // ALTERADO: intervalo depende do modo (mês inteiro ou semana)
  filtro = computed(() => {
    const ref = this.dataReferencia();
    let inicio: Date;
    let fim: Date;

    if (this.modoView() === 'semanal') {
      inicio = this.inicioSemana(ref);
      fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
    } else {
      inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
      fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    }

    return { de: this.formatarISO(inicio), ate: this.formatarISO(fim) };
  });

  labelPeriodo = computed(() => {
    const ref = this.dataReferencia();

    if (this.modoView() === 'semanal') {
      const inicio = this.inicioSemana(ref);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `${fmt(inicio)} – ${fmt(fim)} de ${fim.getFullYear()}`;
    }

    const mes = ref.toLocaleDateString('pt-BR', { month: 'long' });
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${ref.getFullYear()}`;
  });

  subtituloPeriodo = computed(() =>
    this.modoView() === 'semanal' ? 'Visão Semanal da Agenda' : 'Visão Mensal da Agenda'
  );

  private filtrarPorData(dataStr: string): Agendamento[] {
    let ags = this.agendamentos().filter(a => a.dataHoraInicio.startsWith(dataStr));
    if (!this.mostrarInativos()) {
      ags = ags.filter(a => a.status !== 'CANCELADO');
    }
    return ags;
  }

  // Grade mensal (com células vazias para alinhar o 1º dia)
  diasCalendario = computed<DiaCalendario[]>(() => {
    const data = this.dataReferencia();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias: DiaCalendario[] = [];
    const hoje = new Date();

    for (let i = 0; i < primeiroDia.getDay(); i++) {
      dias.push({ diaNumero: null, dataISO: null, agendamentos: [], isToday: false, dots: [], extras: 0 });
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
      const ags = this.filtrarPorData(dataStr);
      dias.push({
        diaNumero: d,
        dataISO: dataStr,
        agendamentos: ags,
        isToday,
        dots: ags.slice(0, MAX_DOTS).map(a => a.status),
        extras: Math.max(0, ags.length - MAX_DOTS),
      });
    }

    return dias;
  });

  /**
   * Sessões da sheet do dia. É um computed sobre `agendamentos()` — e não uma
   * cópia congelada — para que a sheet se atualize sozinha quando uma mudança
   * de status ou de pagamento dispara `carregarAgendamentos()`.
   */
  agendamentosDoDia = computed(() => {
    const dia = this.diaSelecionado();
    return dia ? this.filtrarPorData(dia) : [];
  });

  labelDiaSelecionado = computed(() => {
    const dia = this.diaSelecionado();
    if (!dia) return '';
    const [ano, mes, d] = dia.split('-').map(Number);
    const label = new Date(ano, mes - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  abrirDia(dia: DiaCalendario) {
    if (dia.dataISO && dia.agendamentos.length) this.diaSelecionado.set(dia.dataISO);
  }

  /**
   * Fechar a sheet de ações é no-op enquanto houver um diálogo por cima:
   * todos os overlays escutam Esc no `document`, então sem essa guarda um
   * único Esc fecharia os dois de uma vez.
   */
  fecharAcoes() {
    if (this.agendamentoParaStatus() || this.agendamentoParaCancelarSerie()
      || this.agendamentoParaConfirmarPagamento() || this.agendamentoParaCancelarPagamento()) return;
    this.agendamentoParaAcoes.set(null);
  }

  /** Período ou filtro mudou — as sheets apontariam para dados velhos. */
  private fecharSheets() {
    this.diaSelecionado.set(null);
    this.agendamentoParaAcoes.set(null);
  }

  dotClass(status: StatusAgendamento): string {
    const map: Record<StatusAgendamento, string> = {
      AGENDADO: 'bg-blue-500',
      REALIZADO: 'bg-teal-500',
      FALTA: 'bg-amber-500',
      CANCELADO: 'bg-gray-400',
    };
    return map[status];
  }

  // NOVO: grade semanal (7 dias, domingo -> sábado)
  diasSemana = computed<DiaSemana[]>(() => {
    const inicio = this.inicioSemana(this.dataReferencia());
    const hoje = new Date();
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dias: DiaSemana[] = [];

    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      const dataStr = this.formatarISO(dia);
      dias.push({
        data: dia,
        diaNumero: dia.getDate(),
        nomeDia: nomes[dia.getDay()],
        agendamentos: this.filtrarPorData(dataStr),
        isToday: dia.toDateString() === hoje.toDateString(),
      });
    }

    return dias;
  });

  private static readonly CACHE_KEY = 'agendamentos:filtros';

  ngOnInit() {
    this.restaurarFiltrosDoCache();
    this.carregarDadosBase();
  }

  // Restaura mês/semana, data, profissional e "mostrar canceladas" ao voltar para a tela
  private restaurarFiltrosDoCache() {
    try {
      const raw = sessionStorage.getItem(AgendamentosListaComponent.CACHE_KEY);
      if (!raw) return;

      const cache = JSON.parse(raw) as {
        modo?: ModoVisualizacao;
        data?: string;
        profissionalId?: string;
        inativos?: boolean;
      };

      if (cache.modo === 'semanal') this.modoView.set('semanal');

      if (cache.data) {
        const [ano, mes, dia] = cache.data.split('-').map(Number);
        if (ano && mes && dia) this.dataReferencia.set(new Date(ano, mes - 1, dia));
      }

      if (cache.profissionalId) this.filtroProfissionalId.set(cache.profissionalId);

      if (cache.inativos) this.mostrarInativos.set(true);
    } catch {
      // sessionStorage indisponível (ex.: modo privado) — segue com os valores padrão
    }
  }

  private salvarFiltrosNoCache() {
    try {
      const cache = {
        modo: this.modoView() === 'semanal' ? 'semanal' : undefined,
        data: this.formatarISO(this.dataReferencia()),
        profissionalId: this.filtroProfissionalId(),
        inativos: this.mostrarInativos() || undefined,
      };
      sessionStorage.setItem(AgendamentosListaComponent.CACHE_KEY, JSON.stringify(cache));
    } catch {
      // sessionStorage indisponível (ex.: modo privado) — filtros simplesmente não persistem
    }
  }

  carregarDadosBase() {
    this.carregando.set(true);
    forkJoin({
      pacientes: this.pacienteService.listar(true),
      usuarios: this.isAdmin() ? this.usuarioService.listar() : of([this.authService.usuario()]),
      servicos: this.servicoService.listar({ incluirInativos: true })
    }).subscribe({
      next: (res) => {
        const conv = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.nome }), {});
        this.pacientesDict.set(conv(res.pacientes));
        this.usuariosDict.set(conv(res.usuarios));
        this.servicosDict.set(conv(res.servicos));
        this.carregarAgendamentos();
      },
      error: (err) => {
        this.erro.set('Erro ao carregar dados auxiliares: ' + err.message);
        this.carregando.set(false);
      }
    });
  }

  carregarAgendamentos() {
    this.carregando.set(true);
    this.erro.set(null);
    const { de, ate } = this.filtro();

    this.service.listar({ periodo: { de, ate }, profissionalId: this.filtroProfissionalId() }).subscribe({
      next: lista => {
        this.agendamentos.set(
          lista.sort((a, b) => new Date(a.dataHoraInicio).getTime() - new Date(b.dataHoraInicio).getTime())
        );
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  // NOVO: alterna entre mês e semana (recarrega pois o intervalo muda)
  setModoView(modo: ModoVisualizacao) {
    if (this.modoView() === modo) return;
    this.modoView.set(modo);
    this.fecharSheets();
    this.salvarFiltrosNoCache();
    this.carregarAgendamentos();
  }

  // ALTERADO: navega por mês ou por semana conforme o modo atual
  navegar(direcao: 1 | -1) {
    const ref = this.dataReferencia();
    if (this.modoView() === 'semanal') {
      const nova = new Date(ref);
      nova.setDate(ref.getDate() + direcao * 7);
      this.dataReferencia.set(nova);
    } else {
      this.dataReferencia.set(new Date(ref.getFullYear(), ref.getMonth() + direcao, 1));
    }
    this.fecharSheets();
    this.salvarFiltrosNoCache();
    this.carregarAgendamentos();
  }

  // NOVO: volta para o período atual (mês/semana de hoje)
  irParaHoje() {
    this.dataReferencia.set(new Date());
    this.fecharSheets();
    this.salvarFiltrosNoCache();
    this.carregarAgendamentos();
  }

  // intercepta se for pacote e o pagamento for para "pago"
  iniciarTogglePagamento(ag: Agendamento) {
    const vaiBaixar = !ag.pagoPeloPaciente; // true = vai marcar como pago

    if (ag.valorPacote != null) {
      if (vaiBaixar) this.agendamentoParaConfirmarPagamento.set(ag);
      else this.agendamentoParaCancelarPagamento.set(ag)
    } else {
      this.executarTogglePagamento(ag);
    }
  }

  confirmarPagamentoPacote() {
    const ag = this.agendamentoParaConfirmarPagamento();
    if (!ag) return;
    this.agendamentoParaConfirmarPagamento.set(null);
    this.executarTogglePagamento(ag);
  }

  cancelarPagamentoPacote() {
    const ag = this.agendamentoParaCancelarPagamento();
    if (!ag) return;
    this.agendamentoParaCancelarPagamento.set(null);
    this.executarTogglePagamento(ag);
  }

  private executarTogglePagamento(ag: Agendamento) {
    this.atualizandoPagamento.set(ag.id);
    this.service.atualizarPagamento(ag.id, !ag.pagoPeloPaciente).subscribe({
      next: () => {
        this.atualizandoPagamento.set(null);
        this.agendamentoParaAcoes.set(null);
        this.carregarAgendamentos();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.atualizandoPagamento.set(null);
      },
    });
  }

  abrirModalStatus(ag: Agendamento) {
    this.agendamentoParaStatus.set(ag);
  }

  onStatusAtualizado(payload: { id: number; status: StatusAgendamento }) {
    this.agendamentoParaStatus.set(null);
    this.agendamentoParaAcoes.set(null);
    this.carregarAgendamentos();
  }

  onAgendamentoCriado() {
    this.modalCriacaoAberto.set(false);
    this.carregarAgendamentos();
  }

  confirmarCancelamentoSerie(ag: Agendamento) {
    this.agendamentoParaCancelarSerie.set(ag);
  }

  cancelarSerie() {
    const ag = this.agendamentoParaCancelarSerie();
    if (!ag?.recorrenciaGroupId) return;

    this.cancelandoSerie.set(true);
    this.service.cancelarRecorrencia(ag.recorrenciaGroupId).subscribe({
      next: () => {
        this.agendamentoParaCancelarSerie.set(null);
        this.agendamentoParaAcoes.set(null);
        this.cancelandoSerie.set(false);
        this.carregarAgendamentos();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.cancelandoSerie.set(false);
        this.agendamentoParaCancelarSerie.set(null);
      },
    });
  }

  formatarDataHora = formatarDataHora;
  formatarHora = formatarHora;

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  onFiltroChange(profissionalId?: string) {
    this.filtroProfissionalId.set(profissionalId);
    this.fecharSheets();
    this.salvarFiltrosNoCache();
    this.carregarAgendamentos()
  }

  onToggleInativos(inativo: boolean) {
    this.mostrarInativos.set(inativo);
    this.salvarFiltrosNoCache();
  }
}