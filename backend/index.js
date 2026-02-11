// backend/index.js
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import multer from 'multer';
import { MAX_FILES } from '../frontend/src/config.ts';
import { ChatService } from './services/ChatService.js';

if (process.env.DOTENV_CONFIG_PATH) {
  config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  config();
}

const app = express();
const port = Number(process.env.PORT ?? 3000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: MAX_FILES },
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Configuration du ChatService avec le provider Mistral
const chatService = new ChatService({
  provider: 'mistral',
  providerConfig: {
    apiKey: process.env.MISTRAL_API_KEY,
    maxTokens: Number(process.env.MAX_OUTPUT_TOKENS ?? 4096),
  },
  costLimit: 2.0,
});

/* -------------------------------------------------------------------------- */
/*                                   UPLOAD                                    */
/* -------------------------------------------------------------------------- */
/**
 * Route pour uploader des fichiers (documents) vers l'API Mistral.
 * 
 * Retourne un tableau avec:
 * - file_id: ID du fichier chez Mistral
 * - name: Nom du fichier
 * - size: Taille en bytes
 */
app.post('/api/files', upload.array('files', MAX_FILES), async (req, res) => {
  try {
    console.log(`[Upload] POST /api/files`);
    console.log(`[Upload] Headers:`, req.headers);
    console.log(`[Upload] Body keys:`, Object.keys(req.body));
    console.log(`[Upload] Files count:`, req.files?.length ?? 0);
    console.log(`[Upload] Files:`, req.files?.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })));

    if (!req.files || req.files.length === 0) {
      console.warn('[Upload] No files in request - returning 400');
      return res.status(400).json({
        error: 'NoFiles',
        message: 'Aucun fichier fourni'
      });
    }

    console.log(`[Upload] Calling chatService.uploadFiles with ${req.files.length} file(s)`);

    // Utiliser le ChatService pour uploader les fichiers via l'adapter Mistral
    const uploadResults = await chatService.uploadFiles(req.files);

    console.log(`[Upload] Success: ${uploadResults.length} file(s) uploaded`);

    return res.json({
      success: true,
      files: uploadResults
    });
  } catch (err) {
    const status = Number(err?.status ?? err?.statusCode ?? 400);
    const message = String(err?.message ?? 'Erreur lors de l\'upload');
    console.error('[Upload Error]', { message, errorString: err?.toString(), statusCode: status });
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      error: 'UploadError',
      message,
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                                   DOWNLOAD                                  */
/* -------------------------------------------------------------------------- */
/**
 * Route pour télécharger le contenu d'un fichier uploadé.
 * DEPRECATED: Le backend utilise maintenant /v1/ocr pour extraire le texte.
 * Cette route reste pour compatibility mais n'est plus utilisée.
 */
app.get('/api/files/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        error: 'MissingFileId',
        message: 'ID du fichier requis'
      });
    }

    // Télécharger le fichier depuis Mistral
    const content = await chatService.downloadFile(fileId);

    // Retourner en tant que texte brut
    res.type('text/plain');
    res.send(content);
  } catch (err) {
    const status = Number(err?.status ?? err?.statusCode ?? 400);
    const message = String(err?.message ?? 'Erreur lors du téléchargement');
    console.error('[Download Error]', { message, err });
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      error: 'DownloadError',
      message,
    });
  }
});

/* -------------------------------------------------------------------------- */

/**
 * Gère une requête de chat via le ChatService.
 * 
 * Supporte:
 * - Messages textuels simples ou historique complet
 * - Fichiers attachés (documents uploadés)
 * - Incluersion du contenu des documents dans le contexte du chat
 */
async function handleChatRequest(req, res, model) {
  try {
    // Le ChatService gère tout : vérification limite, normalisation, appel adapter, calcul coût
    // On passe les documentContents si présents dans la requête
    const response = await chatService.processChatRequest(req.body, model);
    return res.json(response);
  } catch (err) {
    const status = Number(err?.status ?? err?.statusCode ?? 500);
    const message = String(err?.message ?? `Erreur serveur (${model})`);
    console.error('[Chat Error]', { message, err });
    return res
      .status(status >= 400 && status <= 599 ? status : 500)
      .json({ 
        error: 'ChatError', 
        message, 
        detail: err?.response?.data 
      });
  }
}

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                    */
/* -------------------------------------------------------------------------- */

// Route unique pour Mistral - plus de distinction de modèles
app.post('/api/chat', (req, res) => handleChatRequest(req, res, 'mistral-large-latest'));

app.listen(port, async () => {
  console.log(`[Mistral Config] keySuffix=${process.env.MISTRAL_API_KEY?.slice(-6) || 'none'}`);
  console.log(`Backend listening at http://localhost:${port}`);
  
  // Test de connexion à la base de données
  try {
    const { connectDB } = await import('./db.ts');
    await connectDB();
  } catch (error) {
    console.error('⚠️  Erreur lors de la connexion à la base de données:', error.message);
  }
  
  // Nettoyage des fichiers au démarrage
  try {
    console.log('\n🧹 Nettoyage des fichiers Mistral au démarrage...');
    const result = await chatService.deleteAllFiles();
    console.log(`✅ Nettoyage terminé: ${result.deleted} fichier(s) supprimé(s)\n`);
  } catch (error) {
    console.warn('⚠️  Erreur lors du nettoyage des fichiers:', error.message);
  }
});