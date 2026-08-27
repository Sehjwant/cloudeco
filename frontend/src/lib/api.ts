import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiConfigured = Boolean(API_BASE_URL);

/**
 * The Cognito **ID token** is the integration contract with the backend.
 * Teammates' API Gateway authorizer (or a secondary-cloud function verifying
 * the token via the Cognito JWKS endpoint) reads it from `Authorization: Bearer`.
 */
export async function getIdToken(): Promise<string | undefined> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export async function getAccessToken(): Promise<string | undefined> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString();
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * Authenticated fetch against the backend REST API. Automatically attaches the
 * Cognito ID token. JSON bodies are serialised; FormData is passed through.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!apiConfigured) {
    throw new ApiError(
      'Backend not connected yet — set VITE_API_BASE_URL once your teammates ship the API.',
    );
  }

  const token = await getIdToken();
  if (!token) throw new ApiError('Not authenticated.', 401);

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  let body = options.body as BodyInit | undefined;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(detail || res.statusText, res.status);
  }

  const contentType = res.headers.get('content-type') ?? '';
  return (contentType.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}
