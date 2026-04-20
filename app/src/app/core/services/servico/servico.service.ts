import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Servico } from '../../models/servico.model';

export interface ServicoDto {
  nome: string;
  valor_atual: number;
  ativo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServicoService {
  constructor(private http: HttpClient) {}

  listar(incluirInativos = false, mostrarTodos = true) {
    const params = new URLSearchParams();
    if (incluirInativos) params.set('inativos', 'true');
    if (mostrarTodos) params.set('todos', 'true');
    
    const qs = params.toString();
    return this.http.get<Servico[]>(`/servicos${qs ? '?' + qs : ''}`);
  }

  criar(dto: ServicoDto) {
    return this.http.post<Servico>('/servicos', dto);
  }

  atualizar(id: number, dto: ServicoDto) {
    return this.http.put<Servico>(`/servicos/${id}`, dto);
  }

  // Soft delete — o serviço continua existindo, só fica inativo
  desativar(id: number) {
    return this.http.delete<void>(`/servicos/${id}`);
  }
}