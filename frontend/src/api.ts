// src/api.ts
import type { ChatPayload } from './services/context';

export type UploadResponse = {
  success: boolean;
  files: Array<{
    file_id: string;
    name: string;
    size: number;
  }>;
};

export type ChatResponse = {
  content: string;
  usage?:
    | {
        total_tokens?: number;
        completion_tokens?: number;
        prompt_tokens?: number;
      }
    | null;
  cost?: number;
  limitReached : boolean;
};

/**
 * Upload des fichiers vers le serveur.
 * @param files Fichiers à uploader (FormData)
 * @param baseUrl Optionnel (ex: 'http://localhost:3000')
 * @returns File IDs
 */
export async function uploadFiles(
  files: FormData,
  baseUrl = '',
): Promise<UploadResponse> {
  const defaultBaseUrl = typeof window !== 'undefined' ? window.backend?.baseUrl ?? '' : '';
  const resolvedBaseUrl = baseUrl || defaultBaseUrl;
  const endpoint = '/api/files';
  const url = `${resolvedBaseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    body: files, // No Content-Type header, let the browser set it with boundary
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) message = errBody.message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = `${message} — ${txt}`;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  const data = await res.json();
  return {
    success: data?.success ?? false,
    files: data?.files ?? [],
  };
}

/**
 * Appelle l'endpoint Mistral.
 * @param payload ChatPayload
 * @param baseUrl Optionnel (ex: 'http://localhost:3000')
 */
export async function chat(
  payload: ChatPayload,
  baseUrl = '',
): Promise<ChatResponse> {
  const defaultBaseUrl = typeof window !== 'undefined' ? window.backend?.baseUrl ?? '' : '';
  const resolvedBaseUrl = baseUrl || defaultBaseUrl;
  const endpoint = '/api/chat';
  const url = `${resolvedBaseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) message = errBody.message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = `${message} — ${txt}`;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  const data = await res.json();
  const content: string = typeof data?.content === 'string' ? data.content : '';
  const usage = data?.usage ?? null;
  const cost = data?.cost ?? null;
  const limitReached = data?.limitReached ?? null;

  return { content, usage, cost, limitReached };
}