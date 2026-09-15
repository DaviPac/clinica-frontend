import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { AcertoDto, FinanceiroService } from '../../services/financeiro/financeiro.service';
import { DespesaClinica } from '../../models/financeiro.model';
import { formatarMoeda } from '../../utils/data.utils';
import {
  AMBOS_PAPEIS,
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
  SO_ADMIN,
} from '../models/ferramenta-ia.model';
import { Args, bool, enumObrig, num, numObrig, str, strObrig } from './args.utils';
import { S, resumirParaModelo, resumirQuantidade } from './schema.utils';

const CATEGORIAS = ['FIXA', 'VARIAVEL'] as const;

@Injectable({ providedIn: 'root' })
export class FerramentasFinanceiro {
  private readonly financeiro = inject(FinanceiroService);

  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'consultar_saldo_a_receber',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'consultar_saldo_a_receber',
        description:
          'Saldo a receber de um profissional num período. O sinal indica a direção: ' +
          'positivo é a clínica devendo ao profissional.',
        parameters: S.obj({
          periodo: S.mes('Período de referência. Padrão: mês atual.'),
          profissional_id: S.inteiro('Profissional consultado. Apenas administradores.'),
        }),
      },
      descreverAcao: (a) => `Consultar saldo a receber de ${str(a, 'periodo') ?? 'este mês'}`,
      executar: (args, ctx) =>
        this.financeiro
          .getSaldoAReceber(str(args, 'periodo'), this.profissionalAlvo(args, ctx))
          .pipe(
            map((s) => ({
              paraModelo: resumirParaModelo(s),
              resumoUi: formatarMoeda(s.saldo_a_receber),
            })),
          ),
    },

    {
      nome: 'listar_acertos',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_acertos',
        description: 'Lista os acertos de comissão já registrados.',
        parameters: S.obj({
          profissional_id: S.inteiro('Filtra por profissional. Apenas administradores.'),
        }),
      },
      descreverAcao: () => 'Consultar acertos de comissão',
      executar: (args, ctx) =>
        this.financeiro
          .getAcertos(this.profissionalAlvo(args, ctx))
          .pipe(map((r) => leitura(r, 'acerto', 'acertos'))),
    },

    {
      nome: 'listar_despesas',
      escopo: 'leitura',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'listar_despesas',
        description: 'Lista as despesas da clínica.',
        parameters: S.obj({
          em_aberto: S.booleano('Apenas despesas ainda não pagas. Padrão false.'),
        }),
      },
      descreverAcao: (a) =>
        bool(a, 'em_aberto') ? 'Consultar despesas em aberto' : 'Consultar despesas',
      executar: (args) =>
        this.financeiro
          .getDespesas(bool(args, 'em_aberto'))
          .pipe(map((r) => leitura(r, 'despesa', 'despesas'))),
    },

    {
      nome: 'obter_relatorio_financeiro',
      escopo: 'leitura',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'obter_relatorio_financeiro',
        description:
          'Relatório financeiro consolidado do mês: faturamento, comissões, ' +
          'despesas e lucro líquido, com quebra por profissional.',
        parameters: S.obj({ periodo: S.mes('Período. Padrão: mês atual.') }),
      },
      descreverAcao: (a) => `Consultar relatório financeiro de ${str(a, 'periodo') ?? 'este mês'}`,
      executar: (args) =>
        this.financeiro.getRelatorio(str(args, 'periodo')).pipe(
          map((r) => ({
            paraModelo: resumirParaModelo(r),
            resumoUi: `lucro ${formatarMoeda(r.lucroLiquido)}`,
          })),
        ),
    },

    {
      nome: 'obter_relatorio_sessoes',
      escopo: 'leitura',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'obter_relatorio_sessoes',
        description:
          'Relatório sessão a sessão de um profissional num intervalo, com valores ' +
          'devidos e recebidos por sessão.',
        parameters: S.obj(
          {
            inicio: S.data('Início do intervalo.'),
            fim: S.data('Fim do intervalo.'),
            profissional_id: S.inteiro('Profissional consultado.'),
          },
          ['inicio', 'fim'],
        ),
      },
      descreverAcao: (a) =>
        `Consultar relatório de sessões de ${str(a, 'inicio')} a ${str(a, 'fim')}`,
      executar: (args) =>
        this.financeiro
          .getRelatorioSessoes(
            strObrig(args, 'inicio'),
            strObrig(args, 'fim'),
            num(args, 'profissional_id'),
          )
          .pipe(
            map((r) => ({
              paraModelo: resumirParaModelo(r),
              resumoUi: `${r.totais?.quantidadeSessoes ?? 0} sessões`,
            })),
          ),
    },

    {
      nome: 'criar_despesa',
      escopo: 'escrita',
      papeis: SO_ADMIN,
      formulario: 'despesa',
      declaracao: {
        name: 'criar_despesa',
        description: 'Registra uma despesa da clínica.',
        parameters: S.obj(
          {
            descricao: S.txt('Descrição da despesa.'),
            valor: S.numero('Valor em reais, mínimo 0,01.'),
            data_vencimento: S.data('Data de vencimento.'),
            categoria: S.opcoes('FIXA para recorrentes, VARIAVEL para eventuais.', CATEGORIAS),
          },
          ['descricao', 'valor', 'data_vencimento', 'categoria'],
        ),
      },
      descreverAcao: (a) => `Registrar despesa "${str(a, 'descricao') ?? ''}"`,
      executar: (args) => {
        const dto: Omit<DespesaClinica, 'id' | 'status_pagamento' | 'criado_em'> = {
          descricao: strObrig(args, 'descricao'),
          valor: numObrig(args, 'valor'),
          data_vencimento: strObrig(args, 'data_vencimento'),
          categoria: enumObrig(args, 'categoria', CATEGORIAS),
        };
        return this.financeiro.criarDespesa(dto).pipe(map((d) => escrita(d, 'despesa criada')));
      },
    },

    {
      nome: 'pagar_despesa',
      escopo: 'escrita',
      papeis: SO_ADMIN,
      formulario: 'despesa-pagar',
      declaracao: {
        name: 'pagar_despesa',
        description: 'Marca uma despesa como paga.',
        parameters: S.obj({ despesa_id: S.inteiro('ID da despesa.') }, ['despesa_id']),
      },
      descreverAcao: (a) => `Marcar despesa #${num(a, 'despesa_id')} como paga`,
      executar: (args) =>
        this.financeiro
          .pagarDespesa(numObrig(args, 'despesa_id'))
          .pipe(map((r) => escrita(r, 'despesa paga'))),
    },

    {
      nome: 'criar_acerto',
      escopo: 'escrita',
      papeis: SO_ADMIN,
      formulario: 'acerto',
      declaracao: {
        name: 'criar_acerto',
        description:
          'Registra um acerto de comissão com um profissional. ' +
          'profissional_recebe = true quando a clínica paga o profissional; ' +
          'false quando o profissional repassa à clínica.',
        parameters: S.obj(
          {
            profissional_id: S.inteiro('ID do profissional.'),
            periodo_referencia: S.mes('Período de referência do acerto.'),
            valor_pago: S.numero('Valor em reais, mínimo 0,01.'),
            profissional_recebe: S.booleano('Direção do repasse. Padrão true.'),
            observacao: S.txt('Observação livre.'),
          },
          ['profissional_id', 'periodo_referencia', 'valor_pago'],
        ),
      },
      descreverAcao: (a) =>
        `Registrar acerto de ${formatarMoeda(num(a, 'valor_pago'))} com o profissional #${num(a, 'profissional_id')}`,
      executar: (args) => {
        const dto: AcertoDto = {
          profissionalId: numObrig(args, 'profissional_id'),
          periodoReferencia: strObrig(args, 'periodo_referencia'),
          valorPago: numObrig(args, 'valor_pago'),
          profissionalRecebe: bool(args, 'profissional_recebe', true),
          ...(str(args, 'observacao') ? { observacao: strObrig(args, 'observacao') } : {}),
        };
        return this.financeiro.criarAcerto(dto).pipe(map((a) => escrita(a, 'acerto registrado')));
      },
    },
  ];

  private profissionalAlvo(args: Args, ctx: ContextoExecucao): number | undefined {
    if (!ctx.isAdmin) return ctx.usuario.id;
    return num(args, 'profissional_id');
  }
}

function leitura(dados: unknown, singular: string, plural: string): ResultadoFerramenta {
  return {
    paraModelo: resumirParaModelo(dados),
    resumoUi: resumirQuantidade(dados, singular, plural),
  };
}

function escrita(dados: unknown, resumo: string): ResultadoFerramenta {
  return { paraModelo: resumirParaModelo(dados), resumoUi: resumo };
}
