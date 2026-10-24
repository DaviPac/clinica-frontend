import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, from, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Editor } from '@tiptap/core';

import { Agendamento } from '../../../core/models/agendamento.model';
import { DocumentoAtual, DocumentoProntuario } from '../../../core/models/prontuario.model';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { formatarHora } from '../../../core/utils/data.utils';
import { nomeArquivo } from './documento/documento';
import { extensoesDocumento } from './documento/extensoes';
import { configDaRota, injetarServicoDocumento } from './documento/tipos';

export const DOCUMENTO_VAZIO: DocumentoProntuario = { type: 'doc', content: [] };

/**
 * Sessão de edição de um documento do agendamento — prontuário ou
 * anotações, conforme o `data.documento` da rota —, para as telas que só
 * editam (hoje, o editor completo): carrega, salva, importa/exporta e
 * acompanha os salvamentos feitos em outras guias. Cada tela fornece a
 * sua instância:
 *
 *   providers: [EdicaoProntuario]
 *
 * O editor nasce em `montar` (precisa do elemento no DOM) e os dados chegam
 * por `carregar` — o que vier por último aplica o conteúdo.
 */
@Injectable()
export class EdicaoProntuario {
  private authService = inject(AuthService);
  private agendamentoService = inject(AgendamentoService);
  private destroyRef = inject(DestroyRef);

  readonly config = configDaRota(inject(ActivatedRoute).snapshot);
  private servico = injetarServicoDocumento(this.config.tipo);

  editor: Editor | null = null;
  agendamentoId = 0;
  /** Texto não salvo vindo da guia que abriu esta; entra no lugar da versão salva. */
  private rascunho: DocumentoProntuario | null = null;

  agendamento = signal<Agendamento | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);
  semPermissao = signal(false);
  versaoAtual = signal<DocumentoAtual | null>(null);
  existe = computed(() => this.versaoAtual() !== null);

  salvando = signal(false);
  alterado = signal(false);
  salvoEm = signal<string | null>(null);
  vazio = signal(true);
  /** Outra guia salvou enquanto havia alterações aqui: salvar agora cria uma versão por cima. */
  salvoEmOutraGuia = signal(false);

  importando = signal(false);
  /** HTML de um .docx esperando a confirmação para substituir o conteúdo. */
  importacaoPendente = signal<string | null>(null);
  avisosImportacao = signal<string[]>([]);
  exportando = signal<'docx' | 'pdf' | null>(null);

  palavras = signal(0);
  caracteres = signal(0);

  /** Muda a cada transação do editor, para as barras relerem o que está ativo. */
  private versaoEditor = signal(0);

  constructor() {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.salvar();
      }
    };
    const aoSair = (e: BeforeUnloadEvent) => {
      if (this.alterado()) e.preventDefault();
    };
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('beforeunload', aoSair);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('beforeunload', aoSair);
      this.editor?.destroy();
    });
  }

  /** `codigoRascunho`: veio de uma guia com alterações não salvas — ver `DocumentoAgendamentoService.oferecerRascunho`. */
  carregar(agendamentoId: number, codigoRascunho: string | null = null) {
    if (!agendamentoId) {
      this.erro.set('ID de agendamento inválido.');
      this.carregando.set(false);
      return;
    }
    this.agendamentoId = agendamentoId;

    forkJoin({
      agendamento: this.agendamentoService.obterPorId(agendamentoId),
      // Sem o documento ainda não é erro: o primeiro salvamento cria
      versao: this.servico.obter(agendamentoId).pipe(
        catchError((err) => (this.servico.naoExiste(err) ? of(null) : throwError(() => err))),
      ),
      rascunho: codigoRascunho ? from(this.servico.buscarRascunho(codigoRascunho)) : of(null),
    }).subscribe({
      next: ({ agendamento, versao, rascunho }) => {
        if (codigoRascunho && !rascunho) {
          this.erro.set(
            'Não foi possível trazer as alterações não salvas da outra guia (ela foi fechada?). Abrimos a última versão salva.',
          );
        }
        this.rascunho = rascunho;
        this.agendamento.set(agendamento);
        if (agendamento?.profissionalId !== this.authService.usuario()?.id) {
          this.semPermissao.set(true);
        }
        this.versaoAtual.set(versao);
        this.carregando.set(false);
        this.aplicarDados();
      },
      error: (err: Error) => {
        this.erro.set(`Erro ao carregar ${this.config.oNome}: ${err.message}`);
        this.carregando.set(false);
      },
    });

    this.servico
      .salvoEmOutraGuia(agendamentoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.alterado()) this.salvoEmOutraGuia.set(true);
        else this.recarregarVersaoAtual(true);
      });
  }

  montar(elemento: HTMLElement, placeholder?: string) {
    this.editor = new Editor({
      element: elemento,
      extensions: extensoesDocumento(placeholder ?? this.config.placeholder),
      onTransaction: () => this.versaoEditor.update((n) => n + 1),
      onUpdate: () => {
        this.alterado.set(true);
        this.contar();
      },
    });
    this.aplicarDados();
  }

  private aplicarDados() {
    if (!this.editor || this.carregando() || this.semPermissao()) return;
    if (this.rascunho) {
      // Dispara onUpdate: o texto trazido continua "alterado" até ser salvo
      this.editor.commands.setContent(this.rascunho);
      this.rascunho = null;
    } else {
      this.mostrar(this.versaoAtual()?.conteudo ?? DOCUMENTO_VAZIO);
    }
    this.editor.commands.focus('end');
  }

  private mostrar(conteudo: DocumentoProntuario) {
    if (!this.editor) return;
    this.editor.commands.setContent(conteudo, { emitUpdate: false });
    this.alterado.set(false);
    this.contar();
  }

  private contar() {
    if (!this.editor) return;
    this.vazio.set(this.editor.isEmpty);
    this.palavras.set(this.editor.storage.characterCount.words());
    this.caracteres.set(this.editor.storage.characterCount.characters());
  }

  /** Lê algo do editor e reavalia a cada transação — para estados da barra. */
  ler<T>(leitura: (e: Editor) => T, padrao: T): T {
    this.versaoEditor();
    return this.editor ? leitura(this.editor) : padrao;
  }

  executar(acao: (e: Editor) => unknown) {
    if (this.editor) acao(this.editor);
  }

  // --- Salvar ---

  /** Resolve com true se salvou. */
  salvar(): Promise<boolean> {
    if (!this.editor || this.salvando() || this.vazio() || this.semPermissao() || this.carregando()) {
      return Promise.resolve(false);
    }
    const conteudo = this.editor.getJSON();
    const requisicao = this.existe()
      ? this.servico.atualizar(this.agendamentoId, conteudo)
      : this.servico.criar(this.agendamentoId, conteudo);

    this.salvando.set(true);
    this.erro.set(null);
    return new Promise((resolver) =>
      requisicao.subscribe({
        next: () => {
          this.salvando.set(false);
          this.alterado.set(false);
          this.salvoEmOutraGuia.set(false);
          this.salvoEm.set(formatarHora(new Date().toISOString()));
          this.recarregarVersaoAtual(false);
          resolver(true);
        },
        error: (err: Error) => {
          this.erro.set(`Erro ao salvar ${this.config.oNome}: ${err.message}`);
          this.salvando.set(false);
          resolver(false);
        },
      }),
    );
  }

  /** `mostrar`: substitui o que está no editor — só quando não há nada a perder. */
  recarregarVersaoAtual(mostrar: boolean) {
    this.servico.obter(this.agendamentoId).subscribe({
      next: (versao) => {
        this.versaoAtual.set(versao);
        if (mostrar && !this.alterado()) {
          this.mostrar(versao.conteudo);
          this.salvoEmOutraGuia.set(false);
        }
      },
      error: (err: Error) => this.erro.set(`Erro ao atualizar ${this.config.oNome}: ${err.message}`),
    });
  }

  // --- Importar / exportar ---

  async importar(arquivo: File) {
    if (!this.editor) return;
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

  cancelarImportacao() {
    this.importacaoPendente.set(null);
    this.avisosImportacao.set([]);
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
}
