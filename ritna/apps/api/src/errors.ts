export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
export const forbidden = (msg = 'Geen toegang') => new AppError(403, 'forbidden', msg);
export const notFound = (what = 'Niet gevonden') => new AppError(404, 'not_found', what);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const paymentRequired = (msg: string) => new AppError(402, 'payment_failed', msg);
