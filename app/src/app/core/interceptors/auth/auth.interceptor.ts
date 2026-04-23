import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';

const BASE_URL = 'http://localhost:8080';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  // Adiciona base URL e Content-Type em todas as requisições
  const apiReq = req.clone({
    url: `${BASE_URL}${req.url}`,
    setHeaders: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(apiReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout(); // limpa tudo e redireciona para /login
      }
      // Extrai a mensagem de erro da API no formato { error: "..." }
      const message = err.error?.error ?? 'Erro inesperado. Tente novamente.';
      return throwError(() => new Error(message));
    })
  );
};