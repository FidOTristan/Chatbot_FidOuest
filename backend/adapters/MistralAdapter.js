// backend/adapters/MistralAdapter.js
import { Mistral } from '@mistralai/mistralai';
import { BaseAdapter } from './BaseAdapter.js';
import { DocumentExtractor } from '../services/DocumentExtractor.js';

/**
 * Adapter pour l'API Mistral AI.
 * 
 * Mistral dispose d'une Files API pour l'upload de documents.
 * Les fichiers sont uploadés avec purpose="ocr" pour permettre l'extraction de contenu.
 */
export class MistralAdapter extends BaseAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Clé API Mistral
   * @param {number} [config.maxTokens=4096] - Nombre maximum de tokens
   */
  constructor(config) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('MistralAdapter: apiKey est requis');
    }

    this.client = new Mistral({ apiKey: config.apiKey });
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * @returns {string}
   */
  getProviderName() {
    return 'Mistral';
  }

  /**
   * Upload de fichiers vers l'API Mistral (purpose="ocr").
   * 
   * Les fichiers sont envoyés bruts à Mistral. L'API Mistral gère l'OCR/extraction.
   * Retourne simplement le file_id pour référence ultérieure.
   * 
   * @param {Array<{buffer: Buffer, originalname: string, size: number, mimetype?: string}>} files
   * @returns {Promise<Array<{name: string, size: number, file_id: string}>>}
   */
  async uploadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Aucun fichier fourni');
    }

    // Valider les formats
    DocumentExtractor.validateFile(files[0].buffer, files[0].originalname);

    const results = [];

    for (const file of files) {
      try {
        DocumentExtractor.validateFile(file.buffer, file.originalname);

        const uint8Array = new Uint8Array(file.buffer);

        const uploadedFile = await this.client.files.upload({
          file: {
            fileName: file.originalname,
            content: uint8Array,
          },
          purpose: 'ocr',
        });

        results.push({
          name: file.originalname,
          size: file.size,
          file_id: uploadedFile.id,
        });
      } catch (error) {
        console.error(`[MistralAdapter] Erreur upload ${file.originalname}:`, error.message);
        throw new Error(`Erreur upload ${file.originalname}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Extrait le texte d'un fichier uploadé via l'endpoint /v1/ocr.
   * Mistral utilise OCR pour extraire le contenu des PDF, DOCX, images, etc.
   * 
   * @param {string} fileId - ID du fichier chez Mistral
   * @returns {Promise<string>} Texte extrait du fichier
   */
  async extractTextFromFile(fileId) {
    try {
      console.log(`[MistralAdapter] Extracting text from file ${fileId} via OCR...`);
      
      const response = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: { fileId },
      });

      console.log(`[MistralAdapter] OCR Response:`, JSON.stringify(response, null, 2));

      if (!response) {
        throw new Error('Réponse OCR vide');
      }

      // Vérifier la structure de la réponse
      console.log(`[MistralAdapter] Response keys:`, Object.keys(response));
      console.log(`[MistralAdapter] Response.contents:`, response.contents);
      console.log(`[MistralAdapter] Response.pages:`, response.pages);

      // Essayer d'extraire le texte selon différents formats
      let extractedText = '';

      if (response.contents && Array.isArray(response.contents)) {
        // Format 1: Array de contenus
        extractedText = response.contents
          .map(c => {
            if (typeof c === 'string') return c;
            if (c?.text) return c.text;
            if (c?.content) return c.content;
            return JSON.stringify(c);
          })
          .filter(t => t && t.length > 0)
          .join('\n\n');
      } else if (response.contents && typeof response.contents === 'string') {
        // Format 2: String direct
        extractedText = response.contents;
      } else if (response.pages && Array.isArray(response.pages)) {
        // Format 3: Pages array
        extractedText = response.pages
          .map((p, i) => {
            if (typeof p === 'string') return p;
            if (p?.content) return p.content;
            if (p?.text) return p.text;
            return `[Page ${i + 1}] ${JSON.stringify(p)}`;
          })
          .join('\n\n');
      } else if (typeof response === 'string') {
        // Format 4: Response est une string brute
        extractedText = response;
      } else {
        // Format 5: Essayer d'extraire n'importe quoi
        console.warn(`[MistralAdapter] Unknown response format, trying to stringify...`);
        extractedText = JSON.stringify(response);
      }

      if (!extractedText || extractedText.length === 0) {
        console.warn(`[MistralAdapter] No text extracted from OCR response`);
        throw new Error('Le fichier n\'a pu être traité par OCR - peut-être un format non supporté ou un fichier corrompu');
      }

      console.log(`[MistralAdapter] Text extracted: ${extractedText.length} characters`);
      return extractedText;
    } catch (error) {
      console.error(`[MistralAdapter] Erreur extraction OCR ${fileId}:`, error.message);
      console.error(`[MistralAdapter] Error details:`, error);
      throw new Error(`Erreur OCR: ${error.message}`);
    }
  }

  /**
   * Récupère et télécharge le contenu d'un fichier uploadé.
   * Convertit le contenu en string texte exploitable.
   * 
   * @param {string} fileId - ID du fichier chez Mistral
   * @returns {Promise<string>} Contenu du fichier en texte
   */
  async downloadFile(fileId) {
    try {
      const content = await this.client.files.download({ fileId });
      
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

      return String(content);
    } catch (error) {
      console.error('[MistralAdapter] Erreur download:', error.message);
      throw new Error(`Erreur download fichier: ${error.message}`);
    }
  }

  /**
   * Envoie une requête de chat à Mistral.
   * 
   * Si des file_ids sont présents :
   * 1. Extraire le texte via /v1/ocr
   * 2. Inclure le texte dans le contexte du message utilisateur
   * 
   * @param {import('./BaseAdapter.js').ChatRequest} request
   * @returns {Promise<import('./BaseAdapter.js').StandardizedResponse>}
   */
  async sendChatRequest(request) {
    const { messages, file_ids = [], model } = request;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Le tableau messages est requis et ne peut pas être vide');
    }

    // Transformation des messages au format Mistral
    let mistralMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Si des fichiers sont attachés, extraire le texte via OCR et inclure dans le message
    if (file_ids && file_ids.length > 0) {
      let documentContext = '\n\n--- DOCUMENTS ATTACHÉS ---\n';
      let filesProcessed = 0;

      for (const fileId of file_ids) {
        try {
          const extractedText = await this.extractTextFromFile(fileId);
          
          const truncated = extractedText.length > 5000 
            ? extractedText.slice(0, 5000) + '\n[... contenu tronqué ...]'
            : extractedText;
          
          documentContext += `\n[Fichier: ${fileId}]\n${truncated}\n`;
          filesProcessed++;

          try {
            await this.deleteFile(fileId);
          } catch (deleteError) {
            // Ignorer les erreurs de suppression
          }
        } catch (error) {
          console.error('[MistralAdapter] Erreur traitement fichier:', error.message);
          documentContext += `\n[Fichier: ${fileId}] - Erreur d'extraction\n`;
        }
      }

      // Ajouter le contenu des fichiers au dernier message utilisateur
      if (mistralMessages.length > 0) {
        const lastIdx = mistralMessages.length - 1;
        if (mistralMessages[lastIdx].role === 'user') {
          mistralMessages[lastIdx].content += documentContext;
        }
      }
    }

    try {
      // Appel à l'API Mistral
      const response = await this.client.chat.complete({
        model: model || 'mistral-large-latest',
        messages: mistralMessages,
        maxTokens: this.maxTokens,
      });

      // Extraction de la réponse
      const choice = response?.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('Réponse Mistral invalide ou vide');
      }

      const content = choice.message.content ?? '';
      const usage = response.usage ?? null;

      // Transformation en format standardisé
      return {
        content: content,
        usage: usage ? {
          total_tokens: usage.totalTokens ?? 0,
          prompt_tokens: usage.promptTokens ?? 0,
          completion_tokens: usage.completionTokens ?? 0,
        } : null,
        tokensUsed: usage?.totalTokens ?? 0
      };
    } catch (error) {
      console.error('[MistralAdapter] Erreur lors de l\'appel API:', error);
      
      // Gestion des erreurs spécifiques
      if (error?.status === 401) {
        throw new Error('Clé API Mistral invalide ou manquante');
      }
      if (error?.status === 429) {
        throw new Error('Limite de taux API Mistral atteinte. Veuillez réessayer plus tard.');
      }
      if (error?.status === 400) {
        throw new Error('Requête invalide envoyée à Mistral: ' + (error?.message ?? 'erreur inconnue'));
      }
      
      throw new Error('Erreur Mistral: ' + (error?.message ?? 'erreur inconnue'));
    }
  }

  /**
   * Supprime un fichier uploadé chez Mistral pour libérer l'espace.
   * Appelé automatiquement après utilisation pour nettoyer.
   * 
   * @param {string} fileId - ID du fichier à supprimer
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      await this.client.files.delete({ fileId });
    } catch (error) {
      console.error('[MistralAdapter] Erreur suppression fichier:', error.message);
    }
  }

  /**
   * Supprime tous les fichiers stockés chez Mistral.
   * Utile pour nettoyer le stockage au démarrage de l'application.
   * 
   * @returns {Promise<{deleted: number, failed: number}>}
   */
  async deleteAllFiles() {
    try {
      const response = await this.client.files.list();
      const files = response?.data ?? [];
      
      if (files.length === 0) {
        return { deleted: 0, failed: 0 };
      }
      
      let deleted = 0;
      let failed = 0;
      
      for (const file of files) {
        try {
          await this.client.files.delete({ fileId: file.id });
          deleted++;
        } catch (error) {
          failed++;
        }
      }
      
      return { deleted, failed };
      
    } catch (error) {
      console.error('[MistralAdapter] Erreur nettoyage:', error.message);
      return { deleted: 0, failed: 0 };
    }
  }
}
