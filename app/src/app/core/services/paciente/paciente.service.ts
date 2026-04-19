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

  listar() {
    return this.http.get<Paciente[]>('/pacientes');
  }

  buscarPorId(id: number) {
    return this.http.get<Paciente>(`/pacientes/${id}`);
  }

  // Retorna a resposta completa para distinguir 200 (vinculação) de 201 (novo)
  criar(dto: CriarPacienteDto) {
    return this.http.post<Paciente>('/pacientes', dto, { observe: 'response' });
  }
}