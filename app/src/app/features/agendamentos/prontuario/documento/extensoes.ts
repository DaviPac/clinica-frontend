import type { Extensions } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';

/**
 * Esquema do documento do prontuário — o mesmo em todas as telas.
 *
 * O editor descarta, ao carregar, todo nó ou marca que não conhece: se a
 * tela de leitura usasse menos extensões que o editor completo, abrir e
 * salvar ali apagaria tabelas, cores e alinhamentos. Por isso todas as
 * telas montam o editor com esta lista; o que muda entre elas é só quais
 * ferramentas a barra oferece.
 */
export function extensoesDocumento(placeholder = 'Comece a escrever o prontuário…'): Extensions {
  return [
    StarterKit,
    Placeholder.configure({ placeholder }),
    CharacterCount,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
  ];
}
