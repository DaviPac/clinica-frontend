import {
  Component,
  ElementRef,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Editor } from '@tiptap/core';

import { Agendamento } from '../../../core/models/agendamento.model';
import {
  DocumentoAtual,
  DocumentoProntuario,
  ProntuarioVersao,
  ProntuarioVersaoResumo,
} from '../../../core/models/prontuario.model';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ProntuarioService } from '../../../core/services/prontuario/prontuario.service';
import { formatarDataHora, formatarHora } from '../../../core/utils/data.utils';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { BotaoComponent } from '../../../shared/ui/botao/botao.component';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';
import { PaginaComponent } from '../../../shared/ui/pagina/pagina.component';
import { ProntuarioHistoricoComponent } from '../prontuario-historico/prontuario-historico.component';
import { nomeArquivo } from './documento/documento';
import { extensoesDocumento } from './documento/extensoes';
import { DOCUMENTO_VAZIO } from './edicao-prontuario';
import { configDaRota, injetarServicoDocumento } from './documento/tipos';

interface Ferramenta {
  rotulo: string;
  icone: string;
  ativa?: (e: Editor) => boolean;
  executar: (e: Editor) => void;
}

/**
 * Prontuário ou anotações de uma sessão (`data.documento` da rota): lê,
 * edita, importa .docx e exporta .docx/PDF. No prontuário cada salvamento
 * vira uma versão nova e as anteriores ficam no histórico; as anotações
 * têm uma versão só, e a tela esconde o histórico.
 *
 * Abre em leitura quando o prontuário existe e direto no editor quando não
 * existe — é a mesma tela para criar e para consultar.
 *
 * O editor completo (fontes, cores, tabelas, folha A4) abre em outra guia;
 * quando ele salva, esta tela é avisada e se atualiza.
 */
@Component({
  selector: 'app-prontuario',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    BotaoComponent,
    CarregandoComponent,
    PaginaComponent,
    ProntuarioHistoricoComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './prontuario.component.html',
  styleUrl: './prontuario.component.css',
})
export class ProntuarioComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private agendamentoService = inject(AgendamentoService);
  /** Só para o histórico, que é exclusivo do prontuário. */
  private prontuarioService = inject(ProntuarioService);
  readonly config = configDaRota(inject(ActivatedRoute).snapshot);
  /** A API do documento da tela: carregar, criar, atualizar e as mensagens entre guias. */
  private servico = injetarServicoDocumento(this.config.tipo);
  private destroyRef = inject(DestroyRef);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');
  private seletorArquivo = viewChild<ElementRef<HTMLInputElement>>('seletorArquivo');
  private editor: Editor | null = null;
  private agendamentoId = 0;

  agendamento = signal<Agendamento | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);
  semPermissao = signal(false);

  versaoAtual = signal<DocumentoAtual | null>(null);
  /** Histórico: só é buscado quando o usuário abre o painel; null = ainda não buscado. */
  versoes = signal<ProntuarioVersaoResumo[] | null>(null);
  historicoAberto = signal(false);
  carregandoHistorico = signal(false);
  /** Versão antiga aberta para leitura; null = mostrando a atual. */
  versaoAntiga = signal<ProntuarioVersao | null>(null);
  carregandoVersao = signal(false);

  editando = signal(false);
  salvando = signal(false);
  alterado = signal(false);

  importando = signal(false);
  /** HTML de um .docx esperando a confirmação para substituir o conteúdo. */
  importacaoPendente = signal<string | null>(null);
  avisosImportacao = signal<string[]>([]);
  exportando = signal<'docx' | 'pdf' | null>(null);
  vazio = signal(true);
  salvoEm = signal<string | null>(null);
  confirmandoDescarte = signal(false);
  /** Outra guia salvou enquanto havia alterações aqui. */
  salvoEmOutraGuia = signal(false);
  /**
   * O texto entregue ao editor completo. Enquanto o editor daqui continuar
   * igual a ele, o salvamento feito lá não conflita com nada aqui.
   */
  private entregueAoCompleto: string | null = null;

  /** Muda a cada transação do editor, para a barra reler o que está ativo. */
  private versaoEditor = signal(0);

  existe = computed(() => this.versaoAtual() !== null);

  formatarDataHora = formatarDataHora;

  readonly grupos: Ferramenta[][] = [
    [
      { rotulo: 'Desfazer', icone: '↶', executar: (e) => e.chain().focus().undo().run() },
      { rotulo: 'Refazer', icone: '↷', executar: (e) => e.chain().focus().redo().run() },
    ],
    [
      {
        rotulo: 'Título',
        icone: 'H1',
        ativa: (e) => e.isActive('heading', { level: 1 }),
        executar: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        rotulo: 'Subtítulo',
        icone: 'H2',
        ativa: (e) => e.isActive('heading', { level: 2 }),
        executar: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        rotulo: 'Seção',
        icone: 'H3',
        ativa: (e) => e.isActive('heading', { level: 3 }),
        executar: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        rotulo: 'Negrito',
        icone: 'B',
        ativa: (e) => e.isActive('bold'),
        executar: (e) => e.chain().focus().toggleBold().run(),
      },
      {
        rotulo: 'Itálico',
        icone: 'I',
        ativa: (e) => e.isActive('italic'),
        executar: (e) => e.chain().focus().toggleItalic().run(),
      },
      {
        rotulo: 'Sublinhado',
        icone: 'U',
        ativa: (e) => e.isActive('underline'),
        executar: (e) => e.chain().focus().toggleUnderline().run(),
      },
      {
        rotulo: 'Tachado',
        icone: 'S',
        ativa: (e) => e.isActive('strike'),
        executar: (e) => e.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        rotulo: 'Lista',
        icone: '•',
        ativa: (e) => e.isActive('bulletList'),
        executar: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        rotulo: 'Lista numerada',
        icone: '1.',
        ativa: (e) => e.isActive('orderedList'),
        executar: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        rotulo: 'Citação',
        icone: '❝',
        ativa: (e) => e.isActive('blockquote'),
        executar: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        rotulo: 'Linha divisória',
        icone: '―',
        executar: (e) => e.chain().focus().setHorizontalRule().run(),
      },
    ],
  ];

  constructor() {
    // O host do editor fica sempre no DOM (só escondido), então já existe aqui
    afterNextRender(() => {
      this.editor = new Editor({
        element: this.host().nativeElement,
        // O mesmo esquema do editor completo: com menos extensões, tabelas e cores sumiriam ao salvar
        extensions: extensoesDocumento(this.config.placeholder),
        editable: false,
        onTransaction: () => this.versaoEditor.update((n) => n + 1),
        onUpdate: ({ editor }) => {
          this.alterado.set(true);
          this.vazio.set(editor.isEmpty);
        },
      });
      this.aplicarDadosNoEditor();
    });
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.erro.set('ID de agendamento inválido.');
      this.carregando.set(false);
      return;
    }
    this.agendamentoId = id;

    forkJoin({
      agendamento: this.agendamentoService.obterPorId(id),
      // Sem o documento ainda não é erro: é a tela de criação
      versao: this.servico.obter(id).pipe(
        catchError((err) => (this.servico.naoExiste(err) ? of(null) : throwError(() => err))),
      ),
    }).subscribe({
      next: ({ agendamento, versao }) => {
        this.agendamento.set(agendamento);
        if (agendamento?.profissionalId !== this.authService.usuario()?.id) {
          this.semPermissao.set(true);
        }
        this.versaoAtual.set(versao);
        this.carregando.set(false);
        // Sem o documento não há o que visualizar: vai direto para a criação
        this.editando.set(!versao);
        this.aplicarDadosNoEditor();
      },
      error: (err: Error) => {
        this.erro.set(`Erro ao carregar ${this.config.oNome}: ${err.message}`);
        this.carregando.set(false);
      },
    });

    // O editor completo, em outra guia, salvou: mostra a versão nova se não há nada a perder
    this.servico
      .salvoEmOutraGuia(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.alterado() && !this.semMudancasDesdeAEntrega()) {
          this.salvoEmOutraGuia.set(true);
          return;
        }
        // O que estava pendente aqui foi o que o editor completo salvou
        this.alterado.set(false);
        this.recarregarVersaoAtual(!this.versaoAntiga());
      });
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  /** Chamado tanto quando o editor nasce quanto quando os dados chegam — o que vier por último aplica. */
  private aplicarDadosNoEditor() {
    if (!this.editor || this.carregando() || this.semPermissao()) return;
    this.mostrarNoEditor(this.versaoAtual()?.conteudo ?? DOCUMENTO_VAZIO);
    this.editor.setEditable(this.editando());
    if (this.editando()) this.editor.commands.focus('end');
  }

  private mostrarNoEditor(conteudo: DocumentoProntuario) {
    if (!this.editor) return;
    this.editor.commands.setContent(conteudo, { emitUpdate: false });
    this.alterado.set(false);
    this.vazio.set(this.editor.isEmpty);
  }

  // --- Barra de ferramentas ---

  ativa(f: Ferramenta): boolean {
    this.versaoEditor(); // dependência: reavalia a cada transação
    return !!this.editor && !!f.ativa?.(this.editor);
  }

  executar(f: Ferramenta) {
    if (this.editor) f.executar(this.editor);
  }

  // --- Edição ---

  iniciarEdicao() {
    if (!this.editor) return;
    if (this.versaoAntiga()) this.voltarParaAtual();
    this.historicoAberto.set(false);
    this.editando.set(true);
    this.salvoEm.set(null);
    this.editor.setEditable(true);
    this.editor.commands.focus('end');
  }

  salvar() {
    if (!this.editor || this.salvando() || this.vazio()) return;
    const conteudo = this.editor.getJSON();
    const requisicao = this.existe()
      ? this.servico.atualizar(this.agendamentoId, conteudo)
      : this.servico.criar(this.agendamentoId, conteudo);

    this.salvando.set(true);
    this.erro.set(null);
    requisicao.subscribe({
      next: () => {
        this.salvando.set(false);
        this.alterado.set(false);
        this.salvoEmOutraGuia.set(false);
        this.salvoEm.set(formatarHora(new Date().toISOString()));
        this.recarregarVersaoAtual(false);
      },
      error: (err: Error) => {
        this.erro.set(`Erro ao salvar ${this.config.oNome}: ${err.message}`);
        this.salvando.set(false);
      },
    });
  }

  /** Sai do editor; se houver alterações não salvas, pede confirmação antes. */
  concluirEdicao() {
    if (this.alterado()) {
      this.confirmandoDescarte.set(true);
      return;
    }
    this.sairDaEdicao();
  }

  descartarAlteracoes() {
    this.confirmandoDescarte.set(false);
    this.salvoEmOutraGuia.set(false);
    this.mostrarNoEditor(this.versaoAtual()?.conteudo ?? DOCUMENTO_VAZIO);
    this.sairDaEdicao();
  }

  private sairDaEdicao() {
    // Criação cancelada: não há documento para visualizar
    if (!this.existe()) {
      this.voltar();
      return;
    }
    this.editando.set(false);
    this.salvoEm.set(null);
    this.editor?.setEditable(false);
  }

  /** `mostrar`: troca o que está no editor pela versão nova — só quando não há nada a perder. */
  private recarregarVersaoAtual(mostrar: boolean) {
    // O histórico ganhou uma versão: a lista antiga não vale mais
    this.versoes.set(null);
    this.servico.obter(this.agendamentoId).subscribe({
      next: (versao) => {
        this.versaoAtual.set(versao);
        if (mostrar && !this.alterado()) {
          this.mostrarNoEditor(versao.conteudo);
          this.salvoEmOutraGuia.set(false);
        }
      },
      error: (err: Error) => this.erro.set(`Erro ao atualizar ${this.config.oNome}: ${err.message}`),
    });
  }

  // --- Histórico ---

  alternarHistorico() {
    if (this.historicoAberto()) {
      this.historicoAberto.set(false);
      if (this.versaoAntiga()) this.voltarParaAtual();
      return;
    }
    this.historicoAberto.set(true);
    if (this.versoes() === null) this.carregarHistorico();
  }

  private carregarHistorico() {
    this.carregandoHistorico.set(true);
    this.prontuarioService.listarVersoes(this.agendamentoId).subscribe({
      next: (versoes) => {
        this.versoes.set(versoes);
        this.carregandoHistorico.set(false);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao carregar histórico: ' + err.message);
        this.historicoAberto.set(false);
        this.carregandoHistorico.set(false);
      },
    });
  }

  abrirVersao(resumo: ProntuarioVersaoResumo) {
    if (this.editando() || this.carregandoVersao()) return;
    if (resumo.versaoId === this.versaoAtual()?.versaoId) {
      this.voltarParaAtual();
      return;
    }
    this.carregandoVersao.set(true);
    this.prontuarioService.obterVersao(this.agendamentoId, resumo.versaoId).subscribe({
      next: (versao) => {
        this.versaoAntiga.set(versao);
        this.mostrarNoEditor(versao.conteudo);
        this.carregandoVersao.set(false);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao carregar versão: ' + err.message);
        this.carregandoVersao.set(false);
      },
    });
  }

  voltarParaAtual() {
    this.versaoAntiga.set(null);
    this.mostrarNoEditor(this.versaoAtual()?.conteudo ?? DOCUMENTO_VAZIO);
  }

  versaoExibidaId(): number | null {
    return this.versaoAntiga()?.versaoId ?? this.versaoAtual()?.versaoId ?? null;
  }

  // --- Importar / exportar ---

  escolherArquivo() {
    this.seletorArquivo()?.nativeElement.click();
  }

  async aoEscolherArquivo(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo || !this.editor) return;

    this.importando.set(true);
    this.erro.set(null);
    this.avisosImportacao.set([]);
    try {
      const { importarDocx } = await import('./documento/importar-docx');
      const { html, avisos } = await importarDocx(arquivo);
      this.avisosImportacao.set(avisos);
      // Não apaga o que já foi escrito sem perguntar
      if (this.editor.isEmpty) this.aplicarImportacao(html);
      else this.importacaoPendente.set(html);
    } catch {
      this.erro.set('Não foi possível ler o arquivo. Verifique se é um .docx válido.');
    } finally {
      this.importando.set(false);
    }
  }

  aplicarImportacao(html = this.importacaoPendente()) {
    this.importacaoPendente.set(null);
    if (!this.editor || html === null) return;
    this.editor.chain().setContent(html).focus('start').run(); // dispara onUpdate: fica "alterado"
  }

  async exportar(formato: 'docx' | 'pdf') {
    const ag = this.agendamento();
    if (!this.editor || !ag || this.exportando()) return;

    this.exportando.set(formato);
    this.erro.set(null);
    const documento = this.editor.getJSON();
    const nome = nomeArquivo(ag.paciente, ag.dataHoraInicio, formato, this.config.prefixoArquivo);
    try {
      if (formato === 'docx') {
        const { exportarDocx } = await import('./documento/exportar-docx');
        await exportarDocx(documento, nome);
      } else {
        const { exportarPdf } = await import('./documento/exportar-pdf');
        await exportarPdf(documento, nome);
      }
    } catch {
      this.erro.set(`Não foi possível gerar o ${formato === 'pdf' ? 'PDF' : '.docx'}.`);
    } finally {
      this.exportando.set(null);
    }
  }

  // --- Navegação ---

  /** Abre o editor completo em outra guia levando o texto em andamento, mesmo sem salvar. */
  abrirCompleto() {
    let queryParams = {};
    if (this.editando() && this.alterado() && this.editor) {
      const conteudo = this.editor.getJSON();
      this.entregueAoCompleto = JSON.stringify(conteudo);
      queryParams = { rascunho: this.servico.oferecerRascunho(conteudo) };
    }
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/agendamentos', this.agendamentoId, this.config.rota, 'completo'], { queryParams }),
    );
    window.open(url, '_blank', 'noopener');
  }

  private semMudancasDesdeAEntrega(): boolean {
    return !!this.editor && this.entregueAoCompleto === JSON.stringify(this.editor.getJSON());
  }

  voltar() {
    this.router.navigate(['/agendamentos', this.agendamentoId]);
  }

  @HostListener('document:keydown', ['$event'])
  onTecla(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && this.editando()) {
      e.preventDefault();
      this.salvar();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onSairDaPagina(e: BeforeUnloadEvent) {
    if (this.alterado()) e.preventDefault();
  }
}
