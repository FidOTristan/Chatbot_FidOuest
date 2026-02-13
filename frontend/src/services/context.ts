// src/services/context.ts
import { HISTORY_WINDOW, SYSTEM_PROMPT } from '../config';
import { history } from './history';
import type { FiltreContext } from '../types';

/** Messages envoyés au backend */
export type OpenAIMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Payload final pour le backend : messages + file_ids */
export type ChatPayload = {
  messages: OpenAIMessage[];
  file_ids: string[];
};

/**
 * Construit un bloc de consignes lisible à partir du filtre.
 * Structure stable, vocabulaire "prompt-friendly" et contraintes utiles.
 */
function formatPromptFromFiltre(f: FiltreContext | null): string | null {
  if (!f) return null;

  const longueur = f.longueur;
  const format = f.format;
  const domaine = f.domaine;
  const contexte = f.contexte ?? ''.trim();

  const lignes: string[] = [
    '[Instruction de rédaction]',
    'Réponse attendue :',
    `- Longueur : ${longueur}`,
    `- Format : ${format}`,
    `- Domaine : ${domaine}`,
  ];

  if (contexte) {
    lignes.push(`- Contexte : ${contexte}`);
  }

  return lignes.join('\n');
}

/**
 * Construit le payload pour le backend :
 * - 1er message : 'system' (SYSTEM_PROMPT)
 * - 2e message optionnel : 'system' (bloc "Instruction de rédaction" issu du filtre)
 * - Puis les HISTORY_WINDOW derniers messages (user/assistant) depuis l'historique
 * - Inclus les file_ids s'il y en a
 */
export function buildMessagesForLLM(
  fileIds: string[] = [],
  filtre: FiltreContext | null,
  contentArray?: any[]
): ChatPayload {
  // Récupère les N derniers messages de l'historique
  let last = history.getLast(HISTORY_WINDOW);

  const messages: OpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Ajout des consignes dynamiques liées au filtre (si présent)
  const instruction = formatPromptFromFiltre(filtre);
  if (instruction) {
    messages.push({ role: 'system', content: instruction });
  }

  // Historique de conversation
  messages.push(
    ...last.map<OpenAIMessage>((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))
  );

  return { 
    messages,
    file_ids: fileIds
  };
}