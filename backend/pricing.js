// backend/pricing.js

/**
 * Calcule le coût d'une requête en USD à partir de l'usage et du modèle.
 * - Supporte OpenAI (Chat Completions et Responses API) avec cache
 * - Supporte Mistral AI (tarification simplifiée)
 * - Les "cached input tokens" sont facturés à un tarif réduit distinct (OpenAI uniquement)
 */

const USD_PER_MILLION = (n) => Number(n) / 1_000_000;

// Barème par défaut (USD / 1M tokens)
const DEFAULT_PRICING = {
  // OpenAI models
  'gpt-5': {
    in: Number(process.env.PRICE_GPT5_IN ?? 1.25),      // $1.25 / 1M input
    cache: Number(process.env.PRICE_GPT5_CACHE ?? 0.125), // $0.125 / 1M cached input
    out: Number(process.env.PRICE_GPT5_OUT ?? 10.0),    // $10.00 / 1M output
  },
  'gpt-4o-mini': {
    in: Number(process.env.PRICE_4OMINI_IN ?? 0.15),      // $0.15 / 1M input
    cache: Number(process.env.PRICE_4OMINI_CACHE ?? 0.075), // $0.075 / 1M input
    out: Number(process.env.PRICE_4OMINI_OUT ?? 0.60),    // $0.60 / 1M output
  },
  // Mistral AI models (pricing page: https://mistral.ai/pricing#api)
  'mistral-small': {
    in: Number(process.env.PRICE_MISTRAL_SMALL_IN ?? 0.10),   // $0.10 / 1M input
    out: Number(process.env.PRICE_MISTRAL_SMALL_OUT ?? 0.30), // $0.30 / 1M output
  },
  'mistral-medium': {
    in: Number(process.env.PRICE_MISTRAL_MEDIUM_IN ?? 0.40),   // $0.40 / 1M input
    out: Number(process.env.PRICE_MISTRAL_MEDIUM_OUT ?? 2.00), // $2.00 / 1M output
  },
  'mistral-large': {
    in: Number(process.env.PRICE_MISTRAL_LARGE_IN ?? 0.50),   // $0.50 / 1M input
    out: Number(process.env.PRICE_MISTRAL_LARGE_OUT ?? 1.50), // $1.50 / 1M output
  },
};

// Résolution clé modèle dans le tableau de prix
function resolveModelKey(model) {
  const m = String(model ?? '').toLowerCase().trim();
  // OpenAI
  if (m.startsWith('gpt-5')) return 'gpt-5';
  if (m.startsWith('gpt-4o-mini')) return 'gpt-4o-mini';
  // Mistral
  if (m.includes('mistral-small') || m.includes('mistral-tiny')) return 'mistral-small';
  if (m.includes('mistral-medium')) return 'mistral-medium';
  if (m.includes('mistral-large')) return 'mistral-large';
  return null;
}

// Extraction robuste de l’usage (Chat Completions ou Responses)
function extractUsage(usage) {
  if (!usage) {
    return { input: 0, output: 0, cached: 0, nonCached: 0 };
  }

  // Responses API
  const inputR  = Number(usage.input_tokens ?? 0);
  const outputR = Number(usage.output_tokens ?? 0);
  const cachedR =
    Number(usage.input_tokens_details?.cached_tokens ??
           usage.input_token_details?.cached_tokens ?? 0);

  // Chat Completions (legacy/actuel)
  const inputC  = Number(usage.prompt_tokens ?? 0);
  const outputC = Number(usage.completion_tokens ?? 0);
  const cachedC =
    Number(usage.prompt_tokens_details?.cached_tokens ??
           usage.input_tokens_details?.cached_tokens ??
           usage.input_token_details?.cached_tokens ?? 0);

  // Priorité aux champs Responses si présents, sinon Chat
  const input  = inputR  || inputC  || 0;
  const output = outputR || outputC || 0;
  const cached = cachedR || cachedC || 0;

  const cachedClamped = Math.max(0, Math.min(cached, input));
  const nonCached = Math.max(0, input - cachedClamped);

  return { input, output, cached: cachedClamped, nonCached };
}

/**
 * Calcule et retourne un nombre (USD).
 * Supporte à la fois OpenAI et Mistral.
 * @param {{...}} usage - objet renvoyé par l'API (OpenAI ou Mistral)
 * @param {string} model - ex: 'gpt-5' | 'gpt-4o-mini' | 'mistral-small' | etc.
 * @returns {number} coût total en USD (arrondi à 1e-6)
 */
export function computeCostFromUsage(usage, model) {
  const key = resolveModelKey(model);
  if (!key) {
    return 0;
  }
  const prices = DEFAULT_PRICING[key];

  const { input, output, cached, nonCached } = extractUsage(usage);

  // OpenAI avec cache
  if (prices.cache !== undefined) {
    const inputCost  = USD_PER_MILLION(prices.in)    * nonCached;
    const cachedCost = USD_PER_MILLION(prices.cache) * cached;
    const outputCost = USD_PER_MILLION(prices.out)   * output;
    const total = inputCost + cachedCost + outputCost;
    return Number(total.toFixed(6));
  }

  // Mistral (pas de cache)
  const inputCost  = USD_PER_MILLION(prices.in)  * input;
  const outputCost = USD_PER_MILLION(prices.out) * output;
  const total = inputCost + outputCost;
  return Number(total.toFixed(6)); // arrondi à 0.000001 USD
}
