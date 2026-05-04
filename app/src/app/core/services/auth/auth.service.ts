import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { Usuario, LoginRequest, LoginResponse, MudarSenhaRequest } from '../../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'usuario';

  private _usuario = signal<Usuario | null>(this.loadUsuario());

  readonly usuario = this._usuario.asReadonly();
  readonly isLoggedIn = computed(() => !!this._usuario());
  readonly isAdmin = computed(() => this._usuario()?.role === 'ADMIN');
  readonly isProfissional = computed(() => this._usuario()?.role === 'PROFISSIONAL');

  constructor(private http: HttpClient, private router: Router) {}

  login(body: LoginRequest) {
    return this.http.post<LoginResponse>('/auth/login', body).pipe(
      tap(({ token, usuario }) => {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
        this._usuario.set(usuario);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private loadUsuario(): Usuario | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  mudarSenha(dto: MudarSenhaRequest) {
    return this.http.post('/auth/me/senha', dto);
  }
}