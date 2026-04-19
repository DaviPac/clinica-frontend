import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Usuario } from '../../models/usuario.model';

export interface RegistrarUsuarioDto {
  nome: string;
  email: string;
  senha: string;
  role: 'ADMIN' | 'PROFISSIONAL';
  profissao?: string;
  taxa_comissao_padrao?: number;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  constructor(private http: HttpClient) {}

  listar() {
    return this.http.get<Usuario[]>('/usuarios');
  }

  registrar(dto: RegistrarUsuarioDto) {
    return this.http.post<Usuario>('/auth/registrar', dto);
  }
}