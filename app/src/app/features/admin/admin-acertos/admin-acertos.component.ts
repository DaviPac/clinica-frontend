import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceiroService } from '../../../core/services/financeiro/financeiro.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { AcertoComissao } from '../../../core/models/finenceiro.model';
import { Usuario } from '../../../core/models/usuario.model';

interface AcertoEnriquecido extends AcertoComissao {
  nome_profissional: string;
}

@Component({
  selector: 'app-admin-acertos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-acertos.component.html',
})
export class AdminAcertosComponent implements OnInit {
  private todosAcertos = signal<AcertoEnriquecido[]>([]);
  private usuarios = signal<Usuario[]>([]);

  mostrarConfirmados = signal(false);
  confirmando = signal<number | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  acertos = computed(() => {
    const lista = this.todosAcertos();
    return this.mostrarConfirmados()
      ? lista
      : lista.filter(a => !a.confirmado_pelo_admin);
  });

  totalPendente = computed(() =>
    this.todosAcertos()
      .filter(a => !a.confirmado_pelo_admin)
      .reduce((s, a) => s + a.valor_pago_a_clinica, 0)
  );

  constructor(
    private financeiroService: FinanceiroService,
    private usuarioService: UsuarioService,
  ) {}

  ngOnInit() {
    // Carrega usuários e acertos em paralelo
    this.usuarioService.listar().subscribe(u => this.usuarios.set(u));

    this.financeiroService.getAcertos().subscribe({
      next: lista => {
        const enriquecidos = lista
          .map(a => ({
            ...a,
            nome_profissional: this.nomeDoUsuario(a.profissional_id),
          }))
          .sort((a, b) =>
            // Pendentes primeiro, depois por data decrescente
            Number(a.confirmado_pelo_admin) - Number(b.confirmado_pelo_admin) ||
            new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime()
          );
        this.todosAcertos.set(enriquecidos);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  confirmar(acerto: AcertoEnriquecido) {
    this.confirmando.set(acerto.id);
    this.financeiroService.confirmarAcerto(acerto.id).subscribe({
      next: () => {
        this.todosAcertos.update(lista =>
          lista.map(a =>
            a.id === acerto.id ? { ...a, confirmado_pelo_admin: true } : a
          )
        );
        this.confirmando.set(null);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.confirmando.set(null);
      },
    });
  }

  private nomeDoUsuario(id: number): string {
    return this.usuarios().find(u => u.id === id)?.nome ?? `Profissional #${id}`;
  }

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  formatarMes(yyyyMM: string): string {
    const [ano, mes] = yyyyMM.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+mes - 1]} ${ano}`;
  }
}