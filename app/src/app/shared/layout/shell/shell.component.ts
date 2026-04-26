import { Component, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string; // SVG path data
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLinkActive],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  sidebarAberta = signal(true);

  constructor(readonly auth: AuthService) {}

  get usuario() { return this.auth.usuario(); }
  get isAdmin()  { return this.auth.isAdmin(); }

  get iniciais(): string {
    const nome = this.usuario?.nome ?? '';
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  // Itens disponíveis para qualquer usuário autenticado
  readonly navPrincipal: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z',
    },
    {
      label: 'Agendamentos',
      path: '/agendamentos',
      icon: 'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm4 4h6M7 12h4',
    },
    {
      label: 'Pacientes',
      path: '/pacientes',
      icon: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z',
    },
    {
      label: 'Serviços',
      path: '/servicos',
      icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
    },
    {
      label: 'Financeiro',
      path: '/financeiro',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-4H9l3-3 3 3h-2v4zm0-8h-2V7h2v2z',
    },
  ];

  // Itens exclusivos de admin
  readonly navAdmin: NavItem[] = [
    {
      label: 'Relatório',
      path: '/admin/relatorio',
      icon: 'M3 12l4-4 4 4 4-8M3 20h18',
    },
    {
      label: 'Acertos',
      path: '/admin/acertos',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    },
    {
      label: 'Despesas',
      path: '/admin/despesas',
      icon: 'M4 6h16M4 10h10M4 14h6',
    },
    {
      label: 'Usuários',
      path: '/admin/usuarios',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    },
  ];

  // Fecha sidebar em telas pequenas ao navegar
  onNavClick() {
    if (window.innerWidth < 768) {
      this.sidebarAberta.set(false);
    }
  }

  logout() { this.auth.logout(); }
}