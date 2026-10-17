import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { EMPTY, Observable, Subject, isObservable, of } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';
import type { MensagemService } from '../mensagem/mensagem.service';
import {
  CampoFormulario, CampoSelecao, ItemQualquer, Nota, OpcaoSelecao, Secao, resolver,
} from './campos';
import { ContextoFormulario, ErroFormulario, VarianteAviso } from './contexto';
import { DefinicaoFormulario, ResultadoFormulario } from './formulario.model';

type Valores = Record<string, any>;

/** O que o template precisa de cada campo, já resolvido para o estado atual. */
export interface VistaCampo {
  readonly tipo: 'campo';
  readonly campo: CampoFormulario;
  readonly id: string;
  readonly controle: FormControl<any>;
  readonly visivel: Signal<boolean>;
  readonly rotulo: Signal<string>;
  readonly ajuda: Signal<string>;
  readonly placeholder: Signal<string>;
  readonly obrigatorio: Signal<boolean>;
  readonly desabilitado: Signal<boolean>;
  /** Do alternador. */
  readonly descricao: Signal<string>;
  /** Do número e da data. */
  readonly minimo: Signal<number | string | undefined>;
  readonly maximo: Signal<number | string | undefined>;
  /** Da seleção. */
  readonly opcoes: Signal<readonly OpcaoSelecao<any>[]>;
}

export interface VistaNota {
  readonly tipo: 'nota';
  readonly item: Nota;
  readonly visivel: Signal<boolean>;
  readonly texto: Signal<string>;
}

export interface VistaSecao {
  readonly tipo: 'secao';
  readonly item: Secao;
  readonly visivel: Signal<boolean>;
  readonly titulo: Signal<string>;
}

export type Vista = VistaCampo | VistaNota | VistaSecao;

export interface ErroCampo {
  texto: string;
  tom: 'erro' | 'aviso';
}

/**
 * O motor do formulário: monta o FormGroup a partir dos campos, mantém as
 * opções dinâmicas em dia, roda os ganchos e conduz o envio.
 *
 * Não depende de componente — o `<app-formulario>` só o desenha. Tudo que
 * muda com o estado é signal, então o template se atualiza sozinho.
 */
export class EstadoFormulario<R = unknown> {
  readonly form: FormGroup<Record<string, FormControl<any>>>;
  readonly vistas: readonly Vista[];
  readonly ctx: ContextoFormulario;

  readonly processando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<{ texto: string; variante: VarianteAviso } | null>(null);
  readonly valido = signal(false);

  readonly enviado = new Subject<ResultadoFormulario<Valores, R>>();
  readonly valoresMudaram = new Subject<Valores>();
  readonly validadeMudou = new Subject<boolean>();
  readonly processandoMudou = new Subject<boolean>();

  private readonly valores: WritableSignal<Valores>;
  private readonly iniciais: Valores;
  private readonly camposPorChave = new Map<string, VistaCampo>();
  private readonly errosEnvio = signal<{ campos: Record<string, string>; tom: 'erro' | 'aviso' }>({ campos: {}, tom: 'erro' });
  private readonly opcoesCarregadas = new Map<string, WritableSignal<readonly OpcaoSelecao<any>[]>>();
  private readonly recargas = new Map<string, { chave: string; gatilho: Subject<void> }>();
  private readonly reacoes = new Map<string, Subject<Observable<unknown>>>();
  private readonly destruido = new Subject<void>();
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly def: DefinicaoFormulario<any, R>,
    private readonly mensagem: MensagemService | null,
    prefixoId: string,
  ) {
    const itens = def.campos as readonly ItemQualquer[];
    const campos = itens.filter((i): i is CampoFormulario => 'chave' in i);

    this.iniciais = Object.fromEntries(campos.map(c => [
      c.chave,
      def.valores?.[c.chave] !== undefined ? def.valores[c.chave]
        : c.valorInicial !== undefined ? c.valorInicial
        : c.valorVazio(),
    ]));
    this.valores = signal({ ...this.iniciais });
    this.ctx = this.criarContexto();

    this.vistas = itens.map(item => {
      const visivel = computed(() => resolver(item.visivel, this.ctx));
      if (item instanceof Nota) {
        return { tipo: 'nota', item, visivel, texto: computed(() => resolver(item.texto, this.ctx)) };
      }
      if (item instanceof Secao) {
        return { tipo: 'secao', item, visivel, titulo: computed(() => resolver(item.titulo, this.ctx)) };
      }
      return this.criarVistaCampo(item as CampoFormulario, visivel, `${prefixoId}-${(item as CampoFormulario).chave}`);
    });

    this.form = new FormGroup(
      Object.fromEntries([...this.camposPorChave].map(([k, v]) => [k, v.controle])),
      { validators: this.validadorDoFormulario() },
    );

    this.escolherPrimeiraOpcao(false);
    this.sincronizar();

    this.form.valueChanges.pipe(takeUntil(this.destruido)).subscribe(() => this.aposMudanca());
    this.iniciarCarregamentos();
    this.executarReacao('__iniciar', def.aoIniciar?.(this.ctx as any));
  }

  destruir() {
    clearTimeout(this.temporizadorAviso);
    this.destruido.next();
    this.destruido.complete();
  }

  /** Erro a mostrar embaixo do campo, se houver. */
  erroDe(vista: VistaCampo): ErroCampo | null {
    const envio = this.errosEnvio();
    const doEnvio = envio.campos[vista.campo.chave];
    if (doEnvio) return { texto: doEnvio, tom: envio.tom };

    const c = vista.controle;
    if (!(c.touched || c.dirty)) return null;

    if (c.errors) {
      const [chave, detalhe] = Object.entries(c.errors)[0];
      return { texto: vista.campo.mensagens[chave] ?? mensagemPadrao(chave, detalhe), tom: 'erro' };
    }

    const doFormulario = this.form.errors?.['formulario']?.[vista.campo.chave];
    return doFormulario ? { texto: doFormulario, tom: 'erro' } : null;
  }

  enviar() {
    if (this.processando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    this.erro.set(null);
    this.errosEnvio.set({ campos: {}, tom: 'erro' });

    const executar = (): Observable<R | undefined> => {
      this.definirProcessando(true);
      return this.def.aoConfirmar ? this.def.aoConfirmar(valor, this.ctx) : of(undefined);
    };

    let resposta: R | undefined;

    if (this.def.confirmacao && this.mensagem) {
      let falha: unknown = null;
      this.mensagem.confirmar({
        ...this.def.confirmacao(valor, this.ctx),
        // O diálogo de confirmação fecha também na falha: o erro é do formulário.
        aoConfirmar: () => executar().pipe(
          tap(r => resposta = r),
          catchError(e => { falha = e; return EMPTY; }),
        ),
      }).subscribe(ok => {
        if (!ok) return;
        if (falha) this.falhar(falha); else this.concluir(valor, resposta);
      });
      return;
    }

    executar().pipe(takeUntil(this.destruido)).subscribe({
      next: r => resposta = r,
      complete: () => this.concluir(valor, resposta),
      error: e => this.falhar(e),
    });
  }

  // ── Montagem ───────────────────────────────────────────────────────

  private criarVistaCampo(campo: CampoFormulario, visivel: Signal<boolean>, id: string): VistaCampo {
    const ctx = this.ctx;
    const opcoes = campo instanceof CampoSelecao
      ? this.sinalDeOpcoes(campo)
      : signal<readonly OpcaoSelecao<any>[]>([]).asReadonly();

    const vista: Omit<VistaCampo, 'controle'> & { controle?: FormControl<any> } = {
      tipo: 'campo',
      campo,
      id,
      visivel,
      rotulo: computed(() => resolver(campo.rotulo, ctx)),
      ajuda: computed(() => resolver(campo.ajuda, ctx)),
      placeholder: computed(() => resolver(campo.placeholder, ctx)),
      obrigatorio: computed(() => resolver(campo.obrigatorio, ctx)),
      desabilitado: computed(() => resolver(campo.desabilitado, ctx)),
      descricao: computed(() => campo.tipo === 'alternador' ? resolver(campo.descricao, ctx) : ''),
      minimo: computed(() => campo.tipo === 'numero' || campo.tipo === 'data' ? resolver<number | string | undefined>(campo.minimo, ctx) : undefined),
      maximo: computed(() => campo.tipo === 'numero' || campo.tipo === 'data' ? resolver<number | string | undefined>(campo.maximo, ctx) : undefined),
      opcoes,
    };

    // Os validadores leem os signals na hora de validar, então obrigatório,
    // mínimo e máximo dinâmicos valem sem recriar o controle.
    const final = vista as VistaCampo;
    const dinamicos: ValidatorFn = c => {
      if (final.obrigatorio()) {
        const erro = (campo.tipo === 'alternador' ? Validators.requiredTrue : Validators.required)(c);
        if (erro) return erro;
      }
      if (campo.tipo === 'numero') {
        const min = final.minimo() as number | undefined;
        const max = final.maximo() as number | undefined;
        return (min != null ? Validators.min(min)(c) : null) ?? (max != null ? Validators.max(max)(c) : null);
      }
      return null;
    };

    vista.controle = new FormControl<any>(this.iniciais[campo.chave], {
      validators: [dinamicos, ...campo.validadores()],
    });
    this.camposPorChave.set(campo.chave, final);
    return final;
  }

  private sinalDeOpcoes(campo: CampoSelecao<string, unknown>): Signal<readonly OpcaoSelecao<any>[]> {
    if (campo.carregarOpcoes) {
      const carregadas = signal<readonly OpcaoSelecao<any>[]>([]);
      this.opcoesCarregadas.set(campo.chave, carregadas);
      return carregadas.asReadonly();
    }
    return computed(() => resolver(campo.opcoes, this.ctx));
  }

  private validadorDoFormulario(): ValidatorFn {
    return (grupo: AbstractControl): ValidationErrors | null => {
      const erros = this.def.validar?.((grupo as FormGroup).getRawValue());
      return erros && Object.keys(erros).length ? { formulario: erros } : null;
    };
  }

  private criarContexto(): ContextoFormulario {
    const estado = this;
    return {
      get valores() { return estado.valores(); },
      get form() { return estado.form; },
      opcoes: chave => estado.camposPorChave.get(chave)?.opcoes() ?? [],
      opcao: chave => {
        const valor = estado.valores()[chave];
        return estado.ctx.opcoes(chave).find(o => Object.is(o.valor, valor));
      },
      definir: (chave, valor) => estado.form.controls[chave]?.setValue(valor),
      preencher: valores => estado.form.patchValue(valores),
      redefinir: valores => {
        estado.erro.set(null);
        estado.errosEnvio.set({ campos: {}, tom: 'erro' });
        estado.form.reset({ ...estado.iniciais, ...valores });
        estado.escolherPrimeiraOpcao(true);
      },
      avisar: (texto, variante = 'info', duracaoMs) => {
        clearTimeout(estado.temporizadorAviso);
        estado.aviso.set({ texto, variante });
        if (duracaoMs) estado.temporizadorAviso = setTimeout(() => estado.aviso.set(null), duracaoMs);
      },
    };
  }

  // ── Reações ────────────────────────────────────────────────────────

  private aposMudanca() {
    const anterior = this.valores();
    const atual = this.form.getRawValue();
    this.valores.set(atual);
    this.sincronizar();

    const mudaram = Object.keys(atual).filter(k => !Object.is(anterior[k], atual[k]));
    if (mudaram.length === 0) return;

    const envio = this.errosEnvio();
    if (mudaram.some(k => envio.campos[k])) {
      const campos = { ...envio.campos };
      mudaram.forEach(k => delete campos[k]);
      this.errosEnvio.set({ ...envio, campos });
    }

    this.dispararRecargas();
    this.valoresMudaram.next(atual);

    for (const chave of mudaram) {
      const campo = this.camposPorChave.get(chave)?.campo;
      this.executarReacao(chave, campo?.aoMudar?.(atual[chave] as never, this.ctx));
    }
  }

  /**
   * Aplica o que é derivado do estado: habilita/desabilita conforme
   * `visivel` e `desabilitado`, e revalida (obrigatório e limites podem ter
   * mudado). Sem emitir eventos, para não entrar em laço.
   */
  private sincronizar() {
    for (const vista of this.camposPorChave.values()) {
      const c = vista.controle;
      const ativo = vista.visivel() && !vista.desabilitado();
      if (ativo && c.disabled) c.enable({ emitEvent: false });
      else if (!ativo && c.enabled) c.disable({ emitEvent: false });
      else c.updateValueAndValidity({ emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });

    const valido = this.form.status === 'VALID' || this.form.status === 'DISABLED';
    if (valido !== this.valido()) {
      this.valido.set(valido);
      this.validadeMudou.next(valido);
    }
  }

  private executarReacao(chave: string, resultado: void | Observable<unknown> | undefined) {
    if (!isObservable(resultado)) return;
    let fila = this.reacoes.get(chave);
    if (!fila) {
      fila = new Subject<Observable<unknown>>();
      fila.pipe(
        switchMap(obs => obs.pipe(catchError(e => { this.erro.set(mensagemDe(e)); return EMPTY; }))),
        takeUntil(this.destruido),
      ).subscribe();
      this.reacoes.set(chave, fila);
    }
    fila.next(resultado);
  }

  private iniciarCarregamentos() {
    for (const vista of this.camposPorChave.values()) {
      const campo = vista.campo;
      if (!(campo instanceof CampoSelecao) || !campo.carregarOpcoes) continue;

      const gatilho = new Subject<void>();
      const carregadas = this.opcoesCarregadas.get(campo.chave)!;
      gatilho.pipe(
        switchMap(() => campo.carregarOpcoes!(this.ctx).pipe(
          catchError(e => { this.erro.set(mensagemDe(e)); return of([]); }),
        )),
        takeUntil(this.destruido),
      ).subscribe(opcoes => {
        carregadas.set(opcoes);
        this.escolherPrimeiraOpcao(true);
        this.sincronizar();
      });

      this.recargas.set(campo.chave, { chave: this.chaveDeRecarga(campo), gatilho });
      gatilho.next();
    }
  }

  private dispararRecargas() {
    for (const [chave, recarga] of this.recargas) {
      const campo = this.camposPorChave.get(chave)!.campo as CampoSelecao<string, unknown>;
      const nova = this.chaveDeRecarga(campo);
      if (nova !== recarga.chave) {
        recarga.chave = nova;
        recarga.gatilho.next();
      }
    }
  }

  private chaveDeRecarga(campo: CampoSelecao<string, unknown>) {
    const valores = this.valores();
    return JSON.stringify(campo.recarregarQuando.map(k => valores[k] ?? null));
  }

  /** Seleção sem placeholder e sem valor começa na primeira opção, como um <select> comum. */
  private escolherPrimeiraOpcao(emitir: boolean) {
    for (const vista of this.camposPorChave.values()) {
      if (vista.campo.tipo !== 'selecao' || vista.placeholder()) continue;
      const opcoes = vista.opcoes();
      if (vista.controle.value == null && opcoes.length) {
        vista.controle.setValue(opcoes[0].valor, { emitEvent: emitir });
        if (!emitir) {
          this.iniciais[vista.campo.chave] = opcoes[0].valor;
          this.valores.set(this.form.getRawValue());
        }
      }
    }
  }

  // ── Envio ──────────────────────────────────────────────────────────

  private definirProcessando(valor: boolean) {
    this.processando.set(valor);
    this.processandoMudou.next(valor);
  }

  private concluir(valor: Valores, resposta: R | undefined) {
    this.definirProcessando(false);
    this.enviado.next({ valor, resposta });
    this.def.aoConcluir?.(resposta, this.ctx);
  }

  private falhar(e: unknown) {
    this.definirProcessando(false);
    if (e instanceof ErroFormulario) {
      this.erro.set(e.message || null);
      this.errosEnvio.set({ campos: e.campos, tom: e.tom });
    } else {
      this.erro.set(mensagemDe(e));
    }
  }
}

function mensagemDe(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Não foi possível concluir a operação.';
}

function mensagemPadrao(chave: string, detalhe: any): string {
  switch (chave) {
    case 'required': return 'Campo obrigatório.';
    case 'requiredtrue': return 'Precisa estar marcado.';
    case 'email': return 'E-mail inválido.';
    case 'min': return `O mínimo é ${detalhe.min}.`;
    case 'max': return `O máximo é ${detalhe.max}.`;
    case 'minlength': return `Use pelo menos ${detalhe.requiredLength} caracteres.`;
    case 'maxlength': return `Use no máximo ${detalhe.requiredLength} caracteres.`;
    case 'pattern': return 'Formato inválido.';
    default: return 'Valor inválido.';
  }
}
