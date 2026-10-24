import type { JSONContent } from '@tiptap/core';
import type { ParagraphChild } from 'docx';
import { Trecho, alinhamento, baixar, hex, primeiraFonte, textoPuro, trechos } from './documento';

type Docx = typeof import('docx');
type Bloco = InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>;

interface Contexto {
  /** Profundidade de lista: 0 fora de lista, 1 na primeira, 2 na aninhada… */
  nivel: number;
  lista: { tipo: 'marcador' | 'numerada'; instancia: number } | null;
  citacao: boolean;
}

const REFERENCIA_NUMERADA = 'lista-numerada';
const RECUO = 720; // 0,5" em twips — o recuo padrão do Word

/** Gera o .docx com exatamente o conteúdo do documento — nada é acrescentado — e baixa. */
export async function exportarDocx(documento: JSONContent, nome: string) {
  const d: Docx = await import('docx');
  const conversor = new ConversorDocx(d);

  const doc = new d.Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } }, // 11pt
    },
    numbering: {
      config: [
        {
          reference: REFERENCIA_NUMERADA,
          levels: Array.from({ length: 6 }, (_, nivel) => ({
            level: nivel,
            format: d.LevelFormat.DECIMAL,
            text: `%${nivel + 1}.`,
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: RECUO * (nivel + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: conversor.blocos(documento.content ?? [], { nivel: 0, lista: null, citacao: false }),
      },
    ],
  });

  baixar(await d.Packer.toBlob(doc), nome);
}

class ConversorDocx {
  /** Cada lista numerada recomeça do 1: o Word precisa de uma instância por lista. */
  private proximaInstancia = 1;

  constructor(private d: Docx) {}

  blocos(nos: JSONContent[], ctx: Contexto) {
    return nos.flatMap((no) => this.bloco(no, ctx));
  }

  private bloco(no: JSONContent, ctx: Contexto): Bloco[] {
    const { Paragraph, TextRun, HeadingLevel, BorderStyle } = this.d;
    const recuo = {
      ...(ctx.citacao ? { indent: { left: RECUO } } : {}),
      ...this.alinhamento(no),
    };

    switch (no.type) {
      case 'paragraph':
        return [new Paragraph({ ...recuo, children: this.runs(trechos(no.content)) })];

      case 'heading': {
        const niveis = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
        const nivel = Number(no.attrs?.['level'] ?? 1);
        return [
          new Paragraph({
            ...recuo,
            heading: niveis[Math.min(nivel, 3) - 1],
            children: this.runs(trechos(no.content)),
          }),
        ];
      }

      case 'bulletList':
      case 'orderedList': {
        const lista = {
          tipo: no.type === 'bulletList' ? ('marcador' as const) : ('numerada' as const),
          instancia: this.proximaInstancia++,
        };
        return this.blocos(no.content ?? [], { ...ctx, nivel: ctx.nivel + 1, lista });
      }

      case 'listItem':
        return this.itemDeLista(no, ctx);

      case 'taskList':
        return this.blocos(no.content ?? [], { ...ctx, nivel: ctx.nivel + 1, lista: null });

      case 'taskItem':
        return this.tarefa(no, ctx);

      case 'table':
        return [this.tabela(no)];

      case 'blockquote':
        return this.blocos(no.content ?? [], { ...ctx, citacao: true });

      case 'codeBlock':
        return [
          new Paragraph({
            ...recuo,
            children: textoPuro(no)
              .split('\n')
              .map((linha, i) => new TextRun({ text: linha, font: 'Courier New', break: i ? 1 : 0 })),
          }),
        ];

      case 'horizontalRule':
        return [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto', space: 1 } },
          }),
        ];

      default:
        // Nó desconhecido: preserva ao menos o texto
        return no.content ? this.blocos(no.content, ctx) : [];
    }
  }

  /** Só o primeiro parágrafo do item leva o marcador; os demais ficam alinhados a ele. */
  private itemDeLista(no: JSONContent, ctx: Contexto) {
    const { Paragraph } = this.d;
    const nivel = ctx.nivel - 1;

    return (no.content ?? []).flatMap((filho, i) => {
      if (filho.type !== 'paragraph') return this.bloco(filho, ctx);

      const marcador =
        i > 0 || !ctx.lista
          ? { indent: { left: RECUO * ctx.nivel } }
          : ctx.lista.tipo === 'marcador'
            ? { bullet: { level: nivel } }
            : { numbering: { reference: REFERENCIA_NUMERADA, level: nivel, instance: ctx.lista.instancia } };

      return [new Paragraph({ ...marcador, children: this.runs(trechos(filho.content)) })];
    });
  }

  /** Caixa de seleção desenhada com o caractere, já que o Word não tem lista de tarefas. */
  private tarefa(no: JSONContent, ctx: Contexto) {
    const { Paragraph, TextRun } = this.d;
    const caixa = no.attrs?.['checked'] ? '☑ ' : '☐ ';
    return (no.content ?? []).flatMap((filho, i) => {
      if (filho.type !== 'paragraph') return this.bloco(filho, ctx);
      return [
        new Paragraph({
          indent: { left: RECUO * ctx.nivel, hanging: i === 0 ? 360 : 0 },
          children: [...(i === 0 ? [new TextRun({ text: caixa })] : []), ...this.runs(trechos(filho.content))],
        }),
      ];
    });
  }

  private tabela(no: JSONContent) {
    const { Table, TableRow, TableCell, Paragraph, WidthType, ShadingType } = this.d;
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: (no.content ?? []).map(
        (linha) =>
          new TableRow({
            children: (linha.content ?? []).map((celula) => {
              const filhos = this.blocos(celula.content ?? [], { nivel: 0, lista: null, citacao: false });
              return new TableCell({
                columnSpan: Number(celula.attrs?.['colspan'] ?? 1),
                rowSpan: Number(celula.attrs?.['rowspan'] ?? 1),
                shading:
                  celula.type === 'tableHeader'
                    ? { type: ShadingType.CLEAR, fill: 'F5F5F4', color: 'auto' }
                    : undefined,
                // O Word exige ao menos um parágrafo por célula
                children: filhos.length ? filhos : [new Paragraph({})],
              });
            }),
          }),
      ),
    });
  }

  private alinhamento(no: JSONContent) {
    const { AlignmentType } = this.d;
    const tipos = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED,
    };
    const valor = alinhamento(no);
    return valor ? { alignment: tipos[valor] } : {};
  }

  private runs(ts: Trecho[]): ParagraphChild[] {
    const { TextRun, ExternalHyperlink, ShadingType } = this.d;
    return ts.map((t) => {
      if (t.quebra) return new TextRun({ text: '', break: 1 });
      const destaque = hex(t.destaque);
      const run = new TextRun({
        text: t.texto,
        bold: t.negrito,
        italics: t.italico,
        underline: t.sublinhado || t.link ? {} : undefined,
        strike: t.tachado,
        superScript: t.sobrescrito || undefined,
        subScript: t.subscrito || undefined,
        font: t.codigo ? 'Courier New' : t.fonte ? primeiraFonte(t.fonte) : undefined,
        size: t.tamanho ? Math.round(t.tamanho * 2) : undefined, // meios-pontos
        color: t.link ? '0563C1' : (hex(t.cor) ?? undefined),
        // `highlight` do Word só aceita 16 cores nomeadas; o sombreado aceita qualquer uma
        shading: destaque ? { type: ShadingType.CLEAR, fill: destaque, color: 'auto' } : undefined,
      });
      return t.link ? new ExternalHyperlink({ link: t.link, children: [run] }) : run;
    });
  }
}
