import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { CardList, Collection, Hit, ImageLang, UserCard } from "../types";
import * as cloud from "../lib/cloud";
import { delLocalImage, getLocalImage, resizeImage, setLocalImage } from "../lib/localImages";
import { supabase } from "../lib/supabase";
import { readJSON, uuid, writeJSON } from "../lib/util";
import { useToast } from "./toast";

/* ===== Onde a coleção fica =====
   local: só neste navegador (só quando o Supabase não está configurado, no desenvolvimento)
   cloud: na conta da pessoa, no Supabase (com uma cópia neste navegador para abrir rápido)
   Montar e editar decks só com conta (pedido do Luan): sem login a pessoa só vê (decks prontos, catálogo, Treinadores). */

/** evento da janela: "abra a janela de criar conta" (montar decks precisa de conta) */
export const LOGIN_EVENT = "mydecks:pedir-login";
let askedAt = 0;
function askLogin() {
  if (Date.now() - askedAt < 800) return;   // a mesma ação pode chamar duas guardas (criar deck + adicionar)
  askedAt = Date.now();
  window.dispatchEvent(new Event(LOGIN_EVENT));
}
export type Mode = { kind: "local" } | { kind: "cloud"; userId: string; email: string; name: string; avatar: string };

const LOCAL_KEY = "mdp-estado-v1";
const cloudKey = (uid: string) => "mdp-nuvem-" + uid;
const EMPTY: Collection = { lists: [], cards: [] };
/* Cartas salvas por versões anteriores deste app podem não ter os campos novos */
const fix = (c: Collection): Collection => ({
  lists: c.lists || [],
  cards: (c.cards || []).map((x) => ({ ...x, section: x.section || "", note: x.note || "", customImage: x.customImage ?? null, imageLang: x.imageLang ?? null, quantity: x.quantity || 1 })),
});
const sorted = (lists: CardList[]) => [...lists].sort((a, b) => a.position - b.position);
/* Numeração contínua: 1 até o fim, somando os decks na ordem */
export function numbersOf(col: Collection): Record<string, number> {
  const n: Record<string, number> = {};
  let i = 0;
  for (const l of sorted(col.lists)) for (const c of col.cards.filter((x) => x.listId === l.id).sort((a, b) => a.position - b.position)) n[c.id] = ++i;
  return n;
}
const blank = (p: Partial<UserCard> & Pick<UserCard, "listId" | "nameEn" | "namePt">): UserCard => ({
  id: uuid(), cardId: null, section: "", note: "", position: 0, imageLang: null, customImage: null, quantity: 1, ...p,
});

/* Backup ({ version, collection, images }) */
interface Backup { version?: string; collection?: Collection; images?: Record<string, string> }
function parseBackup(json: unknown, startPos: number): { col: Collection; images: Record<string, string> } | null {
  const b = json as Backup;
  if (!b?.collection || !Array.isArray(b.collection.lists) || !Array.isArray(b.collection.cards)) return null;
  // ids novos: evita conflito com o que já existe (e com a conta de outra pessoa)
  const ids: Record<string, string> = {};
  const lists = b.collection.lists.map((l, i) => { ids[l.id] = uuid(); return { id: ids[l.id], name: String(l.name).slice(0, 120) || "Deck", position: startPos + i, visibility: l.visibility || "public" as const }; });
  const images: Record<string, string> = {};
  const cards: UserCard[] = [];
  b.collection.cards.forEach((c, i) => {
    if (!ids[c.listId] || !c.nameEn) return;
    const card = blank({ listId: ids[c.listId], cardId: c.cardId ?? null, nameEn: c.nameEn, namePt: c.namePt || c.nameEn, note: c.note || "", position: c.position ?? i,
      imageLang: c.imageLang ?? null, quantity: Math.max(1, Math.min(999, c.quantity || 1)) });
    const img = c.customImage === "idb" ? b.images?.[c.id] : c.customImage;
    if (img) { if (img.startsWith("data:")) { images[card.id] = img; card.customImage = "idb"; } else card.customImage = img; }
    cards.push(card);
  });
  return { col: { lists, cards }, images };
}

interface Ctx {
  col: Collection;
  ready: boolean;
  mode: Mode;
  /** cartas salvas só neste navegador (para oferecer o envio para a conta) */
  localCount: number;
  /** pode montar e editar decks (com login; sem Supabase configurado, sempre) */
  canEdit: boolean;
  /** abre a janela de criar conta com o aviso de que montar decks precisa de conta */
  askLogin: () => void;
  /** põe cartas no deck; a mesma impressão (coleção + número) não repete. Devolve quantas entraram. */
  addCards: (hits: Hit[], listId: string) => Promise<number>;
  removeCard: (id: string) => void;
  moveCard: (id: string, listId: string) => void;
  copyCard: (id: string, listId: string) => void;
  renameCard: (id: string, namePt: string) => void;
  /** troca a versão (impressão) da carta no deck */
  changeVersion: (id: string, cardId: string, nameEn: string, namePt: string) => void;
  /** quantas cópias da carta há no deck (1 a 999) */
  setQuantity: (id: string, q: number) => void;
  setImageLang: (id: string, lang: ImageLang | null) => void;
  /** url: link; file: foto do aparelho; null: volta à imagem da carta */
  setCustomImage: (id: string, img: { url: string } | { file: File } | null) => Promise<void>;
  createList: (name: string, visibility?: "private" | "public") => string;
  renameList: (id: string, name: string) => void;
  /** deixa o deck público (aparece no perfil, em Treinadores) ou privado */
  setListVisibility: (id: string, v: "private" | "public") => void;
  moveList: (id: string, dir: -1 | 1) => void;
  deleteList: (id: string) => void;
  /** apaga todos os decks e cartas (no navegador ou na conta) */
  clearAll: () => Promise<void>;
  importBackup: (json: unknown) => Promise<number>;
  exportBackup: () => void;
  uploadLocal: () => Promise<void>;
  signOut: () => Promise<void>;
}
const CollectionCtx = createContext<Ctx | null>(null);
export function useCollection() {
  const c = useContext(CollectionCtx);
  if (!c) throw new Error("useCollection fora do CollectionProvider");
  return c;
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [col, setColState] = useState<Collection>(EMPTY);
  const [mode, setMode] = useState<Mode>({ kind: "local" });
  const [ready, setReady] = useState(false);
  const [localCount, setLocalCount] = useState(() => readJSON<Collection>(LOCAL_KEY, EMPTY).cards?.length || 0);
  // cópias sempre atualizadas para as ações (que rodam fora do desenho da tela); modeRef muda junto com setMode
  const colRef = useRef(col), modeRef = useRef(mode);
  /* Cada ação que mexe nos decks passa por allowed(); sem conta, abre a janela de criar conta (evento LOGIN_EVENT) */
  const allowed = () => !supabase || modeRef.current.kind === "cloud";

  /* Troca a coleção na tela e guarda a cópia no navegador */
  const setCol = useCallback((next: Collection) => {
    colRef.current = next;
    setColState(next);
    const m = modeRef.current;
    if (m.kind === "local") { if (!writeJSON(LOCAL_KEY, next)) toast("Não foi possível salvar os decks neste navegador (sem espaço)."); setLocalCount(next.cards.length); }
    else writeJSON(cloudKey(m.userId), next);
  }, [toast]);
  const patchCards = useCallback((fn: (c: UserCard) => UserCard | null) => {
    const cur = colRef.current;
    const cards: UserCard[] = [];
    for (const c of cur.cards) { const n = fn(c); if (n) cards.push(n); }
    setCol({ ...cur, cards });
  }, [setCol]);

  const reloadCloud = useCallback(async (userId: string) => {
    try { setCol(fix(await cloud.fetchCollection(userId))); }
    catch { toast("Não foi possível carregar seus decks da conta. Verifique a internet."); }
  }, [setCol, toast]);

  /* Grava na nuvem depois de já ter mudado a tela; se falhar, avisa e recarrega o que está salvo */
  const remote = useCallback((job: () => Promise<void>) => {
    const m = modeRef.current;
    if (m.kind !== "cloud") return;
    job().catch(() => { toast("Não foi possível salvar na sua conta. Recarregando seus decks…"); void reloadCloud(m.userId); });
  }, [toast, reloadCloud]);

  /* Início: sem login usa o navegador; com login, a conta */
  useEffect(() => {
    let alive = true;
    function startLocal() {
      modeRef.current = { kind: "local" };
      setMode({ kind: "local" });
      const c = readJSON<Collection | null>(LOCAL_KEY, null) || EMPTY;
      if (alive) { setCol(fix(c)); setReady(true); }
    }
    async function startCloud(s: Session) {
      // nome e foto vêm do Google (no login por e-mail o nome vem do cadastro e a foto fica vazia)
      const meta = (s.user.user_metadata || {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const m: Mode = { kind: "cloud", userId: s.user.id, email: s.user.email || "", name: str(meta.full_name) || str(meta.name), avatar: str(meta.avatar_url) || str(meta.picture) };
      modeRef.current = m;
      setMode(m);
      const cached = readJSON<Collection | null>(cloudKey(m.userId), null);
      if (cached) { setCol(fix(cached)); setReady(true); }
      await reloadCloud(m.userId);
      if (alive) setReady(true);
    }
    if (!supabase) { startLocal(); return () => { alive = false; }; }
    let current = "", started = false;
    // onAuthStateChange avisa a sessão inicial (INITIAL_SESSION) e cada entrada/saída;
    // a renovação automática da sessão (mesma pessoa) não precisa recarregar nada
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => {
      const uid = s?.user.id || "";
      if (started && uid === current) return;
      started = true;
      current = uid;
      // dentro do callback do Supabase não se deve chamar o Supabase direto: adia um instante
      setTimeout(() => { if (!alive) return; if (s) void startCloud(s); else startLocal(); }, 0);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
    // roda uma vez só, ao abrir o app (as funções usadas aqui não mudam)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextPos = (cards: UserCard[], listId: string) => cards.reduce((m, c) => (c.listId === listId ? Math.max(m, c.position + 1) : m), 0);

  /* Imagem enviada do aparelho: no navegador fica no IndexedDB ("idb"); na conta vai para o Storage */
  const storeImage = useCallback(async (cardId: string, dataUrl: string): Promise<string> => {
    const m = modeRef.current;
    if (m.kind === "cloud") return cloud.uploadImage(m.userId, cardId, dataUrl);
    setLocalImage(cardId, dataUrl);
    return "idb";
  }, []);

  const addCards = useCallback(async (hits: Hit[], listId: string) => {
    if (!allowed()) { askLogin(); return 0; }
    const cur = colRef.current;
    // cada impressão (coleção + número) é uma carta do deck: outra versão da mesma carta entra separada
    const inList = new Set(cur.cards.filter((c) => c.listId === listId).map((c) => c.cardId || c.nameEn));
    let pos = nextPos(cur.cards, listId);
    const fresh: UserCard[] = [];
    for (const h of hits) {
      if (inList.has(h.card.id)) continue;
      inList.add(h.card.id);
      fresh.push(blank({ listId, cardId: h.card.id, nameEn: h.card.en, namePt: h.card.pt, position: pos++, quantity: Math.max(1, Math.min(999, h.qty || 1)) }));
    }
    if (!fresh.length) return 0;
    setCol({ ...cur, cards: [...cur.cards, ...fresh] });
    remote(() => cloud.insertCards(fresh));
    return fresh.length;
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Remove na hora; o aviso traz "Desfazer", que devolve a carta ao mesmo lugar (com a imagem própria) */
  const removeCard = useCallback((id: string) => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current, i = cur.cards.findIndex((c) => c.id === id);
    if (i < 0) return;
    const card = cur.cards[i], list = cur.lists.find((l) => l.id === card.listId);
    const localImg = card.customImage === "idb" ? getLocalImage(card.id) : "";
    setCol({ ...cur, cards: cur.cards.filter((c) => c.id !== id) });
    if (localImg) delLocalImage(card.id);
    remote(() => cloud.deleteCards([id]));
    toast(`"${card.namePt}" removida de ${list ? list.name : "o deck"}.`, {
      label: "Desfazer",
      run: () => {
        const now = colRef.current, cards = [...now.cards];
        cards.splice(Math.min(i, cards.length), 0, card);
        if (localImg) setLocalImage(card.id, localImg);
        setCol({ ...now, cards });
        remote(() => cloud.insertCards([card]));
        toast(`"${card.namePt}" voltou para ${list ? list.name : "o deck"}.`);
      },
    });
  }, [setCol, remote, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveCard = useCallback((id: string, listId: string) => {
    if (!allowed()) { askLogin(); return; }
    const position = nextPos(colRef.current.cards, listId);
    patchCards((c) => (c.id === id ? { ...c, listId, position } : c));
    remote(() => cloud.updateCard(id, { listId, position }));
  }, [patchCards, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyCard = useCallback((id: string, listId: string) => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current, src = cur.cards.find((c) => c.id === id);
    if (!src) return;
    const copy: UserCard = { ...src, id: uuid(), listId, position: nextPos(cur.cards, listId) };
    if (src.customImage === "idb") { const img = getLocalImage(src.id); if (img) setLocalImage(copy.id, img); }
    setCol({ ...cur, cards: [...cur.cards, copy] });
    remote(() => cloud.insertCards([copy]));
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQuantity = useCallback((id: string, q: number) => {
    if (!allowed()) { askLogin(); return; }
    const n = Math.max(1, Math.min(999, Math.round(q) || 1));
    patchCards((c) => (c.id === id ? { ...c, quantity: n } : c));
    remote(() => cloud.updateCard(id, { quantity: n }));
  }, [patchCards, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const renameCard = useCallback((id: string, namePt: string) => {
    if (!allowed()) { askLogin(); return; }
    const n = namePt.trim().slice(0, 120);
    if (!n) return;
    patchCards((c) => (c.id === id ? { ...c, namePt: n } : c));
    remote(() => cloud.updateCard(id, { namePt: n }));
  }, [patchCards, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeVersion = useCallback((id: string, cardId: string, nameEn: string, namePt: string) => {
    if (!allowed()) { askLogin(); return; }
    const patch: Partial<UserCard> = { cardId, nameEn, namePt, imageLang: null };
    patchCards((c) => (c.id === id ? { ...c, ...patch } : c));
    remote(() => cloud.updateCard(id, patch));
  }, [patchCards, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const setImageLang = useCallback((id: string, lang: ImageLang | null) => {
    if (!allowed()) { askLogin(); return; }
    patchCards((c) => (c.id === id ? { ...c, imageLang: lang } : c));
    remote(() => cloud.updateCard(id, { imageLang: lang }));
  }, [patchCards, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCustomImage = useCallback(async (id: string, img: { url: string } | { file: File } | null) => {
    if (!allowed()) { askLogin(); return; }
    const old = colRef.current.cards.find((c) => c.id === id);
    if (!old) return;
    let value: string | null = null;
    if (img && "url" in img) value = img.url;
    else if (img && "file" in img) value = await storeImage(id, await resizeImage(img.file));
    if (old.customImage === "idb" && value !== "idb") delLocalImage(id);
    patchCards((c) => (c.id === id ? { ...c, customImage: value } : c));
    remote(() => cloud.updateCard(id, { customImage: value }));
  }, [patchCards, remote, storeImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const createList = useCallback((name: string, visibility: "private" | "public" = "public") => {
    if (!allowed()) { askLogin(); return ""; }
    const cur = colRef.current;
    // decks novos já nascem públicos, a não ser que a pessoa marque "Deck privado"
    const list: CardList = { id: uuid(), name: name.trim().slice(0, 120) || "Meu deck", position: cur.lists.reduce((m, l) => Math.max(m, l.position + 1), 0), visibility };
    setCol({ ...cur, lists: [...cur.lists, list] });
    remote(() => cloud.insertLists([list]));
    return list.id;
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const renameList = useCallback((id: string, name: string) => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current, n = name.trim().slice(0, 120);
    if (!n) return;
    setCol({ ...cur, lists: cur.lists.map((l) => (l.id === id ? { ...l, name: n } : l)) });
    remote(() => cloud.updateList(id, { name: n }));
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const setListVisibility = useCallback((id: string, v: "private" | "public") => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current;
    setCol({ ...cur, lists: cur.lists.map((l) => (l.id === id ? { ...l, visibility: v } : l)) });
    remote(() => cloud.updateList(id, { visibility: v }));
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sobe ou desce um deck: renumera as posições de todos na nova ordem */
  const moveList = useCallback((id: string, dir: -1 | 1) => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current, lists = sorted(cur.lists), i = lists.findIndex((l) => l.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= lists.length) return;
    [lists[i], lists[j]] = [lists[j], lists[i]];
    const next = lists.map((l, k) => ({ ...l, position: k }));
    const changed = next.filter((l) => cur.lists.find((o) => o.id === l.id)?.position !== l.position);
    setCol({ ...cur, lists: next });
    remote(async () => { for (const l of changed) await cloud.updateList(l.id, { position: l.position }); });
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteList = useCallback((id: string) => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current;
    cur.cards.filter((c) => c.listId === id && c.customImage === "idb").forEach((c) => delLocalImage(c.id));
    setCol({ lists: cur.lists.filter((l) => l.id !== id), cards: cur.cards.filter((c) => c.listId !== id) });
    remote(() => cloud.deleteLists([id]));
  }, [setCol, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Apagar tudo: todos os decks e cartas (e as imagens guardadas no navegador) */
  const clearAll = useCallback(async () => {
    if (!allowed()) { askLogin(); return; }
    const cur = colRef.current;
    cur.cards.filter((c) => c.customImage === "idb").forEach((c) => delLocalImage(c.id));
    setCol(EMPTY);
    if (modeRef.current.kind === "cloud" && cur.lists.length) {
      try { await cloud.deleteLists(cur.lists.map((l) => l.id)); }
      catch { toast("Não foi possível salvar na sua conta. Recarregando seus decks…"); await reloadCloud((modeRef.current as { userId: string }).userId); }
    }
  }, [setCol, toast, reloadCloud]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Importar backup: os decks do arquivo entram como decks novos (nada do que já existe é apagado) */
  const importBackup = useCallback(async (json: unknown) => {
    if (!allowed()) { askLogin(); return 0; }
    const cur = colRef.current;
    const parsed = parseBackup(json, cur.lists.reduce((m, l) => Math.max(m, l.position + 1), 0));
    if (!parsed) throw new Error("formato");
    const { col: add, images } = parsed;
    if (modeRef.current.kind === "cloud") {
      // imagens que estavam só no navegador vão para o Storage antes de gravar as cartas
      for (const c of add.cards) {
        const img = images[c.id];
        if (img) { try { c.customImage = await storeImage(c.id, img); } catch { c.customImage = null; } }
      }
    } else for (const [id, img] of Object.entries(images)) setLocalImage(id, img);
    setCol({ lists: [...cur.lists, ...add.lists], cards: [...cur.cards, ...add.cards] });
    if (modeRef.current.kind === "cloud") {
      try { await cloud.insertLists(add.lists); await cloud.insertCards(add.cards); }
      catch { toast("O backup foi lido, mas não foi possível salvar na sua conta. Tente de novo."); await reloadCloud((modeRef.current as { userId: string }).userId); throw new Error("nuvem"); }
    }
    return add.cards.length;
  }, [setCol, toast, reloadCloud, storeImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportBackup = useCallback(() => {
    const cur = colRef.current, images: Record<string, string> = {};
    cur.cards.forEach((c) => { if (c.customImage === "idb") { const img = getLocalImage(c.id); if (img) images[c.id] = img; } });
    const blob = new Blob([JSON.stringify({ version: "mdp-1", collection: cur, images })], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "backup-decks-pokemon.json" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, []);

  /* Envia para a conta os decks que estavam só neste navegador (com as imagens enviadas do aparelho) */
  const uploadLocal = useCallback(async () => {
    const local = fix(readJSON<Collection>(LOCAL_KEY, EMPTY));
    if (!local.cards.length) return;
    const images: Record<string, string> = {};
    local.cards.forEach((c) => { if (c.customImage === "idb") { const img = getLocalImage(c.id); if (img) images[c.id] = img; } });
    const n = await importBackup({ version: "mdp-1", collection: local, images });
    toast(`${n} cartas enviadas para a sua conta.`);
  }, [importBackup, toast]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const canEdit = !supabase || mode.kind === "cloud";
  const value = useMemo<Ctx>(() => ({
    col, ready, mode, localCount, canEdit, askLogin, addCards, removeCard, moveCard, copyCard, renameCard, changeVersion, setQuantity, setImageLang, setCustomImage,
    createList, renameList, setListVisibility, moveList, deleteList, clearAll, importBackup, exportBackup, uploadLocal, signOut,
  }), [col, ready, mode, localCount, canEdit, addCards, removeCard, moveCard, copyCard, renameCard, changeVersion, setQuantity, setImageLang, setCustomImage,
    createList, renameList, setListVisibility, moveList, deleteList, clearAll, importBackup, exportBackup, uploadLocal, signOut]);
  return <CollectionCtx.Provider value={value}>{children}</CollectionCtx.Provider>;
}
