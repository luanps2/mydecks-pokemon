import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { topDialog } from "../components/Modal";

interface ToastAction { label: string; run: () => void }
interface ToastData { id: number; msg: string; action?: ToastAction }
type ToastFn = (msg: string, action?: ToastAction) => void;

const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

/* Avisos rápidos. Com uma janela (<dialog>) aberta, o aviso precisa ser desenhado dentro dela, senão fica escondido atrás */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastData | null>(null);
  const timer = useRef(0);
  const toast = useCallback<ToastFn>((msg, action) => {
    clearTimeout(timer.current);
    setT({ id: Date.now(), msg, action });
    timer.current = window.setTimeout(() => setT(null), action ? 7000 : 2800);
  }, []);
  const host = topDialog() || document.body;   // a janela que está por cima
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {t && createPortal(
        <div className="toast" role="status" key={t.id}>
          {t.msg}
          {t.action && (
            <button type="button" className="toast-act" onClick={() => { clearTimeout(timer.current); setT(null); t.action!.run(); }}>
              {t.action.label}
            </button>
          )}
        </div>,
        host,
      )}
    </ToastCtx.Provider>
  );
}
