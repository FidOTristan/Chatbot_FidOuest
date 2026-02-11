# Migration ChatGPT → Mistral AI

## Résumé des changements

L'application a été migrée de ChatGPT (OpenAI) vers Mistral AI. Voici les modifications principales :

### Backend

1. **Nouveau MistralAdapter** (`backend/adapters/MistralAdapter.js`)
   - Implémente l'interface `BaseAdapter` pour Mistral AI
   - Utilise le SDK officiel `@mistralai/mistralai`
   - ⚠️ **Pas de support pour les fichiers** : Mistral ne dispose pas d'une Files API comme OpenAI

2. **ChatService mis à jour** (`backend/services/ChatService.js`)
   - Supporte maintenant Mistral via le switch case dans `_createAdapter()`
   - Import du `MistralAdapter` ajouté

3. **Backend/index.js modifié**
   - Configuration changée de `chatgpt` à `mistral`
   - Variable d'environnement : `MISTRAL_API_KEY` au lieu de `OPENAI_API_KEY`
   - Route `/api/files` désactivée (retourne 501 Not Implemented)
   - Routes simplifiées : une seule route `/api/chat` au lieu de `/api/chat-gpt4` et `/api/chat-gpt5`
   - Utilise le modèle `mistral-small` par défaut

4. **Pricing.js étendu** (`backend/pricing.js`)
   - Ajout des tarifs Mistral (small, medium, large)
   - Support combiné OpenAI + Mistral
   - Pas de cache pour Mistral (tarification simplifiée)

### Frontend

1. **Head.tsx simplifié** (`frontend/src/components/Head.tsx`)
   - ✅ **Suppression du sélecteur de modèle GPT**
   - Titre mis à jour : "Chatbot Fid'Ouest (Mistral AI)"
   - Prop `setGpt` retirée

2. **App.tsx modifié** (`frontend/src/App.tsx`)
   - State `gpt` retiré
   - ✅ **Les pièces jointes sont désactivées** (`canImportFiles: false`)
   - Simplifié : plus d'upload de fichiers dans le flux
   - Appel API sans paramètre de modèle

3. **api.ts simplifié** (`frontend/src/api.ts`)
   - Fonction `chat()` ne prend plus le paramètre `gptModel`
   - Utilise uniquement `/api/chat`

### Dépendances

- ✅ Package `@mistralai/mistralai` installé

## Configuration requise

### 1. Créer un fichier `.env`

Copiez `.env.example` en `.env` et remplissez avec votre clé API Mistral :

```bash
MISTRAL_API_KEY=votre_cle_api_mistral
PORT=3000
MAX_OUTPUT_TOKENS=4096
```

### 2. Obtenir une clé API Mistral

1. Créez un compte sur [console.mistral.ai](https://console.mistral.ai/)
2. Allez dans "API Keys"
3. Créez une nouvelle clé API
4. Copiez-la dans votre `.env`

**Plan gratuit** : Mistral offre des crédits gratuits pour démarrer. Le plan gratuit permet d'utiliser les modèles avec des limitations de quota.

### 3. Modèle utilisé

Par défaut, l'application utilise **`mistral-small`** qui est :
- Le plus économique
- Adapté pour le plan gratuit
- Performant pour la majorité des cas d'usage

Pour changer de modèle, modifiez dans `backend/index.js` ligne ~110 :
```javascript
app.post('/api/chat', (req, res) => handleChatRequest(req, res, 'mistral-small'));
```

Modèles disponibles :
- `mistral-small` (recommandé pour débuter)
- `mistral-medium`
- `mistral-large`

## Limitations connues

### ❌ Pas de support pour les fichiers

Mistral ne supporte pas :
- L'upload de documents (PDF, TXT, etc.)
- La fonction `file_search` comme OpenAI
- Les pièces jointes dans les conversations

**Solution** : La fonctionnalité de pièces jointes a été désactivée dans l'interface. Si vous aviez des documents à consulter, vous devrez maintenant copier/coller leur contenu directement dans les messages.

### Alternatives futures

Si vous avez absolument besoin de documents :
1. **Option 1** : Utiliser un service de RAG (Retrieval Augmented Generation) externe
2. **Option 2** : Implémenter votre propre système de vectorisation (ex: avec Pinecone/Weaviate + OpenAI embeddings)
3. **Option 3** : Revenir à OpenAI pour les cas nécessitant des fichiers

## Tarification Mistral

Tarifs approximatifs (à vérifier sur docs.mistral.ai) :
- **mistral-small** : ~$0.20/M tokens input, ~$0.60/M tokens output
- **mistral-medium** : ~$0.70/M tokens input, ~$2.10/M tokens output
- **mistral-large** : ~$2.00/M tokens input, ~$6.00/M tokens output

Le plan gratuit inclut des crédits qui permettent plusieurs milliers de requêtes selon la longueur des messages.

## Tester la migration

1. Assurez-vous que `.env` contient votre `MISTRAL_API_KEY`
2. Lancez le backend : `npm run dev` (dans le dossier racine)
3. L'application devrait afficher "Chatbot Fid'Ouest (Mistral AI)" dans le header
4. Le sélecteur de modèle GPT n'est plus visible
5. Le bouton de pièces jointes (📎) n'est plus visible
6. Envoyez un message test pour vérifier la connexion à Mistral

## En cas de problème

### Erreur "Clé API invalide"
- Vérifiez que `MISTRAL_API_KEY` est bien dans le `.env`
- Vérifiez que la clé est valide sur console.mistral.ai
- Relancez le serveur après avoir modifié le `.env`

### Erreur "Limite de taux atteinte"
- Vous avez dépassé le quota du plan gratuit
- Attendez quelques minutes ou passez à un plan payant

### Erreur "Mistral ne supporte pas les pièces jointes"
- C'est normal, cette fonctionnalité n'est plus disponible
- Copiez/collez le contenu des documents directement dans vos messages

## Retour à ChatGPT (si nécessaire)

Si vous souhaitez revenir à ChatGPT :

1. Dans `backend/index.js`, changez :
   ```javascript
   provider: 'chatgpt',
   providerConfig: {
     apiKey: process.env.OPENAI_API_KEY,
     // ...
   ```

2. Rétablissez les routes :
   ```javascript
   app.post('/api/chat-gpt4', (req, res) => handleChatRequest(req, res, 'gpt-4o-mini'));
   ```

3. Dans le frontend, restaurez le sélecteur de modèle et la logique des fichiers

---

**Date de migration** : 9 février 2026
**État** : ✅ Migration terminée et fonctionnelle
