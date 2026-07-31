import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FinanceiroService } from '../../../core/services/financeiro/financeiro.service';
import { AcertoComissao, SaldoAReceber } from '../../../core/models/financeiro.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';

@Component({
  selector: 'app-financeiro-profissional',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToggleComponent],
  templateUrl: './financeiro-profissional.component.html',
})
export class FinanceiroProfissionalComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  isAdmin = this.authService.isAdmin();

  periodoSelecionado = signal(this.mesAtual());

  saldo = signal<SaldoAReceber | null>(null);
  acertos = signal<AcertoComissao[]>([]);
  profissionais = signal<{ id: number; nome: string }[]>([]);

  carregandoSaldo = signal(false);
  carregandoAcertos = signal(false);
  salvandoAcerto = signal(false);

  erro = signal<string | null>(null);
  erroAcerto = signal<string | null>(null);
  sucessoAcerto = signal(false);
  mostrarModal = signal(false);

  totalRepassadoPeriodo = computed(() =>
    this.acertos()
      .filter(a => a.periodoReferencia === this.periodoSelecionado())
      .reduce((sum, a) => sum + a.valorPago, 0)
  );

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: FinanceiroService
  ) {
    this.form = fb.group({
      profissionalId: [null as number | null, [Validators.required]],
      valor_pago: [0, [Validators.required, Validators.min(0.01)]],
      observacao: [''],
      profissionalRecebe: [true],
    });
  }

  ngOnInit() {
    if (this.isAdmin) {
      this.carregarProfissionais();
      this.form.get('profissionalId')?.valueChanges.subscribe(() => {
        this.carregarTudo();
      });
    } else {
      // Profissional só visualiza — sem formulário de criação
      this.carregarTudo();
    }
  }

  carregarTudo() {
    this.carregarSaldo();
    this.carregarAcertos();
  }

  carregarProfissionais() {
    this.usuarioService.listar().subscribe({
      next: (lista) => this.profissionais.set(lista),
      error: (err: Error) => console.error('Erro ao carregar profissionais', err),
    });
  }

  carregarSaldo() {
    const profId = this.isAdmin ? this.form.get('profissionalId')?.value : undefined;

    if (this.isAdmin && !profId) {
      this.saldo.set(null);
      this.form.controls['valor_pago'].setValue(0);
      return;
    }

    this.carregandoSaldo.set(true);

    this.service.getSaldoAReceber(this.periodoSelecionado(), profId).subscribe({
      next: s => {
        this.saldo.set(s);
        // Preenche o campo com o saldo pendente de repasse
        if (this.isAdmin) {
          this.form.controls['valor_pago'].setValue(Math.abs(s.saldo_a_receber));
          this.form.controls['profissionalRecebe'].setValue(s.saldo_a_receber >= 0);
        }
        this.carregandoSaldo.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregandoSaldo.set(false);
      },
    });
  }

  carregarAcertos() {
    const profId = this.isAdmin ? this.form.get('profissionalId')?.value : undefined;

    if (this.isAdmin && !profId) {
      this.acertos.set([]);
      return;
    }

    this.carregandoAcertos.set(true);

    this.service.getAcertos(profId).subscribe({
      next: lista => {
        this.acertos.set(
          lista.sort((a, b) =>
            new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime()
          )
        );
        this.carregandoAcertos.set(false);
      },
      error: () => this.carregandoAcertos.set(false),
    });
  }

  onPeriodoChange(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.periodoSelecionado.set(valor);
      this.carregarTudo();
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.mostrarModal.set(true);
  }

  fecharModal() {
    if (!this.salvandoAcerto()) {
      this.mostrarModal.set(false);
    }
  }

  confirmarRepasse() {
    this.salvandoAcerto.set(true);
    this.erroAcerto.set(null);
    this.sucessoAcerto.set(false);

    const raw = this.form.getRawValue();
    const dto = {
      profissionalId: raw.profissionalId,
      periodoReferencia: this.periodoSelecionado(),
      valorPago: raw.valor_pago,
      profissionalRecebe: raw.profissionalRecebe,
      ...(raw.observacao?.trim() ? { observacao: raw.observacao.trim() } : {}),
    };

    this.service.criarAcerto(dto).subscribe({
      next: novoAcerto => {
        this.acertos.update(lista => [novoAcerto, ...lista]);
        this.sucessoAcerto.set(true);
        this.form.patchValue({ valor_pago: 0, observacao: '', profissionalRecebe: true });
        this.salvandoAcerto.set(false);
        this.carregarSaldo();
        this.fecharModal(); // Fecha o modal após sucesso
        setTimeout(() => this.sucessoAcerto.set(false), 3000);
      },
      error: (err: Error) => {
        this.erroAcerto.set(err.message);
        this.salvandoAcerto.set(false);
        this.fecharModal(); // Fecha o modal para mostrar o erro na tela principal
      },
    });
  }

  formatarValor(v: number): string {
    return Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  formatarMes(yyyyMM: string): string {
    const [ano, mes] = yyyyMM.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+mes - 1]} ${ano}`;
  }

  private mesAtual(): string {
    return new Date().toISOString().slice(0, 7);
  }
}