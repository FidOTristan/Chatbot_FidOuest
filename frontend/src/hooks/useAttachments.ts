// src/hooks/useAttachments.ts
import { useState } from 'react';
import type { FileTokenAttachment } from '../types';
import { MAX_FILES } from '../config';

declare global {
  interface Window {
    fileAPI?: {
      openMany(): Promise<Array<{ token: string; name: string; size: number }> | null>;
      uploadByTokens(tokens: string[], backendUrl?: string): Promise<Array<{ token: string; file_id: string }>>;
    };
  }
}

export function useAttachments(onLargeOrError?: (detail?: string) => void) {
  const [attachments, setAttachments] = useState<FileTokenAttachment[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const addFromDialog = async () => {
    try {
      const list = await window.fileAPI?.openMany();
      if (!list || !Array.isArray(list)) return;

      const limited = list.slice(0, MAX_FILES);
      if (!limited.length) {
        onLargeOrError?.('Aucun fichier valide sélectionné.');
        return;
      }

      // Déduplication + limite MAX_FILES
      const map = new Map<string, FileTokenAttachment>();
      [...attachments, ...limited].forEach(f => {
        const key = `${f.name}:${f.size}:${f.token}`;
        if (!map.has(key)) map.set(key, { ...f });
      });
      let merged = Array.from(map.values());
      if (merged.length > MAX_FILES) {
        merged = merged.slice(0, MAX_FILES);
        onLargeOrError?.(`Tu peux joindre au maximum ${MAX_FILES} fichiers.`);
      }

      setAttachments(merged);
      if (merged.length) setSelectedIdx(merged.length - 1);
    } catch (e: any) {
      onLargeOrError?.(e?.message ?? 'Erreur lors de la sélection de fichiers');
    }
  };

  const removeSelected = () => {
    setAttachments(prev => {
      if (!prev.length) return prev;
      const next = prev.filter((_, i) => i !== selectedIdx);
      setSelectedIdx(Math.min(selectedIdx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const clearAttachments = () => {
    setAttachments([]);
    setSelectedIdx(0);
  };

  return {
    attachments,
    selectedIdx,
    setSelectedIdx,
    addFromDialog,
    removeSelected,
    clearAttachments,
  };
}
