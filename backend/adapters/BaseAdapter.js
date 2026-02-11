// backend/adapters/BaseAdapter.js

/**
 * @typedef {Object} StandardizedMessage
 * @property {'user' | 'assistant' | 'system'} role - Le rôle du message
 * @property {string} content - Le contenu textuel du message
 */

/**
 * @typedef {Object} StandardizedUsage
 * @property {number} [total_tokens] - Nombre total de tokens
 * @property {number} [prompt_tokens] - Tokens utilisés pour le prompt
 * @property {number} [completion_tokens] - Tokens utilisés pour la complétion
 */

/**
 * @typedef {Object} StandardizedResponse
 * @property {string} content - Le contenu de la réponse de l'IA
 * @property {StandardizedUsage | null} usage - Informations sur l'utilisation des tokens
 * @property {number} tokensUsed - Nombre total de tokens utilisés (pour facturation)
 */

/**
 * @typedef {Object} ChatRequest
 * @property {StandardizedMessage[]} messages - Liste des messages de la conversation
 * @property {string[]} [file_ids] - IDs des fichiers attachés
 * @property {string} model - Le modèle à utiliser
 * @property {number} [max_tokens] - Nombre maximum de tokens pour la réponse
 */

/**
 * Classe de base abstraite pour tous les adapters de fournisseurs d'IA.
 * Définit le contrat que chaque adapter doit respecter.
 */
export class BaseAdapter {
  /**
   * @param {Object} config - Configuration spécifique à l'adapter
   */
  constructor(config = {}) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter est une classe abstraite et ne peut pas être instanciée directement');
    }
    this.config = config;
  }

  /**
   * Envoie une requête de chat au fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {ChatRequest} request - La requête de chat standardisée
   * @returns {Promise<StandardizedResponse>} La réponse standardisée
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async sendChatRequest(request) {
    throw new Error('La méthode sendChatRequest() doit être implémentée par la classe dérivée');
  }

  /**
   * Upload des fichiers vers le fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {Array<{buffer: Buffer, originalname: string, size: number}>} files - Les fichiers à uploader
   * @returns {Promise<Array<{name: string, size: number, file_id: string}>>} Les informations des fichiers uploadés
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async uploadFiles(files) {
    throw new Error('La méthode uploadFiles() doit être implémentée par la classe dérivée');
  }

  /**
   * Supprime un fichier du fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {string} fileId - L'ID du fichier à supprimer
   * @returns {Promise<void>}
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async deleteFile(fileId) {
    throw new Error('La méthode deleteFile() doit être implémentée par la classe dérivée');
  }

  /**
   * Extrait le texte d'un fichier uploadé.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {string} fileId - L'ID du fichier
   * @returns {Promise<string>} Texte extrait du fichier
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async extractTextFromFile(fileId) {
    throw new Error('La méthode extractTextFromFile() doit être implémentée par la classe dérivée');
  }

  /**
   * Obtient une URL signée (temporaire) pour accéder à un fichier uploadé.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {string} fileId - L'ID du fichier
   * @returns {Promise<string>} URL signée temporaire
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async getSignedUrl(fileId) {
    throw new Error('La méthode getSignedUrl() doit être implémentée par la classe dérivée');
  }

  /**
   * Télécharge le contenu d'un fichier stocké chez le fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {string} fileId - L'ID du fichier à télécharger
   * @returns {Promise<Buffer>} Le contenu du fichier
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async downloadFile(fileId) {
    throw new Error('La méthode downloadFile() doit être implémentée par la classe dérivée');
  }

  /**
   * Supprime un fichier de la plateforme du fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @param {string} fileId - L'ID du fichier à supprimer
   * @returns {Promise<void>} Aucune valeur retournée
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async deleteFile(fileId) {
    throw new Error('La méthode deleteFile() doit être implémentée par la classe dérivée');
  }

  /**
   * Supprime tous les fichiers stockés chez le fournisseur d'IA.
   * Méthode abstraite qui doit être implémentée par chaque adapter.
   * 
   * @returns {Promise<{deleted: number, failed: number}>} Nombre de fichiers supprimés et échoués
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  async deleteAllFiles() {
    throw new Error('La méthode deleteAllFiles() doit être implémentée par la classe dérivée');
  }

  /**
   * Retourne le nom du provider (ex: "ChatGPT", "Mistral", etc.)
   * 
   * @returns {string} Le nom du provider
   */
  getProviderName() {
    return 'Unknown';
  }
}
