/** Configuração central do módulo de IA. Tudo que é "número mágico" vive aqui. */

/** Nível de raciocínio (thinking) escolhido pelo usuário. */
export type NivelRaciocinio = 'desligado' | 'equilibrado' | 'profundo';

export interface ModeloIA {
  /** ID enviado à API (sem o prefixo "models/"). */
  id: string;
  rotulo: string;
  descricao: string;
  suportaRaciocinio: boolean;
}

/**
 * Catálogo base. É cruzado com `GET /v1beta/models` da chave em uso
 * (ver ModelosService) — só aparece no seletor o que a chave realmente serve.
 */
export const MODELOS_IA: readonly ModeloIA[] = [
  {
    id: 'gemini-flash-latest',
    rotulo: 'Flash',
    descricao: 'Equilíbrio entre velocidade e qualidade. Recomendado.',
    suportaRaciocinio: true,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    rotulo: 'Flash Lite',
    descricao: 'O mais rápido e econômico. Bom para consultas simples.',
    suportaRaciocinio: false,
  },
  {
    id: 'gemini-pro-latest',
    rotulo: 'Pro',
    descricao: 'Mais capaz em tarefas com muitas etapas. Mais lento.',
    suportaRaciocinio: true,
  },
];

export const MODELO_PADRAO = 'gemini-flash-latest';

/** Orçamento de tokens de raciocínio por nível. -1 deixa o modelo decidir. */
export const ORCAMENTO_RACIOCINIO: Record<NivelRaciocinio, number> = {
  desligado: 0,
  equilibrado: 4096,
  profundo: 16384,
};

export const ROTULO_RACIOCINIO: Record<NivelRaciocinio, string> = {
  desligado: 'Sem raciocínio',
  equilibrado: 'Raciocínio equilibrado',
  profundo: 'Raciocínio profundo',
};

/** Quantas chamadas ao modelo um único turno pode encadear. */
export const MAX_ITERACOES_TURNO = 8;

/** Mensagens enviadas como contexto ao modelo (as mais recentes). */
export const MAX_MENSAGENS_CONTEXTO = 40;

/** Itens devolvidos ao modelo por resultado de ferramenta. */
export const MAX_ITENS_RESULTADO = 50;

/** Repetições idênticas de uma mesma chamada antes de abortar o turno. */
export const MAX_CHAMADAS_REPETIDAS = 3;

/** Limites de retenção local. */
export const MAX_CONVERSAS = 50;
export const MAX_MENSAGENS_POR_CONVERSA = 300;
/** Resultado de ferramenta maior que isso é gravado truncado. */
export const MAX_BYTES_RESULTADO = 16 * 1024;

/** IndexedDB. */
export const DB_NOME = 'clinica-ia';
export const DB_VERSAO = 1;
export const STORE_CONVERSAS = 'conversas';
export const STORE_MENSAGENS = 'mensagens';
export const STORE_USO = 'uso';
export const INDICE_CONVERSAS_USUARIO = 'porUsuario';
export const INDICE_MENSAGENS_CONVERSA = 'porConversa';

/** Preferências que ficam no localStorage (escolha por dispositivo, não por conversa). */
export const CHAVE_MODELO_PADRAO = 'ia:modelo';
export const CHAVE_RACIOCINIO_PADRAO = 'ia:raciocinio';
