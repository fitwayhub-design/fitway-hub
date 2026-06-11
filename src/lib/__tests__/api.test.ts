import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, apiJson, ApiError } from '../api.js';

// Minimal localStorage + fetch stubs so the browser-targeted module runs under
// node:test. getApiBase() short-circuits to "" when window is undefined, so
// requests hit the bare path — perfect for asserting what apiFetch sends.
type Captured = { url: string; init: RequestInit | undefined };
let captured: Captured;
let nextResponse: () => Response;

beforeEach(() => {
  captured = { url: '', init: undefined };
  nextResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  (globalThis as any).localStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null; },
    setItem(k: string, v: string) { this.store[k] = v; },
    removeItem(k: string) { delete this.store[k]; },
  };
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    captured = { url: String(url), init };
    return nextResponse();
  }) as typeof fetch;
});

test('apiFetch injects the bearer token from localStorage', async () => {
  localStorage.setItem('token', 'tok-123');
  await apiFetch('/api/thing');
  const headers = new Headers(captured.init?.headers as HeadersInit);
  assert.equal(headers.get('Authorization'), 'Bearer tok-123');
});

test('apiFetch does not override an explicit Authorization header', async () => {
  localStorage.setItem('token', 'tok-123');
  await apiFetch('/api/thing', { headers: { Authorization: 'Bearer custom' } });
  const headers = new Headers(captured.init?.headers as HeadersInit);
  assert.equal(headers.get('Authorization'), 'Bearer custom');
});

test('apiFetch skips auth when auth:false', async () => {
  localStorage.setItem('token', 'tok-123');
  await apiFetch('/api/public', { auth: false });
  const headers = new Headers(captured.init?.headers as HeadersInit);
  assert.equal(headers.get('Authorization'), null);
});

test('apiFetch JSON-stringifies plain object bodies and sets content-type', async () => {
  await apiFetch('/api/thing', { method: 'POST', body: { a: 1 } });
  const headers = new Headers(captured.init?.headers as HeadersInit);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(captured.init?.body, JSON.stringify({ a: 1 }));
});

test('apiFetch passes string bodies through untouched', async () => {
  await apiFetch('/api/thing', { method: 'POST', body: JSON.stringify({ b: 2 }), headers: { 'Content-Type': 'application/json' } });
  assert.equal(captured.init?.body, JSON.stringify({ b: 2 }));
});

test('apiJson resolves parsed JSON on 2xx', async () => {
  nextResponse = () => new Response(JSON.stringify({ value: 42 }), { status: 200 });
  const data = await apiJson<{ value: number }>('/api/thing');
  assert.equal(data.value, 42);
});

test('apiJson throws ApiError carrying status and server message', async () => {
  nextResponse = () => new Response(JSON.stringify({ message: 'Nope' }), { status: 403 });
  await assert.rejects(
    () => apiJson('/api/thing'),
    (err: any) => err instanceof ApiError && err.status === 403 && err.message === 'Nope',
  );
});

test('apiJson copes with non-JSON error bodies', async () => {
  nextResponse = () => new Response('Bad gateway', { status: 502 });
  await assert.rejects(
    () => apiJson('/api/thing'),
    (err: any) => err instanceof ApiError && err.status === 502 && err.message === 'Bad gateway',
  );
});
