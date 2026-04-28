export interface AcertoComissao {
  id: number;
  profissional_id: number;
  periodo_referencia: string;
  valor_pago: number;
  data_pagamento: string;
  observacao: string | null;
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