// backend/services/DocumentExtractor.js

/**
 * Upload brut de documents vers l'API Mistral
 * (sans extraction locale du texte - Mistral gère l'OCR)
 */
export class DocumentExtractor {
  /**
   * Filtre les documents supportés par l'API OCR de Mistral
   * 
   * @param {string} originalname - Nom du fichier
   * @param {string} mimetype - Type MIME
   * @returns {boolean} true si le fichier est supporté
   */
  static isSupportedFormat(originalname, mimetype) {
    const filename = originalname.toLowerCase();
    
    // Formats supportés par Mistral OCR: PDF, DOCX, images
    // Note: .txt n'est PAS supporté par Mistral OCR (text/plain rejeté)
    return (
      filename.endsWith('.pdf') ||
      filename.endsWith('.docx') ||
      filename.endsWith('.png') ||
      filename.endsWith('.jpg') ||
      filename.endsWith('.jpeg') ||
      filename.endsWith('.webp') ||
      mimetype?.includes('pdf') ||
      mimetype?.includes('wordprocessingml') ||
      mimetype?.includes('vnd.openxmlformats') ||
      mimetype?.startsWith('image/')
    );
  }

  /**
   * Validation basique du fichier
   * 
   * @param {Buffer} buffer
   * @param {string} originalname
   * @returns {void} Lance une erreur si invalide
   */
  static validateFile(buffer, originalname) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Fichier vide');
    }

    if (!this.isSupportedFormat(originalname, '')) {
      throw new Error(
        `Format non supporté: ${originalname}. ` +
        'Formats acceptés: PDF, DOCX, PNG, JPG, JPEG, WEBP'
      );
    }
  }
}

