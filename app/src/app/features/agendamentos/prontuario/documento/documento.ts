import type { JSONContent } from '@tiptap/core';

/** Um pedaço de texto com a mesma formatação — o "run" do Word. */
export interface Trecho {
  texto: string;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  tachado: boolean;
  codigo: boolean;
  link: string | null;
  sobrescrito: boolean;
  subscrito: boolean;
  /** Cor do texto em hexadecimal (`#rrggbb`), ou null para a automática. */
  cor: string | null;
  /** Cor do marca-texto, ou null sem destaque. */
  destaque: string | null;
  fonte: string | null;
  /** Tamanho em pontos, ou null para o padrão do documento. */
  tamanho: number | null;
  /** Quebra de linha (Shift+Enter) — não carrega texto. */
  quebra: boolean;
}

/** Achata o conteúdo inline de um bloco (texto + marcas + quebras) em trechos. */
export function trechos(nos: JSONContent[] = []): Trecho[] {
  return nos.map((no) => {
    const marcas = new Set((no.marks ?? []).map((m) => m.type));
    const attrs = (tipo: string) => no.marks?.find((m) => m.type === tipo)?.attrs ?? {};
    const estilo = attrs('textStyle');
    const destaque = no.marks?.find((m) => m.type === 'highlight');
    return {
      texto: no.type === 'text' ? (no.text ?? '') : '',
      negrito: marcas.has('bold'),
      italico: marcas.has('italic'),
      sublinhado: marcas.has('underline'),
      tachado: marcas.has('strike'),
      codigo: marcas.has('code'),
      link: attrs('link')['href'] ?? null,
      sobrescrito: marcas.has('superscript'),
      subscrito: marcas.has('subscript'),
      cor: estilo['color'] || null,
      // Destaque sem cor escolhida é o amarelo padrão do marca-texto
      destaque: destaque ? destaque.attrs?.['color'] || '#fef08a' : null,
      fonte: estilo['fontFamily'] || null,
      tamanho: pontos(estilo['fontSize']),
      quebra: no.type === 'hardBreak',
    };
  });
}

/** `12pt` → 12; `16px` → 12. Sem tamanho (ou ilegível) → null. */
export function pontos(tamanho: string | null | undefined): number | null {
  const m = /^([\d.]+)\s*(pt|px)?$/.exec(tamanho ?? '');
  if (!m) return null;
  const valor = Number(m[1]);
  return m[2] === 'px' ? valor * 0.75 : valor;
}

export type Alinhamento = 'left' | 'center' | 'right' | 'justify';

/** Alinhamento de um parágrafo ou título; null quando é o padrão (à esquerda). */
export function alinhamento(no: JSONContent): Alinhamento | null {
  const valor = no.attrs?.['textAlign'];
  return valor === 'center' || valor === 'right' || valor === 'justify' ? valor : null;
}

/** `#abc`, `#aabbcc` ou `rgb(…)` → `AABBCC`, o formato do Word. Outra coisa → null. */
export function hex(cor: string | null): string | null {
  if (!cor) return null;
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(cor);
  if (curto) return (curto[1] + curto[1] + curto[2] + curto[2] + curto[3] + curto[3]).toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(cor)) return cor.slice(1).toUpperCase();
  const rgb = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(cor);
  if (rgb) return rgb.slice(1, 4).map((c) => Number(c).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

/** Primeira fonte de uma pilha CSS, sem aspas: `"Times New Roman", serif` → `Times New Roman`. */
export function primeiraFonte(pilha: string): string {
  return pilha.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/** Texto puro de um nó e seus filhos — para blocos de código. */
export function textoPuro(no: JSONContent): string {
  if (no.type === 'text') return no.text ?? '';
  if (no.type === 'hardBreak') return '\n';
  return (no.content ?? []).map(textoPuro).join('');
}

/** `prontuario-maria-silva-2026-10-24.pdf` */
export function nomeArquivo(paciente: string, dataSessao: string, extensao: string, prefixo = 'prontuario'): string {
  const slug = paciente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const data = new Date(dataSessao).toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
  return `${prefixo}-${slug || 'paciente'}-${data}.${extensao}`;
}

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bibliotecas CommonJS chegam pelo `import()` às vezes no `default`, às
 * vezes no próprio namespace, conforme o empacotador. Isso normaliza.
 */
export function moduloPadrao<T>(mod: T | { default: T }): T {
  return (mod as { default?: T }).default ?? (mod as T);
}
