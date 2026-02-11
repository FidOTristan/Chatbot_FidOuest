// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import './App.css';
import ChatList from './components/ChatList';
import Composer from './components/Composer';
import Head from './components/Head';
import Filtre from './components/Filtre'
import Warning from './components/Warning'
import { useAttachments } from './hooks/useAttachments';
import type { Message } from './types';
import { history } from './services/history';
import { buildMessagesForLLM } from './services/context';
import { chat } from './api';
import type { Flags } from './types'
import type { FiltreContext } from './types';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Gestion des fichiers uploadés
  const [uploadedFiles, setUploadedFiles] = useState<{ 
    [file_id: string]: { name: string; content: string } 
  }>({});

  // Filtre
  const [filtre, setFiltre] = useState<FiltreContext | null>(null);

  // Récupération des permissions
  const [flags, setFlags] = useState<Flags | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Thème
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'light' || saved === 'dark') return saved;
    // fallback : détection OS
    const prefersDark = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  // Permissions
  useEffect(() => {
      window.permissions
        .get()
        .then((f) => {
          setFlags(f);
        })
        .catch((e) => setError('Impossible de récupérer les droits.'));
    }, []);

  console.log(flags)

  // Thème
  // Applique l'attribut data-theme sur <html> et persiste
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  // Passe une fonction qui accepte un message de détail
  const {
    attachments,
    selectedIdx,
    setSelectedIdx,
    addFromDialog,
    removeSelected,
    clearAttachments,
  } = useAttachments(pushAttachmentError);

  const endRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  // ✅ Affiche les messages détaillés transmis par useAttachments (fallback générique)
  function pushAttachmentError(detail?: string) {
    const msg = detail && String(detail).trim().length > 0
      ? `❌ ${detail}`
      : '❌ Fichier trop volumineux';
    setMessages(prev => [...prev, { sender: 'assistant', text: msg }]);
    scrollToBottom(true);
  }

  const copyToClipboard = async (text: string, idx: number) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // UI: ajouter message utilisateur
    const newMessages: Message[] = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollToBottom(false);

    try {
      history.add('user', trimmed);

      let file_ids: string[] = [];

      // Uploader les fichiers attachés
      if (attachments && attachments.length > 0) {
        try {
          const tokens = attachments.map(a => a.token);
          console.log(`[App] Uploading ${tokens.length} fichier(s)...`);
          
          // Utiliser l'API fileAPI pour uploader les fichiers
          if (window.fileAPI?.uploadByTokens) {
            const results = await window.fileAPI.uploadByTokens(tokens);
            file_ids = results.map(r => r.file_id);
            console.log(`[App] Upload successful: ${file_ids.join(', ')}`);
          } else {
            console.warn('[App] fileAPI.uploadByTokens not available');
          }
        } catch (uploadErr: any) {
          const msg = uploadErr?.message ?? 'Erreur lors de l\'upload des fichiers';
          setMessages(prev => [...prev, { sender: 'assistant', text: `❌ ${msg}` }]);
          scrollToBottom(true);
          setLoading(false);
          return;
        }
      }

      // Construire le payload avec les file_ids
      const payload = buildMessagesForLLM(file_ids, filtre);

      // Appel backend Mistral
      const data = await chat(payload);

      // Limite
      if (data.limitReached) {
        setMessages((prev) => [...prev, { sender: 'assistant', text: '🔴 Limite atteinte — impossibilité d’envoyer de nouveaux messages.' }]);
        return;
      }

      const assistantMessage = data?.content ?? 'Réponse vide';
      const tokensUsed: number | undefined =
        data?.usage?.total_tokens ?? data?.usage?.completion_tokens ?? undefined;

      const cost: number | undefined =
        typeof (data as any)?.cost === 'number' ? (data as any).cost : undefined;

      setMessages([...newMessages, { sender: 'assistant', text: assistantMessage, tokens: tokensUsed, cost: cost }]);
      scrollToBottom(true);
      history.add('assistant', assistantMessage);
      
      // Nettoyer les fichiers après envoi
      clearAttachments();
    } catch (err: any) {
      const networkMsg =
        err?.name === 'TypeError'
          ? 'Problème réseau ou serveur injoignable.'
          : String(err?.message ?? err);
      setMessages([...newMessages, { sender: 'assistant', text: `❌ ${networkMsg}` }]);
      scrollToBottom(true);
    } finally {
      setLoading(false);
    }
  };

  // Erreurs
  if (error) return <div style={{ padding: 24, color: 'crimson' }}>{error}</div>;
  if (!flags) return <div style={{ padding: 24 }}>Chargement…</div>;

  // Si l'uilisateur n'a pas le droit d'utiliser l'application
  if (!flags.canUseApp) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Accès refusé</h2>
        <p>Votre compte ne dispose pas des droits pour utiliser cette application.</p>
      </div>
    );
  }

  // Si il peut utiliser l'application
  return (
    <div className="app">
      <Head
        flags={flags}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <Warning />

      <ChatList
        messages={messages}
        copiedIndex={copiedIndex}
        onCopy={copyToClipboard}
        endRef={endRef}
      />

      <Filtre
        onChange={setFiltre}
        disabled={loading}
      />

      <Composer
        input={input}
        setInput={setInput}
        loading={loading}
        onSend={sendMessage}
        attachments={attachments}
        selectedIdx={selectedIdx}
        setSelectedIdx={setSelectedIdx}
        onAttachClick={addFromDialog}
        onRemoveSelected={removeSelected}
        flags={flags}
      />
    </div>
  );
}

export default App;
