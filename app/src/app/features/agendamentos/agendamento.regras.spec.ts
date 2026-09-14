import { FormBuilder } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { Servico } from '../../core/models/servico.model';
import { aplicarRegrasDoServico, valorPorSessao } from './agendamento.regras';

function formulario() {
  const fb = new FormBuilder();
  const grupo = fb.nonNullable.group({
    recorrente: [false],
    pacote: [false],
    valor_combinado: [0],
  });
  return {
    grupo,
    ctrls: {
      recorrente: grupo.controls.recorrente,
      pacote: grupo.controls.pacote,
      valor_combinado: grupo.controls.valor_combinado,
    },
  };
}

function servico(parcial: Partial<Servico>): Servico {
  return {
    id: 1,
    profissional_id: 1,
    nome: 'Sessão',
    valor_atual: 200,
    ativo: true,
    is_pacote: false,
    ...parcial,
  };
}

describe('aplicarRegrasDoServico', () => {
  it('força recorrência e usa o valor total quando o serviço é pacote', () => {
    const { grupo, ctrls } = formulario();

    aplicarRegrasDoServico(ctrls, servico({ is_pacote: true, valor_atual: 1200 }));

    const bruto = grupo.getRawValue();
    expect(bruto.recorrente).toBe(true);
    expect(bruto.pacote).toBe(true);
    expect(bruto.valor_combinado).toBe(1200);
    expect(ctrls.recorrente.disabled).toBe(true);
  });

  it('libera a recorrência para serviço avulso', () => {
    const { grupo, ctrls } = formulario();

    aplicarRegrasDoServico(ctrls, servico({ is_pacote: true, valor_atual: 1200 }));
    aplicarRegrasDoServico(ctrls, servico({ is_pacote: false, valor_atual: 180 }));

    const bruto = grupo.getRawValue();
    expect(bruto.recorrente).toBe(false);
    expect(bruto.pacote).toBe(false);
    expect(bruto.valor_combinado).toBe(180);
    expect(ctrls.recorrente.enabled).toBe(true);
  });

  it('não mexe no formulário quando não há serviço selecionado', () => {
    const { grupo, ctrls } = formulario();
    grupo.patchValue({ valor_combinado: 99 });

    aplicarRegrasDoServico(ctrls, null);

    expect(grupo.getRawValue().valor_combinado).toBe(99);
  });
});

describe('valorPorSessao', () => {
  it('divide o total pelo número de sessões', () => {
    expect(valorPorSessao(1200, 10)).toBe(120);
  });

  it('devolve null quando o número de sessões é inválido', () => {
    expect(valorPorSessao(1200, 0)).toBeNull();
    expect(valorPorSessao(1200, -1)).toBeNull();
  });
});
