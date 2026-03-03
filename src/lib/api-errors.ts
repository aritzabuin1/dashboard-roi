/**
 * Centralized API error responses.
 * - In production: always returns a generic message to avoid leaking internals
 * - In development: includes detail for easier debugging
 *
 * Usage:
 *   catch (error) {
 *     console.error('[route] Error:', error);   // real log on server
 *     return apiError(500);                     // generic to client
 *   }
 */
export function apiError(status: number, detail?: string): Response {
  const isDev = process.env.NODE_ENV === 'development';

  const genericMessages: Record<number, string> = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    500: 'Internal server error',
  };

  const message =
    isDev && detail
      ? detail
      : (genericMessages[status] ?? 'Error');

  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
