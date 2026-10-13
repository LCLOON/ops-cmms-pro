'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

interface Message {
  role: 'user' | 'advisor';
  text: string;
  sources?: string[];
  usedModel?: boolean;
  modelError?: string;
  suggestedPage?: string;
}

const SUGGESTIONS = [
  'What needs attention today?',
  'How do I create a PM schedule?',
  'What does the Documents module do?',
  'How many overdue PMs do we have?',
  'How do I issue a safety permit?',
];

export default function AdvisorPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'advisor',
      text: 'Ask me anything about this CMMS — I know every module, field and workflow, and I can read live data from your site. Try one of the suggestions below or type your own question.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const r = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessages(m => [...m, { role: 'advisor', text: data.error || 'The advisor could not answer that.' }]);
        return;
      }
      setMessages(m => [...m, {
        role: 'advisor',
        text: data.answer,
        sources: data.sources,
        usedModel: data.usedModel,
        modelError: data.modelError,
        suggestedPage: data.suggestedPage,
      }]);
    } catch {
      setMessages(m => [...m, { role: 'advisor', text: 'Network error — could not reach the advisor.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <div>
          <h2 className="text-xl font-bold text-white">AI Advisor</h2>
          <p className="text-slate-400 text-sm">Signed in as {user?.displayName} ({user?.role}) — answers are grounded in your live data.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-200'
            }`}>
              {m.text}
              {m.role === 'advisor' && m.suggestedPage && onNavigate && (
                <div className="mt-3">
                  <button
                    onClick={() => onNavigate(m.suggestedPage!)}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 underline"
                  >
                    Open {m.suggestedPage.replace('-', ' ')} →
                  </button>
                </div>
              )}
              {m.role === 'advisor' && m.sources && m.sources.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-500">Sources: {m.sources.join(', ')}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 my-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-full px-3 py-1.5"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={e => { e.preventDefault(); ask(input); }}
        className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about any module, metric or workflow..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg p-2.5"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
