import { useEffect, useMemo, useRef, useState } from "react";
import type { CardList } from "../types";
import { norm } from "../lib/util";

/* ===== Seletor de decks: um botão compacto que abre a lista de decks (no lugar das abas) ===== */
export function DeckPicker({ lists, counts, total, value, onChange, onManage }: {
  lists: CardList[];
  counts: Map<string, number>;
  total: number;
  /** deck escolhido ("" = todas as cartas) */
  value: string;
  onChange: (id: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const cur = lists.find((l) => l.id === value);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? lists.filter((l) => norm(l.name).includes(n)) : lists;
  }, [lists, q]);
  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); };

  return (
    <div className="dpick" ref={ref}>
      <button type="button" className="dpick-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        title="Escolher o deck que aparece na tela">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="12" height="16" rx="2" /><path d="M4.5 7v11.5A2 2 0 0 0 6.5 20.5H15" /></svg>
        <span className="dpick-txt"><small>Deck</small><b>{cur ? cur.name : "Todas as cartas"}</b></span>
        <span className="n">{cur ? counts.get(cur.id) || 0 : total}</span>
        <svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && (
        <div className="dpick-pop" role="listbox" aria-label="Decks">
          {lists.length > 6 && (
            <input type="search" className="dpick-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar deck" aria-label="Buscar deck" autoFocus />
          )}
          <div className="dpick-list">
            {!q && (
              <button type="button" role="option" aria-selected={!value} onClick={() => pick("")}>
                <span>Todas as cartas</span><span className="n">{total}</span>
              </button>
            )}
            {shown.map((l) => (
              <button key={l.id} type="button" role="option" aria-selected={l.id === value} onClick={() => pick(l.id)}>
                <span>{l.name}</span>
                {l.visibility === "private" && <svg className="lock" viewBox="0 0 24 24" aria-label="Deck privado"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}
                <span className="n">{counts.get(l.id) || 0}</span>
              </button>
            ))}
            {!shown.length && <p className="note">Nenhum deck com esse nome.</p>}
          </div>
          <button type="button" className="dpick-manage" onClick={() => { setOpen(false); onManage(); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Criar e gerenciar decks
          </button>
        </div>
      )}
    </div>
  );
}
