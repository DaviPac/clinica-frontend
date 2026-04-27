import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AcertoComissao, DespesaClinica, SaldoAReceber
} from '../../models/finenceiro.model';

export interface AcertoDto {
  profissional_id: number;
  periodo_referencia: string;
  valor_pago: number;
  observacao?: string;
}

export interface RelatorioFinanceiro {
  periodo: string;
  profissionais: {
    profissional_id: number;
    nome_profissional: string;
    total_recebido: number;
    comissao_clinica: number;
    a_receber: number;
    total_repassado: number;
    pendente: number;
  }[];
  total_comissoes: number;
  total_despesas: number;
  lucro_liquido: number;
}

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  constructor(private http: HttpClient) {}

  // Profissional
  getSaldoAReceber(periodo?: string, profissionalId?: number) {
    const params = new URLSearchParams();
    if (periodo) params.set('periodo', periodo);
    if (profissionalId) params.set('profissional_id', String(profissionalId));
    const qs = params.toString();
    return this.http.get<SaldoAReceber>(`/financeiro/saldo-a-receber${qs ? '?' + qs : ''}`);
  }

  getAcertos(profissionalId?: number) {
    const qs = profissionalId ? `?profissional_id=${profissionalId}` : '';
    return this.http.get<AcertoComissao[]>(`/financeiro/acertos${qs}`);
  }

  // Admin
  criarAcerto(dto: AcertoDto) {
    return this.http.post<AcertoComissao>('/financeiro/acertos', dto);
  }

  getRelatorio(periodo?: string) {
    const qs = periodo ? `?periodo=${periodo}` : '';
    return this.http.get<RelatorioFinanceiro>(`/financeiro/relatorio${qs}`);
  }

  getDespesas(emAberto?: boolean) {
    const qs = emAberto ? '?em_aberto=true' : '';
    return this.http.get<DespesaClinica[]>(`/financeiro/despesas${qs}`);
  }

  criarDespesa(dto: Omit<DespesaClinica, 'id' | 'status_pagamento' | 'criado_em'>) {
    return this.http.post<DespesaClinica>('/financeiro/despesas', dto);
  }

  pagarDespesa(id: number) {
    return this.http.patch<{ pago: boolean }>(
      `/financeiro/despesas/${id}/pagar`, {}
    );
  }
}