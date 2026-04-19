// Converte Date local para string RFC3339 com offset -03:00 (Brasília)
export function toRFC3339Brasilia(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
}

// Converte string ISO UTC para Date local do navegador
export function fromISO(iso: string): Date {
  return new Date(iso);
}

// Exibe data/hora no fuso local do usuário
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatarDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Retorna "YYYY-MM-DD" da segunda e domingo da semana atual
export function semanaAtual(): { de: string; ate: string } {
  const hoje = new Date();
  const dia = hoje.getDay(); // 0 = dom
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (dia === 0 ? 6 : dia - 1));
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  return {
    de: segunda.toISOString().slice(0, 10),
    ate: domingo.toISOString().slice(0, 10),
  };
}

// Soma N semanas a uma Date
export function addSemanas(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}