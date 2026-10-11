'use client';

import React, { useState } from 'react';
import { getDictionary } from '@/lib/translations';
import {
  Send,
  Clipboard,
  CheckCircle2,
  Smartphone,
  Loader2,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface QuickPasteMobileProps {
  initialCode?: string;
}

export const QuickPasteMobile: React.FC<QuickPasteMobileProps> = ({
  initialCode = '',
}) => {
  const t = getDictionary('en').quickPaste;
  const [code, setCode] = useState<string>(initialCode.toUpperCase());
  const [text, setText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setText(clipText.slice(0, 5000));
          setErrorMessage(null);
          return;
        }
      }
      setErrorMessage('Clipboard is empty. Long-press (tap & hold) inside the box below to paste.');
    } catch {
      setErrorMessage('Browser permission needed. Long-press (tap & hold) inside the box below to paste.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanText = text.trim();

    if (!cleanCode || cleanCode.length < 4) {
      setErrorMessage('Please enter the 6-character PC pairing code.');
      return;
    }

    if (!cleanText) {
      setErrorMessage('Please type or paste some text before sending.');
      return;
    }

    if (cleanText.length > 5000) {
      setErrorMessage('Text cannot exceed 5,000 characters.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, text: cleanText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send text to PC');
      }

      setSuccessMessage(t.sentSuccess);
      setText('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
          <Smartphone className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">{t.phoneTitle}</h3>
        <p className="text-xs text-slate-400">
          {code ? t.phoneSubtitle.replace('{code}', code) : t.enterCodePrompt}
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Pairing Code Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            PC Pairing Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErrorMessage(null);
            }}
            maxLength={8}
            placeholder="e.g. A9K3P2"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500 uppercase placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs"
          />
        </div>

        {/* Text Input Area */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold">Text or URL to Send</span>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
            >
              <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.pasteClipboard}</span>
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 5000));
              setErrorMessage(null);
            }}
            rows={5}
            placeholder={t.pastePlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 resize-none leading-relaxed placeholder:text-slate-600"
          />

          <div className="text-right text-[11px] text-slate-500 font-mono mt-1">
            {text.length} / 5,000
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSending || !text.trim()}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.sending}</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{t.sendButton}</span>
            </>
          )}
        </button>
      </form>

      <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-2 border-t border-slate-800">
        <Zap className="w-3.5 h-3.5 text-indigo-400" />
        <span>Instantly appears on your PC screen</span>
      </div>
    </div>
  );
};
