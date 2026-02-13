// backend/services/ChatService.js
import { ChatGPTAdapter } from '../adapters/ChatGPTAdapter.js';
import { MistralAdapter } from '../adapters/MistralAdapter.js';
import { computeCostFromUsage } from '../pricing.js';
import { ensureUserExists, addTokens, addCost, getTotalCost, getCostLimit, addRequest, addRequestWithFiles } from '../db.ts';
import { getWindowsUserName } from '../security/identity.ts';

/**
 * @typedef {Object} ProcessedChatRequest
 * @property {import('../adapters/BaseAdapter.js').StandardizedMessage[]} messages - Messages standardisés
 * @property {string[]} [file_ids] - IDs des fichiers attachés
 * @property {string} model - Le modèle à utiliser
 */

/**
 * @typedef {Object} ServiceChatResponse
 * @property {string} content - Le contenu de la réponse
 * @property {Object | null} usage - Informations sur l'utilisation
 * @property {number} [cost] - Coût de la requête
 * @property {boolean} limitReached - Indique si la limite de coût est atteinte
 */

/**
 * Service principal de chat qui orchestre les appels aux différents adapters.
 * C'est le point d'entrée unique pour toutes les requêtes de chat, indépendamment
 * du fournisseur d'IA utilisé.
 */
export class ChatService {
  /**
   * @param {Object} config
   * @param {string} config.provider - Le provider à utiliser ('chatgpt', 'mistral', etc.)
   * @param {Object} config.providerConfig - Configuration spécifique au provider
   * @param {number} [config.costLimit=2.0] - Limite de coût par utilisateur
   */
  constructor(config) {
    this.provider = config.provider?.toLowerCase() ?? 'chatgpt';
    this.costLimit = config.costLimit ?? 2.0;
    this.adapter = this._createAdapter(this.provider, config.providerConfig);
  }

  /**
   * Crée l'adapter approprié selon le provider choisi.
   * 
   * @private
   * @param {string} provider
   * @param {Object} providerConfig
   * @returns {import('../adapters/BaseAdapter.js').BaseAdapter}
   */
  _createAdapter(provider, providerConfig) {
    switch (provider) {
      case 'chatgpt':
      case 'openai':
        return new ChatGPTAdapter(providerConfig);
      
      case 'mistral':
        return new MistralAdapter(providerConfig);
      
      default:
        throw new Error(`Provider non supporté: ${provider}`);
    }
  }

  /**
   * Traite une requête de chat complète :
   * - Vérifie la limite de coût
   * - Normalise les messages
   * - Appelle l'adapter approprié
   * - Calcule et enregistre les coûts
   * 
   * @param {Object} rawRequest - Requête brute du frontend
   * @param {string} [rawRequest.prompt] - Prompt simple (legacy)
   * @param {Array} [rawRequest.messages] - Historique de messages
   * @param {string[]} [rawRequest.file_ids] - IDs des fichiers attachés
   * @param {string} model - Le modèle à utiliser
   * @returns {Promise<ServiceChatResponse>}
   */
  async processChatRequest(rawRequest, model) {
    const username = getWindowsUserName();
    await ensureUserExists?.(username);

    // Incremente le compteur de requetes utilisateur
    await addRequest(username);

    // Incremente le compteur de requetes avec fichiers si applicable
    const hasFiles = Array.isArray(rawRequest?.file_ids) && rawRequest.file_ids.length > 0;
    if (hasFiles) {
      await addRequestWithFiles(username);
    }

    // Vérification de la limite de coût
    const totalCost = await getTotalCost(username);
    const userCostLimit = await getCostLimit(username);
    const effectiveLimit = Number.isFinite(userCostLimit) ? userCostLimit : this.costLimit;
    const limitReached = totalCost >= effectiveLimit;
    
    if (limitReached) {
      return { 
        content: '', 
        usage: null, 
        cost: 0, 
        limitReached: true 
      };
    }

    // Normalisation de la requête
    const processedRequest = this._normalizeRequest(rawRequest, model);

    // Appel à l'adapter
    let response;
    try {
      response = await this.adapter.sendChatRequest(processedRequest);
    } catch (error) {
      throw error;
    }

    // Calcul du coût
    const cost = computeCostFromUsage(response.usage, model);

    // Enregistrement des tokens et du coût
    if (response.tokensUsed && Number.isFinite(response.tokensUsed)) {
      await addTokens(username, response.tokensUsed);
    }
    
    if (typeof cost === 'number' && Number.isFinite(cost)) {
      await addCost(username, cost);
    }

    // Retour de la réponse dans le format attendu par le frontend
    return {
      content: response.content,
      usage: response.usage,
      cost,
      limitReached: false,
    };
  }

  /**
   * Normalise la requête brute en format standardisé.
   * Supporte à la fois le format legacy (prompt) et le nouveau format (messages).
   * 
   * @private
   * @param {Object} rawRequest
   * @param {string} model
   * @returns {ProcessedChatRequest}
   */
  _normalizeRequest(rawRequest, model) {
    const { prompt, messages, file_ids } = rawRequest ?? {};

    // Conversion en format standardisé
    let standardizedMessages = [];

    if (Array.isArray(messages) && messages.length > 0) {
      // Format messages : on les convertit en format standardisé
      standardizedMessages = messages.map((m) => {
        // Extraction du texte selon le format
        const text =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.content)
            ? m.content
                .map((c) => {
                  if (typeof c === 'string') return c;
                  if (c?.text) return c.text;
                  if (c?.type === 'input_text' && c?.text) return c.text;
                  return '';
                })
                .filter(Boolean)
                .join('\n')
            : '';

        return {
          role: m.role || 'user',
          content: text,
        };
      });
    } else if (prompt && typeof prompt === 'string') {
      // Format legacy : simple prompt
      standardizedMessages = [
        {
          role: 'user',
          content: prompt,
        },
      ];
    } else {
      throw new Error('Ni prompt ni messages n\'ont été fournis');
    }

    return {
      messages: standardizedMessages,
      file_ids: Array.isArray(file_ids) ? file_ids.map(String) : [],
      model,
    };
  }

  /**
   * Upload des fichiers via l'adapter.
   * 
   * @param {Array<{buffer: Buffer, originalname: string, size: number}>} files
   * @returns {Promise<Array<{name: string, size: number, file_id: string}>>}
   */
  async uploadFiles(files) {
    return await this.adapter.uploadFiles(files);
  }

  /**
   * Supprime un fichier via l'adapter.
   * 
   * @param {string} fileId
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    return await this.adapter.deleteFile(fileId);
  }

  /**
   * Supprime plusieurs fichiers.
   * 
   * @param {string[]} fileIds
   * @returns {Promise<void>}
   */
  async deleteFiles(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) return;
    
    for (const fileId of fileIds) {
      await this.deleteFile(fileId);
    }
  }

  /**
   * Télécharge le contenu d'un fichier.
   * 
   * @param {string} fileId
   * @returns {Promise<Buffer>}
   */
  async downloadFile(fileId) {
    return await this.adapter.downloadFile(fileId);
  }

  /**
   * Extrait le texte d'un fichier uploadé.
   * 
   * @param {string} fileId
   * @returns {Promise<string>}
   */
  async extractTextFromFile(fileId) {
    return await this.adapter.extractTextFromFile(fileId);
  }

  /**
   * Retourne le nom du provider actuellement utilisé.
   * 
   * @returns {string}
   */
  getProviderName() {
    return this.adapter.getProviderName();
  }

  /**
   * Supprime tous les fichiers stockés chez le provider.
   * Utile pour nettoyer le stockage au démarrage.
   * 
   * @returns {Promise<{deleted: number, failed: number}>}
   */
  async deleteAllFiles() {
    return await this.adapter.deleteAllFiles();
  }
}
