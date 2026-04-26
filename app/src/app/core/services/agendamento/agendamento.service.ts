import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Agendamento, StatusAgendamento } from '../../models/agendamento.model';

export interface AgendamentoDto {
  paciente_id: number;
  servico_id: number;
  data_hora_inicio: string; // RFC3339
  duracao_minutos: number;
  valor_combinado: number;
  recorrente: boolean;
  total_sessoes?: number;
  intervalo_semanas?: number;
  pacote: boolean;
}

export interface AgendamentoRecorrenteResponse {
  recorrencia_group_id: string;
  total_criados: number;
  agendamentos: Agendamento[];
}

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  constructor(private http: HttpClient) {}

  listar(de?: string, ate?: string, todos: boolean = false) {
    const params = new URLSearchParams();
    if (de) params.set('de', de);
    if (ate) params.set('ate', ate);
    if (todos) params.set('todos', 'true'); 

    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos${qs ? '?' + qs : ''}`);
  }

  listarPendentes() {
    const params = new URLSearchParams();
    params.set('filtro', 'pendente');
    
    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos?${qs}`);
  }

  listarPagamentoPendente() {
    const params = new URLSearchParams();
    params.set('filtro', 'pagamento_pendente');
    
    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos?${qs}`);
  }

  criar(dto: AgendamentoDto, profissionalID?: string) {
    const params = new URLSearchParams();
    if (profissionalID) params.set('userID', profissionalID)
    const qs = params.toString();
    // Resposta pode ser Agendamento (único) ou AgendamentoRecorrenteResponse
    return this.http.post<Agendamento | AgendamentoRecorrenteResponse>(
      `/agendamentos${qs ? '?' + qs : ''}`, dto
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