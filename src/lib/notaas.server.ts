// Server-only Notaas API client (API_KEY header auth)
// Sandbox/Homologação base URL
const NOTAAS_BASE = process.env.NOTAAS_BASE_URL || "https://api.notaas.com.br";

function getApiKey(): string {
  const key = process.env.NOTAAS_API_KEY;
  if (!key) throw new Error("NOTAAS_API_KEY não configurada");
  return key;
}

async function request(path: string, init: RequestInit = {}) {
  const apiKey = getApiKey();
  const res = await fetch(`${NOTAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-API-KEY": apiKey,
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || data?.error || data?.errors?.[0]?.message || `Erro Notaas (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const notaasApi = {
  emitirNFe: (payload: any) => request("/v1/nfe", { method: "POST", body: JSON.stringify(payload) }),
  emitirNFSe: (payload: any) => request("/v1/nfse", { method: "POST", body: JSON.stringify(payload) }),
  consultarNFe: (id: string) => request(`/v1/nfe/${encodeURIComponent(id)}`),
  consultarNFSe: (id: string) => request(`/v1/nfse/${encodeURIComponent(id)}`),
  cancelarNFe: (id: string, justificativa: string) =>
    request(`/v1/nfe/${encodeURIComponent(id)}/cancelar`, { method: "POST", body: JSON.stringify({ justificativa }) }),
  cancelarNFSe: (id: string, justificativa: string) =>
    request(`/v1/nfse/${encodeURIComponent(id)}/cancelar`, { method: "POST", body: JSON.stringify({ justificativa }) }),
};
