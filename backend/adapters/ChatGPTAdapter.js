// backend/adapters/ChatGPTAdapter.js
import { OpenAI } from 'openai';
import { toFile } from 'openai/uploads';
import { BaseAdapter } from './BaseAdapter.js';

/**
 * Adapter pour l'API OpenAI (ChatGPT).
 * Encapsule toute la logique spécifique à OpenAI et transforme les réponses
 * en format standardisé.
 */
export class ChatGPTAdapter extends BaseAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Clé API OpenAI
   * @param {number} [config.maxOutputTokens=4096] - Nombre maximum de tokens en sortie
   */
  constructor(config) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('ChatGPTAdapter: apiKey est requis');
    }

    this.client = new OpenAI({ apiKey: config.apiKey });
    this.maxOutputTokens = config.maxOutputTokens ?? 4096;
    
    // Cache léger pour méta fichiers (utile pour décider PDF vs non-PDF)
    /** @type {Map<string, {name: string, ext: string}>} */
    this.fileMetaById = new Map();
  }

  /**
   * @returns {string}
   */
  getProviderName() {
    return 'ChatGPT';
  }

  /**
   * Upload des fichiers vers OpenAI Files API.
   * 
   * @param {Array<{buffer: Buffer, originalname: string, size: number}>} files
   * @returns {Promise<Array<{name: string, size: number, file_id: string}>>}
   */
  async uploadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Aucun fichier à uploader');
    }

    const results = [];
    for (const f of files) {
      const fileObj = await toFile(f.buffer, f.originalname);
      const uploaded = await this.client.files.create({ 
        file: fileObj, 
        purpose: 'assistants' 
      });
      
      const name = f.originalname;
      const ext = (name.split('.').pop() ?? '').toLowerCase();
      this.fileMetaById.set(uploaded.id, { name, ext });
      
      results.push({ 
        name: f.originalname, 
        size: f.size, 
        file_id: uploaded.id 
      });
    }

    return results;
  }

  /**
   * Supprime un fichier d'OpenAI.
   * 
   * @param {string} fileId
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      await this.client.files.delete(fileId);
      this.fileMetaById.delete(fileId);
    } catch (e) {
      // Ignorer les erreurs de suppression
    }
  }

  /**   * Obtient une URL signée (temporaire) pour accéder à un fichier uploadé.
   * OpenAI ne supporte pas directement les URLs signées via l'API.
   * Cette implémentation retourne une erreur.
   * 
   * @param {string} fileId
   * @returns {Promise<string>}
   */
  async extractTextFromFile(fileId) {
    throw new Error('OpenAI n\'expose pas d\'endpoint d\'extraction de texte pour les fichiers');
  }

  async getSignedUrl(fileId) {
    throw new Error('OpenAI n\'expose pas d\'URLs signées pour les fichiers uploadés');
  }

  /**   * Télécharge le contenu d'un fichier d'OpenAI.
   * Convertit le contenu en string texte exploitable.
   * 
   * @param {string} fileId
   * @returns {Promise<string>} Contenu du fichier en texte
   */
  async downloadFile(fileId) {
    try {
      const content = await this.client.files.retrieveContent(fileId);
      
      // Convertir le ReadableStream en string
      if (!content) {
        return '';
      }

      // Si c'est déjà un string
      if (typeof content === 'string') {
        return content;
      }

      // Si c'est un Buffer
      if (Buffer.isBuffer(content)) {
        return content.toString('utf-8');
      }

      // Si c'est un ReadableStream, le lire
      if (content && typeof content.pipe === 'function') {
        return new Promise((resolve, reject) => {
          let data = '';
          content.on('data', chunk => {
            data += chunk.toString('utf-8');
          });
          content.on('end', () => {
            resolve(data);
          });
          content.on('error', reject);
        });
      }

      // Fallback: convertir en string
      return String(content);
    } catch (e) {
      console.error('[ChatGPTAdapter] Erreur download:', e.message);
      throw e;
    }
  }

  /**
   * Envoie une requête de chat à OpenAI.
   * Gère automatiquement le choix entre Chat Completions (PDF) et Responses API (non-PDF).
   * 
   * @param {import('./BaseAdapter.js').ChatRequest} request
   * @returns {Promise<import('./BaseAdapter.js').StandardizedResponse>}
   */
  async sendChatRequest(request) {
    const { messages, file_ids = [], model } = request;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Le tableau messages est requis et ne peut pas être vide');
    }

    // Décision de chemin : si des fichiers non-PDF, on utilise Responses API avec file_search
    const hasNonPdfFiles = file_ids.length > 0 ? await this._hasNonPdf(file_ids) : false;

    if (hasNonPdfFiles) {
      return await this._handleResponsesFileSearch(messages, file_ids, model);
    } else {
      return await this._handleChatCompletions(messages, file_ids, model);
    }
  }

  /**
   * Vérifie si au moins un fichier n'est pas un PDF.
   * 
   * @private
   * @param {string[]} file_ids
   * @returns {Promise<boolean>}
   */
  async _hasNonPdf(file_ids = []) {
    for (const fid of file_ids) {
      let meta = this.fileMetaById.get(fid);
      
      if (!meta) {
        try {
          const f = await this.client.files.retrieve(fid);
          const name = f?.filename ?? '';
          meta = { name, ext: (name.split('.').pop() ?? '').toLowerCase() };
          this.fileMetaById.set(fid, meta);
        } catch {
          // Prudence : si on ne parvient pas à récupérer la méta, on force File Search
          return true;
        }
      }
      
      if (meta.ext !== 'pdf') return true;
    }
    return false;
  }

  /**
   * Crée un Vector Store et y attache les fichiers donnés.
   * 
   * @private
   * @param {string[]} file_ids
   * @returns {Promise<{id: string} | null>}
   */
  async _createVectorStoreWithFiles(file_ids = []) {
    if (!Array.isArray(file_ids) || file_ids.length === 0) return null;
    
    const vectorStore = await this.client.vectorStores.create({ 
      name: 'session-store' 
    });
    
    await this.client.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
      file_ids: file_ids.map(String),
    });
    
    return vectorStore;
  }

  /**
   * Gère les requêtes avec Responses API + file_search (pour fichiers non-PDF).
   * 
   * @private
   * @param {import('./BaseAdapter.js').StandardizedMessage[]} messages
   * @param {string[]} file_ids
   * @param {string} model
   * @returns {Promise<import('./BaseAdapter.js').StandardizedResponse>}
   */
  async _handleResponsesFileSearch(messages, file_ids, model) {
    let vectorStore = null;
    
    try {
      vectorStore = await this._createVectorStoreWithFiles(file_ids);

      // Conversion des messages en format texte pour Responses API
      const userPrompt = messages
        .map((m) => {
          const role = m?.role ?? 'user';
          const text = m?.content ?? '';
          if (!text.trim()) return '';
          return `[${role.toUpperCase()}]\n${text}`;
        })
        .filter(Boolean)
        .join('\n\n')
        .trim();

      const response = await this.client.responses.create({
        model,
        input: userPrompt.length 
          ? userPrompt 
          : 'Réponds en utilisant les fichiers fournis si nécessaire.',
        tools: [{ 
          type: 'file_search', 
          vector_store_ids: vectorStore ? [vectorStore.id] : [] 
        }],
        max_output_tokens: this.maxOutputTokens,
      });

      // Extraction du contenu textuel
      const contentText =
        response?.output_text?.trim?.() ??
        (Array.isArray(response?.output)
          ? response.output
              .map((p) => 
                (p?.content ?? [])
                  .map((cc) => (cc?.type === 'output_text' ? cc?.text : ''))
                  .join('')
              )
              .join('')
              .trim()
          : '');

      const usage = response?.usage ?? null;
      const tokensUsed = usage?.total_tokens ?? usage?.output_tokens ?? usage?.input_tokens ?? 0;

      return {
        content: contentText || 'Réponse vide',
        usage: usage ? {
          total_tokens: usage.total_tokens,
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
        } : null,
        tokensUsed,
      };
    } finally {
      if (vectorStore?.id) {
        try {
          await this.client.vectorStores.delete(vectorStore.id);
        } catch (e) {
          // Ignorer les erreurs de suppression
        }
      }
    }
  }

  /**
   * Gère les requêtes avec Chat Completions API (pour PDF uniquement ou sans fichiers).
   * 
   * @private
   * @param {import('./BaseAdapter.js').StandardizedMessage[]} messages
   * @param {string[]} file_ids
   * @param {string} model
   * @returns {Promise<import('./BaseAdapter.js').StandardizedResponse>}
   */
  async _handleChatCompletions(messages, file_ids, model) {
    // Conversion des messages en format OpenAI Chat
    const inputForChat = [
      ...messages.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      })),
      // Si des fichiers PDF sont attachés, on les ajoute dans un message séparé
      ...(Array.isArray(file_ids) && file_ids.length > 0
        ? [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Voici les fichiers à prendre en compte :' },
                ...file_ids.map((fid) => ({ 
                  type: 'file', 
                  file: { file_id: String(fid) } 
                })),
              ],
            },
          ]
        : []),
    ];

    const response = await this.client.chat.completions.create({
      model,
      messages: inputForChat,
      max_completion_tokens: this.maxOutputTokens,
    });

    const reply = response.choices?.[0]?.message?.content ?? '';
    const usage = response.usage ?? null;
    const tokensUsed = usage?.total_tokens ?? usage?.completion_tokens ?? 0;

    return {
      content: String(reply).trim() || 'Réponse vide',
      usage: usage ? {
        total_tokens: usage.total_tokens,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
      } : null,
      tokensUsed,
    };
  }

  /**
   * Supprime un fichier. OpenAI ne supporte pas la suppression via API.
   * 
   * @param {string} fileId - L'ID du fichier
   * @throws {Error} Toujours, car OpenAI ne supporte pas cette opération
   */
  async deleteFile(fileId) {
    throw new Error('ChatGPTAdapter: La suppression de fichiers n\'est pas supportée par OpenAI');
  }

  /**
   * Supprime tous les fichiers. OpenAI ne supporte pas cette opération.
   * 
   * @returns {Promise<{deleted: number, failed: number}>}
   */
  async deleteAllFiles() {
    return { deleted: 0, failed: 0 };
  }
}
