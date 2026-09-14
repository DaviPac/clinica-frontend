import { Observable } from 'rxjs';
import { FunctionDeclaration } from '@google/genai';
import { Role, Usuario } from '../../models/usuario.model';

/**
 * leitura — executa direto, sem confirmação.
 * escrita — exige confirmação do usuário num formulário editável.
 * acao    — executa na hora, mas o único efeito é exibir um botão/link no chat.
 */
export type EscopoFerramenta = 'leitura' | 'escrita' | 'acao';

/** Qual formulário de confirmação renderiza os argumentos desta ferramenta. */
export type FormularioConfirmacao =
  | 'agendamento-criar'
  | 'agendamento-status'
  | 'agendamento-valor'
  | 'agendamento-pagamento'
  | 'agendamento-reagendar'
  | 'agendamento-recorrencia'
  | 'paciente'
  | 'paciente-ativacao'
  | 'servico'
  | 'servico-desativar'
  | 'despesa'
  | 'despesa-pagar'
  | 'acerto'
  | 'usuario'
  | 'generico';

/** Card clicável proposto pelo assistente. Nunca age sozinho. */
export type AcaoChat =
  | { tipo: 'navegar'; rotulo: string; comandos: (string | number)[] }
  | {
      tipo: 'download';
      rotulo: string;
      recurso: 'relatorio-sessoes-pdf';
      params: { inicio: string; fim: string; profissionalId?: number };
    };

export interface ResultadoFerramenta {
  /** Vai de volta ao modelo como `functionResponse.response`. */
  readonly paraModelo: Record<string, unknown>;
  /** Card clicável (apenas escopo 'acao'). */
  readonly acao?: AcaoChat;
  /** Resumo curto exibido no card ("12 agendamentos"). */
  readonly resumoUi?: string;
}

export interface ContextoExecucao {
  readonly usuario: Usuario;
  readonly isAdmin: boolean;
}

export interface FerramentaIA {
  readonly nome: string;
  readonly escopo: EscopoFerramenta;
  /** Filtra o que é declarado ao modelo E é revalidado na execução. */
  readonly papeis: readonly Role[];
  readonly declaracao: FunctionDeclaration;
  /** Obrigatório quando escopo === 'escrita'. */
  readonly formulario?: FormularioConfirmacao;
  /** Frase em pt-BR exibida no cabeçalho do card. */
  readonly descreverAcao: (args: Record<string, unknown>) => string;
  readonly executar: (
    args: Record<string, unknown>,
    ctx: ContextoExecucao,
  ) => Observable<ResultadoFerramenta>;
}

export const AMBOS_PAPEIS: readonly Role[] = ['ADMIN', 'PROFISSIONAL'];
export const SO_ADMIN: readonly Role[] = ['ADMIN'];
