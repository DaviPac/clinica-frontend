import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { PacienteService, AtualizarPacienteDto } from '../../../core/services/paciente/paciente.service';
import { Paciente } from '../../../core/models/paciente.model';

// Campos opcionais que NAO podem ser limpos (backend ainda nao suporta apagar valor)
const CAMPOS_OPCIONAIS = ['telefone', 'dataNascimento', 'rg', 'enderecoCompleto'] as const;
type CampoOpcional = typeof CAMPOS_OPCIONAIS[number];

@Component({
  selector: 'app-paciente-editar',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './paciente-editar.component.html',
})
export class PacienteEditarComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PacienteService);
  private fb = inject(FormBuilder);

  paciente = signal<Paciente | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  salvando = signal(false);
  erroSalvar = signal<string | null>(null);
  submetido = signal(false);

  // Campos que o usuario tentou limpar (tinham valor, agora estao vazios)
  camposLimpos = signal<CampoOpcional[]>([]);

  form: FormGroup;

  constructor() {
    this.form = this.fb.nonNullable.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      cpf: ['', [Validators.required, Validators.minLength(11)]],
      telefone: [''],
      dataNascimento: [''],
      rg: [''],
      enderecoCompleto: [''],
    });
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.erro.set('ID de paciente invalido.');
      this.carregando.set(false);
      return;
    }

    this.service.buscarPorId(id).subscribe({
      next: p => {
        this.paciente.set(p);
        this.form.patchValue({
          nome: p.nome,
          cpf: p.cpf,
          telefone: p.telefone ?? '',
          // input[type=date] espera YYYY-MM-DD
          dataNascimento: p.dataNascimento ? p.dataNascimento.substring(0, 10) : '',
          rg: p.rg ?? '',
          enderecoCompleto: p.enderecoCompleto ?? '',
        });
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  campoInvalido(nome: string): boolean {
    const c = this.form.get(nome);
    if (!c) return false;
    return c.invalid && (c.touched || this.submetido());
  }

  /**
   * Compara um valor de form com o valor original do paciente.
   * Normaliza: trim, undefined/null -> '', e datas para YYYY-MM-DD.
   */
  private valorOriginal(campo: string, p: Paciente): string {
    switch (campo) {
      case 'nome': return p.nome ?? '';
      case 'cpf': return p.cpf ?? '';
      case 'telefone': return p.telefone ?? '';
      case 'dataNascimento':
        return p.dataNascimento ? p.dataNascimento.substring(0, 10) : '';
      case 'rg': return p.rg ?? '';
      case 'enderecoCompleto': return p.enderecoCompleto ?? '';
      default: return '';
    }
  }

  cancelar() {
    const p = this.paciente();
    if (p) {
      this.router.navigate(['/pacientes', p.id]);
    } else {
      this.router.navigate(['/pacientes']);
    }
  }

  salvar() {
    this.submetido.set(true);
    this.erroSalvar.set(null);
    this.camposLimpos.set([]);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const p = this.paciente();
    if (!p) return;

    const raw = this.form.getRawValue();

    // 1) Detecta campos opcionais que o usuario tentou limpar
    //    (tinha valor antes, agora esta vazio)
    const limpos: CampoOpcional[] = [];
    for (const campo of CAMPOS_OPCIONAIS) {
      const original = this.valorOriginal(campo, p);
      const atual = (raw[campo] ?? '').toString().trim();
      if (original !== '' && atual === '') {
        limpos.push(campo);
      }
    }

    if (limpos.length > 0) {
      this.camposLimpos.set(limpos);
      this.erroSalvar.set(
        'Limpar campos ainda nao e suportado. Restaure o valor original ou ' +
        'mantenha o atual para continuar.'
      );
      return;
    }

    // 2) Monta o diff: so envia o que realmente mudou
    const dto: AtualizarPacienteDto = {};
    const camposParaComparar = ['nome', 'cpf', 'telefone', 'dataNascimento', 'rg', 'enderecoCompleto'] as const;

    for (const campo of camposParaComparar) {
      const original = this.valorOriginal(campo, p);
      const atual = (raw[campo] ?? '').toString().trim();
      if (atual !== '' && atual !== original) {
        (dto as any)[campo] = atual;
      }
    }

    // 3) Se nada mudou, nao chama o backend
    if (Object.keys(dto).length === 0) {
      this.router.navigate(['/pacientes', p.id]);
      return;
    }

    // 4) Salva
    this.salvando.set(true);
    this.service.atualizar(dto, p.id).subscribe({
      next: () => {
        this.router.navigate(['/pacientes', p.id]);
      },
      error: (err: Error) => {
        this.erroSalvar.set(err.message);
        this.salvando.set(false);
      },
    });
  }

  /** Helper usado no template para destacar campos que o usuario tentou limpar */
  foiLimpo(campo: string): boolean {
    return this.camposLimpos().includes(campo as CampoOpcional);
  }
}