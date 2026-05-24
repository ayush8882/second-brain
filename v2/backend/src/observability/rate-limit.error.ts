export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
