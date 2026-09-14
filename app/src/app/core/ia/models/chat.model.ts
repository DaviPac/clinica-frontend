import { NivelRaciocinio } from '../ia.config';
import { AcaoChat, EscopoFerramenta, FormularioConfirmacao } from './ferramenta-ia.model';

export type EstadoCardFerramenta =
  | 'pendente' // escrita aguardando confirmação do usuário
  | 'executando'
  | 'executada' // leitura/ação concluída
  | 'confirmada' // escrita confirmada e executada
  | 'cancelada'
  | 'erro';

export interface MensagemBase {
  id: string;
  conversaId: string;
  /** Posição na conversa — é a chave de ordenação no IndexedDB. */
  ordem: number;
  criadoEm: string;
}

export interface MensagemTexto extends MensagemBase {
  tipo: 'texto';
  papel: 'usuario' | 'assistente';
  texto: string;
  /** Bloco de raciocínio do modelo, quando o nível de thinking está ligado. */
  raciocinio?: string;
  /** Tokens do turno que produziu esta mensagem. */
  uso?: UsoTurno;
}

export interface MensagemFerramenta extends MensagemBase {
  tipo: 'ferramenta';
  papel: 'assistente';
  /** Liga esta mensagem à chamada correspondente em RodadaPendente. */
  chamadaId: string;
  nome: string;
  escopo: EscopoFerramenta;
  formulario?: FormularioConfirmacao;
  descricao: string;
  /** Sobrescrito pelos argumentos EDITADOS no formulário ao confirmar. */
  args: Record<string, unknown>;
  estado: EstadoCardFerramenta;
  resumoUi?: string;
  resultado?: unknown;
  erro?: string;
  acao?: AcaoChat;
}

export interface MensagemAviso extends MensagemBase {
  tipo: 'aviso';
  papel: 'sistema';
  texto: string;
}

export type Mensagem = MensagemTexto | MensagemFerramenta | MensagemAviso;

export interface ChamadaFerramenta {
  id: string;
  nome: string;
  args: Record<string, unknown>;
}

/** Turno do modelo parcialmente processado — permite suspender e retomar o loop. */
export interface RodadaPendente {
  chamadas: ChamadaFerramenta[];
  /** Próxima chamada a processar. */
  indice: number;
  /** Iteração do loop, para respeitar MAX_ITERACOES_TURNO ao retomar. */
  iteracao: number;
}

export interface UsoTurno {
  prompt: number;
  resposta: number;
  raciocinio: number;
  total: number;
}

export interface UsoConversa extends UsoTurno {
  /** Tokens do prompt do último turno — mede a janela de contexto ocupada. */
  ultimoPrompt: number;
  requisicoes: number;
}

export const USO_ZERADO: UsoConversa = {
  prompt: 0,
  resposta: 0,
  raciocinio: 0,
  total: 0,
  ultimoPrompt: 0,
  requisicoes: 0,
};

/** Metadados da conversa — no IndexedDB as mensagens ficam num store separado. */
export interface ConversaMeta {
  id: string;
  usuarioId: number;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  modeloId: string;
  nivelRaciocinio: NivelRaciocinio;
  rodada: RodadaPendente | null;
  uso: UsoConversa;
  /** Próxima `ordem` a atribuir a uma mensagem. */
  proximaOrdem: number;
}

export interface Conversa extends ConversaMeta {
  mensagens: Mensagem[];
}

export interface ResumoConversa {
  id: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
}

/** Contadores diários de uso da chave, medidos neste dispositivo. */
export interface UsoDiario {
  dia: string; // YYYY-MM-DD
  requisicoes: number;
  tokensPrompt: number;
  tokensResposta: number;
  tokensRaciocinio: number;
}

export function ehMensagemTexto(m: Mensagem): m is MensagemTexto {
  return m.tipo === 'texto';
}

export function ehMensagemFerramenta(m: Mensagem): m is MensagemFerramenta {
  return m.tipo === 'ferramenta';
}

export function novoId(): string {
  return crypto.randomUUID();
}
