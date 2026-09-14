import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Agendamento } from '../models/agendamento.model';
import { DespesaClinica } from '../models/financeiro.model';
import { Paciente } from '../models/paciente.model';
import { Servico } from '../models/servico.model';
import { Usuario } from '../models/usuario.model';
import { AgendamentoService } from '../services/agendamento/agendamento.service';
import { AuthService } from '../services/auth/auth.service';
import { FinanceiroService } from '../services/financeiro/financeiro.service';
import { PacienteService } from '../services/paciente/paciente.service';
import { ServicoService } from '../services/servico/servico.service';
import { UsuarioService } from '../services/usuario/usuario.service';

/**
 * Cache das entidades usadas pelos selects dos formulários de confirmação.
 *
 * Existe para o usuário poder TROCAR o paciente, o serviço ou o profissional que
 * a IA sugeriu — sem isso a confirmação seria só um "ok/cancela" sobre um ID
 * cru. É carregado sob demanda e recarregado após cada escrita.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly auth = inject(AuthService);
  private readonly pacienteSvc = inject(PacienteService);
  private readonly servicoSvc = inject(ServicoService);
  private readonly usuarioSvc = inject(UsuarioService);
  private readonly agendamentoSvc = inject(AgendamentoService);
  private readonly financeiroSvc = inject(FinanceiroService);

  readonly pacientes = signal<Paciente[]>([]);
  readonly servicos = signal<Servico[]>([]);
  readonly profissionais = signal<Usuario[]>([]);
  readonly agendamentos = signal<Agendamento[]>([]);
  readonly despesas = signal<DespesaClinica[]>([]);
  readonly carregando = signal(false);

  private carregado = false;

  async garantirCarregado(): Promise<void> {
    if (this.carregado) return;
    await this.recarregar();
  }

  async recarregar(): Promise<void> {
    const usuario = this.auth.usuario();
    if (!usuario) return;

    const isAdmin = usuario.role === 'ADMIN';
    this.carregando.set(true);

    const resultados = await Promise.allSettled([
      firstValueFrom(this.pacienteSvc.listar(isAdmin)),
      firstValueFrom(this.servicoSvc.listar(isAdmin ? {} : { profissionalId: usuario.id })),
      isAdmin ? firstValueFrom(this.usuarioSvc.listar()) : Promise.resolve([usuario]),
      firstValueFrom(
        this.agendamentoSvc.listar({
          periodo: periodoAmplo(),
          ...(isAdmin ? {} : { profissionalId: usuario.id }),
        }),
      ),
      isAdmin ? firstValueFrom(this.financeiroSvc.getDespesas()) : Promise.resolve([]),
    ]);

    aplicar(resultados[0], this.pacientes);
    aplicar(resultados[1], this.servicos);
    aplicar(resultados[2], this.profissionais);
    aplicar(resultados[3], this.agendamentos);
    aplicar(resultados[4], this.despesas);

    this.carregado = true;
    this.carregando.set(false);
  }

  /** Pacientes e serviços de um profissional específico (uso do admin). */
  async doProfissional(profissionalId: number): Promise<{
    pacientes: Paciente[];
    servicos: Servico[];
  }> {
    const [pacientes, servicos] = await Promise.all([
      firstValueFrom(this.pacienteSvc.listar(false, false, String(profissionalId))),
      firstValueFrom(this.servicoSvc.listar({ profissionalId, incluirInativos: true })),
    ]);
    return { pacientes, servicos };
  }

  nomePaciente(id: unknown): string {
    const p = this.pacientes().find((x) => x.id === Number(id));
    return p?.nome ?? `Paciente #${id}`;
  }

  nomeServico(id: unknown): string {
    const s = this.servicos().find((x) => x.id === Number(id));
    return s?.nome ?? `Serviço #${id}`;
  }

  nomeProfissional(id: unknown): string {
    const u = this.profissionais().find((x) => x.id === Number(id));
    return u?.nome ?? `Profissional #${id}`;
  }
}

/** Janela generosa o bastante para o usuário achar o agendamento nos selects. */
function periodoAmplo(): { de: string; ate: string } {
  const hoje = new Date();
  const de = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0);
  return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
}

function aplicar<T>(
  resultado: PromiseSettledResult<T[]>,
  destino: { set: (v: T[]) => void },
): void {
  if (resultado.status === 'fulfilled') destino.set(resultado.value);
}
