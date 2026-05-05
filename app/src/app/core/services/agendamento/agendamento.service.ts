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

  listar(opts: {
    periodo?: { de: string, ate: string };
    profissionalId?: number | string;
  }) {
    const params = new URLSearchParams();
    if (opts?.periodo) {
      params.set('de', opts.periodo.de);
      params.set('ate', opts.periodo.ate);
    }
    if (opts?.profissionalId) params.set("profissional_id", String(opts.profissionalId));
    else if (opts) params.set('todos', 'true');

    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos${qs ? '?' + qs : ''}`);
  }

  obterPorId(id: string | number) {
    return this.http.get<Agendamento | null>(`/agendamentos/${id}`)
  }

  listarPendentes(todos: boolean = false) {
    const params = new URLSearchParams();
    params.set('filtro', 'pendente');
    if (todos) params.set('todos', 'true'); 
    
    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos?${qs}`);
  }

  listarPagamentoPendente(todos: boolean = false) {
    const params = new URLSearchParams();
    params.set('filtro', 'pagamento_pendente');
    if (todos) params.set('todos', 'true'); 
    
    const qs = params.toString();
    return this.http.get<Agendamento[]>(`/agendamentos?${qs}`);
  }

  criar(dto: AgendamentoDto, profissionalID?: string) {
    const params = new URLSearchParams();
    if (profissionalID) params.set('profissional_id', profissionalID)
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

  atualizarValor(id: number, valor: number, recorrente: boolean = false) {
    const params = recorrente ? '?recorrente=true' : '';
    return this.http.patch<{ valor_combinado: number }>(
      `/agendamentos/${id}/valor-combinado${params}`, { valor_combinado: valor }
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