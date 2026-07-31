export interface AcertoComissao {
  id: number;
  profissionalId: number;
  periodoReferencia: string;
  valorPago: number;
  dataPagamento: string;
  observacao: string | null;
  profissionalRecebe: boolean;
}

export interface DespesaClinica {
  id: number;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status_pagamento: boolean;
  categoria: 'FIXA' | 'VARIAVEL';
  criado_em: string;
}

export interface SaldoAReceber {
  profissional_id: number;
  periodo: string;
  saldo_a_receber: number;
}