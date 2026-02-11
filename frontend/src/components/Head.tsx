// src/components/Head.tsx
import './Head.css';

type Props = {
    flags: {
        canUseApp: boolean;
        canImportFiles: boolean;
    };
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export default function Head({
    flags,
    theme,
    onToggleTheme
}: Props) {
    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <img src="../public/assets/logo.png" alt="Logo entreprise" className="company-logo" />
                    <div className="header-text">
                        <h1>Chatbot Fid'Ouest</h1>
                        <span className="header-subtitle">Propulsé par Mistral AI</span>
                    </div>
                </div>

                <div className='buttons-right'>
                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={onToggleTheme}
                        aria-label={`Basculer en mode ${theme === 'dark' ? 'clair' : 'sombre'}`}
                        title={`Mode ${theme === 'dark' ? 'clair' : 'sombre'}`}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>
        </header>
    );
}