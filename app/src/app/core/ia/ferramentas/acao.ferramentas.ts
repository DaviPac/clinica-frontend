import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { Role } from '../../models/usuario.model';
import {
  AMBOS_PAPEIS,
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
  SO_ADMIN,
} from '../models/ferramenta-ia.model';
import { Args, enumObrig, num, str, strObrig } from './args.utils';
import { S } from './schema.utils';

interface Tela {
  rotulo: string;
  comandos: (id?: number) => (string | number)[];
  papeis: readonly Role[];
  exigeId?: boolean;
}

/**
 * Telas que a IA pode oferecer. É um enum fechado de propósito: o modelo escolhe
 * uma chave, nunca escreve uma URL. Isso impede tanto link inventado quanto um
 * link de /admin/* chegar às mãos de um profissional.
 */
const TELAS = {
  dashboard: {
    rotulo: 'Abrir o dashboard',
    comandos: () => ['/dashboard'],
    papeis: AMBOS_PAPEIS,
  },
  agendamentos: {
    rotulo: 'Ver agendamentos',
    comandos: () => ['/agendamentos'],
    papeis: AMBOS_PAPEIS,
  },
  agendamento_detalhe: {
    rotulo: 'Abrir o agendamento',
    comandos: (id?: number) => ['/agendamentos', id ?? 0],
    papeis: AMBOS_PAPEIS,
    exigeId: true,
  },
  pacientes: {
    rotulo: 'Ver pacientes',
    comandos: () => ['/pacientes'],
    papeis: AMBOS_PAPEIS,
  },
  paciente_detalhe: {
    rotulo: 'Abrir o paciente',
    comandos: (id?: number) => ['/pacientes', id ?? 0],
    papeis: AMBOS_PAPEIS,
    exigeId: true,
  },
  paciente_editar: {
    rotulo: 'Editar o paciente',
    comandos: (id?: number) => ['/pacientes', id ?? 0, 'editar'],
    papeis: AMBOS_PAPEIS,
    exigeId: true,
  },
  servicos: {
    rotulo: 'Ver serviços',
    comandos: () => ['/servicos'],
    papeis: AMBOS_PAPEIS,
  },
  financeiro: {
    rotulo: 'Abrir o financeiro',
    comandos: () => ['/financeiro'],
    papeis: AMBOS_PAPEIS,
  },
  perfil: {
    rotulo: 'Abrir meu perfil',
    comandos: () => ['/perfil'],
    papeis: AMBOS_PAPEIS,
  },
  admin_relatorio: {
    rotulo: 'Abrir o relatório financeiro',
    comandos: () => ['/admin/relatorio'],
    papeis: SO_ADMIN,
  },
  admin_relatorio_sessoes: {
    rotulo: 'Abrir o relatório por sessão',
    comandos: () => ['/admin/relatorio-sessoes'],
    papeis: SO_ADMIN,
  },
  admin_acertos: {
    rotulo: 'Abrir os acertos',
    comandos: () => ['/admin/acertos'],
    papeis: SO_ADMIN,
  },
  admin_despesas: {
    rotulo: 'Abrir as despesas',
    comandos: () => ['/admin/despesas'],
    papeis: SO_ADMIN,
  },
  admin_usuarios: {
    rotulo: 'Ver usuários',
    comandos: () => ['/admin/usuarios'],
    papeis: SO_ADMIN,
  },
  admin_usuario_detalhe: {
    rotulo: 'Abrir o usuário',
    comandos: (id?: number) => ['/admin/usuarios', id ?? 0],
    papeis: SO_ADMIN,
    exigeId: true,
  },
} satisfies Record<string, Tela>;

type ChaveTela = keyof typeof TELAS;
const CHAVES_TELA = Object.keys(TELAS) as ChaveTela[];

/**
 * Ferramentas cujo único efeito é exibir um card clicável. Executam sem
 * confirmação porque nada acontece até o usuário clicar — o clique é a
 * confirmação. A resposta devolvida ao modelo diz isso explicitamente, para ele
 * não afirmar que já navegou ou já baixou o arquivo.
 */
@Injectable({ providedIn: 'root' })
export class FerramentasAcao {
  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'abrir_tela',
      escopo: 'acao',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'abrir_tela',
        description:
          'Exibe no chat um botão que leva o usuário a uma tela do sistema. ' +
          'Não navega sozinho: o usuário precisa clicar. Use quando ele pedir para ' +
          'ser levado a algum lugar ou quando ver o registro na tela ajudar.',
        parameters: S.obj(
          {
            tela: S.opcoes('Tela de destino.', CHAVES_TELA),
            id: S.inteiro('ID do registro, para telas de detalhe.'),
            rotulo: S.txt('Texto do botão. Opcional.'),
          },
          ['tela'],
        ),
      },
      descreverAcao: (a) => `Oferecer atalho para ${str(a, 'tela') ?? 'uma tela'}`,
      executar: (args, ctx) => of(this.montarNavegacao(args, ctx)),
    },

    {
      nome: 'preparar_download_relatorio_sessoes',
      escopo: 'acao',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'preparar_download_relatorio_sessoes',
        description:
          'Exibe no chat um botão para baixar o PDF oficial do relatório por sessão. ' +
          'O download só acontece quando o usuário clica.',
        parameters: S.obj(
          {
            inicio: S.data('Início do intervalo.'),
            fim: S.data('Fim do intervalo.'),
            profissional_id: S.inteiro('Profissional do relatório.'),
          },
          ['inicio', 'fim'],
        ),
      },
      descreverAcao: (a) => `Oferecer PDF de ${str(a, 'inicio')} a ${str(a, 'fim')}`,
      executar: (args) => {
        const inicio = strObrig(args, 'inicio');
        const fim = strObrig(args, 'fim');
        const profissionalId = num(args, 'profissional_id');
        return of({
          paraModelo: { exibido: true, aguardando_clique_do_usuario: true },
          resumoUi: 'botão de download exibido',
          acao: {
            tipo: 'download' as const,
            rotulo: `Baixar PDF (${inicio} a ${fim})`,
            recurso: 'relatorio-sessoes-pdf' as const,
            params: { inicio, fim, ...(profissionalId ? { profissionalId } : {}) },
          },
        });
      },
    },
  ];

  private montarNavegacao(args: Args, ctx: ContextoExecucao): ResultadoFerramenta {
    const chave = enumObrig(args, 'tela', CHAVES_TELA);
    const tela: Tela = TELAS[chave];

    if (!tela.papeis.includes(ctx.usuario.role)) {
      throw new Error('Esta tela não está disponível para o seu perfil.');
    }

    const id = num(args, 'id');
    if (tela.exigeId && id === undefined) {
      throw new Error(`A tela "${chave}" precisa de um id.`);
    }

    return {
      paraModelo: { exibido: true, aguardando_clique_do_usuario: true, tela: chave },
      resumoUi: 'atalho exibido',
      acao: {
        tipo: 'navegar',
        rotulo: str(args, 'rotulo') ?? tela.rotulo,
        comandos: tela.comandos(id),
      },
    };
  }
}

export type TelaIA = ChaveTela;
