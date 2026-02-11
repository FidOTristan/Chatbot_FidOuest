// src/components/Filtre.tsx
import React, { useEffect, useId, useState } from 'react';
import type { FiltreContext } from '../types';
import './Filtre.css';

type Props = {
  /** Callback déclenché à chaque changement (sélecteurs ou champ de saisie) */
  onChange?: (ctx: FiltreContext) => void;
  /** Désactivation (ex: pendant un envoi) */
  disabled?: boolean;
};

const DEFAULTS: FiltreContext = {
  longueur: 'court',
  format: 'synthèse',
  domaine: 'comptable',
  contexte: '',
};

export default function Filtre({ onChange, disabled = false }: Props) {
  // ÉTAT INTERNE UNIQUEMENT (composant non contrôlé)
  const [state, setState] = useState<FiltreContext>(DEFAULTS);

  // Notifie le parent au premier rendu pour qu'il dispose d'une valeur initiale
  useEffect(() => {
    onChange?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const longueurId = useId();
  const formatId = useId();
  const domaineId = useId();
  const contexteId = useId();

  const setPart = <K extends keyof FiltreContext>(key: K, v: FiltreContext[K]) => {
    const next = { ...state, [key]: v };
    setState(next);
    onChange?.(next);
  };

  return (
    <div className="filtre-wrap">
        <div className="filtre"> 
        {/* Longueur */}
        <label htmlFor={longueurId} className="filtre-field">
            <span className="filtre-label">Longueur</span>
            <select
            id={longueurId}
            className="filtre-select"
            value={state.longueur}
            onChange={(e) => setPart('longueur', e.target.value as FiltreContext['longueur'])}
            disabled={disabled}
            aria-label="Longueur attendue"
            title="Longueur attendue du rendu"
            >
            <option value="court">Court</option>
            <option value="long">Long</option>
            </select>
        </label>

        {/* Format */}
        <label htmlFor={formatId} className="filtre-field">
            <span className="filtre-label">Format</span>
            <select
            id={formatId}
            className="filtre-select"
            value={state.format}
            onChange={(e) => setPart('format', e.target.value as FiltreContext['format'])}
            disabled={disabled}
            aria-label="Format attendu"
            title="Format attendu de la réponse"
            >
            <option value="mail">Mail</option>
            <option value="synthèse">Synthèse</option>
            </select>
        </label>

        {/* Domaine */}
        <label htmlFor={domaineId} className="filtre-field">
            <span className="filtre-label">Domaine</span>
            <select
            id={domaineId}
            className="filtre-select"
            value={state.domaine}
            onChange={(e) => setPart('domaine', e.target.value as FiltreContext['domaine'])}
            disabled={disabled}
            aria-label="Domaine de réponse"
            title="Domaine de réponse"
            >
            <option value="comptable">Comptable</option>
            <option value="social">Social</option>
            <option value="fiscale">Fiscale</option>
            <option value="juridique">Juridique</option>
            </select>
        </label>

        {/* Contexte libre */}
        <label htmlFor={contexteId} className="filtre-field filtre-field--grow">
            <span className="filtre-label">Contexte</span>
            <div className="filtre-input-wrap">
            <input
                id={contexteId}
                type="text"
                className="filtre-input"
                placeholder="Ex. typologie client, contraintes, ton, délais…"
                value={state.contexte}
                onChange={(e) => setPart('contexte', e.target.value)}
                disabled={disabled}
                aria-label="Contexte du prompt"
                title="Précisez des éléments utiles : type de client, urgence, ton attendu, etc."
            />
            </div>
        </label>
        </div>
    </div>
    );
}