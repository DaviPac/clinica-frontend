import { Component, input, output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ServicoService } from '../../../core/services/servico/servico.service';
import { Servico } from '../../../core/models/servico.model';

@Component({
  selector: 'app-servicos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './servicos-modal.component.html',
})
export class ServicosModalComponent implements OnInit {
  // null = modo criação | Servico = modo edição
  servico = input<Servico | null>(null);

  fechar = output<void>();
  salvo = output<void>();

  form: FormGroup;

  loading = signal(false);
  erro = signal<string | null>(null);

  get modoEdicao() { return !!this.servico(); }
  get titulo() { return this.modoEdicao ? 'Editar serviço' : 'Novo serviço'; }
  get labelBotao() { return this.modoEdicao ? 'Salvar' : 'Criar'; }

  constructor(
    private fb: FormBuilder,
    private service: ServicoService
  ) {
    this.form = fb.nonNullable.group({
      nome: ['', Validators.required],
      valor_atual: [0, [Validators.required, Validators.min(0.01)]],
      ativo: [true],
    });
  }

  ngOnInit() {
    // Pré-popula o form se vier um serviço para edição
    const s = this.servico();
    if (s) {
      this.form.patchValue({
        nome: s.nome,
        valor_atual: s.valor_atual,
        ativo: s.ativo,
      });
    }
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);

    const dto = this.form.getRawValue();
    const s = this.servico();

    const op$ = s
      ? this.service.atualizar(s.id, dto)
      : this.service.criar(dto);

    op$.subscribe({
      next: () => this.salvo.emit(),
      error: (err: Error) => {
        this.erro.set(err.message);
        this.loading.set(false);
      },
    });
  }
}