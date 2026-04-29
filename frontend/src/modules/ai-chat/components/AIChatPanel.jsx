import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useClaudeChat } from '../hooks/useClaudeChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X, PaperPlaneRight, ArrowsClockwise, ChartBar, UsersThree, Megaphone, ChatCircleText, Robot, Stop,
} from '@phosphor-icons/react';

const QUICK_QUESTIONS = [
  { id: 'resumen', label: 'Resumen del mes', icon: ChartBar, prompt: 'Dame un resumen del mes en curso con KPIs clave' },
  { id: 'inactivos', label: 'Prospectos sin actividad', icon: UsersThree, prompt: 'Muéstrame los prospectos sin actividad en los últimos 14 días' },
  { id: 'campanas', label: 'Rendimiento campañas', icon: Megaphone, prompt: '¿Cómo está el rendimiento de las campañas Meta y Google?' },
];

export default function AIChatPanel({ open, onClose }) {
  const { activeProject } = useProjectContext();
  const chat = useClaudeChat(activeProject?.id);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll al fondo cuando cambian mensajes
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages, chat.streaming]);

  // Focus al abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    chat.send(text);
    setInput('');
  }, [input, chat]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop solo en mobile */}
      <div className="fixed inset-0 !m-0 z-[60] bg-black/40 md:hidden" onClick={onClose} />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Chat con Claude AI"
        className="fixed top-0 right-0 bottom-0 z-[60] w-full md:w-[400px] bg-card border-l border-border shadow-xl flex flex-col"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Robot size={18} weight="regular" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">Chat con Claude</h3>
              <p className="text-[10px] text-muted-foreground truncate">{activeProject ? activeProject.nombre : 'Sin proyecto'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={chat.clear}
              disabled={chat.messages.length === 0}
              title="Limpiar conversacion"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ArrowsClockwise size={16} />
            </button>
            <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <ChatCircleText size={22} weight="regular" />
              </div>
              <p className="font-semibold text-sm">Hola! Soy Claude</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
                Pregunta sobre los datos de {activeProject?.nombre || 'tu proyecto'} — prospectos, campanas, conversiones, contabilidad.
              </p>
            </div>
          ) : (
            chat.messages.map(m => <Message key={m.id} message={m} />)
          )}
        </div>

        {/* Quick questions */}
        {chat.messages.length === 0 && !chat.streaming && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 border-t border-border pt-3">
            {QUICK_QUESTIONS.map(q => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  onClick={() => chat.send(q.prompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Icon size={12} weight="bold" /> {q.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-border p-3 flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Pregunta sobre ${activeProject?.nombre || 'el proyecto'}…`}
              rows={1}
              disabled={!activeProject || chat.streaming}
              className="flex-1 min-h-[40px] max-h-32 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-50"
            />
            {chat.streaming ? (
              <button type="button" onClick={chat.cancel}
                className="h-10 w-10 rounded-md bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 flex items-center justify-center flex-shrink-0"
                title="Detener generacion">
                <Stop size={14} weight="fill" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || !activeProject}
                className="h-10 w-10 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                title="Enviar (Enter)">
                <PaperPlaneRight size={14} weight="bold" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Enter para enviar · Shift+Enter para nueva linea</p>
        </form>
      </aside>
    </>,
    document.body
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] bg-primary text-white rounded-md rounded-br-sm px-3 py-2 text-sm">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Robot size={14} weight="regular" />
      </div>
      <div className="flex-1 min-w-0">
        {message.error ? (
          <div className="text-xs text-red-600">{message.error}</div>
        ) : (
          <div className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
            {message.streaming && <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse align-middle ml-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}
