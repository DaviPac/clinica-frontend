import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { ApiError } from '../../models/api-error.model';
import { DocumentoProntuario, DocumentoSalvo } from '../../models/prontuario.model';

type MensagemCanal =
  | { tipo: 'salvo'; agendamentoId: number }
  | { tipo: 'pedido'; codigo: string }
  | { tipo: 'rascunho'; codigo: string; conteudo: DocumentoProntuario };

/** Quanto o editor completo espera pela guia que o abriu antes de desistir do rascunho. */
const ESPERA_RASCUNHO_MS = 3000;
/** Rascunho que ninguém veio buscar (a guia nova foi fechada antes) é descartado. */
const VALIDADE_RASCUNHO_MS = 60_000;

/**
 * Documento rico de um agendamento — o prontuário e as anotações usam os
 * mesmos endpoints, cada um no seu recurso (`/agendamentos/:id/<recurso>`).
 *
 * O editor completo abre em outra guia, e as guias conversam por um
 * BroadcastChannel (um por recurso):
 *  - cada salvamento é anunciado, para as outras guias se atualizarem;
 *  - o texto ainda não salvo passa de uma guia para a outra só pela
 *    memória: quem abre guarda o rascunho sob um código (`oferecerRascunho`),
 *    o código vai na URL e a guia nova o pede (`buscarRascunho`). Nada do
 *    documento é gravado no navegador.
 */
export abstract class DocumentoAgendamentoService<T extends DocumentoSalvo = DocumentoSalvo> {
  protected http = inject(HttpClient);

  private canal: BroadcastChannel | null;
  private mensagens = new Subject<MensagemCanal>();
  private rascunhos = new Map<string, DocumentoProntuario>();

  /**
   * `recurso`: o trecho da URL depois do agendamento.
   * `codigoNaoExiste`: o código de erro da API quando o agendamento ainda não tem o documento.
   */
  protected constructor(
    protected readonly recurso: string,
    private readonly codigoNaoExiste: string,
  ) {
    this.canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(recurso);
    // O canal não entrega a mensagem para quem a enviou: só chegam as das outras guias
    this.canal?.addEventListener('message', (e: MessageEvent<MensagemCanal>) => {
      const m = e.data;
      if (m.tipo === 'pedido' && this.rascunhos.has(m.codigo)) {
        this.canal?.postMessage({ tipo: 'rascunho', codigo: m.codigo, conteudo: this.rascunhos.get(m.codigo)! });
        this.rascunhos.delete(m.codigo);
      }
      this.mensagens.next(m);
    });
  }

  /** Falha com o erro de inexistente se o agendamento ainda não tem o documento — ver `naoExiste`. */
  obter(agendamentoId: number) {
    return this.http.get<T>(this.url(agendamentoId));
  }

  criar(agendamentoId: number, conteudo: DocumentoProntuario) {
    return this.http.post<void>(this.url(agendamentoId), { conteudo }).pipe(this.anunciar(agendamentoId));
  }

  atualizar(agendamentoId: number, conteudo: DocumentoProntuario) {
    return this.http.put<void>(this.url(agendamentoId), { conteudo }).pipe(this.anunciar(agendamentoId));
  }

  /** O erro só diz que o agendamento ainda não tem o documento. */
  naoExiste(err: unknown): boolean {
    return err instanceof ApiError && err.codigo === this.codigoNaoExiste;
  }

  protected url(agendamentoId: number) {
    return `/agendamentos/${agendamentoId}/${this.recurso}`;
  }

  // --- Entre guias ---

  /** Emite quando outra guia salva o documento deste agendamento. */
  salvoEmOutraGuia(agendamentoId: number): Observable<void> {
    return this.mensagens.pipe(
      filter((m) => m.tipo === 'salvo' && m.agendamentoId === agendamentoId),
      map(() => undefined),
    );
  }

  /** Guarda o rascunho para a guia que vai ser aberta; devolve o código que vai na URL. */
  oferecerRascunho(conteudo: DocumentoProntuario): string {
    const codigo = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.rascunhos.set(codigo, conteudo);
    setTimeout(() => this.rascunhos.delete(codigo), VALIDADE_RASCUNHO_MS);
    return codigo;
  }

  /** Pede à guia que abriu esta o rascunho do código; null se ela não responder a tempo. */
  buscarRascunho(codigo: string): Promise<DocumentoProntuario | null> {
    if (!this.canal) return Promise.resolve(null);
    return new Promise((resolver) => {
      const assinatura = this.mensagens.subscribe((m) => {
        if (m.tipo === 'rascunho' && m.codigo === codigo) terminar(m.conteudo);
      });
      const prazo = setTimeout(() => terminar(null), ESPERA_RASCUNHO_MS);
      const terminar = (conteudo: DocumentoProntuario | null) => {
        clearTimeout(prazo);
        assinatura.unsubscribe();
        resolver(conteudo);
      };
      this.canal!.postMessage({ tipo: 'pedido', codigo } satisfies MensagemCanal);
    });
  }

  private anunciar(agendamentoId: number) {
    return tap<void>(() => this.canal?.postMessage({ tipo: 'salvo', agendamentoId } satisfies MensagemCanal));
  }
}
