import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Agendamento, StatusAgendamento } from '../../models/agendamento.model';

export interface AgendamentoDto {
  paciente_id: number;
  servico_id: number;
  data_hora_inicio: string; // RFC3339
  data_hora_fim: string;
  valor_combinado: number;
  recorrente: boolean;
  total_sessoes?: number;
  intervalo_semanas?: number;
}

export interface AgendamentoRecorrenteResponse {
  recorrencia_group_id: string;
  total_criados: number;
  agendamentos: Agendamento[];
}

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  constructor(private http: HttpClient) {}

  listar(de?: string, ate?: string) {
    const params = new URLSearchParams();
    if (de) params.set('de', de);
    if (ate) params.set('ate', ate);
    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos${qs ? '?' + qs : ''}`);
  }

  criar(dto: AgendamentoDto) {
    // Resposta pode ser Agendamento (único) ou AgendamentoRecorrenteResponse
    return this.http.post<Agendamento | AgendamentoRecorrenteResponse>(
      '/agendamentos', dto
    );
  }

  atualizarStatus(id: number, status: StatusAgendamento) {
    return this.http.patch<{ status: StatusAgendamento }>(
      `/agendamentos/${id}/status`, { status }
    );
  }

  atualizarPagamento(id: number, pago: boolean) {
    return this.http.patch<{ pago_pelo_paciente: boolean }>(
      `/agendamentos/${id}/pagamento`, { pago_pelo_paciente: pago }
    );
  }

  cancelarRecorrencia(groupId: string) {
    return this.http.delete<{ mensagem: string }>(
      `/agendamentos/recorrencia/${groupId}`
    );
  }
}