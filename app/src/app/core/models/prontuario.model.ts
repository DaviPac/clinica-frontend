import type { JSONContent } from '@tiptap/core';

/** Documento do editor (TipTap), salvo como JSON pela API. */
export type DocumentoProntuario = JSONContent;

/** O mínimo que o GET de um documento do agendamento devolve — é tudo o que as anotações têm. */
export interface DocumentoSalvo {
  conteudo: DocumentoProntuario;
}

/** O que a tela tem do documento atual: os metadados da versão só existem no prontuário. */
export type DocumentoAtual = DocumentoSalvo & Partial<ProntuarioVersao>;

export interface ProntuarioVersao {
  versaoId: number;
  conteudo: DocumentoProntuario;
  autorId: number;
  autor: string | null;
  criadoEm: string;
}

export interface ProntuarioVersaoResumo {
  versaoId: number;
  autorId: number;
  autor: string;
  criadoEm: string;
}
