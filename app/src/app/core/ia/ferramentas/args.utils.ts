/**
 * Leitura segura dos argumentos vindos do modelo.
 *
 * Dois motivos para centralizar: `noPropertyAccessFromIndexSignature` proíbe
 * `args.paciente_id`, e o modelo às vezes manda número como string (ou o
 * contrário). Converter num lugar só evita espalhar `as number` pelo código.
 */

export type Args = Record<string, unknown>;

export function num(args: Args, chave: string): number | undefined {
  const bruto = args[chave];
  if (bruto === null || bruto === undefined || bruto === '') return undefined;
  const n = typeof bruto === 'number' ? bruto : Number(bruto);
  return Number.isFinite(n) ? n : undefined;
}

export function numObrig(args: Args, chave: string): number {
  const n = num(args, chave);
  if (n === undefined) throw new Error(`O parâmetro "${chave}" é obrigatório.`);
  return n;
}

export function str(args: Args, chave: string): string | undefined {
  const bruto = args[chave];
  if (bruto === null || bruto === undefined) return undefined;
  const s = String(bruto).trim();
  return s === '' ? undefined : s;
}

export function strObrig(args: Args, chave: string): string {
  const s = str(args, chave);
  if (s === undefined) throw new Error(`O parâmetro "${chave}" é obrigatório.`);
  return s;
}

export function bool(args: Args, chave: string, padrao = false): boolean {
  const bruto = args[chave];
  if (bruto === null || bruto === undefined || bruto === '') return padrao;
  if (typeof bruto === 'boolean') return bruto;
  const s = String(bruto).toLowerCase();
  return s === 'true' || s === '1' || s === 'sim';
}

export function enumDe<T extends string>(
  args: Args,
  chave: string,
  validos: readonly T[],
): T | undefined {
  const s = str(args, chave);
  if (s === undefined) return undefined;
  const achado = validos.find((v) => v.toUpperCase() === s.toUpperCase());
  return achado;
}

export function enumObrig<T extends string>(
  args: Args,
  chave: string,
  validos: readonly T[],
): T {
  const v = enumDe(args, chave, validos);
  if (v === undefined) {
    throw new Error(`O parâmetro "${chave}" deve ser um de: ${validos.join(', ')}.`);
  }
  return v;
}

/** Remove chaves com valor undefined — o backend rejeita campos nulos em alguns PATCHes. */
export function limparUndefined<T extends object>(objeto: T): T {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(objeto)) {
    if (valor !== undefined) saida[chave] = valor;
  }
  return saida as T;
}
