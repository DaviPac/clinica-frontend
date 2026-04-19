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

  listar(incluirInativos = false) {
    const params = incluirInativos ? '?inativos=true' : '';
    return this.http.get<Servico[]>(`/servicos${params}`);
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