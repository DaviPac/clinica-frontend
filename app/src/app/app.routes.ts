import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard-guard';
import { roleGuard } from './core/guards/role.guard-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'profissional',
    canActivate: [authGuard],
    children: [
      /*{
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      // Pacientes, Agendamentos, Serviços, Financeiro virão aqui*/
      {
        path: 'pacientes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/pacientes/pacientes-lista/pacientes-lista.component')
                .then(m => m.PacientesListaComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/pacientes/paciente-detalhe/paciente-detalhe.component')
                .then(m => m.PacienteDetalheComponent),
          },
        ],
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
        path: 'financeiro',
        loadComponent: () =>
          import('./features/financeiro/financeiro-profissional/financeiro-profissional.component')
            .then(m => m.FinanceiroProfissionalComponent),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      /*{
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      // Relatório, Despesas, Usuários virão aqui*/
      {
        path: 'pacientes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/pacientes/pacientes-lista/pacientes-lista.component')
                .then(m => m.PacientesListaComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/pacientes/paciente-detalhe/paciente-detalhe.component')
                .then(m => m.PacienteDetalheComponent),
          },
        ],
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
        path: 'financeiro',
        loadComponent: () =>
          import('./features/financeiro/financeiro-profissional/financeiro-profissional.component')
            .then(m => m.FinanceiroProfissionalComponent),
      },
      {
        path: 'acertos',
        loadComponent: () =>
          import('./features/admin/admin-acertos/admin-acertos.component')
            .then(m => m.AdminAcertosComponent),
      },
      {
        path: 'despesas',
        loadComponent: () =>
          import('./features/admin/admin-despesas/admin-despesas.component')
            .then(m => m.AdminDespesasComponent),
      },
      {
        path: 'relatorio',
        loadComponent: () =>
          import('./features/admin/admin-relatorio/admin-relatorio.component')
            .then(m => m.AdminRelatorioComponent),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/admin/admin-usuarios/admin-usuarios.component')
            .then(m => m.AdminUsuariosComponent),
      },
    ],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];