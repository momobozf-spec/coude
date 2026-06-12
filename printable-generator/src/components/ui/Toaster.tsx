"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToasterUI toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToasterUI({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  const colors = {
    success: { bg: "#ecfdf5", border: "#0d9488", text: "#065f46" },
    error: { bg: "#fef2f2", border: "#dc2626", text: "#991b1b" },
    info: { bg: "#f0f9ff", border: "#3b82f6", text: "#1e40af" },
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const c = colors[t.type];
        return (
          <div key={t.id} onClick={() => onDismiss(t.id)}
            className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium shadow-lg"
            style={{
              backgroundColor: c.bg,
              borderLeft: `4px solid ${c.border}`,
              color: c.text,
              animation: "fadeIn 0.3s ease-out",
            }}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// Standalone Toaster component for layout (uses context from Provider)
export function Toaster() {
  // This is a placeholder — actual toasts are rendered by ToastProvider
  return null;
}
