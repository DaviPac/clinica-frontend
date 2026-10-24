import { moduloPadrao } from './documento';

export interface ResultadoImportacao {
  html: string;
  /** O que o mammoth não conseguiu converter (estilos desconhecidos etc.). */
  avisos: string[];
}

/**
 * Converte um .docx em HTML para carregar no editor. O editor só aceita o
 * que conhece (títulos, listas, tabelas, citações…): imagens do Word não
 * entram, e fontes, cores e alinhamentos não são lidos pelo mammoth.
 */
export async function importarDocx(arquivo: File): Promise<ResultadoImportacao> {
  const mammoth = moduloPadrao(await import('mammoth'));
  const resultado = await mammoth.convertToHtml(
    { arrayBuffer: await arquivo.arrayBuffer() },
    {
      styleMap: [
        'u => u', // o mammoth descarta sublinhado se não for mapeado
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    },
  );
  return {
    html: resultado.value,
    avisos: resultado.messages.filter((m) => m.type === 'warning').map((m) => m.message),
  };
}
