import { clearToken, getToken } from './session';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
export const SESSION_EXPIRED_EVENT = 'rehabquest:session-expired';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Login/registration calls must not trigger the "session expired" flow. */
  anonymous?: boolean;
};

/**
 * Single entry point for API calls.
 * - Adds the bearer token.
 * - 401 on an authenticated call: clears the session and broadcasts SESSION_EXPIRED_EVENT;
 *   the AuthProvider then sends the user to the login page with an explanation.
 * - 403: thrown as ApiError so screens can show "no access" without logging the user out.
 * - Network failures become a readable ApiError with status 0.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.anonymous ? null : getToken();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Could not reach RehabQuest. Check your connection and try again.', 'network_error');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    const message =
      response.status === 403 && !data.message
        ? 'You do not have access to this page.'
        : (data.message as string | undefined) ?? 'Something went wrong. Please try again.';

    throw new ApiError(response.status, message, data.code, data.details?.fields ?? {});
  }

  return data as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
