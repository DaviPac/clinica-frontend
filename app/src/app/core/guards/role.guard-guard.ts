import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { Role } from '../models/usuario.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles: Role[] = route.data['roles'];
  const userRole = auth.usuario()?.role;

  if (userRole && allowedRoles.includes(userRole)) return true;

  // Redireciona para o dashboard correto em vez de 403
  return router.createUrlTree([
    auth.isAdmin() ? '/admin/dashboard' : '/profissional/dashboard'
  ]);
};