/** An error the app can show something friendly for. `code` is stable; the UI maps it to words. */
export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429,
    readonly code: string,
  ) {
    super(code)
  }
}
