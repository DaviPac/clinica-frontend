import { Injectable, inject, isDevMode } from '@angular/core';
import { Tool } from '@google/genai';
import { Observable, throwError } from 'rxjs';
import { Role } from '../../models/usuario.model';
import {
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
} from '../models/ferramenta-ia.model';
import { FerramentasAcao } from './acao.ferramentas';
import { FerramentasAgendamento } from './agendamento.ferramentas';
import { FerramentasFinanceiro } from './financeiro.ferramentas';
import { FerramentasPaciente } from './paciente.ferramentas';
import { FerramentasServico } from './servico.ferramentas';
import { FerramentasUsuario } from './usuario.ferramentas';

/**
 * A camada de ferramentas do assistente.
 *
 * As definições ficam em arquivos por domínio só para não virar um arquivo de
 * 900 linhas; a API pública é esta classe. Ela é o único ponto que decide o que
 * o modelo pode ver e o que ele pode executar.
 *
 * O papel do usuário é verificado duas vezes de propósito: ao declarar (o modelo
 * nem enxerga o que não pode chamar) e ao executar (um card antigo, uma sessão
 * que trocou de papel ou uma alucinação não passam). Isso é UX e defesa em
 * profundidade — a autorização de verdade continua sendo do backend.
 */
@Injectable({ providedIn: 'root' })
export class RegistroFerramentas {
  private readonly grupos: readonly FerramentaIA[][] = [
    inject(FerramentasAgendamento).ferramentas as FerramentaIA[],
    inject(FerramentasPaciente).ferramentas as FerramentaIA[],
    inject(FerramentasServico).ferramentas as FerramentaIA[],
    inject(FerramentasFinanceiro).ferramentas as FerramentaIA[],
    inject(FerramentasUsuario).ferramentas as FerramentaIA[],
    inject(FerramentasAcao).ferramentas as FerramentaIA[],
  ];

  private readonly todas: readonly FerramentaIA[] = this.grupos.flat();

  private readonly porNome = new Map<string, FerramentaIA>(
    this.todas.map((f) => [f.nome, f]),
  );

  constructor() {
    if (isDevMode()) this.validarRegistro();
  }

  paraPapel(papel: Role): FerramentaIA[] {
    return this.todas.filter((f) => f.papeis.includes(papel));
  }

  /** Declarações no formato do SDK, já filtradas pelo papel. */
  declaracoes(papel: Role): Tool[] {
    return [{ functionDeclarations: this.paraPapel(papel).map((f) => f.declaracao) }];
  }

  obter(nome: string): FerramentaIA | undefined {
    return this.porNome.get(nome);
  }

  permitido(nome: string, papel: Role): boolean {
    const ferramenta = this.porNome.get(nome);
    return !!ferramenta && ferramenta.papeis.includes(papel);
  }

  executar(
    nome: string,
    args: Record<string, unknown>,
    ctx: ContextoExecucao,
  ): Observable<ResultadoFerramenta> {
    const ferramenta = this.porNome.get(nome);
    if (!ferramenta) {
      return throwError(() => new Error(`Ferramenta desconhecida: ${nome}.`));
    }
    if (!ferramenta.papeis.includes(ctx.usuario.role)) {
      return throwError(() => new Error('Esta operação não está disponível para o seu perfil.'));
    }
    // O executor pode lançar de forma síncrona ao validar argumentos.
    try {
      return ferramenta.executar(args, ctx);
    } catch (err: unknown) {
      return throwError(() => err);
    }
  }

  /** Erros de registro devem aparecer no boot, não em produção. */
  private validarRegistro(): void {
    const vistos = new Set<string>();
    for (const f of this.todas) {
      if (vistos.has(f.nome)) {
        throw new Error(`[ia] ferramenta duplicada: ${f.nome}`);
      }
      vistos.add(f.nome);

      if (f.declaracao.name !== f.nome) {
        throw new Error(
          `[ia] ${f.nome}: declaracao.name é "${f.declaracao.name}" e deveria ser "${f.nome}"`,
        );
      }
      if (f.escopo === 'escrita' && !f.formulario) {
        throw new Error(`[ia] ${f.nome}: ferramenta de escrita precisa declarar um formulário`);
      }
      if (!f.papeis.length) {
        throw new Error(`[ia] ${f.nome}: nenhum papel declarado`);
      }
    }
  }
}
