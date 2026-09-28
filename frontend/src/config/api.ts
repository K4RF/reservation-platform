// A relative URL uses the development proxy (or a same-origin production reverse proxy).
export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeoutMs: 10_000,
} as const
