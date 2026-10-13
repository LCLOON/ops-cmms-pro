'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface Toast { id: number; type: 'success' | 'error' | 'warning' | 'info'; message: string; }

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {}, success: () => {}, error: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4" />, error: <AlertCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />, info: <Info className="w-4 h-4" />,
  };
  const colors: Record<string, string> = {
    success: 'border-green-500/30 bg-green-900/50 text-green-300',
    error: 'border-red-500/30 bg-red-900/50 text-red-300',
    warning: 'border-amber-500/30 bg-amber-900/50 text-amber-300',
    info: 'border-blue-500/30 bg-blue-900/50 text-blue-300',
  };

  return (
    <ToastContext.Provider value={{ toast: addToast, success: (m: string) => addToast(m, 'success'), error: (m: string) => addToast(m, 'error') }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-slide-up text-sm ${colors[t.type]}`}>
            {icons[t.type]} {t.message}
            <button onClick={() => remove(t.id)} className="ml-auto opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
