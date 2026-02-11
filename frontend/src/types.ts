// src/types.ts
export type Sender = 'user' | 'assistant';

export interface Message {
  sender: Sender;
  text: string;
  tokens?: number;
  cost?: number;
}

export type FileTokenAttachment = {
  token: string;
  name: string;
  size: number;
  mime?: string;
};

export type PdfIdAttachment = {
  file_id: string;              // renvoyé par /v1/files
  name: string;
  size: number;
  mime: 'application/pdf';
};

export type Flags = {
  canUseApp: boolean;
  canImportFiles: boolean;
};

export type FiltreContext = {
  /** Longueur attendue du rendu */
  longueur: string;
  /** Format attendu de la réponse */
  format: string;
  /** Domaine de réponse */
  domaine: string;
  /** Contexte complémentaire libre saisi par l’utilisateur */
  contexte: string;
};
