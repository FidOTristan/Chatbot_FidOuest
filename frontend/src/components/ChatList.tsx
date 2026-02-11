// src/components/ChatList.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import './ChatList.css';

type Props = {
  messages: Message[];
  copiedIndex: number | null;
  onCopy: (text: string, idx: number) => void;
  endRef?: React.Ref<HTMLDivElement>;
};

export default function ChatList({ messages, copiedIndex, onCopy, endRef }: Props) {
  return (
    <div className="chat-area">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.sender === 'assistant' ? 'flex-start' : 'flex-end',
          }}
        >
          <div className={`bubble ${msg.sender}`}>
            {msg.sender === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    const safeHref = typeof href === 'string' ? href : '';
                    const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      if (!safeHref) return;
                      if (window.externalLinks?.open) {
                        window.externalLinks.open(safeHref);
                      } else {
                        window.open(safeHref, '_blank', 'noopener,noreferrer');
                      }
                    };

                    return (
                      <a href={safeHref} onClick={onClick} rel="noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {msg.text}
              </ReactMarkdown>
            ) : (
              // Texte utilisateur SANS conversion Markdown
              <span className="user-plain">{msg.text}</span>
            )}
          </div>

          {msg.sender === 'assistant' && (
            <div className="bubble-tools">
              <button
                className="copy-btn"
                onClick={() => onCopy(msg.text, idx)}
                title="Copier la réponse"
              >
                {copiedIndex === idx ? '✓ Copié' : 'Copier'}
              </button>
              <span className="debug-tokens" title="Tokens utilisés pour générer cette réponse">
                {/*• {msg.tokens} tokens • ~ {msg.cost != null ? msg.cost : "_"} $*/}
                {msg.cost != null ? "~ " + msg.cost + " $" : ""}
              </span>
            </div>
          )}
        </div>
      ))}

      {/* anchor for scrolling: placed inside the scrollable .chat-area container */}
      <div ref={endRef} />
    </div>
  );
}