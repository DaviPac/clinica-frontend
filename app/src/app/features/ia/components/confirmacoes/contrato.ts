import { OutputEmitterRef } from '@angular/core';

/**
 * Contrato de todo formulário de confirmação.
 *
 * O componente recebe os argumentos que o modelo propôs e emite, a cada
 * alteração, os argumentos JÁ NORMALIZADOS — datas no formato que a ferramenta
 * espera, números como number. Assim o card pai nunca lida com `unknown` no
 * template, o que também evita o problema de `[(ngModel)]` sobre um
 * `Record<string, unknown>` (que não compila com `strictTemplates`).
 */
export interface FormularioConfirmacaoContrato {
  readonly alterado: OutputEmitterRef<Record<string, unknown>>;
  readonly valido: OutputEmitterRef<boolean>;
}

/** Converte "2026-09-14T14:00:00-03:00" para o valor de um input datetime-local. */
export function paraDatetimeLocal(valor: unknown): string {
  if (!valor) return '';
  const texto = String(valor);
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto.slice(0, 16);

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}` +
    `T${pad(data.getHours())}:${pad(data.getMinutes())}`
  );
}

export function comoTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

export function comoNumero(valor: unknown, padrao = 0): number {
  if (valor === null || valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

export function comoBooleano(valor: unknown, padrao = false): boolean {
  if (valor === null || valor === undefined || valor === '') return padrao;
  if (typeof valor === 'boolean') return valor;
  const s = String(valor).toLowerCase();
  return s === 'true' || s === '1' || s === 'sim';
}
