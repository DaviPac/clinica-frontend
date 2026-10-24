/**
 * Erro devolvido pelo `authInterceptor`. Continua sendo um `Error` com a
 * mensagem da API, mas guarda o status HTTP e o `code` da resposta para
 * quem precisa distinguir um caso do outro (ex.: 404 de "não existe ainda").
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo: string | null,
  ) {
    super(message);
  }
}
