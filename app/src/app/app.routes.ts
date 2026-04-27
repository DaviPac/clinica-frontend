import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard-guard';
import { roleGuard } from './core/guards/role.guard-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent),
  },
  {
    // Shell principal — qualquer usuário autenticado
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/shell/shell.component')
        .then(m => m.ShellComponent),
    children: [
      // ── Features compartilhadas (profissional + admin) ──
      {
        path: 'pacientes',
        loadComponent: () =>
          import('./features/pacientes/pacientes-lista/pacientes-lista.component')
            .then(m => m.PacientesListaComponent),
      },
      {
        path: 'pacientes/:id',
        loadComponent: () =>
          import('./features/pacientes/paciente-detalhe/paciente-detalhe.component')
            .then(m => m.PacienteDetalheComponent),
      },
      {
        path: 'servicos',
        loadComponent: () =>
          import('./features/servicos/servicos-lista/servicos-lista.component')
            .then(m => m.ServicosListaComponent),
      },
      {
        path: 'agendamentos',
        loadComponent: () =>
          import('./features/agendamentos/agendamentos-lista/agendamentos-lista.component')
            .then(m => m.AgendamentosListaComponent),
      },
      {
        path: 'agendamentos/:id',
        loadComponent: () =>
          import('./features/agendamentos/agendamento-detalhes/agendamento-detalhes.component')
            .then(m => m.AgendamentoDetalhesComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component')
            .then(m => m.DashboardComponent),
      },
      {
        path: 'financeiro',
        loadComponent: () =>
          import('./features/financeiro/financeiro-profissional/financeiro-profissional.component')
            .then(m => m.FinanceiroProfissionalComponent),
      },

      // ── Features exclusivas de admin ──
      {
        path: 'admin/acertos',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/admin/admin-acertos/admin-acertos.component')
            .then(m => m.AdminAcertosComponent),
      },
      {
        path: 'admin/despesas',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/admin/admin-despesas/admin-despesas.component')
            .then(m => m.AdminDespesasComponent),
      },
      {
        path: 'admin/relatorio',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/admin/admin-relatorio/admin-relatorio.component')
            .then(m => m.AdminRelatorioComponent),
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/admin/admin-usuarios/admin-usuarios.component')
            .then(m => m.AdminUsuariosComponent),
      },

      // Redirect padrão
      { path: '', redirectTo: 'agendamentos', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '/login' },
];