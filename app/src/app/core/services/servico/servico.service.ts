import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Servico } from '../../models/servico.model';

export interface ServicoBaseDto {
  nome: string;
  valor_atual: number;
  pacote: boolean;
}

export interface CriarServicoDto extends ServicoBaseDto {}

export interface AtualizarServicoDto extends ServicoBaseDto {
  ativo: boolean;    // só faz sentido na edição
}

@Injectable({ providedIn: 'root' })
export class ServicoService {
  constructor(private http: HttpClient) {}

  listar(opts: {
    profissionalId?: number | string;
    incluirInativos?: boolean;
  } = {}) {
    const params: Record<string, string> = {};
    if (opts.profissionalId) params['profissional_id'] = String(opts.profissionalId);
    else params['todos'] = 'true';
    if (opts.incluirInativos) params['inativos'] = 'true';

    return this.http.get<Servico[]>('/servicos', { params });
  }

  criar(dto: CriarServicoDto, opts: { profissionalId?: number | string } = {}) {
    const params: Record<string, string> = {};
    if (opts.profissionalId) params['profissional_id'] = String(opts.profissionalId);
    return this.http.post<Servico>('/servicos', dto, { params });
  }

  atualizar(id: number, dto: AtualizarServicoDto) {
    return this.http.put<Servico>(`/servicos/${id}`, dto);
  }

  // Soft delete — o serviço continua existindo, só fica inativo
  desativar(id: number) {
    return this.http.delete<void>(`/servicos/${id}`);
  }
}