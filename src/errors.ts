/**
 * All API errors thrown by the IgniteIQ Vault client.
 *
 * @example
 * ```ts
 * try {
 *   await client.query({ measures: ['fact_jobs.total_revenue'] });
 * } catch (err) {
 *   if (err instanceof VaultError) {
 *     console.error(err.code, err.message, err.status);
 *   }
 * }
 * ```
 */
export class VaultError extends Error {
  /**
   * Machine-readable error code.
   *
   * Common values:
   * - `UNAUTHORIZED`  — invalid or missing API key
   * - `FORBIDDEN`     — key exists but lacks permission for this operation
   * - `NOT_FOUND`     — resource (org, dimension, measure) not found
   * - `RATE_LIMITED`  — request quota exceeded
   * - `BAD_REQUEST`   — malformed query payload
   * - `API_ERROR`     — unexpected server error
   */
  public readonly code: string;

  /** HTTP status code, if the error originated from an HTTP response. */
  public readonly status: number | undefined;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    this.status = status;

    // Maintain correct prototype chain when targeting ES5/CommonJS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
