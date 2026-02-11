# Support des Documents avec Mistral

## Overview

Le chatbot supporte maintenant l'upload de documents (PDF, DOCX, TXT) vers l'API Mistral Files.

Les fichiers sont uploadés bruts vers Mistral, qui gère l'OCR/extraction de contenu nativement.

## Architecture

### Flux Simple

```
1. Frontend: Utilisateur sélectionne des fichiers via le dialog Electron
   |
   v
2. Frontend: Envoie les fichiers au backend via POST /api/files
   |
   v
3. Backend: Valide le format du fichier
   |
   v
4. Backend: MistralAdapter.uploadFiles() upload vers Mistral (purpose="ocr")
   |
   v
5. Backend: Retourne file_id au frontend
   |
   v
6. Frontend: Stocke file_id localement
   |
   v
7. Frontend: Envoie chat request avec file_ids
   |
   v
8. Backend: Passe file_ids au chat (usage futur)
```

## Composants Clés

### Backend

**`DocumentExtractor.js`** - Validation des formats
- Supporte: PDF, DOCX, DOC, TXT
- Valide les fichiers vides
- Valide les formats supportés

**`MistralAdapter.uploadFiles()`** - Upload vers Mistral
- Appelle: `mistral.files.upload()` avec purpose="ocr"
- Upload le fichier brut (pas d'extraction locale)
- Retourne: file_id, name, size

**`MistralAdapter.sendChatRequest()`** - Chat simple
- Accepte: file_ids[] (pour future intégration)
- Note: Mistral n'a pas encore de support files-in-chat comme OpenAI
- Les file_ids sont stockés mais non encore utilisés dans le message

**`/api/files`** - Route d'upload
- POST avec FormData multipart
- Retourne: { success, files: [{file_id, name, size}] }

**`/api/chat`** - Route de chat
- Accepte: messages[], file_ids[]
- Passe file_ids à l'adapter (pour usage futur)

### Frontend

**`useAttachments.ts`** - Gestion des attachments
- Récupère les fichiers via `window.fileAPI.openMany()`
- Déduplique, valide taille max
- Retourne: attachments[], selectedIdx, clearAttachments()

**`api.ts`** - Fonctions HTTP
- `uploadFiles(FormData)` → `/api/files`
- `chat(ChatPayload)` → `/api/chat`

**`App.tsx`** - Logique principale
- État: uploadedFileIds = []
- sendMessage(): 
  1. Crée payload avec file_ids
  2. Envoie au chat

**`context.ts`** - Construction du payload
- buildMessagesForLLM(fileIds[], filtre)
- Retourne: { messages, file_ids }

## Fichiers Modifiés

### Backend
- `backend/adapters/MistralAdapter.js` - Upload brut vers Mistral
- `backend/services/DocumentExtractor.js` - Validation uniquement
- `backend/services/ChatService.js` - Passe file_ids (simple)
- `backend/index.js` - Route /api/files

### Frontend
- `frontend/src/App.tsx` - Gère uploadedFileIds simple
- `frontend/src/api.ts` - uploadFiles() retourne file_ids uniquement
- `frontend/src/services/context.ts` - Type ChatPayload simplifié

## Configuration requises

Aucune dépendance locale d'extraction! Les packages pdf-parse et mammoth ne sont plus utilisés.

## Limites Actuelles

1. **Chat avec documents**: Pas encore supporté
   - Mistral n'a pas d'API native pour inclure files dans le chat
   - Solution future: utiliser Document AI ou vision API si disponible
   - Pour l'instant: fichiers stockés via Files API mais pas utilisés dans le chat

2. **Formats supportés**: PDF, DOCX, DOC, TXT seulement
   - Extensions: .pdf, .docx, .doc, .txt
   - Les autres formats échouent avec message d'erreur clair

3. **Nombre de fichiers**: MAX_FILES (voir config.ts)
   - Frontend limite d'abord
   - Backend limite aussi en sécurité

4. **Stockage**: Fichiers stockés seulement en mémoire côté frontend
   - Pas de persistence localStorage pour les file_ids
   - Perdus après refresh

5. **Taille**: Limite à 512 MB par fichier (limite Mistral)

## Usage dans l'App

```typescript
// Dans sendMessage (App.tsx)
let file_ids: string[] = [];

// Uploader les fichiers (à implémenter: Electron fileAPI integration)
if (attachments && attachments.length > 0) {
  // À implémenter: convertir attachments en FormData
  // const fd = new FormData();
  // for (const att of attachments) { fd.append('files', blob); }
  // const res = await uploadFiles(fd);
  // file_ids = res.files.map(f => f.file_id);
}

// Envoyer le chat avec file_ids
const payload = buildMessagesForLLM(file_ids, filtre);
const data = await chat(payload);
```

## Prochaines Étapes

1. **Intégration Electron fileAPI**
   - Convertir tokens en Buffer/Blob
   - Implémente uploadFiles() dans App.tsx

2. **Chat avec documents**
   - Vérifier si Mistral ajoute support files-in-chat
   - Ou utiliser Document AI si disponible
   - Ou implémenter extraction backend et inclusion dans contexte

3. **Gestion des fichiers**
   - Interface pour lister/supprimer les fichiers uploadés
   - Persistance des file_ids par session

4. **Performance**
   - Streaming pour gros fichiers
   - Upload progressif avec feedback

## Testing

1. Télécharger un PDF/DOCX/TXT
2. Cliquer sur 📎 dans le Composer
3. Sélectionner le fichier du dialog Electron
4. Le fichier apparaît dans le select des pièces jointes
5. Backend reçoit POST /api/files
6. Mistral retourne file_id
7. file_id retourné au frontend
8. Envoyer un message (fichier stocké pour usage futur)

## Dépannage

**Erreur "Format non supporté"**
- Vérifier que le fichier est PDF, DOCX, DOC ou TXT
- Vérifier l'extension du fichier

**Erreur "Fichier vide"**
- Le fichier est vide (0 bytes)
- Essayer avec un fichier contenant du contenu

**Les fichiers n'apparaissent pas dans le select**
- Vérifier que flags.canImportFiles === true
- Vérifier permissions.get() retourne canImportFiles: true

**File upload échoue**
- Vérifier MISTRAL_API_KEY dans .env
- Vérifier la connexion réseau
- Vérifier la taille du fichier (< 512 MB)
