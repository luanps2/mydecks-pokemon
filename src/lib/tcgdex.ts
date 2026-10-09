import { useEffect, useState } from "react";
import type { ApiCard } from "../types";

/* ===== Dados completos de uma carta, na hora (TCGdex) =====
   https://api.tcgdex.net/v2/{pt|en}/cards/{id}: ataques, habilidades, fraqueza, resistência, recuo, textos e preços.
   A versão em português só existe para as cartas lançadas no Brasil (a API responde 404 nas outras).
   Fica guardado na memória enquanto a página está aberta. */
const API = "https://api.tcgdex.net/v2";
const mem = new Map<string, Promise<ApiCard | null>>();

export function fetchCard(id: string, lang: "pt" | "en"): Promise<ApiCard | null> {
  const k = lang + "|" + id;
  let p = mem.get(k);
  if (!p) {
    p = fetch(`${API}/${lang}/cards/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => { mem.delete(k); return null; });
    mem.set(k, p);
  }
  return p;
}

/** Os dois idiomas de uma carta: { pt, en, loading } */
export function useCardDetails(id: string | null | undefined): { pt: ApiCard | null; en: ApiCard | null; loading: boolean } {
  const [st, setSt] = useState<{ id: string; pt: ApiCard | null; en: ApiCard | null; loading: boolean }>({ id: "", pt: null, en: null, loading: false });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setSt({ id, pt: null, en: null, loading: true });
    void Promise.all([fetchCard(id, "pt"), fetchCard(id, "en")]).then(([pt, en]) => { if (alive) setSt({ id, pt, en, loading: false }); });
    return () => { alive = false; };
  }, [id]);
  return st.id === id ? st : { pt: null, en: null, loading: !!id };
}
