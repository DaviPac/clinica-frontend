export interface AcertoComissao {
  id: number;
  profissional_id: number;
  periodo_referencia: string;
  valor_pago_a_clinica: number;
  data_pagamento: string;
  confirmado_pelo_admin: boolean;
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

export interface SaldoDevedor {
  profissional_id: number;
  periodo: string;
  saldo_devido: number;
}