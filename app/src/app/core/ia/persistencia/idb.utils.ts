import {
  DB_NOME,
  DB_VERSAO,
  INDICE_CONVERSAS_USUARIO,
  INDICE_MENSAGENS_CONVERSA,
  STORE_CONVERSAS,
  STORE_MENSAGENS,
  STORE_USO,
} from '../ia.config';

/**
 * Wrapper promisificado mínimo sobre IndexedDB.
 *
 * Regra que o IndexedDB impõe e que o código acima precisa respeitar: uma
 * transação morre assim que o event loop roda sem nenhum pedido pendente. Por
 * isso `emTransacao` recebe uma função SÍNCRONA que só dispara pedidos do
 * próprio IDB — nada de `await fetch()` no meio de uma transação.
 */

export function suportaIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha no IndexedDB'));
  });
}

let conexao: Promise<IDBDatabase> | null = null;

export function abrirBanco(): Promise<IDBDatabase> {
  if (!suportaIdb()) {
    return Promise.reject(new Error('IndexedDB indisponível neste navegador'));
  }
  if (conexao) return conexao;

  conexao = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_CONVERSAS)) {
        const conversas = db.createObjectStore(STORE_CONVERSAS, { keyPath: 'id' });
        conversas.createIndex(INDICE_CONVERSAS_USUARIO, ['usuarioId', 'atualizadoEm']);
      }
      if (!db.objectStoreNames.contains(STORE_MENSAGENS)) {
        const mensagens = db.createObjectStore(STORE_MENSAGENS, { keyPath: 'id' });
        mensagens.createIndex(INDICE_MENSAGENS_CONVERSA, ['conversaId', 'ordem']);
      }
      if (!db.objectStoreNames.contains(STORE_USO)) {
        db.createObjectStore(STORE_USO, { keyPath: 'dia' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Outra aba pediu upgrade: soltar a conexão para não bloqueá-la.
      db.onversionchange = () => {
        db.close();
        conexao = null;
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir o banco'));
    req.onblocked = () => reject(new Error('Banco bloqueado por outra aba'));
  }).catch((err: unknown) => {
    conexao = null;
    throw err;
  });

  return conexao;
}

/**
 * Abre uma transação, executa `corpo` (síncrono) e resolve com o valor que ele
 * devolve, depois que a transação commitar.
 */
export async function emTransacao<T>(
  stores: string | string[],
  modo: IDBTransactionMode,
  corpo: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await abrirBanco();
  const tx = db.transaction(stores, modo);

  const concluida = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transação falhou'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'));
  });

  const resultado = await corpo(tx);
  await concluida;
  return resultado;
}

/** Lê todos os registros de um índice dentro de um intervalo. */
export function lerPorIndice<T>(
  tx: IDBTransaction,
  store: string,
  indice: string,
  intervalo: IDBKeyRange,
): Promise<T[]> {
  return pedido(tx.objectStore(store).index(indice).getAll(intervalo) as IDBRequest<T[]>);
}

/** Remove todos os registros de um índice dentro de um intervalo. */
export function removerPorIndice(
  tx: IDBTransaction,
  store: string,
  indice: string,
  intervalo: IDBKeyRange,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(store).index(indice).openKeyCursor(intervalo);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      tx.objectStore(store).delete(cursor.primaryKey);
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('Falha ao remover registros'));
  });
}
