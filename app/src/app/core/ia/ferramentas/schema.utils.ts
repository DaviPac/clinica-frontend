import { Schema, Type } from '@google/genai';
import { MAX_ITENS_RESULTADO } from '../ia.config';

/** Açúcar sobre `Schema` para as declarações ficarem legíveis. */
export const S = {
  obj(propriedades: Record<string, Schema>, obrigatorios: string[] = []): Schema {
    return { type: Type.OBJECT, properties: propriedades, required: obrigatorios };
  },
  txt(descricao: string): Schema {
    return { type: Type.STRING, description: descricao };
  },
  opcoes(descricao: string, valores: readonly string[]): Schema {
    return { type: Type.STRING, description: descricao, enum: [...valores] };
  },
  inteiro(descricao: string): Schema {
    return { type: Type.INTEGER, description: descricao };
  },
  numero(descricao: string): Schema {
    return { type: Type.NUMBER, description: descricao };
  },
  booleano(descricao: string): Schema {
    return { type: Type.BOOLEAN, description: descricao };
  },
  /** Data no formato YYYY-MM-DD. */
  data(descricao: string): Schema {
    return { type: Type.STRING, description: `${descricao} Formato: YYYY-MM-DD.` };
  },
  /** Data e hora locais, sem fuso — o executor aplica o offset de Brasília. */
  dataHora(descricao: string): Schema {
    return {
      type: Type.STRING,
      description: `${descricao} Formato: YYYY-MM-DDTHH:mm (horário de Brasília).`,
    };
  },
  /** Período mensal YYYY-MM. */
  mes(descricao: string): Schema {
    return { type: Type.STRING, description: `${descricao} Formato: YYYY-MM.` };
  },
} as const;

/** Schema de uma ferramenta sem parâmetros. */
export const SEM_PARAMETROS: Schema = { type: Type.OBJECT, properties: {} };

/**
 * Prepara o retorno de uma chamada de API para virar `functionResponse`.
 *
 * Três coisas acontecem aqui: arrays longos são truncados (o histórico do chat
 * não pode virar um dump do banco), campos nulos somem (só gastam token), e
 * valores primitivos são embrulhados — a API exige um objeto na resposta.
 */
export function resumirParaModelo(dados: unknown): Record<string, unknown> {
  if (Array.isArray(dados)) {
    const itens = dados.slice(0, MAX_ITENS_RESULTADO).map(semNulos);
    return dados.length > MAX_ITENS_RESULTADO
      ? { itens, total: dados.length, truncado: true }
      : { itens, total: dados.length };
  }
  if (dados && typeof dados === 'object') {
    return semNulos(dados) as Record<string, unknown>;
  }
  return { resultado: dados ?? null };
}

/** Contagem legível para o rótulo do card ("12 agendamentos"). */
export function resumirQuantidade(dados: unknown, singular: string, plural: string): string {
  if (Array.isArray(dados)) {
    return dados.length === 1 ? `1 ${singular}` : `${dados.length} ${plural}`;
  }
  return dados ? `1 ${singular}` : 'nenhum resultado';
}

function semNulos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semNulos);
  if (!valor || typeof valor !== 'object') return valor;

  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    if (v === null || v === undefined) continue;
    saida[chave] = semNulos(v);
  }
  return saida;
}

/**
 * Remove campos sensíveis de listagens. O assistente não precisa de CPF, RG e
 * endereço para listar pacientes — só quando o usuário pede um paciente
 * específico (`obter_paciente`), onde os campos são mantidos.
 */
export function semDadosSensiveis<T extends object>(registro: T): Partial<T> {
  const copia = { ...registro } as Record<string, unknown>;
  delete copia['cpf'];
  delete copia['rg'];
  delete copia['enderecoCompleto'];
  return copia as Partial<T>;
}
