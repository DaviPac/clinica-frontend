import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Paciente } from '../../models/paciente.model';

export interface CriarPacienteDto {
  nome: string;
  cpf: string;
  telefone?: string;
  data_nascimento?: string;
}

@Injectable({ providedIn: 'root' })
export class PacienteService {
  constructor(private http: HttpClient) {}

  listar(mostrarTodos = false, mostrarInativos = false, profissionalId?: string) {
    const params = new URLSearchParams();
    if (mostrarTodos) params.set('todos', 'true');
    if (profissionalId) params.set('profissional_id', profissionalId)
    if (mostrarInativos) params.set("inativos", 'true')

    const qs = params.toString();
    return this.http.get<Paciente[]>(`/pacientes${qs ? '?' + qs : ''}`);
  }

  buscarPorId(id: number) {
    return this.http.get<Paciente>(`/pacientes/${id}`);
  }

  // Retorna a resposta completa para distinguir 200 (vinculação) de 201 (novo)
  criar(dto: CriarPacienteDto, profissionalId?: string) {
    const params = new URLSearchParams();
    if (profissionalId) params.set('profissional_id', profissionalId)
    const qs = params.toString();
    return this.http.post<Paciente>(`/pacientes${qs ? '?' + qs : ''}`, dto, { observe: 'response' });
  }

  inativar(pacienteId: string) {
    return this.http.delete<undefined>(`/pacientes/${pacienteId}`);
  }

  ativar(pacienteId: string) {
    return this.http.patch<undefined>(`/pacientes/${pacienteId}/ativar`, {});
  }
}