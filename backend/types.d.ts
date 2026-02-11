// backend/types.d.ts

/**
 * Types TypeScript pour le backend.
 * Ces types documentent les structures de données utilisées dans le pattern Adapter.
 */

/**
 * Message standardisé utilisé dans toute l'application
 */
export interface StandardizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Informations d'utilisation des tokens
 */
export interface StandardizedUsage {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

/**
 * Réponse standardisée retournée par tous les adapters
 */
export interface StandardizedResponse {
  /** Contenu textuel de la réponse de l'IA */
  content: string;
  /** Informations sur l'utilisation des tokens */
  usage: StandardizedUsage | null;
  /** Nombre total de tokens utilisés (pour facturation) */
  tokensUsed: number;
}

/**
 * Requête de chat standardisée envoyée aux adapters
 */
export interface ChatRequest {
  /** Liste des messages de la conversation */
  messages: StandardizedMessage[];
  /** IDs des fichiers attachés (optionnel) */
  file_ids?: string[];
  /** Le modèle à utiliser */
  model: string;
  /** Nombre maximum de tokens pour la réponse (optionnel) */
  max_tokens?: number;
}

/**
 * Informations d'un fichier uploadé
 */
export interface UploadedFile {
  /** Nom du fichier */
  name: string;
  /** Taille en bytes */
  size: number;
  /** ID du fichier retourné par le provider */
  file_id: string;
}

/**
 * Fichier à uploader (format multer)
 */
export interface FileToUpload {
  /** Buffer contenant les données du fichier */
  buffer: Buffer;
  /** Nom original du fichier */
  originalname: string;
  /** Taille en bytes */
  size: number;
}

/**
 * Réponse envoyée au frontend
 */
export interface ServiceChatResponse {
  /** Contenu de la réponse de l'IA */
  content: string;
  /** Informations sur l'utilisation des tokens */
  usage: StandardizedUsage | null;
  /** Coût de la requête en dollars */
  cost?: number;
  /** Indique si la limite de coût utilisateur est atteinte */
  limitReached: boolean;
}

/**
 * Configuration d'un adapter
 */
export interface AdapterConfig {
  /** Clé API du provider */
  apiKey: string;
  /** Configuration spécifique au provider */
  [key: string]: any;
}

/**
 * Configuration du ChatService
 */
export interface ChatServiceConfig {
  /** Le provider à utiliser ('chatgpt', 'mistral', etc.) */
  provider: string;
  /** Configuration spécifique au provider */
  providerConfig: AdapterConfig;
  /** Limite de coût par utilisateur (défaut: 2.0) */
  costLimit?: number;
}

/**
 * Requête brute reçue du frontend
 */
export interface RawChatRequest {
  /** Prompt simple (format legacy) */
  prompt?: string;
  /** Historique de messages (format nouveau) */
  messages?: Array<{
    role: string;
    content: string | Array<{ text?: string; type?: string }>;
  }>;
  /** IDs des fichiers attachés */
  file_ids?: string[];
}
