import type { JSONContent } from '@tiptap/core';
import type { Content, ContentText, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { Trecho, alinhamento, moduloPadrao, textoPuro, trechos } from './documento';

const LARGURA_UTIL = 515; // A4 (595pt) menos as margens de 40pt
const COR_SUAVE = '#57534d';
const COR_LINHA = '#d6d3d1';

/** Gera o PDF com exatamente o conteúdo do documento — nada é acrescentado — e baixa. */
export async function exportarPdf(documento: JSONContent, nome: string) {
  const [pdfMake, vfs] = await Promise.all([
    import('pdfmake/build/pdfmake').then(moduloPadrao),
    import('pdfmake/build/vfs_fonts').then(moduloPadrao),
  ]);
  pdfMake.addVirtualFileSystem(vfs); // Roboto embutida: cobre os acentos do português
  await pdfMake.createPdf(definicaoPdf(documento)).download(nome);
}

export function definicaoPdf(documento: JSONContent): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.3 },
    styles: {
      h1: { fontSize: 16, bold: true, margin: [0, 10, 0, 6] },
      h2: { fontSize: 13.5, bold: true, margin: [0, 8, 0, 4] },
      h3: { fontSize: 11.5, bold: true, margin: [0, 6, 0, 4] },
    },
    content: blocos(documento.content ?? []),
  };
}

function blocos(nos: JSONContent[]): Content[] {
  return nos.map(bloco);
}

function bloco(no: JSONContent): Content {
  switch (no.type) {
    case 'paragraph':
      // Parágrafo vazio ainda ocupa uma linha, como no editor
      return { text: inline(trechos(no.content)), alignment: alinhamento(no) ?? undefined, margin: [0, 0, 0, 6] };

    case 'heading': {
      const nivel = Math.min(Number(no.attrs?.['level'] ?? 1), 3);
      return { text: inline(trechos(no.content)), alignment: alinhamento(no) ?? undefined, style: `h${nivel}` };
    }

    case 'taskList':
      return { stack: (no.content ?? []).map(tarefa), margin: [0, 0, 0, 6] };

    case 'table':
      return tabela(no);

    case 'bulletList':
      return { ul: itens(no), margin: [0, 0, 0, 6] };

    case 'orderedList':
      return { ol: itens(no), start: Number(no.attrs?.['start'] ?? 1), margin: [0, 0, 0, 6] };

    case 'blockquote':
      // Tabela de uma célula só para ter o filete à esquerda
      return {
        table: { widths: ['*'], body: [[{ stack: blocos(no.content ?? []), color: COR_SUAVE }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i: number) => (i === 0 ? 2 : 0),
          vLineColor: () => COR_LINHA,
          paddingLeft: () => 10,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [0, 0, 0, 6],
      };

    case 'codeBlock':
      return {
        text: textoPuro(no),
        fontSize: 9.5,
        background: '#f5f5f4',
        preserveLeadingSpaces: true,
        margin: [0, 0, 0, 6],
      };

    case 'horizontalRule':
      return separador([0, 6, 0, 10]);

    default:
      return { stack: blocos(no.content ?? []) };
  }
}

/**
 * Cada item vira uma pilha: o parágrafo do item e eventuais listas aninhadas.
 * Dentro da lista o parágrafo leva menos margem — o espaço entre itens já basta.
 */
function itens(lista: JSONContent): Content[] {
  return (lista.content ?? []).map((item) => {
    const filhos = (item.content ?? []).map(
      (filho): Content =>
        filho.type === 'paragraph'
          ? { text: inline(trechos(filho.content)), margin: [0, 0, 0, 2] }
          : bloco(filho),
    );
    return filhos.length === 1 ? filhos[0] : { stack: filhos };
  });
}

/** A Roboto embutida não tem ☐/☑: a caixa é desenhada. */
function tarefa(item: JSONContent): Content {
  const marcada = !!item.attrs?.['checked'];
  const caixa = [
    { type: 'rect' as const, x: 0, y: 2.5, w: 8, h: 8, r: 1.5, lineWidth: 0.75, lineColor: COR_SUAVE },
    ...(marcada
      ? [{ type: 'polyline' as const, points: [{ x: 1.8, y: 6.5 }, { x: 3.6, y: 8.5 }, { x: 6.5, y: 4.5 }], lineWidth: 1, lineColor: COR_SUAVE }]
      : []),
  ];
  const filhos = (item.content ?? []).map(
    (filho): Content =>
      filho.type === 'paragraph'
        ? {
            text: inline(trechos(filho.content)),
            decoration: marcada ? 'lineThrough' : undefined,
            color: marcada ? COR_SUAVE : undefined,
            margin: [0, 0, 0, 2],
          }
        : bloco(filho),
  );
  return { columns: [{ width: 14, canvas: caixa }, { width: '*', stack: filhos }] };
}

/**
 * O pdfmake quer a grade completa: cada célula coberta por colspan/rowspan
 * precisa de um marcador vazio no lugar. O TipTap só guarda as células reais.
 */
function tabela(no: JSONContent): Content {
  const linhas = no.content ?? [];
  const grade: TableCell[][] = linhas.map(() => []);
  linhas.forEach((linha, i) => {
    let coluna = 0;
    for (const celula of linha.content ?? []) {
      while (grade[i][coluna] !== undefined) coluna++; // pula o que um rowspan de cima já ocupou
      const colspan = Number(celula.attrs?.['colspan'] ?? 1);
      const rowspan = Number(celula.attrs?.['rowspan'] ?? 1);
      grade[i][coluna] = {
        stack: blocos(celula.content ?? []),
        colSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
        fillColor: celula.type === 'tableHeader' ? '#f5f5f4' : undefined,
        bold: celula.type === 'tableHeader' || undefined,
      };
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if ((r || c) && grade[i + r]) grade[i + r][coluna + c] = {};
        }
      }
      coluna += colspan;
    }
  });

  const colunas = Math.max(1, ...grade.map((l) => l.length));
  const corpo = grade.map((l) => Array.from({ length: colunas }, (_, c) => l[c] ?? {}));
  return {
    table: { widths: Array(colunas).fill('*'), body: corpo },
    layout: {
      hLineColor: () => COR_LINHA,
      vLineColor: () => COR_LINHA,
      hLineWidth: () => 0.75,
      vLineWidth: () => 0.75,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 8],
  };
}

function inline(ts: Trecho[]): ContentText['text'] {
  if (!ts.length) return ' ';
  return ts.map((t) => {
    if (t.quebra) return '\n';
    const decoracao = [
      ...(t.sublinhado || t.link ? (['underline'] as const) : []),
      ...(t.tachado ? (['lineThrough'] as const) : []),
    ];
    return {
      text: t.texto,
      bold: t.negrito,
      italics: t.italico,
      decoration: decoracao.length ? [...decoracao] : undefined,
      background: t.codigo ? '#f5f5f4' : (t.destaque ?? undefined),
      fontSize: t.tamanho ?? undefined,
      sup: t.sobrescrito || undefined,
      sub: t.subscrito || undefined,
      link: t.link ?? undefined,
      color: t.link ? '#1447e6' : (t.cor ?? undefined),
    };
  });
}

function separador(margem: [number, number, number, number]): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: LARGURA_UTIL, y2: 0, lineWidth: 0.75, lineColor: COR_LINHA }],
    margin: margem,
  };
}
