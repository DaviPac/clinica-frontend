import {
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@tiptap/core';

import { formatarDataHora } from '../../../core/utils/data.utils';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CampoTexto } from '../../../shared/components/formulario/campos';
import { FormularioService } from '../../../shared/components/formulario/formulario.service';
import { BotaoComponent } from '../../../shared/ui/botao/botao.component';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';
import { pontos } from '../prontuario/documento/documento';
import { EdicaoProntuario } from '../prontuario/edicao-prontuario';

interface Ferramenta {
  rotulo: string;
  /** Texto do botão — ou o nome de um ícone desenhado no template (`ic:…`). */
  icone: string;
  ativa?: (e: Editor) => boolean;
  /** Sem `pode`, a ferramenta está sempre disponível. */
  pode?: (e: Editor) => boolean;
  executar: (e: Editor) => void;
  /** Classe extra do botão, para o "B" em negrito, o "I" em itálico… */
  estilo?: string;
}

interface Opcao {
  valor: string;
  rotulo: string;
}

type Menu = 'cor' | 'destaque' | 'exportar' | 'tabela' | null;

const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
/** O mesmo tamanho base do .docx exportado (Calibri 11pt). */
const TAMANHO_PADRAO = 11;

/**
 * Editor completo do prontuário ou das anotações (`data.documento` da
 * rota), aberto em uma guia própria a partir da tela do documento:
 * folha A4 sobre a "mesa", faixa de ferramentas no estilo dos editores de
 * texto (fonte, tamanho, cores, alinhamento, tabelas…), zoom e contagem.
 *
 * Fica fora do shell — a guia é só o documento. Os salvamentos são
 * anunciados às outras guias pelo serviço do documento.
 */
@Component({
  selector: 'app-prontuario-editor-completo',
  standalone: true,
  imports: [AlertComponent, ConfirmDialogComponent, BotaoComponent, CarregandoComponent, NgTemplateOutlet],
  providers: [EdicaoProntuario],
  templateUrl: './prontuario-editor-completo.component.html',
  styleUrl: './prontuario-editor-completo.component.css',
})
export class ProntuarioEditorCompletoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private titulo = inject(Title);
  private formulario = inject(FormularioService);
  private elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  edicao = inject(EdicaoProntuario);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');
  private seletorArquivo = viewChild<ElementRef<HTMLInputElement>>('seletorArquivo');

  menu = signal<Menu>(null);
  zoom = signal(100);
  /** Grade do "Inserir tabela": linhas × colunas sob o cursor. */
  gradeTabela = signal({ linhas: 0, colunas: 0 });

  formatarDataHora = formatarDataHora;
  readonly tamanhos = TAMANHOS;
  readonly indices = Array.from({ length: 8 }, (_, i) => i + 1);

  readonly estilos: Opcao[] = [
    { valor: 'p', rotulo: 'Texto normal' },
    { valor: '1', rotulo: 'Título 1' },
    { valor: '2', rotulo: 'Título 2' },
    { valor: '3', rotulo: 'Título 3' },
  ];

  readonly fontes: Opcao[] = [
    { valor: '', rotulo: 'Padrão (Calibri)' },
    { valor: 'Arial, Helvetica, sans-serif', rotulo: 'Arial' },
    { valor: 'Georgia, serif', rotulo: 'Georgia' },
    { valor: '"Times New Roman", Times, serif', rotulo: 'Times New Roman' },
    { valor: 'Verdana, Geneva, sans-serif', rotulo: 'Verdana' },
    { valor: '"Trebuchet MS", sans-serif', rotulo: 'Trebuchet MS' },
    { valor: '"Courier New", Courier, monospace', rotulo: 'Courier New' },
  ];

  readonly cores = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
    '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
  ];

  readonly destaques = [
    '#fef08a', '#fde68a', '#fed7aa', '#fecaca', '#fbcfe8',
    '#e9d5ff', '#bfdbfe', '#a5f3fc', '#bbf7d0', '#e5e7eb',
  ];

  readonly historico: Ferramenta[] = [
    { rotulo: 'Desfazer (Ctrl+Z)', icone: '↶', pode: (e) => e.can().undo(), executar: (e) => e.chain().focus().undo().run() },
    { rotulo: 'Refazer (Ctrl+Y)', icone: '↷', pode: (e) => e.can().redo(), executar: (e) => e.chain().focus().redo().run() },
    {
      rotulo: 'Limpar formatação',
      icone: 'ic:limpar',
      executar: (e) => e.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run(),
    },
  ];

  readonly marcas: Ferramenta[] = [
    { rotulo: 'Negrito (Ctrl+B)', icone: 'B', estilo: 'negrito', ativa: (e) => e.isActive('bold'), executar: (e) => e.chain().focus().toggleBold().run() },
    { rotulo: 'Itálico (Ctrl+I)', icone: 'I', estilo: 'italico', ativa: (e) => e.isActive('italic'), executar: (e) => e.chain().focus().toggleItalic().run() },
    { rotulo: 'Sublinhado (Ctrl+U)', icone: 'U', estilo: 'sublinhado', ativa: (e) => e.isActive('underline'), executar: (e) => e.chain().focus().toggleUnderline().run() },
    { rotulo: 'Tachado', icone: 'S', estilo: 'tachado', ativa: (e) => e.isActive('strike'), executar: (e) => e.chain().focus().toggleStrike().run() },
    { rotulo: 'Sobrescrito', icone: 'x²', ativa: (e) => e.isActive('superscript'), executar: (e) => e.chain().focus().toggleSuperscript().run() },
    { rotulo: 'Subscrito', icone: 'x₂', ativa: (e) => e.isActive('subscript'), executar: (e) => e.chain().focus().toggleSubscript().run() },
  ];

  readonly alinhamentos: Ferramenta[] = (
    [
      ['left', 'Alinhar à esquerda'],
      ['center', 'Centralizar'],
      ['right', 'Alinhar à direita'],
      ['justify', 'Justificar'],
    ] as const
  ).map(([valor, rotulo]) => ({
    rotulo,
    icone: `ic:alinhar-${valor}`,
    ativa: (e: Editor) => e.isActive({ textAlign: valor }),
    executar: (e: Editor) => e.chain().focus().setTextAlign(valor).run(),
  }));

  readonly listas: Ferramenta[] = [
    { rotulo: 'Lista com marcadores', icone: 'ic:lista', ativa: (e) => e.isActive('bulletList'), executar: (e) => e.chain().focus().toggleBulletList().run() },
    { rotulo: 'Lista numerada', icone: 'ic:numerada', ativa: (e) => e.isActive('orderedList'), executar: (e) => e.chain().focus().toggleOrderedList().run() },
    { rotulo: 'Lista de tarefas', icone: 'ic:tarefas', ativa: (e) => e.isActive('taskList'), executar: (e) => e.chain().focus().toggleTaskList().run() },
    {
      rotulo: 'Diminuir recuo (Shift+Tab)',
      icone: 'ic:recuo-menos',
      pode: (e) => e.can().liftListItem('listItem') || e.can().liftListItem('taskItem'),
      executar: (e) => {
        const tipo = e.isActive('taskItem') ? 'taskItem' : 'listItem';
        e.chain().focus().liftListItem(tipo).run();
      },
    },
    {
      rotulo: 'Aumentar recuo (Tab)',
      icone: 'ic:recuo-mais',
      pode: (e) => e.can().sinkListItem('listItem') || e.can().sinkListItem('taskItem'),
      executar: (e) => {
        const tipo = e.isActive('taskItem') ? 'taskItem' : 'listItem';
        e.chain().focus().sinkListItem(tipo).run();
      },
    },
  ];

  readonly insercoes: Ferramenta[] = [
    { rotulo: 'Link (Ctrl+K)', icone: 'ic:link', ativa: (e) => e.isActive('link'), executar: () => this.editarLink() },
    { rotulo: 'Citação', icone: '❝', ativa: (e) => e.isActive('blockquote'), executar: (e) => e.chain().focus().toggleBlockquote().run() },
    { rotulo: 'Código', icone: '</>', ativa: (e) => e.isActive('code'), executar: (e) => e.chain().focus().toggleCode().run() },
    { rotulo: 'Linha horizontal', icone: '―', executar: (e) => e.chain().focus().setHorizontalRule().run() },
  ];

  /** Só aparecem com o cursor dentro de uma tabela. */
  readonly opcoesTabela: Ferramenta[] = [
    { rotulo: 'Inserir linha acima', icone: 'ic:linha-acima', executar: (e) => e.chain().focus().addRowBefore().run() },
    { rotulo: 'Inserir linha abaixo', icone: 'ic:linha-abaixo', executar: (e) => e.chain().focus().addRowAfter().run() },
    { rotulo: 'Inserir coluna à esquerda', icone: 'ic:coluna-esquerda', executar: (e) => e.chain().focus().addColumnBefore().run() },
    { rotulo: 'Inserir coluna à direita', icone: 'ic:coluna-direita', executar: (e) => e.chain().focus().addColumnAfter().run() },
    { rotulo: 'Excluir linha', icone: 'ic:excluir-linha', executar: (e) => e.chain().focus().deleteRow().run() },
    { rotulo: 'Excluir coluna', icone: 'ic:excluir-coluna', executar: (e) => e.chain().focus().deleteColumn().run() },
    { rotulo: 'Mesclar ou dividir células', icone: 'ic:mesclar', pode: (e) => e.can().mergeOrSplit(), executar: (e) => e.chain().focus().mergeOrSplit().run() },
    { rotulo: 'Linha de cabeçalho', icone: 'ic:cabecalho', executar: (e) => e.chain().focus().toggleHeaderRow().run() },
    { rotulo: 'Excluir tabela', icone: 'ic:excluir-tabela', executar: (e) => e.chain().focus().deleteTable().run() },
  ];

  constructor() {
    const codigoRascunho = this.route.snapshot.queryParamMap.get('rascunho');
    this.edicao.carregar(Number(this.route.snapshot.paramMap.get('id')), codigoRascunho);
    // O código só vale uma vez: sem ele na URL, recarregar a guia não espera à toa
    if (codigoRascunho) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
    afterNextRender(() => this.edicao.montar(this.host().nativeElement));

    // A guia é só o documento: o título dela diz de quem é
    effect(() => {
      const ag = this.edicao.agendamento();
      const { titulo } = this.edicao.config;
      this.titulo.setTitle(ag ? `${titulo} · ${ag.paciente}` : titulo);
    });
  }

  // --- Estado da faixa ---

  ativa(f: Ferramenta): boolean {
    return this.edicao.ler((e) => !!f.ativa?.(e), false);
  }

  pode(f: Ferramenta): boolean {
    return this.edicao.ler((e) => (f.pode ? f.pode(e) : e.isEditable), false);
  }

  executar(f: Ferramenta) {
    this.menu.set(null);
    this.edicao.executar(f.executar);
  }

  emTabela(): boolean {
    return this.edicao.ler((e) => e.isActive('table'), false);
  }

  estiloAtual(): string {
    return this.edicao.ler((e) => {
      for (const nivel of [1, 2, 3]) if (e.isActive('heading', { level: nivel })) return String(nivel);
      return 'p';
    }, 'p');
  }

  definirEstilo(valor: string) {
    this.edicao.executar((e) =>
      valor === 'p'
        ? e.chain().focus().setParagraph().run()
        : e.chain().focus().setHeading({ level: Number(valor) as 1 | 2 | 3 }).run(),
    );
  }

  fonteAtual(): string {
    return this.edicao.ler((e) => e.getAttributes('textStyle')['fontFamily'] ?? '', '');
  }

  definirFonte(valor: string) {
    this.edicao.executar((e) =>
      valor ? e.chain().focus().setFontFamily(valor).run() : e.chain().focus().unsetFontFamily().run(),
    );
  }

  /** Tamanho em pontos sob o cursor; vazio quando é o padrão do estilo. */
  tamanhoAtual(): string {
    return this.edicao.ler((e) => {
      const valor = pontos(e.getAttributes('textStyle')['fontSize']);
      return valor ? String(valor) : '';
    }, '');
  }

  definirTamanho(valor: string) {
    this.edicao.executar((e) =>
      valor ? e.chain().focus().setFontSize(`${valor}pt`).run() : e.chain().focus().unsetFontSize().run(),
    );
  }

  /** Passo para o tamanho vizinho da lista, como o A↑/A↓ dos editores. */
  passoTamanho(direcao: 1 | -1) {
    const atual = Number(this.tamanhoAtual()) || TAMANHO_PADRAO;
    const proximo =
      direcao > 0 ? TAMANHOS.find((t) => t > atual) : [...TAMANHOS].reverse().find((t) => t < atual);
    if (proximo) this.definirTamanho(String(proximo));
  }

  corAtual(): string | null {
    return this.edicao.ler((e) => e.getAttributes('textStyle')['color'] ?? null, null);
  }

  definirCor(cor: string | null) {
    this.menu.set(null);
    this.edicao.executar((e) =>
      cor ? e.chain().focus().setColor(cor).run() : e.chain().focus().unsetColor().run(),
    );
  }

  destaqueAtual(): string | null {
    return this.edicao.ler((e) => (e.isActive('highlight') ? (e.getAttributes('highlight')['color'] ?? '#fef08a') : null), null);
  }

  definirDestaque(cor: string | null) {
    this.menu.set(null);
    this.edicao.executar((e) =>
      cor ? e.chain().focus().setHighlight({ color: cor }).run() : e.chain().focus().unsetHighlight().run(),
    );
  }

  inserirTabela(linhas: number, colunas: number) {
    this.menu.set(null);
    this.gradeTabela.set({ linhas: 0, colunas: 0 });
    this.edicao.executar((e) => e.chain().focus().insertTable({ rows: linhas, cols: colunas, withHeaderRow: true }).run());
  }

  alternarMenu(menu: Menu) {
    this.menu.update((atual) => (atual === menu ? null : menu));
  }

  editarLink() {
    const editor = this.edicao.editor;
    if (!editor) return;
    this.menu.set(null);
    const atual: string = editor.getAttributes('link')['href'] ?? '';
    this.formulario
      .abrir({
        titulo: atual ? 'Editar link' : 'Inserir link',
        tamanho: 'pequeno',
        campos: [
          new CampoTexto({
            chave: 'url',
            rotulo: 'Endereço',
            placeholder: 'https://…',
            valorInicial: atual,
            ajuda: 'Deixe vazio para remover o link.',
          }),
        ],
        botoes: { confirmar: 'Aplicar' },
      })
      .subscribe((r) => {
        if (!r) return;
        const url = r.valor.url.trim();
        const cadeia = editor.chain().focus().extendMarkRange('link');
        if (!url) cadeia.unsetLink().run();
        // Sem esquema, o navegador trataria como caminho relativo à aplicação
        else cadeia.setLink({ href: /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}` }).run();
      });
  }

  // --- Zoom ---

  ajustarZoom(passo: number) {
    this.zoom.update((z) => Math.min(200, Math.max(50, z + passo)));
  }

  // --- Arquivo ---

  escolherArquivo() {
    this.menu.set(null);
    this.seletorArquivo()?.nativeElement.click();
  }

  aoEscolherArquivo(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (arquivo) this.edicao.importar(arquivo);
  }

  exportar(formato: 'docx' | 'pdf') {
    this.menu.set(null);
    this.edicao.exportar(formato);
  }

  imprimir() {
    this.menu.set(null);
    window.print();
  }

  /** Clique fora fecha o menu aberto. */
  @HostListener('document:mousedown', ['$event'])
  aoClicarFora(e: MouseEvent) {
    if (!this.menu()) return;
    const alvo = e.target as HTMLElement | null;
    if (!alvo?.closest('.completo__menu-ancora')) this.menu.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(e: KeyboardEvent) {
    if (e.key === 'Escape') this.menu.set(null);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && this.elemento.nativeElement.contains(document.activeElement)) {
      e.preventDefault();
      this.editarLink();
    }
  }
}
