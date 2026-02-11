// src/components/Warning.tsx
import React from 'react';
import './Warning.css';

export default function Warning() {
  return (
    <div className="warning-banner">
      <p>
        ⚠️ Confidentialité : veillez à anonymiser toutes les données fournies à l'IA, vérifiez systématiquement les sources, gardez un esprit critique et n'utilisez l'IA que dans un cadre professionnel.
      </p>
    </div>
  );
}