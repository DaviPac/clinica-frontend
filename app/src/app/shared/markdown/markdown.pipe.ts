import { Pipe, PipeTransform } from '@angular/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Converte markdown em HTML seguro.
 *
 * O conteúdo aqui é saída de modelo contendo dados de paciente vindos da API, ou
 * seja, texto que o usuário influencia indiretamente. Por isso o resultado passa
 * por uma allowlist do DOMPurify e é ligado com `[innerHTML]` SEM
 * `bypassSecurityTrustHtml` — assim o sanitizador do próprio Angular roda depois,
 * como segunda camada independente.
 */

marked.use({ gfm: true, breaks: true });

const TAGS_PERMITIDAS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'hr', 'div', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ATRIBUTOS_PERMITIDOS = ['href', 'title', 'class', 'target', 'rel', 'align'];

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(texto: string | null | undefined): string {
    if (!texto) return '';

    const bruto = marked.parse(texto, { async: false });

    // RETURN_DOM_FRAGMENT permite ajustar o resultado DEPOIS da sanitização, sem
    // hooks globais no DOMPurify e sem sobrescrever o renderer do marked (que
    // perde a referência ao parser e quebra tabelas).
    const fragmento = DOMPurify.sanitize(bruto, {
      ALLOWED_TAGS: TAGS_PERMITIDAS,
      ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
      ALLOW_DATA_ATTR: false,
      RETURN_DOM_FRAGMENT: true,
    });

    for (const link of Array.from(fragmento.querySelectorAll('a'))) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }

    // Tabelas herdam o wrapper com scroll horizontal usado no resto do app.
    for (const tabela of Array.from(fragmento.querySelectorAll('table'))) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrap';
      tabela.replaceWith(wrapper);
      wrapper.appendChild(tabela);
    }

    const container = document.createElement('div');
    container.appendChild(fragmento);
    return container.innerHTML;
  }
}
