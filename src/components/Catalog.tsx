import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CatCard, EnergyType } from "../types";
import { rankByName, searchCards, useCatalog } from "../lib/catalog";
import { useDebounced } from "../lib/hooks";
import { cardSources } from "../lib/images";
import { STAGE_FILTERS, SUB_FILTERS, TYPES, TYPE_ORDER, matchStage, matchSub, rarityPt, seriePt, type StageFilter, type SubFilter } from "../lib/labels";
import { PRICE_BANDS, inBand, type PriceBand } from "../lib/prices";
import { norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { DetailModal, type DetailView } from "./DetailModal";
import { Modal } from "./Modal";
import { PriceTag } from "./PriceTag";

/* Filtros do catálogo (ficam iguais ao fechar e abrir de novo, assim como a seleção) */
export interface CatFilters {
  q: string; cat: "" | "0" | "1" | "2"; type: "" | EnergyType; stage: StageFilter; sub: SubFilter; serie: string; set: string; rarity: string;
  hpMin: string; hpMax: string; reg: string; legal: "" | "std" | "exp"; band: PriceBand; sort: "new" | "old" | "name" | "priceHi" | "priceLo" | "hp";
}
export const CAT_DEFAULTS: CatFilters = { q: "", cat: "", type: "", stage: "", sub: "", serie: "", set: "", rarity: "", hpMin: "", hpMax: "", reg: "", legal: "", band: "", sort: "new" };
const SORTS: [CatFilters["sort"], string][] = [["new", "Mais novas"], ["old", "Mais antigas"], ["name", "Nome (A–Z)"], ["priceHi", "Maior valor"], ["priceLo", "Menor valor"], ["hp", "Maior HP"]];
const CATS: [CatFilters["cat"], string][] = [["", "Todas"], ["0", "Pokémon"], ["1", "Treinador"], ["2", "Energia"]];
let saved: CatFilters = CAT_DEFAULTS;
const selection = new Map<string, CatCard>();
/** abre o catálogo já com uma busca (ex.: "Ver as N cartas no catálogo" da busca do topo) */
export function presetCatalogQuery(q: string) { saved = { ...CAT_DEFAULTS, q }; }
const PAGE = 60;

/** Aplica os filtros às cartas do catálogo (a lista toda; a tela mostra aos poucos) */
export function filterCards(all: CatCard[], f: CatFilters, search: (q: string, pool: CatCard[]) => CatCard[]): CatCard[] {
  const hpMin = +f.hpMin || 0, hpMax = +f.hpMax || 0;
  let out = all.filter((c) =>
    (!f.cat || c.cat === +f.cat) && (!f.type || c.types.includes(f.type)) && matchStage(c, f.stage) && matchSub(c, f.sub) &&
    (!f.serie || c.set.s === f.serie) && (!f.set || c.set.id === f.set) && (!f.rarity || c.rarity === f.rarity) &&
    (!hpMin || c.hp >= hpMin) && (!hpMax || (c.hp > 0 && c.hp <= hpMax)) && (!f.reg || c.reg.toUpperCase() === f.reg) &&
    (!f.legal || (f.legal === "std" ? c.std : c.exp)) && inBand(c, f.band));
  if (f.q.trim()) out = search(f.q, out);
  const byDate = (a: CatCard, b: CatCard) => a.set.d.localeCompare(b.set.d) || a.set.id.localeCompare(b.set.id) || a.num.localeCompare(b.num, undefined, { numeric: true });
  switch (f.sort) {
    // as mais novas primeiro, mas as cartas sem imagem nenhuma (ex.: coleções comemorativas recém-saídas) vão para o fim
    case "new": out = f.q.trim() ? rankByName(out, f.q) : [...out].sort((a, b) => +!(a.imgPt || a.imgEn || a.set.pc) - +!(b.imgPt || b.imgEn || b.set.pc) || byDate(b, a)); break;
    case "old": out = [...out].sort(byDate); break;
    case "name": out = [...out].sort((a, b) => a.pt.localeCompare(b.pt, "pt")); break;
    case "priceHi": out = [...out].sort((a, b) => b.lo - a.lo); break;
    case "priceLo": out = [...out].filter((c) => c.lo > 0).sort((a, b) => a.lo - b.lo); break;
    case "hp": out = [...out].sort((a, b) => b.hp - a.hp); break;
  }
  return out;
}

/* ===== "Adicionar cartas": catálogo completo com filtros, rolagem infinita e seleção múltipla ===== */
export function Catalog({ open, onClose, defaultList, onPresets, footer }: {
  open: boolean;
  onClose: () => void;
  defaultList: string;
  onPresets: () => void;
  /** menu de baixo do celular, mostrado no fim do catálogo (só aparece nessa largura) */
  footer?: ReactNode;
}) {
  const { cat, failed } = useCatalog();
  const { col, addCards, createList, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [f, setF] = useState<CatFilters>(saved);
  const [shown, setShown] = useState(PAGE);
  const [sel, setSel] = useState(() => new Map(selection));
  const [dest, setDest] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [det, setDet] = useState<DetailView | null>(null);
  const [fopen, setFopen] = useState(false);   // celular: filtros recolhidos atrás do botão "Filtros"
  const gridRef = useRef<HTMLDivElement>(null), moreRef = useRef<HTMLDivElement>(null);
  // ao abrir, pega os filtros guardados (podem ter vindo da busca do topo)
  useEffect(() => { if (open) setF(saved); }, [open]);
  const q = useDebounced(f.q, 250);   // busca enquanto digita (pausa curta), sem precisar do Enter
  const set = (p: Partial<CatFilters>) => { const n = { ...f, ...p }; saved = n; setF(n); setShown(PAGE); gridRef.current?.scrollTo({ top: 0 }); };

  const results = useMemo(() => (cat ? filterCards(cat.cards, { ...f, q }, (s, pool) => searchCards(cat, s, pool)) : []), [cat, f, q]);
  const items = results.slice(0, shown);

  // rolagem infinita: mostra mais quando o fim da grade aparece (a grade tem rolagem própria)
  useEffect(() => {
    if (!open) return;
    const g = gridRef.current, s = moreRef.current;
    if (!g || !s) return;
    const obs = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setShown((n) => n + PAGE); }, { root: g, rootMargin: "0px 0px 400px 0px" });
    obs.observe(s);
    return () => obs.disconnect();
  }, [open, cat]);

  const sets = useMemo(() => (cat ? cat.sets.filter((s) => !f.serie || s.s === f.serie).slice().reverse() : []), [cat, f.serie]);
  const rarities = useMemo(() => (cat ? [...new Set(cat.cards.map((c) => c.rarity).filter(Boolean))].sort((a, b) => rarityPt(a).localeCompare(rarityPt(b), "pt")) : []), [cat]);
  const regs = useMemo(() => (cat ? [...new Set(cat.cards.map((c) => c.reg.toUpperCase()).filter(Boolean))].sort() : []), [cat]);
  const have = useMemo(() => new Set(col.cards.map((c) => c.cardId || "")), [col.cards]);
  const haveName = useMemo(() => new Set(col.cards.map((c) => norm(c.nameEn))), [col.cards]);
  const toggle = (c: CatCard) => {
    if (selection.has(c.id)) selection.delete(c.id); else selection.set(c.id, c);
    setSel(new Map(selection));
  };
  const listId = dest === "__new" ? "__new" : col.lists.some((l) => l.id === dest) ? dest : col.lists.some((l) => l.id === defaultList) ? defaultList : col.lists[0]?.id || "__new";

  async function addSelected() {
    if (!canEdit) { askLogin(); return; }
    let to = listId;
    if (to === "__new") {
      if (!newName.trim()) { toast("Digite o nome do novo deck."); return; }
      to = createList(newName);
    }
    setBusy(true);
    const picked = [...selection.values()];
    const n = await addCards(picked.map((card) => ({ card })), to);
    setBusy(false);
    const name = col.lists.find((l) => l.id === to)?.name || newName.trim();
    toast(n ? `${n} ${n === 1 ? "carta adicionada" : "cartas adicionadas"} em ${name}.` + (n < picked.length ? ` ${picked.length - n} já estavam lá.` : "") : "Essas cartas já estão nesse deck.");
    selection.clear(); setSel(new Map()); setNewName(""); onClose();
  }

  // quantos filtros fora do padrão (mostrado no botão "Filtros" do celular)
  const active = (Object.keys(CAT_DEFAULTS) as (keyof CatFilters)[]).filter((k) => k !== "q" && k !== "cat" && f[k] !== CAT_DEFAULTS[k]).length;
  const status = !cat ? (failed ? "Não foi possível carregar o catálogo. Verifique a internet." : "Carregando o catálogo…")
    : `${results.length.toLocaleString("pt-BR")} ${results.length === 1 ? "carta" : "cartas"}${results.length !== cat.cards.length ? ` de ${cat.cards.length.toLocaleString("pt-BR")}` : " no catálogo"}`;
  const detItems = useMemo(() => results.map((card) => ({ card })), [results]);

  return (
    <>
      <Modal open={open} onClose={onClose} label="Adicionar cartas" className="wide">
        <div className="cat-head">
          <h4>Adicionar cartas</h4>
          <p className="note cat-status" aria-live="polite">{status}</p>
          <span className="spacer" />
          <button type="button" className="cat-presets" onClick={onPresets} title="Criar um deck a partir de um tema, como o Deck do Ash ou um deck campeão">Decks prontos</button>
        </div>
        <div className="cat-top">
          <form className={"cat-line" + (fopen ? " fopen" : "")} onSubmit={(e) => { e.preventDefault(); setFopen(false); }}>
            <input id="catQ" type="search" enterKeyHint="search" placeholder="Nome em português ou inglês, número ou coleção (ex.: Pikachu, MEW 25)" value={f.q}
              onChange={(e) => set({ q: e.target.value })} aria-label="Buscar carta" />
            <button type="button" className="cat-ftoggle" aria-expanded={fopen} onClick={() => setFopen(!fopen)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>Filtros{active > 0 && <b className="badge">{active}</b>}
            </button>
            <div className="cat-more">
              <select aria-label="Série (era)" value={f.serie} onChange={(e) => set({ serie: e.target.value, set: "" })}>
                <option value="">Todas as séries</option>
                {cat?.series.slice().reverse().map((s) => <option key={s.id} value={s.id}>{seriePt(s.id, s.pt || s.en)}</option>)}
              </select>
              <select aria-label="Coleção" value={f.set} onChange={(e) => set({ set: e.target.value })}>
                <option value="">Todas as coleções</option>
                {sets.map((s) => <option key={s.id} value={s.id}>{s.pt || s.en}{s.ab ? ` (${s.ab})` : ""} · {s.d.slice(0, 4)}</option>)}
              </select>
              <select aria-label="Ordenar por" value={f.sort} onChange={(e) => set({ sort: e.target.value as CatFilters["sort"] })}>
                {SORTS.map(([k, l]) => <option key={k} value={k}>Ordenar: {l}</option>)}
              </select>
              <button type="button" onClick={() => set(CAT_DEFAULTS)}>Limpar filtros</button>
            </div>
          </form>
          <div className="cat-chips" role="group" aria-label="Categoria e tipo de energia">
            {CATS.map(([k, l]) => <button key={l} type="button" aria-pressed={f.cat === k} onClick={() => set({ cat: k, ...(k !== "0" && k !== "" ? { type: "", stage: "" } : {}) })}>{l}</button>)}
            <span className="chip-sep" aria-hidden="true" />
            {TYPE_ORDER.map((t) => (
              <button key={t} type="button" className="tchip" aria-pressed={f.type === t} title={`Tipo ${TYPES[t].pt}`} onClick={() => set({ type: f.type === t ? "" : t })}>
                <i style={{ background: TYPES[t].bg }} />{TYPES[t].pt}
              </button>
            ))}
          </div>
          <div className={"cat-filters" + (fopen ? " fopen" : "")}>
            <label>Estágio<select value={f.stage} onChange={(e) => set({ stage: e.target.value as StageFilter })}>
              {STAGE_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
            <label>Treinador / Energia<select value={f.sub} onChange={(e) => set({ sub: e.target.value as SubFilter })}>
              {SUB_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
            <label>Raridade<select value={f.rarity} onChange={(e) => set({ rarity: e.target.value })}>
              <option value="">Todas</option>{rarities.map((r) => <option key={r} value={r}>{rarityPt(r)}</option>)}
            </select></label>
            <label>HP mínimo<input type="number" min={0} step={10} inputMode="numeric" value={f.hpMin} onChange={(e) => set({ hpMin: e.target.value })} /></label>
            <label>HP máximo<input type="number" min={0} step={10} inputMode="numeric" value={f.hpMax} onChange={(e) => set({ hpMax: e.target.value })} /></label>
            <label>Marca de regulação<select value={f.reg} onChange={(e) => set({ reg: e.target.value })}>
              <option value="">Todas</option>{regs.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></label>
            <label>Formato<select value={f.legal} onChange={(e) => set({ legal: e.target.value as CatFilters["legal"] })}>
              <option value="">Todos</option><option value="std">Legal no Padrão</option><option value="exp">Legal no Expandido</option>
            </select></label>
            <label>Valor de mercado<select value={f.band} onChange={(e) => set({ band: e.target.value as PriceBand })} title="Pelo menor valor de mercado da carta">
              {PRICE_BANDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          </div>
        </div>
        <div className="catgrid" ref={gridRef}>
          {items.map((c, i) => {
            const on = sel.has(c.id);
            return (
              <div className={"cwrap" + (on ? " on" : "")} key={c.id}>
                <button type="button" className="citem" title="Ver detalhes" onClick={() => setDet({ items: detItems, index: i, mode: "cat" })}>
                  <span className="img"><CardImage sources={cardSources(c, "low")} alt={c.pt} /></span>
                  {have.has(c.id) ? <span className="have">No deck</span> : haveName.has(norm(c.en)) && <span className="have soft">Outra versão nos decks</span>}
                  <span className="nm">{c.pt}</span>
                  {c.pt !== c.en && <span className="tp">{c.en}</span>}
                  <span className="st">{c.set.ab || c.set.id} {c.num}{c.hp ? ` · HP ${c.hp}` : ""}</span>
                  <PriceTag card={c} />
                </button>
                <button type="button" className="chk" aria-pressed={on} aria-label={`Selecionar ${c.pt}`} title={on ? "Tirar da seleção" : "Selecionar"} onClick={() => toggle(c)}>{on ? "✓" : "+"}</button>
              </div>
            );
          })}
          <div className="cat-sentinel" ref={moreRef} aria-live="polite">
            {cat && (results.length > shown ? "Carregando mais…" : results.length ? "Fim da lista." : "Nenhuma carta encontrada. Confira o nome ou tire algum filtro.")}
          </div>
        </div>
        <div className={"catbar" + (sel.size ? " has" : "")}>
          <span className="cnt">{sel.size ? `${sel.size} ${sel.size === 1 ? "carta selecionada" : "cartas selecionadas"}` : <><span className="hint-desk">Clique no + para selecionar · clique na carta para ver os detalhes</span><span className="hint-mob">Toque no + para escolher cartas</span></>}</span>
          <span className="catbar-sel">
            <button type="button" className="linkish" title="Seleciona as cartas que já apareceram na grade com os filtros atuais"
              onClick={() => { items.forEach((c) => selection.set(c.id, c)); setSel(new Map(selection)); }}>Selecionar todas</button>
            {sel.size > 0 && <button type="button" className="linkish" onClick={() => { selection.clear(); setSel(new Map()); }}>Limpar seleção</button>}
          </span>
          <span className="catbar-dest">
            {canEdit && (
              <select aria-label="Deck de destino" value={listId} onChange={(e) => setDest(e.target.value)}>
                {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__new">+ Criar novo deck…</option>
              </select>
            )}
            {canEdit && listId === "__new" && <input placeholder="Nome do novo deck" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nome do novo deck" />}
            <button type="button" className="success" disabled={canEdit && (!sel.size || busy)} onClick={() => void addSelected()}>{!canEdit ? "Criar conta para adicionar" : sel.size ? `Adicionar ${sel.size}` : "Adicionar ao deck"}</button>
          </span>
        </div>
        {footer}
      </Modal>
      <DetailModal view={open ? det : null} onClose={() => setDet(null)} defaultDest={listId === "__new" ? "" : listId}
        onIndex={(i) => { setDet((d) => (d ? { ...d, items: detItems, index: Math.max(0, Math.min(i, detItems.length - 1)) } : d)); if (i >= shown - 5) setShown((n) => n + PAGE); }}
        selected={new Set(sel.keys())} onToggleSel={toggle} />
    </>
  );
}
