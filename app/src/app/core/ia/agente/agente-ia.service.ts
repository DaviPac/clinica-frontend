import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { RegistroFerramentas } from '../ferramentas/registro-ferramentas';
import { ErroCotaIA, GeminiChatClient } from '../gemini/gemini-chat.client';
import { construirInstrucaoSistema } from '../gemini/prompt-sistema';
import {
  CHAVE_MODELO_PADRAO,
  CHAVE_RACIOCINIO_PADRAO,
  MAX_CHAMADAS_REPETIDAS,
  MAX_ITERACOES_TURNO,
  MODELO_PADRAO,
  NivelRaciocinio,
} from '../ia.config';
import {
  ChamadaFerramenta,
  Conversa,
  ConversaMeta,
  Mensagem,
  MensagemFerramenta,
  MensagemTexto,
  ResumoConversa,
  USO_ZERADO,
  UsoTurno,
  ehMensagemFerramenta,
  novoId,
} from '../models/chat.model';
import { ContextoExecucao } from '../models/ferramenta-ia.model';
import { ConversaStore } from '../persistencia/conversa-store';
import { assinaturaChamada, recortarContexto, toGeminiContents } from './transcricao';

export type EstadoAgente =
  | 'ocioso'
  | 'pensando'
  | 'executando'
  | 'aguardando_confirmacao'
  | 'erro';

@Injectable({ providedIn: 'root' })
export class AgenteIaService {
  private readonly auth = inject(AuthService);
  private readonly registro = inject(RegistroFerramentas);
  private readonly cliente = inject(GeminiChatClient);
  private readonly store = inject(ConversaStore);

  private readonly _conversa = signal<Conversa | null>(null);
  private readonly _conversas = signal<ResumoConversa[]>([]);

  readonly conversa = this._conversa.asReadonly();
  readonly conversas = this._conversas.asReadonly();
  readonly mensagens = computed<Mensagem[]>(() => this._conversa()?.mensagens ?? []);

  readonly estado = signal<EstadoAgente>('ocioso');
  readonly rotuloEstado = signal('');
  readonly erro = signal<string | null>(null);
  readonly detalheCota = signal<string | null>(null);

  readonly ocupado = computed(
    () => this.estado() === 'pensando' || this.estado() === 'executando',
  );
  readonly aguardandoConfirmacao = computed(() => this.estado() === 'aguardando_confirmacao');
  readonly somenteMemoria = computed(() => this.store.somenteMemoria);

  private abortador: AbortController | null = null;
  private assinaturasDoTurno: string[] = [];

  // ── Ciclo de vida das conversas ────────────────────────────────────────────

  async carregarLista(): Promise<void> {
    this._conversas.set(await firstValueFrom(this.store.listar()));
  }

  async novaConversa(): Promise<Conversa> {
    const conversa = await firstValueFrom(
      this.store.criar({
        modeloId: this.modeloPreferido(),
        nivelRaciocinio: this.raciocinioPreferido(),
      }),
    );
    this._conversa.set(conversa);
    this.estado.set('ocioso');
    this.erro.set(null);
    await this.carregarLista();
    return conversa;
  }

  async abrir(id: string): Promise<void> {
    const conversa = await firstValueFrom(this.store.obter(id));
    if (!conversa) {
      this.erro.set('Conversa não encontrada.');
      return;
    }
    this._conversa.set(conversa);
    this.erro.set(null);
    await this.restaurarEstado(conversa);
  }

  async renomear(id: string, titulo: string): Promise<void> {
    await firstValueFrom(this.store.renomear(id, titulo));
    const atual = this._conversa();
    if (atual?.id === id) this._conversa.set({ ...atual, titulo });
    await this.carregarLista();
  }

  async remover(id: string): Promise<void> {
    await firstValueFrom(this.store.remover(id));
    if (this._conversa()?.id === id) this._conversa.set(null);
    await this.carregarLista();
  }

  async definirModelo(modeloId: string): Promise<void> {
    localStorage.setItem(CHAVE_MODELO_PADRAO, modeloId);
    await this.mutarMeta((c) => ({ ...c, modeloId }));
  }

  async definirRaciocinio(nivel: NivelRaciocinio): Promise<void> {
    localStorage.setItem(CHAVE_RACIOCINIO_PADRAO, nivel);
    await this.mutarMeta((c) => ({ ...c, nivelRaciocinio: nivel }));
  }

  parar(): void {
    this.abortador?.abort();
    this.abortador = null;
  }

  // ── Turno ──────────────────────────────────────────────────────────────────

  async enviar(texto: string): Promise<void> {
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (this.estado() === 'pensando' || this.estado() === 'executando') return;

    let conversa = this._conversa();
    conversa ??= await this.novaConversa();

    this.erro.set(null);
    this.detalheCota.set(null);
    this.assinaturasDoTurno = [];

    await this.anexar(this.mensagemTexto('usuario', conteudo));

    if (!this._conversa()?.titulo) {
      const titulo = conteudo.length > 48 ? `${conteudo.slice(0, 48)}…` : conteudo;
      await this.mutarMeta((c) => ({ ...c, titulo }));
      await this.carregarLista();
    }

    await this.rodarLoop(0);
  }

  /**
   * Confirma uma chamada de escrita com os argumentos EDITADOS no formulário.
   *
   * Os argumentos do formulário substituem os que o modelo propôs tanto na
   * execução quanto no histórico — assim o resumo que o assistente escreve
   * depois corresponde ao que de fato aconteceu.
   */
  async confirmarFerramenta(
    mensagemId: string,
    argsEditados: Record<string, unknown>,
  ): Promise<void> {
    const conversa = this._conversa();
    const alvo = conversa?.mensagens.find((m) => m.id === mensagemId);
    if (!conversa || !alvo || !ehMensagemFerramenta(alvo) || alvo.estado !== 'pendente') return;

    // Sair de 'pendente' é o que destrava o loop: enquanto o card estiver
    // pendente, processarRodada volta a suspender em vez de executar.
    // A descrição é recalculada com os args editados — senão o histórico
    // mostraria o que a IA propôs, não o que o usuário mandou executar.
    const ferramenta = this.registro.obter(alvo.nome);
    await this.atualizarFerramenta(mensagemId, {
      args: argsEditados,
      estado: 'executando',
      descricao: ferramenta?.descreverAcao(argsEditados) ?? alvo.descricao,
    });

    const chamadaId = alvo.chamadaId;
    await this.mutarMeta((c) =>
      c.rodada
        ? {
            ...c,
            rodada: {
              ...c.rodada,
              chamadas: c.rodada.chamadas.map((ch) =>
                ch.id === chamadaId ? { ...ch, args: argsEditados } : ch,
              ),
            },
          }
        : c,
    );

    await this.prosseguirRodada();
  }

  async cancelarFerramenta(mensagemId: string): Promise<void> {
    const conversa = this._conversa();
    const alvo = conversa?.mensagens.find((m) => m.id === mensagemId);
    if (!conversa || !alvo || !ehMensagemFerramenta(alvo) || alvo.estado !== 'pendente') return;

    await this.atualizarFerramenta(mensagemId, {
      estado: 'cancelada',
      erro: 'Cancelado pelo usuário.',
    });
    this.avancarIndice();
    await this.prosseguirRodada();
  }

  // ── Motor ──────────────────────────────────────────────────────────────────

  private async rodarLoop(iteracaoInicial: number): Promise<void> {
    const usuario = this.auth.usuario();
    if (!usuario) return;

    const ctx: ContextoExecucao = { usuario, isAdmin: usuario.role === 'ADMIN' };
    const ferramentas = this.registro.declaracoes(usuario.role);
    const instrucaoSistema = construirInstrucaoSistema(usuario);

    let iteracao = iteracaoInicial;

    while (iteracao < MAX_ITERACOES_TURNO) {
      iteracao++;

      this.abortador = new AbortController();
      this.estado.set('pensando');
      this.rotuloEstado.set('Pensando…');

      const parcial = this.mensagemTexto('assistente', '');
      await this.anexar(parcial);

      let resposta;
      try {
        const conversa = this._conversa();
        resposta = await this.cliente.gerar({
          modelo: conversa?.modeloId ?? MODELO_PADRAO,
          raciocinio: conversa?.nivelRaciocinio ?? 'desligado',
          instrucaoSistema,
          contents: toGeminiContents(
            recortarContexto(this.mensagens().filter((m) => m.id !== parcial.id)),
          ),
          ferramentas,
          sinal: this.abortador.signal,
          onTexto: (delta) => this.acumularTexto(parcial.id, delta, 'texto'),
          onRaciocinio: (delta) => this.acumularTexto(parcial.id, delta, 'raciocinio'),
        });
      } catch (err: unknown) {
        await this.removerMensagemVaziaOuFinalizar(parcial.id);
        this.registrarErro(err);
        return;
      } finally {
        this.abortador = null;
      }

      await this.registrarUso(resposta.uso);
      await this.finalizarMensagemParcial(parcial.id, resposta.texto, resposta.raciocinio);

      if (!resposta.chamadas.length) {
        // Fallback natural: o modelo respondeu em texto, sem chamar ferramenta.
        this.estado.set('ocioso');
        this.rotuloEstado.set('');
        return;
      }

      if (this.detectouLaco(resposta.chamadas)) {
        await this.anexar(
          this.mensagemAviso(
            'Percebi que estava repetindo a mesma consulta. Parei aqui — pode reformular o pedido?',
          ),
        );
        this.estado.set('ocioso');
        return;
      }

      const chamadas: ChamadaFerramenta[] = resposta.chamadas.map((c) => ({
        id: novoId(),
        nome: c.nome,
        args: c.args,
      }));

      await this.mutarMeta((c) => ({ ...c, rodada: { chamadas, indice: 0, iteracao } }));
      await this.anexar(...chamadas.map((c) => this.mensagemFerramenta(c)));

      if ((await this.processarRodada(ctx)) === 'suspensa') return;

      await this.mutarMeta((c) => ({ ...c, rodada: null }));
    }

    await this.anexar(
      this.mensagemAviso(
        `Interrompi após ${MAX_ITERACOES_TURNO} etapas encadeadas. Quer que eu continue?`,
      ),
    );
    this.estado.set('ocioso');
    this.rotuloEstado.set('');
  }

  /**
   * Executa as chamadas da rodada em ordem. Ao encontrar uma escrita pendente,
   * devolve 'suspensa' e o turno para até o usuário confirmar ou cancelar.
   */
  private async processarRodada(ctx: ContextoExecucao): Promise<'concluida' | 'suspensa'> {
    for (;;) {
      const conversa = this._conversa();
      const rodada = conversa?.rodada;
      if (!conversa || !rodada) return 'concluida';
      if (rodada.indice >= rodada.chamadas.length) return 'concluida';

      const chamada = rodada.chamadas[rodada.indice];
      const mensagem = conversa.mensagens.find(
        (m): m is MensagemFerramenta =>
          ehMensagemFerramenta(m) && m.chamadaId === chamada.id,
      );
      if (!mensagem) {
        this.avancarIndice();
        continue;
      }

      const ferramenta = this.registro.obter(chamada.nome);

      // Revalida o papel na execução: um card antigo ou uma alucinação param aqui.
      if (!ferramenta || !this.registro.permitido(chamada.nome, ctx.usuario.role)) {
        await this.atualizarFerramenta(mensagem.id, {
          estado: 'erro',
          erro: ferramenta
            ? 'Esta operação não está disponível para o seu perfil.'
            : `Ferramenta desconhecida: ${chamada.nome}.`,
        });
        this.avancarIndice();
        continue;
      }

      if (ferramenta.escopo === 'escrita' && mensagem.estado === 'pendente') {
        this.estado.set('aguardando_confirmacao');
        this.rotuloEstado.set('');
        return 'suspensa';
      }

      this.estado.set('executando');
      this.rotuloEstado.set(ferramenta.descreverAcao(mensagem.args));
      await this.atualizarFerramenta(mensagem.id, { estado: 'executando' });

      try {
        const resultado = await firstValueFrom(
          this.registro.executar(chamada.nome, mensagem.args, ctx),
        );
        await this.atualizarFerramenta(mensagem.id, {
          estado: ferramenta.escopo === 'escrita' ? 'confirmada' : 'executada',
          resultado: resultado.paraModelo,
          resumoUi: resultado.resumoUi,
          acao: resultado.acao,
        });
      } catch (err: unknown) {
        await this.atualizarFerramenta(mensagem.id, {
          estado: 'erro',
          erro: err instanceof Error ? err.message : 'Falha ao executar a operação.',
        });
      }

      this.avancarIndice();
    }
  }

  /** Retoma depois de uma confirmação ou cancelamento. */
  private async prosseguirRodada(): Promise<void> {
    const usuario = this.auth.usuario();
    if (!usuario) return;
    const ctx: ContextoExecucao = { usuario, isAdmin: usuario.role === 'ADMIN' };

    if ((await this.processarRodada(ctx)) === 'suspensa') return;

    const iteracao = this._conversa()?.rodada?.iteracao ?? 0;
    await this.mutarMeta((c) => ({ ...c, rodada: null }));
    await this.rodarLoop(iteracao);
  }

  // ── Estado e persistência ──────────────────────────────────────────────────

  /** Recalcula o estado ao reabrir uma conversa suspensa num F5. */
  private async restaurarEstado(conversa: Conversa): Promise<void> {
    const rodada = conversa.rodada;
    if (!rodada) {
      this.estado.set('ocioso');
      return;
    }

    const pendente = conversa.mensagens.some(
      (m) => ehMensagemFerramenta(m) && m.estado === 'pendente',
    );
    if (pendente) {
      this.estado.set('aguardando_confirmacao');
      return;
    }

    // A rodada terminou mas a aba fechou antes de o resultado voltar ao modelo:
    // sem isso a conversa ficaria com uma ação executada e nenhuma resposta.
    this.estado.set('ocioso');
    this.assinaturasDoTurno = [];
    await this.prosseguirRodada();
  }

  private avancarIndice(): void {
    const conversa = this._conversa();
    if (!conversa?.rodada) return;
    const rodada = { ...conversa.rodada, indice: conversa.rodada.indice + 1 };
    this._conversa.set({ ...conversa, rodada });
    void firstValueFrom(this.store.salvarMeta(semMensagens({ ...conversa, rodada })));
  }

  private mensagemTexto(papel: 'usuario' | 'assistente', texto: string): MensagemTexto {
    const conversa = this._conversa();
    return {
      id: novoId(),
      conversaId: conversa?.id ?? '',
      ordem: conversa?.proximaOrdem ?? 0,
      criadoEm: new Date().toISOString(),
      tipo: 'texto',
      papel,
      texto,
    };
  }

  private mensagemAviso(texto: string): Mensagem {
    const conversa = this._conversa();
    return {
      id: novoId(),
      conversaId: conversa?.id ?? '',
      ordem: conversa?.proximaOrdem ?? 0,
      criadoEm: new Date().toISOString(),
      tipo: 'aviso',
      papel: 'sistema',
      texto,
    };
  }

  private mensagemFerramenta(chamada: ChamadaFerramenta): MensagemFerramenta {
    const conversa = this._conversa();
    const ferramenta = this.registro.obter(chamada.nome);
    const escrita = ferramenta?.escopo === 'escrita';

    return {
      id: novoId(),
      conversaId: conversa?.id ?? '',
      ordem: conversa?.proximaOrdem ?? 0,
      criadoEm: new Date().toISOString(),
      tipo: 'ferramenta',
      papel: 'assistente',
      chamadaId: chamada.id,
      nome: chamada.nome,
      escopo: ferramenta?.escopo ?? 'leitura',
      formulario: ferramenta?.formulario,
      descricao: ferramenta?.descreverAcao(chamada.args) ?? chamada.nome,
      args: chamada.args,
      estado: escrita ? 'pendente' : 'executando',
    };
  }

  private async anexar(...mensagens: Mensagem[]): Promise<void> {
    const conversa = this._conversa();
    if (!conversa || !mensagens.length) return;

    let ordem = conversa.proximaOrdem;
    const prontas = mensagens.map((m) => ({ ...m, conversaId: conversa.id, ordem: ordem++ }));

    this._conversa.set({
      ...conversa,
      mensagens: [...conversa.mensagens, ...prontas],
      proximaOrdem: ordem,
    });

    await firstValueFrom(this.store.anexarMensagens(prontas));
    await this.mutarMeta((c) => c);
  }

  /** Atualizações imutáveis: mutar o objeto no lugar não dispara os signals. */
  private async atualizarFerramenta(
    mensagemId: string,
    mudancas: Partial<MensagemFerramenta>,
  ): Promise<void> {
    const conversa = this._conversa();
    if (!conversa) return;

    let atualizada: MensagemFerramenta | null = null;
    const mensagens = conversa.mensagens.map((m) => {
      if (m.id !== mensagemId || !ehMensagemFerramenta(m)) return m;
      atualizada = { ...m, ...mudancas };
      return atualizada;
    });
    if (!atualizada) return;

    this._conversa.set({ ...conversa, mensagens });
    await firstValueFrom(this.store.atualizarMensagem(atualizada));
  }

  /** Buffer de streaming: grava no IndexedDB só ao final do turno. */
  private acumularTexto(
    mensagemId: string,
    delta: string,
    campo: 'texto' | 'raciocinio',
  ): void {
    const conversa = this._conversa();
    if (!conversa) return;

    const mensagens = conversa.mensagens.map((m) => {
      if (m.id !== mensagemId || m.tipo !== 'texto') return m;
      return campo === 'texto'
        ? { ...m, texto: m.texto + delta }
        : { ...m, raciocinio: (m.raciocinio ?? '') + delta };
    });
    this._conversa.set({ ...conversa, mensagens });
  }

  private async finalizarMensagemParcial(
    mensagemId: string,
    texto: string,
    raciocinio: string,
  ): Promise<void> {
    const conversa = this._conversa();
    if (!conversa) return;

    if (!texto && !raciocinio) {
      this._conversa.set({
        ...conversa,
        mensagens: conversa.mensagens.filter((m) => m.id !== mensagemId),
      });
      return;
    }

    let final: MensagemTexto | null = null;
    const mensagens = conversa.mensagens.map((m) => {
      if (m.id !== mensagemId || m.tipo !== 'texto') return m;
      final = { ...m, texto, ...(raciocinio ? { raciocinio } : {}) };
      return final;
    });
    if (!final) return;

    this._conversa.set({ ...conversa, mensagens });
    await firstValueFrom(this.store.atualizarMensagem(final));
  }

  private async removerMensagemVaziaOuFinalizar(mensagemId: string): Promise<void> {
    const conversa = this._conversa();
    if (!conversa) return;
    const m = conversa.mensagens.find((x) => x.id === mensagemId);
    if (m && m.tipo === 'texto' && !m.texto.trim()) {
      this._conversa.set({
        ...conversa,
        mensagens: conversa.mensagens.filter((x) => x.id !== mensagemId),
      });
    }
  }

  private async registrarUso(uso: UsoTurno): Promise<void> {
    const conversa = this._conversa();
    if (!conversa) return;

    const acumulado = conversa.uso ?? { ...USO_ZERADO };
    await this.mutarMeta((c) => ({
      ...c,
      uso: {
        prompt: acumulado.prompt + uso.prompt,
        resposta: acumulado.resposta + uso.resposta,
        raciocinio: acumulado.raciocinio + uso.raciocinio,
        total: acumulado.total + uso.total,
        ultimoPrompt: uso.prompt,
        requisicoes: acumulado.requisicoes + 1,
      },
    }));

    const dia = new Date().toISOString().slice(0, 10);
    await firstValueFrom(
      this.store.somarUsoDoDia(dia, {
        requisicoes: 1,
        tokensPrompt: uso.prompt,
        tokensResposta: uso.resposta,
        tokensRaciocinio: uso.raciocinio,
      }),
    );
  }

  private async mutarMeta(fn: (c: Conversa) => Conversa): Promise<void> {
    const conversa = this._conversa();
    if (!conversa) return;
    const atualizada = fn(conversa);
    this._conversa.set(atualizada);
    await firstValueFrom(this.store.salvarMeta(semMensagens(atualizada)));
  }

  private registrarErro(err: unknown): void {
    if (err instanceof ErroCotaIA) {
      this.detalheCota.set(err.detalhe);
      this.erro.set(
        'O limite de uso da chave do Gemini foi atingido. Veja os detalhes no painel de uso.',
      );
    } else {
      this.erro.set(err instanceof Error ? err.message : 'Falha ao falar com a IA.');
    }
    this.estado.set('erro');
    this.rotuloEstado.set('');
  }

  private detectouLaco(chamadas: { nome: string; args: Record<string, unknown> }[]): boolean {
    for (const c of chamadas) {
      const assinatura = assinaturaChamada(c.nome, c.args);
      this.assinaturasDoTurno.push(assinatura);
      const repeticoes = this.assinaturasDoTurno.filter((a) => a === assinatura).length;
      if (repeticoes >= MAX_CHAMADAS_REPETIDAS) return true;
    }
    return false;
  }

  private modeloPreferido(): string {
    return localStorage.getItem(CHAVE_MODELO_PADRAO) ?? MODELO_PADRAO;
  }

  private raciocinioPreferido(): NivelRaciocinio {
    const salvo = localStorage.getItem(CHAVE_RACIOCINIO_PADRAO);
    return salvo === 'equilibrado' || salvo === 'profundo' ? salvo : 'desligado';
  }
}

function semMensagens(conversa: Conversa): ConversaMeta {
  const { mensagens, ...meta } = conversa;
  void mensagens;
  return meta;
}
