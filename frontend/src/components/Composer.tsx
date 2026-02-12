// src/components/Composer.tsx
import React from 'react';
import type { FileTokenAttachment } from '../types';
import './Composer.css';

type Props = {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSend: () => void;

  // pièces jointes
  attachments: FileTokenAttachment[];
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
  onAttachClick: () => void;
  onRemoveSelected: () => void;

  // Permission
  flags: {
        canUseApp: boolean;

        canImportFiles: boolean;
    };
};

export default function Composer({
  input,
  setInput,
  loading,
  onSend,
  attachments,
  selectedIdx,
  setSelectedIdx,
  onAttachClick,
  onRemoveSelected,
  flags,
}: Props) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // éviter les conflits IME
    if ('isComposing' in e && (e as any).isComposing) return;
    if ((e.nativeEvent as any).isComposing) return;

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!loading) onSend();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    setInput(el.value);
  };

  return (
    <div className="composer-wrap">
      <div className="composer-bubble vertical">
        <textarea
          className="composer-input"
          placeholder="Écrivez votre message… (Ctrl + Entrée pour envoyer)"
          value={input}
          onChange={onInput}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        <div className="composer-actions">
          {/* Actions gauche : pièces jointes */}
          <div className="actions-left">

            {flags.canImportFiles &&
              <button className="attachments-btn" onClick={onAttachClick} disabled={loading} aria-label="Joindre des PDF">
                📎
              </button>
            }

            <div className="attachments-select-wrap" aria-live="polite">
              {attachments.length > 0 ? (
                <>
                  <select
                    className="attachments-select"
                    value={String(selectedIdx)}
                    onChange={(e) => setSelectedIdx(Number(e.target.value))}
                    title={`${attachments.length} fichier(s) joint(s)`}
                    disabled={loading}
                  >
                    {attachments.map((f, i) => (
                      <option key={`${f.name}:${f.size}:${i}`} value={String(i)}>
                        {f.name} — {Math.round(f.size / 1024)} Ko
                      </option>
                    ))}
                  </select>

                  <button className="icon-btn" onClick={onRemoveSelected} disabled={loading} aria-label="Retirer la pièce jointe sélectionnée">
                    ×
                  </button>
                </>
              ) : (
                <span className="attachments-spacer" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Centre (optionnel) */}
          <div className="actions-center" />

          {/* Actions droite : envoyer */}
          <div className="actions-right">
            <button className="icon-btn send" onClick={onSend} disabled={loading || !input.trim()} aria-label="Envoyer">
              ➤
            </button>
            {loading && <span className="spinner" aria-label="Chargement…" />}
          </div>
        </div>
      </div>
    </div>
  );
}