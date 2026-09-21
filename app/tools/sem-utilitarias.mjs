#!/usr/bin/env node
/*
 * Trava contra a volta do CSS utilitário.
 *
 * Cada componente é dono do próprio CSS: o template usa nomes semânticos
 * (BEM, com o prefixo do bloco) e o arquivo `.css` ao lado diz como eles se
 * parecem. Este script varre `src/**` procurando o vocabulário antigo —
 * `flex`, `px-4`, `text-gray-500`, `sm:grid-cols-2`, `hover:bg-white`… — em
 * atributos `class` de templates e em strings de TypeScript, e falha se achar.
 *
 *   npm run lint:estilos
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

/** Famílias de utilidade que existiam no projeto. */
const UTILITARIA = new RegExp(
  '^(' +
    [
      // layout e caixa
      'flex|inline-flex|grid|inline-grid|block|inline-block|hidden|contents',
      'flex-(1|auto|none|row|col|wrap|nowrap|shrink|grow)(-reverse)?',
      '(items|justify|content|self|place)-[a-z]+',
      '(grid|col|row)-(cols|span|start|end)-[a-z0-9]+',
      'relative|absolute|fixed|sticky|static',
      '(inset|top|right|bottom|left)-[a-z0-9.\\[\\]/-]+',
      'z-[0-9]+',
      // espaçamento e tamanho
      '-?(m|p)(t|r|b|l|x|y|s|e)?-[a-z0-9.\\[\\]/-]+',
      '(w|h|min-w|min-h|max-w|max-h|size)-[a-z0-9.\\[\\]/-]+',
      'gap(-x|-y)?-[a-z0-9.\\[\\]/-]+',
      'space-(x|y)-[a-z0-9.-]+',
      'divide-[a-z0-9-]+',
      // tipografia
      'text-(xs|sm|base|lg|xl|[0-9]xl|left|right|center|justify)',
      'text-(gray|stone|brand|red|amber|teal|blue|green|emerald|violet|purple|white|black|on-accent)(-[0-9]+)?',
      'font-(sans|serif|mono|thin|light|normal|medium|semibold|bold|extrabold|black)',
      'leading-[a-z0-9.\\[\\]-]+|tracking-[a-z-]+',
      'truncate|uppercase|lowercase|capitalize|whitespace-[a-z-]+|break-[a-z]+',
      'tabular-nums|antialiased',
      // cor e borda
      'bg-[a-z0-9/-]+',
      'border(-[trblxyse])?(-[a-z0-9/-]+)?',
      'rounded(-[a-z0-9-]+)?',
      'ring(-[a-z0-9/-]+)?|shadow(-[a-z0-9-]+)?|opacity-[0-9]+',
      // efeito e interação
      'transition(-[a-z]+)?|duration-[0-9]+|ease-[a-z-]+|animate-[a-z]+',
      'cursor-[a-z-]+|select-[a-z]+|overflow(-[xy])?-[a-z]+|resize(-[a-z]+)?',
      'translate-[xy]-[a-z0-9.\\[\\]/-]+|scale-[0-9]+|rotate-[0-9]+',
      'sr-only|pointer-events-[a-z]+|accent-[a-z0-9-]+|appearance-[a-z]+',
    ].join('|') +
    ')$',
);

/** Variantes que só existem em CSS utilitário: `sm:`, `hover:`, `md:`… */
const VARIANTE = /^(sm|md|lg|xl|2xl|hover|focus|active|disabled|group-hover|focus-within|dark|first|last|odd|even|peer-[a-z]+|\[[^\]]+\]):/;

/** Classes globais que o projeto tinha antes da migração. */
const GLOBAL_ANTIGA = /^(page|page-header|table-wrap|ui-input|ui-label|btn|btn-primary|btn-outline|btn-danger|md)$/;

function suspeitas(valor) {
  return valor
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => VARIANTE.test(c) || UTILITARIA.test(c) || GLOBAL_ANTIGA.test(c));
}

async function* arquivos(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) yield* arquivos(caminho);
    else if (/\.(html|ts)$/.test(item.name) && !item.name.endsWith('.spec.ts')) yield caminho;
  }
}

const achados = [];

for await (const caminho of arquivos(RAIZ)) {
  const linhas = (await readFile(caminho, 'utf8')).split('\n');

  linhas.forEach((linha, i) => {
    // `class="…"`, `class: '…'` e `[class]="'…'"` — onde quer que o nome apareça
    for (const m of linha.matchAll(/class(?:Name)?\s*[:=]\s*["'`]([^"'`]*)["'`]/g)) {
      for (const classe of suspeitas(m[1])) {
        achados.push(`${relative(RAIZ, caminho)}:${i + 1}  ${classe}`);
      }
    }
  });
}

if (achados.length) {
  console.error('Classe utilitária encontrada — o CSS mora no componente:\n');
  console.error(achados.map((a) => `  ${a}`).join('\n'));
  console.error(`\n${achados.length} ocorrência(s).`);
  process.exit(1);
}

console.log('Nenhuma classe utilitária nos templates.');
