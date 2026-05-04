import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ServicoService } from '../../../core/services/servico/servico.service';
import { Servico } from '../../../core/models/servico.model';
import { ServicosModalComponent } from '../servicos-modal/servicos-modal.component';

@Component({
  selector: 'app-servicos-lista',
  standalone: true,
  imports: [CommonModule, ServicosModalComponent, ToggleComponent],
  templateUrl: './servicos-lista.component.html',
})
export class ServicosListaComponent implements OnInit {
  private todos = signal<Servico[]>([]);

  exibirInativos = signal(false);
  carregando = signal(true);
  erro = signal<string | null>(null);

  // Serviço sendo editado — null significa modo criação
  servicoEmEdicao = signal<Servico | null>(null);
  modalAberto = signal(false);

  // Serviço aguardando confirmação de desativação
  servicoParaDesativar = signal<Servico | null>(null);
  desativando = signal(false);

  servicos = computed(() => {
    const lista = this.todos();
    return this.exibirInativos() ? lista : lista.filter(s => s.ativo);
  });

  totalAtivos = computed(() => this.todos().filter(s => s.ativo).length);

  constructor(private service: ServicoService) {}

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);

    // Sempre busca todos (ativos + inativos) — o filtro é local via computed()
    this.service.listar(true).subscribe({
      next: lista => {
        this.todos.set(lista);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  abrirCriacao() {
    this.servicoEmEdicao.set(null);
    this.modalAberto.set(true);
  }

  abrirEdicao(servico: Servico) {
    this.servicoEmEdicao.set(servico);
    this.modalAberto.set(true);
  }

  fecharModal() {
    this.modalAberto.set(false);
    this.servicoEmEdicao.set(null);
  }

  onSalvo() {
    this.fecharModal();
    this.carregar();
  }

  confirmarDesativacao(servico: Servico) {
    this.servicoParaDesativar.set(servico);
  }

  cancelarDesativacao() {
    this.servicoParaDesativar.set(null);
  }

  desativar() {
    const servico = this.servicoParaDesativar();
    if (!servico) return;

    this.desativando.set(true);
    this.service.desativar(servico.id).subscribe({
      next: () => {
        this.servicoParaDesativar.set(null);
        this.desativando.set(false);
        this.carregar();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.desativando.set(false);
        this.servicoParaDesativar.set(null);
      },
    });
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}