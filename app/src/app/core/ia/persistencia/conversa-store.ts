import { Observable } from 'rxjs';
import { Conversa, ConversaMeta, Mensagem, ResumoConversa, UsoDiario } from '../models/chat.model';

/**
 * Contrato de persistência do módulo de IA.
 *
 * É uma classe abstrata (e não uma interface) para servir de token de DI: trocar
 * o armazenamento local por um backend é uma linha em `app.config.ts`.
 *
 * Todos os métodos devolvem Observable mesmo quando a implementação responde na
 * hora — assim uma implementação HTTP entra sem mexer em nenhum chamador. E a
 * granularidade (anexar/atualizar mensagem em vez de salvar a conversa inteira)
 * já é a de uma API REST: POST /ia/conversas/:id/mensagens, PATCH /ia/mensagens/:id.
 */
export abstract class ConversaStore {
  /** true quando o histórico não está sendo gravado (aba anônima, IDB bloqueado). */
  abstract readonly somenteMemoria: boolean;

  abstract listar(): Observable<ResumoConversa[]>;
  abstract obter(id: string): Observable<Conversa | null>;
  abstract criar(parcial?: Partial<ConversaMeta>): Observable<Conversa>;

  /** Grava os metadados (título, modelo, rodada pendente, uso). */
  abstract salvarMeta(meta: ConversaMeta): Observable<void>;

  abstract anexarMensagens(mensagens: Mensagem[]): Observable<void>;
  abstract atualizarMensagem(mensagem: Mensagem): Observable<void>;

  abstract renomear(id: string, titulo: string): Observable<void>;
  abstract remover(id: string): Observable<void>;
  abstract removerTodas(): Observable<void>;

  /** Contadores de uso da chave medidos neste dispositivo. */
  abstract usoDoDia(dia: string): Observable<UsoDiario>;
  abstract somarUsoDoDia(dia: string, delta: Omit<UsoDiario, 'dia'>): Observable<void>;
}
