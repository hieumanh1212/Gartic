function serverBase(): string {
  const env = import.meta.env.VITE_SERVER_URL?.trim();
  if (env) return env.replace(/\/+$/, '').replace(/^http/, 'ws');
  // Chạy local: server wrangler dev ở cổng 8787 trên cùng máy
  return `ws://${location.hostname || 'localhost'}:8787`;
}

export const SERVER_URL = serverBase();

export const wsUrl = (code: string) => `${SERVER_URL}/ws?room=${encodeURIComponent(code)}`;

export const inviteLink = (code: string) =>
  `${location.origin}${location.pathname}${location.search}#/${code}`;
