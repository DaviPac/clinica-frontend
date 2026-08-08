import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AcertoComissao, DespesaClinica, SaldoAReceber
} from '../../models/financeiro.model';

export interface AcertoDto {
  profissionalId: number;
  periodoReferencia: string;
  valorPago: number;
  observacao?: string;
  profissionalRecebe?: boolean;
}

export interface RelatorioFinanceiro {
  periodo: string;
  profissionais: {
    profissionalId: number;
    nomeProfissional: string;
    totalFaturado: number;
    comissaoClinica: number;
    devidoAoProfissional: number;
    devidoAClinica: number;
    repassadoAoProfissional: number;
    repassadoAClinica: number;
    pendenteAoProfissional: number;
    pendenteAClinica: number;
  }[];
  totalComissoes: number;
  totalDespesas: number;
  lucroLiquido: number;
}

export interface SessaoRelatorio {
  agendamentoId: number;
  dataHoraInicio: string;
  nomePaciente: string;
  nomeServico: string;
  status: 'AGENDADO' | 'REALIZADO' | 'FALTA' | 'CANCELADO';
  pagoPeloPaciente: boolean;
  profissionalRecebe: boolean;
  valorSessao: number;
  percentualComissao: number;
  parteClinica: number;
  parteProfissional: number;
  recebidoPelaClinica: number;
  recebidoPeloProfissional: number;
  devidoAoProfissional: number;
  devidoAClinica: number;
}

export interface RelatorioSessoes {
  profissionalId: number;
  nomeProfissional: string;
  inicio: string;
  fim: string;
  sessoes: SessaoRelatorio[];
  totais: {
    quantidadeSessoes: number;
    valorTotal: number;
    recebidoPelaClinica: number;
    recebidoPeloProfissional: number;
    devidoAoProfissional: number;
    devidoAClinica: number;
  };
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

  getRelatorioSessoes(inicio: string, fim: string, profissionalId?: number) {
    const params = new URLSearchParams({ inicio, fim });
    if (profissionalId) params.set('profissional_id', String(profissionalId));
    return this.http.get<RelatorioSessoes>(`/financeiro/relatorio-sessoes?${params}`);
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