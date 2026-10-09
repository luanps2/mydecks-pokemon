import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CatCard, EnergyType, Hit, UserCard } from "./types";
import { CardModal } from "./components/CardModal";
import { CardTile, ICON_TRASH } from "./components/CardTile";
import { Catalog, presetCatalogQuery } from "./components/Catalog";
import { DeckPicker } from "./components/DeckPicker";
import { DetailModal, type DetailView } from "./components/DetailModal";
import { GlobalBehaviors } from "./components/GlobalBehaviors";
import { Logo } from "./components/Logo";
import { ManageLists } from "./components/ManageLists";
import { Modal } from "./components/Modal";
import { SearchPanel } from "./components/SearchPanel";
import { useCatalog } from "./lib/catalog";
import { useSignal } from "./lib/hooks";
import { customSrc, userCardSources } from "./lib/images";
import { STAGE_FILTERS, SUB_FILTERS, TYPES, TYPE_ORDER, kindLine, matchStage, matchSub, rarityPt, type StageFilter, type SubFilter } from "./lib/labels";
import { localImgSignal, openLocalImages } from "./lib/localImages";
import { PRICE_BANDS, inBand, type PriceBand } from "./lib/prices";
import { checkDeck } from "./lib/rules";
import { supabase } from "./lib/supabase";
import { brl, copies, norm, readJSON, writeJSON } from "./lib/util";
import { CollectionProvider, LOGIN_EVENT, numbersOf, useCollection } from "./state/collection";
import { ToastProvider } from "./state/toast";

export default function App() {
  return (
    <ToastProvider>
      <CollectionProvider>
        <Main />
        <GlobalBehaviors />
      </CollectionProvider>
    </ToastProvider>
  );
}

export const ICON_PEOPLE = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3 3-4.8 6-4.8s5.4 1.8 6 4.8" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.3c2.3.2 4 1.7 4.5 4.2" /></svg>;
const ICON_USER = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></svg>;
const ICON_CHART = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /></svg>;
const ICON_LOGOUT = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4" /></svg>;
const ICON_DOWN = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>;
const ICON_STAR = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" /></svg>;
const ICON_PLUS = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

/* Quem está conectado: foto do Google (ou a inicial) e nome; o clique abre o menu com "Meu painel", "Meu perfil" e "Sair" */
function AccountMenu({ name, email, avatar, onDash, onProfile, onSignOut }: { name: string; email: string; avatar: string; onDash: () => void; onProfile: () => void; onSignOut: () => void }) {
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shown = name || email.split("@")[0];
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="acct-wrap" ref={ref}>
      <button type="button" className="userchip" aria-haspopup="menu" aria-expanded={open} title={"Conectado como " + (name ? name + " (" + email + ")" : email)} onClick={() => setOpen((o) => !o)}>
        {avatar && !bad
          ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
          : <span className="ua" aria-hidden="true">{(shown || "?").charAt(0).toUpperCase()}</span>}
        <span className="un"><b>{shown}</b></span>
        <svg className="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <small>Conectado como</small>
          <b>{email}</b>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDash(); }}>{ICON_CHART}Meu painel</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onProfile(); }}>{ICON_PEOPLE}Meu perfil de treinador</button>
          <button type="button" role="menuitem" className="out" onClick={() => { setOpen(false); onSignOut(); }}>{ICON_LOGOUT}Sair</button>
        </div>
      )}
    </div>
  );
}

/* Filtros da tela principal */
type Filter = "all" | "0" | "1" | "2" | "noimg" | "custom";
const FILTERS: [Filter, string][] = [["all", "Todas"], ["0", "Pokémon"], ["1", "Treinador"], ["2", "Energia"], ["noimg", "Sem imagem"], ["custom", "Imagem minha"]];
const GROUPS = ["Pokémon", "Treinador", "Energia", "Outras"];

function Main() {
  const { col, ready, mode, localCount, removeCard, setQuantity, uploadLocal, signOut, canEdit } = useCollection();
  const { cat } = useCatalog();
  useSignal(localImgSignal);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(() => readJSON("mdp-deck", ""));
  const [filter, setFilter] = useState<Filter>("all");
  const [type, setType] = useState<"" | EnergyType>("");
  const [stage, setStage] = useState<StageFilter>("");
  const [sub, setSub] = useState<SubFilter>("");
  const [band, setBand] = useState<PriceBand>("");   // filtro por valor de mercado
  const [view, setView] = useState<"grid" | "rows">(() => readJSON("mdp-modo", "grid"));
  const [cardId, setCardId] = useState<string | null>(null);
  const [det, setDet] = useState<DetailView | null>(null);
  const [dlg, setDlg] = useState<"" | "login" | "catalog" | "lists" | "account" | "community" | "dash">("");
  // montar decks precisa de conta: quem tenta sem login recebe a janela de criar conta com o aviso
  const [, setNeedLogin] = useState(false);
  useEffect(() => {
    const f = () => setNeedLogin(true);
    window.addEventListener(LOGIN_EVENT, f);
    return () => window.removeEventListener(LOGIN_EVENT, f);
  }, []);
  const [over, setOver] = useState<"" | "presets" | "export">("");   // janelas que abrem por cima das outras
  // fechar uma janela só limpa o estado se ela ainda for a aberta: ao trocar de janela (ex.: do catálogo para
  // Meus decks pelo menu de baixo), o aviso de "fechei" da anterior chega depois e não pode desfazer a troca
  const closeDlg = useCallback((k: string) => setDlg((d) => (d === k ? "" : d)), []);
  const openPresets = useCallback(() => setOver("presets"), []);
  const [hideUpload, setHideUpload] = useState(() => readJSON("mdp-esconder-envio", false));
  const pickTab = (id: string) => { setTab(id); writeJSON("mdp-deck", id); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => { void openLocalImages(); }, []);

  const lists = useMemo(() => [...col.lists].sort((a, b) => a.position - b.position), [col.lists]);
  const byList = useMemo(() => {
    const m = new Map<string, UserCard[]>();
    for (const l of lists) m.set(l.id, []);
    for (const c of col.cards) m.get(c.listId)?.push(c);
    m.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return m;
  }, [col.cards, lists]);
  const info = useCallback((c: UserCard): CatCard | undefined => (c.cardId ? cat?.byId.get(c.cardId) : undefined), [cat]);
  // contagens somam as cópias (3 Pikachu = 3 cartas); valor = soma das cópias × menor valor da carta
  const counts = useMemo(() => new Map([...byList].map(([k, v]) => [k, copies(v)])), [byList]);
  const values = useMemo(() => new Map([...byList].map(([k, v]) => [k, v.reduce((t, c) => t + (c.quantity || 1) * (info(c)?.lo || 0), 0)])), [byList, info]);
  const totalCopies = useMemo(() => copies(col.cards), [col.cards]);
  const numbers = useMemo(() => numbersOf(col), [col]);
  const tabOk = lists.some((l) => l.id === tab) ? tab : "";

  const nq = norm(q.trim());
  const pass = (c: UserCard) => {
    const ci = info(c);
    if (band && !inBand(ci, band)) return false;
    if (nq && !norm(c.namePt).includes(nq) && !norm(c.nameEn).includes(nq) && String(numbers[c.id]) !== nq) return false;
    if (type && !ci?.types.includes(type)) return false;
    if (stage && (!ci || !matchStage(ci, stage))) return false;
    if (sub && (!ci || !matchSub(ci, sub))) return false;
    if (filter === "all") return true;
    if (filter === "custom") return !!c.customImage;
    if (filter === "noimg") return !customSrc(c) && (!ci || (!ci.imgEn && !ci.imgPt));
    return !!ci && ci.cat === +filter;
  };
  const filtered = !!(nq || filter !== "all" || band || type || stage || sub);
  const order: string[] = [];
  const sections = lists.filter((l) => !tabOk || l.id === tabOk).map((l) => {
    const all = byList.get(l.id) || [];
    const items = all.filter(pass);
    // dentro do deck: Pokémon, Treinador e Energia (como numa lista de deck), na ordem em que foram postas
    const groups = GROUPS.map((g, gi) => ({ g, cards: items.filter((c) => { const ci = info(c); return ci ? ci.cat === gi : gi === 3; }) })).filter((x) => x.cards.length);
    groups.forEach((x) => x.cards.forEach((c) => order.push(c.id)));
    return { list: l, total: counts.get(l.id) || 0, items, groups, check: checkDeck(all, cat?.byId) };
  }).filter((s) => s.items.length || !filtered);

  const idx = cardId ? order.indexOf(cardId) : -1;
  const step = (dir: -1 | 1) => { const id = order[idx + dir]; if (id) setCardId(id); };
  const open = useCallback((id: string) => setCardId(id), []);
  const openHits = useCallback((items: Hit[], index: number) => setDet({ items, index, mode: "rel" }), []);
  const goHome = () => { setDlg(""); setOver(""); setQ(""); pickTab(""); };

  /* Menu de baixo no celular (como nos apps): os botões do topo ficam escondidos nessa largura.
     5 botões com "Adicionar" no meio: Início · Treinadores · Adicionar · Decks · Conta.
     Aparece também dentro do catálogo ("Adicionar"), que no celular ocupa a tela toda. */
  const bottomNav = (
    <nav className="bottomnav" aria-label="Menu">
      <button type="button" aria-current={!dlg && !over ? "page" : undefined} onClick={goHome}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /></svg><span>Início</span>
      </button>
      {supabase ? (
        <button type="button" aria-current={dlg === "community" ? "page" : undefined} onClick={() => setDlg("community")}>{ICON_PEOPLE}<span>Treinadores</span></button>
      ) : (
        <button type="button" aria-current={over === "presets" ? "page" : undefined} onClick={openPresets}>{ICON_STAR}<span>Prontos</span></button>
      )}
      <button type="button" className="bn-add" aria-current={dlg === "catalog" ? "page" : undefined} onClick={() => setDlg("catalog")}>
        <span className="bn-plus">{ICON_PLUS}</span><span>Adicionar</span>
      </button>
      <button type="button" aria-current={dlg === "lists" ? "page" : undefined} onClick={() => setDlg("lists")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="12" height="16" rx="2" /><path d="M4.5 7v11.5A2 2 0 0 0 6.5 20.5H15" /></svg><span>Decks</span>
      </button>
      {supabase ? (
        <button type="button" aria-current={dlg === "login" || dlg === "account" ? "page" : undefined} onClick={() => setDlg(mode.kind === "cloud" ? "account" : "login")}>
          {ICON_USER}<span>{mode.kind === "cloud" ? "Conta" : "Entrar"}</span>
        </button>
      ) : (
        <button type="button" aria-current={over === "export" ? "page" : undefined} onClick={() => setOver("export")}>{ICON_DOWN}<span>Exportar</span></button>
      )}
    </nav>
  );

  return (
    <>
      <header className="top">
        {/* linha 1: marca | busca | Treinadores e conta */}
        <div className="wrap top-row">
          <a className="brand" href="#" aria-label="MyDeck Pokémon – início" onClick={(e) => { e.preventDefault(); goHome(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Logo className="brand-mark" />
            <span className="brand-txt"><b>My<em>Deck</em></b><small>Pokémon</small></span>
          </a>
          <label className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carta: nome em português ou inglês, ou número" aria-label="Buscar carta" />
          </label>
          <div className="top-end">
            {supabase && <button type="button" className="hbtn" onClick={() => setDlg("community")} title="Ver os outros treinadores e os decks deles">{ICON_PEOPLE}<span>Treinadores</span></button>}
            <div className="acct">
              {mode.kind === "cloud"
                ? <AccountMenu name={mode.name} email={mode.email} avatar={mode.avatar} onDash={() => setDlg("dash")} onProfile={() => setDlg("community")} onSignOut={() => void signOut()} />
                : supabase && <button type="button" className="hbtn" onClick={() => setDlg("login")}>{ICON_USER}<span>Entrar</span></button>}
            </div>
          </div>
        </div>
        {/* linha 2: qual deck está na tela | ações (verde = ação principal; as outras discretas) */}
        <div className="wrap deck-row">
          <DeckPicker lists={lists} counts={counts} total={totalCopies} value={tabOk} onChange={pickTab} onManage={() => setDlg("lists")} />
          <nav className="actions" aria-label="Ações">
            <button type="button" className="btn soft" onClick={openPresets} title="Decks dos personagens do anime, decks oficiais e decks campeões">{ICON_STAR}<span>Decks prontos</span></button>
            <button type="button" className="btn soft" onClick={() => setOver("export")} title="Baixar os seus decks em Excel, texto ou no formato do Pokémon TCG Live">{ICON_DOWN}<span>Exportar<span className="xl"> decks</span></span></button>
            <button type="button" className="btn act" onClick={() => setDlg("catalog")} title="Escolher cartas no catálogo completo">{ICON_PLUS}<span>Adicionar cartas</span></button>
          </nav>
        </div>
      </header>

      <div className="wrap toolbar">
        <div className="chips" role="group" aria-label="Filtrar por tipo de carta">
          {FILTERS.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <span className="tsel">
          <select value={type} onChange={(e) => setType(e.target.value as EnergyType | "")} aria-label="Tipo de energia">
            <option value="">Tipo: todos</option>{TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPES[t].pt}</option>)}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value as StageFilter)} aria-label="Estágio">
            {STAGE_FILTERS.map(([k, l]) => <option key={k} value={k}>{k ? l : "Estágio: todos"}</option>)}
          </select>
          <select value={sub} onChange={(e) => setSub(e.target.value as SubFilter)} aria-label="Subtipo de Treinador ou Energia">
            {SUB_FILTERS.map(([k, l]) => <option key={k} value={k}>{k ? l : "Subtipo: todos"}</option>)}
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value as PriceBand)} aria-label="Filtrar por valor de mercado" title="Pelo menor valor de mercado da carta">
            {PRICE_BANDS.map(([k, l]) => <option key={k} value={k}>{k ? l : "Valor: todos"}</option>)}
          </select>
        </span>
        <span className="vtoggle" role="group" aria-label="Modo de exibição">
          {([["grid", "Imagens", "Ver com imagens"], ["rows", "Lista", "Ver em lista, sem imagens"]] as const).map(([v, l, t]) => (
            <button key={v} type="button" title={t} aria-pressed={view === v} onClick={() => { setView(v); writeJSON("mdp-modo", v); }}>
              {v === "grid"
                ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>}
              <span>{l}</span>
            </button>
          ))}
        </span>
      </div>
      <div className="wrap">
        <p className="status">
          <b>{totalCopies}</b> cartas em <b>{lists.length}</b> {lists.length === 1 ? "deck" : "decks"}
          {col.cards.length > 0 && <> (<button type="button" className="linkish" onClick={() => setDlg("dash")}>ver painel com gráficos</button>)</>}<span className="sep">·</span>
          {mode.kind === "cloud" ? <>Salvo na sua conta (<b>{mode.email}</b>)</> : supabase ? "Entre para montar e salvar decks na nuvem." : "Salvo só neste navegador"}
        </p>
        {ready && !canEdit && lists.length > 0 && (
          <div className="banner">
            <span><b>Você está sem conta:</b> estes decks só podem ser vistos. Para montar e editar decks, crie uma conta grátis.</span>
            <button type="button" className="btn act" onClick={() => setNeedLogin(true)}>Criar conta</button>
            <button type="button" className="btn ghost" onClick={() => setDlg("login")}>Entrar</button>
          </div>
        )}
        {mode.kind === "cloud" && localCount > 0 && !hideUpload && (
          <div className="banner">
            <span>Você tem <b>{localCount}</b> cartas salvas só neste navegador. Quer enviar para a sua conta?</span>
            <button type="button" className="btn act" onClick={async () => { await uploadLocal(); setHideUpload(true); writeJSON("mdp-esconder-envio", true); }}>Enviar para minha conta</button>
            <button type="button" className="btn ghost" onClick={() => { setHideUpload(true); writeJSON("mdp-esconder-envio", true); }}>Agora não</button>
          </div>
        )}
      </div>

      <main className="wrap">
        <SearchPanel query={q} defaultList={tabOk} onOpen={openHits} onCatalog={(s) => { presetCatalogQuery(s); setDlg("catalog"); }} />
        {!ready && <p className="empty">Carregando seus decks…</p>}
        {ready && !lists.length && !nq && (
          <div className="welcome">
            <h2>Comece a sua coleção</h2>
            {canEdit ? <>
              <p>Monte decks com as cartas que você tem, as que quer comprar ou de qualquer tema. É grátis.</p>
              <div className="welcome-acts">
                <button type="button" className="btn act" onClick={() => setDlg("catalog")}>Adicionar cartas</button>
                <button type="button" className="btn" onClick={openPresets}>Ver decks prontos</button>
                <button type="button" className="btn ghost" onClick={() => setDlg("lists")}>Criar um deck vazio</button>
              </div>
            </> : <>
              <p><b>Para montar seus decks, crie uma conta.</b> É grátis, e os decks ficam salvos em qualquer aparelho e no seu perfil de treinador.
                Sem conta, você pode ver os decks prontos, o catálogo de cartas e os decks dos outros treinadores.</p>
              <div className="welcome-acts">
                <button type="button" className="btn act" onClick={() => setNeedLogin(true)}>Criar conta grátis</button>
                <button type="button" className="btn ghost" onClick={() => setDlg("login")}>Entrar</button>
                <button type="button" className="btn" onClick={openPresets}>Ver decks prontos</button>
                <button type="button" className="btn ghost" onClick={() => setDlg("catalog")}>Ver o catálogo</button>
              </div>
            </>}
          </div>
        )}
        {ready && !sections.length && lists.length > 0 && (
          <p className="empty">{filtered ? "Nenhuma carta dos seus decks combina com essa busca e esses filtros." : "Seus decks estão vazios."}</p>
        )}
        {sections.map(({ list, total, items, groups, check }) => (
          <section key={list.id} className="deck-sec">
            <h2>{list.name}<small>{total} {total === 1 ? "carta" : "cartas"}{values.get(list.id)! > 0 && <> · ≈ {brl(values.get(list.id)!)}</>}</small></h2>
            {total > 0 && <DeckRules check={check} />}
            {!items.length && <p className="empty">Este deck está vazio. Use "Adicionar cartas", um deck pronto ou mova cartas de outro deck para cá.</p>}
            {groups.map(({ g, cards }) => (
              <div key={g}>
                <h3>{g} <small>{copies(cards)}</small></h3>
                {view === "grid" ? (
                  <div className="grid">
                    {cards.map((c) => (
                      <CardTile key={c.id} card={c} info={info(c)} n={numbers[c.id]} srcKey={userCardSources(c, "low").join("|")} onOpen={open} onRemove={removeCard} onQty={setQuantity} />
                    ))}
                  </div>
                ) : (
                  <div className="rows">{cards.map((c) => <Row key={c.id} card={c} info={info(c)} n={numbers[c.id]} onOpen={open} onRemove={removeCard} />)}</div>
                )}
              </div>
            ))}
          </section>
        ))}
      </main>
      <Footer />

      <CardModal cardId={cardId} numbers={numbers} onClose={() => setCardId(null)} onStep={step}
        canPrev={idx > 0} canNext={idx >= 0 && idx < order.length - 1} onOpenRelated={openHits} />
      <Catalog open={dlg === "catalog"} onClose={() => closeDlg("catalog")} defaultList={tabOk} onPresets={openPresets} footer={bottomNav} />
      <ManageLists open={dlg === "lists"} onClose={() => closeDlg("lists")} onPresets={openPresets} />
      <DetailModal view={det} onClose={() => setDet(null)} defaultDest={tabOk}
        onIndex={(i) => setDet((d) => (d ? { ...d, index: Math.max(0, Math.min(i, d.items.length - 1)) } : d))} />
      {mode.kind === "cloud" && (
        <Modal open={dlg === "account"} onClose={() => closeDlg("account")} label="Sua conta">
          <h4>Sua conta</h4>
          <p className="meta">Conectado como <b>{mode.email}</b>. Seus decks ficam salvos na conta e aparecem em qualquer aparelho.</p>
          <div className="row">
            <button type="button" onClick={() => setDlg("dash")}>Meu painel</button>
            <button type="button" onClick={() => setDlg("community")}>Meu perfil de treinador</button>
            <button type="button" onClick={() => { setDlg(""); setOver("export"); }}>Exportar decks</button>
            <button type="button" className="danger" onClick={() => { setDlg(""); void signOut(); }}>Sair</button>
          </div>
        </Modal>
      )}
      {bottomNav}
    </>
  );
}

/* Avisos das regras do formato (não bloqueiam): 60 cartas, até 4 com o mesmo nome, Padrão/Expandido */
function DeckRules({ check }: { check: ReturnType<typeof checkDeck> }) {
  const bits: ReactNode[] = [];
  bits.push(check.total === 60 ? <span key="t" className="rule ok">✓ 60 cartas</span> : <span key="t" className="rule warn" title="Um deck de Pokémon TCG tem exatamente 60 cartas">{check.total} de 60 cartas</span>);
  if (check.over.length) bits.push(<span key="o" className="rule warn" title="No máximo 4 cópias com o mesmo nome (Energia Básica pode mais)">Mais de 4 cópias: {check.over.map((o) => `${o.name} (${o.n})`).join(", ")}</span>);
  bits.push(check.notStd || check.unknown ? <span key="s" className="rule no" title="Cartas que não podem ser usadas no formato Padrão">Fora do Padrão: {check.notStd + check.unknown}</span> : <span key="s" className="rule ok">✓ Padrão</span>);
  bits.push(check.notExp || check.unknown ? <span key="e" className="rule no" title="Cartas que não podem ser usadas no formato Expandido">Fora do Expandido: {check.notExp + check.unknown}</span> : <span key="e" className="rule ok">✓ Expandido</span>);
  return <p className="rules">{bits}</p>;
}

/* Uma linha do modo Lista: número, cópias, nomes, tipo, coleção e número, HP, raridade e lixeira.
   data-hover guarda a imagem para a prévia ao passar o mouse (a linha não mostra imagem). */
function Row({ card, info, n, onOpen, onRemove }: { card: UserCard; info: CatCard | undefined; n: number; onOpen: (id: string) => void; onRemove: (id: string) => void }) {
  const bits: string[] = [];
  if (info) {
    bits.push(kindLine(info));
    bits.push(`${info.set.pt || info.set.en} · ${info.num}${info.set.ab ? ` (${info.set.ab})` : ""}`);
    if (info.hp) bits.push(`HP ${info.hp}`);
    if (info.rarity) bits.push(rarityPt(info.rarity));
    if (info.lo > 0) bits.push(brl(info.lo) + (info.hi > info.lo * 1.15 ? " – " + brl(info.hi) : ""));
  }
  return (
    <div className="roww">
      <button type="button" className="rowc" data-hover={userCardSources(card, "low")[0] || ""} onClick={() => onOpen(card.id)}>
        <span className="n">{n}</span>
        <span className="names"><b>{card.quantity > 1 && <span className="qty-x">{card.quantity}×</span>}{card.namePt}</b><span>{norm(card.nameEn) !== norm(card.namePt) ? card.nameEn : "Nome original em inglês"}</span></span>
        <span className="meta2">{bits.length ? bits.map((b, i) => <span key={i} style={{ display: "block" }}>{b}</span>) : "Carregando dados…"}</span>
      </button>
      <button type="button" className="cdel" aria-label={`Remover ${card.namePt} do deck`} title="Remover do deck" onClick={() => onRemove(card.id)}>{ICON_TRASH}</button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="wrap site-foot">
      <div className="sf-brand">
        <Logo size={28} />
        <span><b>My<em>Deck</em> Pokémon</b><small>Coleção e decks de Pokémon Estampas Ilustradas (TCG)</small></span>
      </div>
      <dl className="sf-src">
        <div><dt>Dados e imagens das cartas</dt><dd>API pública e servidor de imagens da TCGdex (tcgdex.dev), com os nomes, textos e cartas impressas em português quando existem.</dd></div>
        <div><dt>Valor de mercado</dt><dd>Preços do TCGplayer (US$) e do Cardmarket (€) informados pela TCGdex, convertidos em reais pela cotação do dia (AwesomeAPI, Frankfurter ou ExchangeRate-API).</dd></div>
        <div><dt>Decks prontos</dt><dd>Decks de torneio e do meta: Limitless TCG. Decks oficiais: listas do projeto Pokémon TCG Data e fotos das caixas do catálogo do TCGplayer. Retratos dos personagens: Pokémon Wiki (Fandom).</dd></div>
      </dl>
      <p className="sf-legal">Site de fãs, sem fins lucrativos e sem ligação com a Nintendo, a The Pokémon Company, a Game Freak ou a Creatures. Pokémon e as imagens das cartas pertencem aos seus donos.</p>
    </footer>
  );
}
