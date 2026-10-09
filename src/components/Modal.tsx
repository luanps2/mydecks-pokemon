import { useEffect, useRef, type ReactNode } from "react";

/* Pilha das janelas abertas, na ordem em que abriram: a última é a que está por cima.
   Usada pelos avisos (que precisam ser desenhados dentro dela) e pelas setas do teclado (só a de cima responde). */
const stack: HTMLDialogElement[] = [];
export const topDialog = (): HTMLDialogElement | null => stack[stack.length - 1] || null;

/* Janela usando o <dialog> do navegador: Esc e clique fora fecham */
export function Modal({ open, onClose, className, label, children, onArrow }: {
  open: boolean;
  onClose: () => void;
  className?: string;
  label: string;
  children: ReactNode;
  /** setas ← → do teclado, só quando esta janela está por cima */
  onArrow?: (dir: -1 | 1) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); stack.push(d); }
    if (!open && d.open) d.close();
  }, [open]);
  // saiu da tela (mesmo aberta): tira da pilha
  useEffect(() => () => { const d = ref.current, i = d ? stack.indexOf(d) : -1; if (i >= 0) stack.splice(i, 1); }, []);
  useEffect(() => {
    if (!open || !onArrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (!/^Arrow(Left|Right)$/.test(e.key) || topDialog() !== ref.current) return;
      if ((e.target as HTMLElement).closest?.("input,select,textarea,summary")) return;
      e.preventDefault();
      onArrow(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onArrow]);
  return (
    <dialog ref={ref} className={className} aria-label={label}
      onClose={() => { const d = ref.current, i = d ? stack.indexOf(d) : -1; if (i >= 0) stack.splice(i, 1); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="dlg">
          <button type="button" className="close" aria-label="Fechar" onClick={onClose}>×</button>
          {children}
        </div>
      )}
    </dialog>
  );
}
