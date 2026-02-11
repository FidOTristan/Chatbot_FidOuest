# Architecture Backend - Pattern Adapter

## Vue d'ensemble

Le backend utilise le **Pattern Adapter** pour permettre une intégration flexible de différents fournisseurs d'IA (ChatGPT, Mistral, etc.) tout en maintenant une interface cohérente pour le frontend.

## Structure des fichiers

```
backend/
├── index.js                    # Point d'entrée, routes Express
├── adapters/                   # Adapters pour les fournisseurs d'IA
│   ├── BaseAdapter.js          # Interface abstraite de base
│   ├── ChatGPTAdapter.js       # Implémentation pour OpenAI
│   └── MistralAdapter.js       # Implémentation pour Mistral AI
├── services/
│   └── ChatService.js          # Orchestrateur principal
├── db.ts                       # Gestion base de données
├── pricing.js                  # Calcul des coûts
└── security/
    ├── identity.ts
    └── permissions.ts
```

## Flux de données

```
Frontend (api.ts)
    ↓
Express Routes (index.js)
    ↓
ChatService (orchestrateur)
    ↓
BaseAdapter (interface)
    ↓
ChatGPTAdapter ou MistralAdapter (implémentation)
    ↓
API externe (OpenAI, Mistral, etc.)
```

## Composants principaux

### 1. BaseAdapter (Interface)

**Fichier**: `backend/adapters/BaseAdapter.js`

Classe abstraite définissant le contrat que tous les adapters doivent respecter :

```javascript
class BaseAdapter {
  async sendChatRequest(request)  // Envoie une requête de chat
  async uploadFiles(files)         // Upload des fichiers
  async deleteFile(fileId)         // Supprime un fichier
  getProviderName()                // Retourne le nom du provider
}
```

**Format standardisé** :
- `StandardizedMessage`: `{ role: 'user'|'assistant', content: string }`
- `StandardizedResponse`: `{ content: string, usage: object, tokensUsed: number }`
- `ChatRequest`: `{ messages: [], file_ids: [], model: string }`

### 2. ChatGPTAdapter

**Fichier**: `backend/adapters/ChatGPTAdapter.js`

Implémentation concrète pour l'API OpenAI :
- Gère automatiquement la décision entre Chat Completions (PDF) et Responses API (non-PDF)
- Maintient un cache des métadonnées de fichiers
- Crée et nettoie automatiquement les Vector Stores
- Transforme les réponses OpenAI en format standardisé

**Particularités** :
- Détection automatique du type de fichier (PDF vs non-PDF)
- Choix intelligent de l'API à utiliser (Chat Completions vs Responses)
- Gestion complète du cycle de vie des Vector Stores

### 3. ChatService (Orchestrateur)

**Fichier**: `backend/services/ChatService.js`

Service principal qui :
- Reçoit les requêtes du frontend (format libre)
- Normalise les données en format standardisé
- Vérifie les limites de coût utilisateur
- Délègue au bon adapter selon la configuration
- Calcule et enregistre les coûts en base de données
- Retourne une réponse dans un format constant

**Responsabilités** :
- Gestion du cycle de vie des requêtes
- Normalisation des formats de messages
- Orchestration entre adapters et base de données
- Calcul et tracking des coûts

### 4. Routes Express (index.js)

**Fichier**: `backend/index.js`

Point d'entrée simplifié qui :
- Configure le ChatService au démarrage
- Expose les endpoints REST (`/api/chat`)
- Les fichiers ne sont pas supportés avec Mistral (route upload désactivée)
- Délègue toute la logique au ChatService

## Format de communication

### Requête du frontend

```javascript
{
  messages: [                    // OU prompt: string (legacy)
    { role: 'user', content: '...' },
    { role: 'assistant', content: '...' }
  ],
  file_ids: ['file-xxx', 'file-yyy'],  // Optionnel (OpenAI uniquement)
}
```

### Réponse vers le frontend

```javascript
{
  content: "Réponse de l'IA",
  usage: {
    total_tokens: 150,
    prompt_tokens: 50,
    completion_tokens: 100
  },
  cost: 0.002,
  limitReached: false
}
```

Ce format est **constant** quel que soit le provider utilisé.

## Ajout d'un nouveau provider (ex: Mistral)

Pour ajouter Mistral :

1. **Créer l'adapter** : `backend/adapters/MistralAdapter.js`
   ```javascript
   import { BaseAdapter } from './BaseAdapter.js';
   
   export class MistralAdapter extends BaseAdapter {
     async sendChatRequest(request) {
       // Logique spécifique Mistral
       // Transformer la réponse en StandardizedResponse
     }
     
     async uploadFiles(files) { /* ... */ }
     async deleteFile(fileId) { /* ... */ }
     getProviderName() { return 'Mistral'; }
   }
   ```

2. **Enregistrer dans ChatService** :
   ```javascript
   // Dans ChatService._createAdapter()
   case 'mistral':
     return new MistralAdapter(providerConfig);
   ```

3. **Configurer au démarrage** :
   ```javascript
   // Dans index.js
   const chatService = new ChatService({
     provider: 'mistral',  // ou 'chatgpt'
     providerConfig: {
       apiKey: process.env.MISTRAL_API_KEY,
     },
   });
   ```

Le frontend n'a **aucune modification** à faire !

## Avantages de cette architecture

1. **Séparation des responsabilités** : Chaque composant a un rôle clair
2. **Facilité d'ajout de providers** : Un seul fichier adapter à créer
3. **Format constant** : Le frontend reçoit toujours la même structure
4. **Maintenabilité** : Code organisé et modulaire
5. **Testabilité** : Chaque composant peut être testé indépendamment
6. **Flexibilité** : Changement de provider sans modification du frontend

## Configuration

Le provider est configuré au démarrage dans `index.js` :

```javascript
const chatService = new ChatService({
  provider: process.env.AI_PROVIDER || 'mistral',
  providerConfig: {
    apiKey: process.env.MISTRAL_API_KEY,
    maxTokens: 4096,
  },
  costLimit: 2.0,
});
```

Variables d'environnement :
- `MISTRAL_API_KEY` : Clé API Mistral
- `MAX_OUTPUT_TOKENS` : Limite de tokens en sortie (défaut: 4096)
- `AI_PROVIDER` : Provider à utiliser (défaut: 'mistral')

## Mistral: API et pricing

### Usage API (chat)

- Le backend envoie des messages `{ role, content }` a l'API Mistral.
- L'appel principal est `client.chat.complete({ model, messages, maxTokens })`.
- La reponse est normalisee en `StandardizedResponse`.

### Calcul du cout

- Mistral facture separement les tokens d'entree et de sortie.
- Le calcul utilise `prompt_tokens` et `completion_tokens` (ou `input_tokens`/`output_tokens` si disponibles).
- La formule applique le prix par million de tokens, sans mecanisme de cache.
- Les tarifs sont definis dans `backend/pricing.js` et peuvent etre surcharges via variables d'environnement.
