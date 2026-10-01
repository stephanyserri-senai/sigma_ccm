const TOKEN_KEY = 'sigma_token';

export type JwtUser = {
  id: number | string;
  nome: string;
  papel: string;
  username: string;
};

export type LoginResponse = {
  token: string;
  user: JwtUser;
};

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  setToken(null);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers = new Headers(options.headers ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : typeof payload === 'string' && payload.trim().length > 0
          ? payload
          : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}

export async function login(username: string, senha: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, senha }),
  });

  setToken(data.token);
  return data;
}

export async function me(): Promise<JwtUser> {
  const data = await apiFetch<{ user?: JwtUser; data?: JwtUser } | JwtUser>('/auth/me');

  if (data && typeof data === 'object' && 'user' in data && data.user) {
    return data.user;
  }

  return data as JwtUser;
}

export async function dashboard(): Promise<any> {
  return apiFetch('/dashboard');
}

export async function cadastros(): Promise<any> {
  return apiFetch('/cadastros');
}

export async function notas(): Promise<any> {
  return apiFetch('/notas');
}

export async function criarNota(n: any): Promise<any> {
  return apiFetch('/notas', {
    method: 'POST',
    body: JSON.stringify(n),
  });
}

export async function converterNota(id: string | number): Promise<any> {
  return apiFetch(`/notas/${id}/converter`, {
    method: 'POST',
  });
}

export async function ordens(): Promise<any> {
  return apiFetch('/ordens');
}

export async function ordem(id: string | number): Promise<any> {
  return apiFetch(`/ordens/${id}`);
}

export async function statusOrdem(id: string | number, status: string): Promise<any> {
  return apiFetch(`/ordens/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function criarApontamento(ap: any): Promise<any> {
  return apiFetch('/apontamentos', {
    method: 'POST',
    body: JSON.stringify(ap),
  });
}

export async function sinalizacoes(): Promise<any> {
  return apiFetch('/sinalizacoes');
}

export async function aceitarSinal(id: string | number): Promise<any> {
  return apiFetch(`/sinalizacoes/${id}/aceitar`, {
    method: 'POST',
  });
}

export async function rejeitarSinal(id: string | number): Promise<any> {
  return apiFetch(`/sinalizacoes/${id}/rejeitar`, {
    method: 'POST',
  });
}

export async function usuarios(): Promise<any> {
  return apiFetch('/usuarios');
}

export async function criarUsuario(u: any): Promise<any> {
  return apiFetch('/usuarios', {
    method: 'POST',
    body: JSON.stringify(u),
  });
}
