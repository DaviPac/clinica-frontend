import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import {
  DB_NOME,
  INDICE_CONVERSAS_USUARIO,
  INDICE_MENSAGENS_CONVERSA,
  MAX_BYTES_RESULTADO,
  MAX_CONVERSAS,
  MAX_MENSAGENS_POR_CONVERSA,
  MODELO_PADRAO,
  STORE_CONVERSAS,
  STORE_MENSAGENS,
  STORE_USO,
} from '../ia.config';
import {
  Conversa,
  ConversaMeta,
  Mensagem,
  ResumoConversa,
  USO_ZERADO,
  UsoDiario,
  ehMensagemFerramenta,
  novoId,
} from '../models/chat.model';
import { ConversaStore } from './conversa-store';
import {
  emTransacao,
  lerPorIndice,
  pedido,
  removerPorIndice,
  suportaIdb,
} from './idb.utils';

const USO_DIARIO_VAZIO = (dia: string): UsoDiario => ({
  dia,
  requisicoes: 0,
  tokensPrompt: 0,
  tokensResposta: 0,
  tokensRaciocinio: 0,
});

/**
 * Implementação em IndexedDB.
 *
 * Conversas e mensagens ficam em stores separados: anexar uma mensagem (ou
 * reescrever a que está sendo transmitida em streaming) não toca no resto do
 * histórico, que é justamente o que torna o IDB melhor que o localStorage aqui.
 *
 * Se o IndexedDB não estiver disponível (aba anônima, política do navegador), a
 * classe cai num modo em memória e sinaliza por `somenteMemoria` para a UI
 * avisar que o histórico não será salvo — em vez de quebrar a página.
 */
@Injectable({ providedIn: 'root' })
export class ConversaStoreIdb extends ConversaStore {
  private readonly auth = inject(AuthService);

  private memoria = new Map<string, Conversa>();
  private usoMemoria = new Map<string, UsoDiario>();
  private emMemoria = !suportaIdb();

  override get somenteMemoria(): boolean {
    return this.emMemoria;
  }

  private get usuarioId(): number {
    return this.auth.usuario()?.id ?? 0;
  }

  // ── Leitura ────────────────────────────────────────────────────────────────

  override listar(): Observable<ResumoConversa[]> {
    return this.operacao(async () => {
      const usuarioId = this.usuarioId;
      const metas = await emTransacao(STORE_CONVERSAS, 'readonly', (tx) =>
        lerPorIndice<ConversaMeta>(
          tx,
          STORE_CONVERSAS,
          INDICE_CONVERSAS_USUARIO,
          IDBKeyRange.bound([usuarioId, ''], [usuarioId, '￿']),
        ),
      );
      return metas.map(paraResumo).sort(porAtualizacaoDesc);
    }, () =>
      [...this.memoria.values()]
        .filter((c) => c.usuarioId === this.usuarioId)
        .map(paraResumo)
        .sort(porAtualizacaoDesc),
    );
  }

  override obter(id: string): Observable<Conversa | null> {
    return this.operacao(
      async () => {
        const { meta, mensagens } = await emTransacao(
          [STORE_CONVERSAS, STORE_MENSAGENS],
          'readonly',
          async (tx) => ({
            meta: await pedido<ConversaMeta | undefined>(
              tx.objectStore(STORE_CONVERSAS).get(id) as IDBRequest<ConversaMeta | undefined>,
            ),
            mensagens: await lerPorIndice<Mensagem>(
              tx,
              STORE_MENSAGENS,
              INDICE_MENSAGENS_CONVERSA,
              IDBKeyRange.bound([id, -Infinity], [id, Infinity]),
            ),
          }),
        );
        if (!meta || meta.usuarioId !== this.usuarioId) return null;
        return { ...meta, mensagens: mensagens.sort((a, b) => a.ordem - b.ordem) };
      },
      () => this.memoria.get(id) ?? null,
    );
  }

  // ── Escrita ────────────────────────────────────────────────────────────────

  override criar(parcial: Partial<ConversaMeta> = {}): Observable<Conversa> {
    const agora = new Date().toISOString();
    const conversa: Conversa = {
      id: novoId(),
      usuarioId: this.usuarioId,
      titulo: '',
      criadoEm: agora,
      atualizadoEm: agora,
      modeloId: MODELO_PADRAO,
      nivelRaciocinio: 'desligado',
      rodada: null,
      uso: { ...USO_ZERADO },
      proximaOrdem: 0,
      mensagens: [],
      ...parcial,
    };

    return this.operacao(
      async () => {
        await emTransacao(STORE_CONVERSAS, 'readwrite', (tx) =>
          pedido(tx.objectStore(STORE_CONVERSAS).put(semMensagens(conversa))),
        );
        await this.podarConversas();
        return conversa;
      },
      () => {
        this.memoria.set(conversa.id, conversa);
        return conversa;
      },
    );
  }

  override salvarMeta(meta: ConversaMeta): Observable<void> {
    const atualizado: ConversaMeta = { ...meta, atualizadoEm: new Date().toISOString() };
    return this.operacao(
      async () => {
        await emTransacao(STORE_CONVERSAS, 'readwrite', (tx) =>
          pedido(tx.objectStore(STORE_CONVERSAS).put(semMensagens(atualizado))),
        );
      },
      () => {
        const atual = this.memoria.get(meta.id);
        if (atual) this.memoria.set(meta.id, { ...atual, ...atualizado });
      },
    );
  }

  override anexarMensagens(mensagens: Mensagem[]): Observable<void> {
    if (!mensagens.length) return this.operacao(async () => undefined, () => undefined);
    const prontas = mensagens.map(compactar);

    return this.operacao(
      async () => {
        await emTransacao(STORE_MENSAGENS, 'readwrite', (tx) => {
          const store = tx.objectStore(STORE_MENSAGENS);
          for (const m of prontas) store.put(m);
        });
        await this.podarMensagens(prontas[0].conversaId);
      },
      () => {
        const conversa = this.memoria.get(prontas[0].conversaId);
        if (conversa) conversa.mensagens.push(...prontas);
      },
    );
  }

  override atualizarMensagem(mensagem: Mensagem): Observable<void> {
    const pronta = compactar(mensagem);
    return this.operacao(
      async () => {
        await emTransacao(STORE_MENSAGENS, 'readwrite', (tx) =>
          pedido(tx.objectStore(STORE_MENSAGENS).put(pronta)),
        );
      },
      () => {
        const conversa = this.memoria.get(pronta.conversaId);
        if (!conversa) return;
        const i = conversa.mensagens.findIndex((m) => m.id === pronta.id);
        if (i >= 0) conversa.mensagens[i] = pronta;
      },
    );
  }

  override renomear(id: string, titulo: string): Observable<void> {
    return this.operacao(
      async () => {
        await emTransacao(STORE_CONVERSAS, 'readwrite', async (tx) => {
          const store = tx.objectStore(STORE_CONVERSAS);
          const meta = await pedido<ConversaMeta | undefined>(
            store.get(id) as IDBRequest<ConversaMeta | undefined>,
          );
          if (meta) store.put({ ...meta, titulo, atualizadoEm: new Date().toISOString() });
        });
      },
      () => {
        const c = this.memoria.get(id);
        if (c) c.titulo = titulo;
      },
    );
  }

  override remover(id: string): Observable<void> {
    return this.operacao(
      async () => {
        await emTransacao([STORE_CONVERSAS, STORE_MENSAGENS], 'readwrite', async (tx) => {
          tx.objectStore(STORE_CONVERSAS).delete(id);
          await removerPorIndice(
            tx,
            STORE_MENSAGENS,
            INDICE_MENSAGENS_CONVERSA,
            IDBKeyRange.bound([id, -Infinity], [id, Infinity]),
          );
        });
      },
      () => {
        this.memoria.delete(id);
      },
    );
  }

  override removerTodas(): Observable<void> {
    return this.operacao(
      async () => {
        const resumos = await emTransacao(STORE_CONVERSAS, 'readonly', (tx) =>
          lerPorIndice<ConversaMeta>(
            tx,
            STORE_CONVERSAS,
            INDICE_CONVERSAS_USUARIO,
            IDBKeyRange.bound([this.usuarioId, ''], [this.usuarioId, '￿']),
          ),
        );
        for (const meta of resumos) {
          await emTransacao([STORE_CONVERSAS, STORE_MENSAGENS], 'readwrite', async (tx) => {
            tx.objectStore(STORE_CONVERSAS).delete(meta.id);
            await removerPorIndice(
              tx,
              STORE_MENSAGENS,
              INDICE_MENSAGENS_CONVERSA,
              IDBKeyRange.bound([meta.id, -Infinity], [meta.id, Infinity]),
            );
          });
        }
      },
      () => {
        this.memoria.clear();
      },
    );
  }

  // ── Uso da chave ───────────────────────────────────────────────────────────

  override usoDoDia(dia: string): Observable<UsoDiario> {
    return this.operacao(
      async () => {
        const registro = await emTransacao(STORE_USO, 'readonly', (tx) =>
          pedido<UsoDiario | undefined>(
            tx.objectStore(STORE_USO).get(dia) as IDBRequest<UsoDiario | undefined>,
          ),
        );
        return registro ?? USO_DIARIO_VAZIO(dia);
      },
      () => this.usoMemoria.get(dia) ?? USO_DIARIO_VAZIO(dia),
    );
  }

  override somarUsoDoDia(dia: string, delta: Omit<UsoDiario, 'dia'>): Observable<void> {
    return this.operacao(
      async () => {
        await emTransacao(STORE_USO, 'readwrite', async (tx) => {
          const store = tx.objectStore(STORE_USO);
          const atual =
            (await pedido<UsoDiario | undefined>(
              store.get(dia) as IDBRequest<UsoDiario | undefined>,
            )) ?? USO_DIARIO_VAZIO(dia);
          store.put(somar(atual, delta));
        });
      },
      () => {
        const atual = this.usoMemoria.get(dia) ?? USO_DIARIO_VAZIO(dia);
        this.usoMemoria.set(dia, somar(atual, delta));
      },
    );
  }

  // ── Infra ──────────────────────────────────────────────────────────────────

  /**
   * Roda a versão IndexedDB e, se ela falhar (ou o IDB não existir), cai para a
   * versão em memória — marcando o store como `somenteMemoria` para a UI avisar.
   */
  private operacao<T>(idb: () => Promise<T>, memoria: () => T): Observable<T> {
    return defer(() => {
      if (this.emMemoria) return Promise.resolve(memoria());
      return idb().catch((err: unknown) => {
        console.warn(`[ia] ${DB_NOME}: caindo para memória —`, err);
        this.emMemoria = true;
        return memoria();
      });
    });
  }

  /** Mantém no máximo MAX_CONVERSAS por usuário, descartando as mais antigas. */
  private async podarConversas(): Promise<void> {
    const usuarioId = this.usuarioId;
    const metas = await emTransacao(STORE_CONVERSAS, 'readonly', (tx) =>
      lerPorIndice<ConversaMeta>(
        tx,
        STORE_CONVERSAS,
        INDICE_CONVERSAS_USUARIO,
        IDBKeyRange.bound([usuarioId, ''], [usuarioId, '￿']),
      ),
    );
    if (metas.length <= MAX_CONVERSAS) return;

    const excedentes = metas.sort(porAtualizacaoDesc).slice(MAX_CONVERSAS);
    for (const meta of excedentes) {
      await emTransacao([STORE_CONVERSAS, STORE_MENSAGENS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_CONVERSAS).delete(meta.id);
        await removerPorIndice(
          tx,
          STORE_MENSAGENS,
          INDICE_MENSAGENS_CONVERSA,
          IDBKeyRange.bound([meta.id, -Infinity], [meta.id, Infinity]),
        );
      });
    }
  }

  /**
   * Mantém no máximo MAX_MENSAGENS_POR_CONVERSA, cortando as mais antigas — mas
   * só até uma mensagem de usuário, para nunca separar uma chamada de ferramenta
   * da resposta dela na transcrição enviada ao modelo.
   */
  private async podarMensagens(conversaId: string): Promise<void> {
    const mensagens = await emTransacao(STORE_MENSAGENS, 'readonly', (tx) =>
      lerPorIndice<Mensagem>(
        tx,
        STORE_MENSAGENS,
        INDICE_MENSAGENS_CONVERSA,
        IDBKeyRange.bound([conversaId, -Infinity], [conversaId, Infinity]),
      ),
    );
    if (mensagens.length <= MAX_MENSAGENS_POR_CONVERSA) return;

    const ordenadas = mensagens.sort((a, b) => a.ordem - b.ordem);
    let corte = ordenadas.length - MAX_MENSAGENS_POR_CONVERSA;
    while (
      corte < ordenadas.length &&
      !(ordenadas[corte].tipo === 'texto' && ordenadas[corte].papel === 'usuario')
    ) {
      corte++;
    }
    if (corte >= ordenadas.length) return;

    const remover = ordenadas.slice(0, corte);
    await emTransacao(STORE_MENSAGENS, 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_MENSAGENS);
      for (const m of remover) store.delete(m.id);
    });
  }
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

function paraResumo(meta: ConversaMeta): ResumoConversa {
  return {
    id: meta.id,
    titulo: meta.titulo,
    criadoEm: meta.criadoEm,
    atualizadoEm: meta.atualizadoEm,
  };
}

function porAtualizacaoDesc(a: ResumoConversa, b: ResumoConversa): number {
  return b.atualizadoEm.localeCompare(a.atualizadoEm);
}

function semMensagens(conversa: ConversaMeta): ConversaMeta {
  const meta: ConversaMeta & { mensagens?: Mensagem[] } = { ...conversa };
  delete meta.mensagens;
  return meta;
}

/** Trunca resultados grandes de ferramenta antes de gravar. */
function compactar(mensagem: Mensagem): Mensagem {
  if (!ehMensagemFerramenta(mensagem) || mensagem.resultado === undefined) return mensagem;

  const serializado = JSON.stringify(mensagem.resultado) ?? '';
  if (serializado.length <= MAX_BYTES_RESULTADO) return mensagem;

  return {
    ...mensagem,
    resultado: { truncado: true, amostra: serializado.slice(0, 2000) },
  };
}

function somar(atual: UsoDiario, delta: Omit<UsoDiario, 'dia'>): UsoDiario {
  return {
    dia: atual.dia,
    requisicoes: atual.requisicoes + delta.requisicoes,
    tokensPrompt: atual.tokensPrompt + delta.tokensPrompt,
    tokensResposta: atual.tokensResposta + delta.tokensResposta,
    tokensRaciocinio: atual.tokensRaciocinio + delta.tokensRaciocinio,
  };
}
