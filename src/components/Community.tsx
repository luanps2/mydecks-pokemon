import { useEffect, useMemo, useState } from "react";
import type { CatCard, Hit } from "../types";
import { useCatalog, type Catalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { fetchCommunity, fetchListCards, fetchProfile, myProfile, profileLink, renameMe, type Profile, type PublicCard, type PublicList } from "../lib/social";
import { supabase } from "../lib/supabase";
import { norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { Modal } from "./Modal";
import { PriceTag } from "./PriceTag";
import { PokeLoader } from "./PokeLoader";

/* Carta de um deck público no formato da janela de detalhes (pelo código da carta no catálogo) */
function toHit(c: PublicCard, cat: Catalog | null): (Hit & { card: CatCard }) | null {
  const card = c.cardId ? cat?.byId.get(c.cardId) : undefined;
  return card ? { card, qty: c.quantity || 1 } : null;
}
/* Imagem própria (link) que a pessoa pôs na carta vem primeiro */
const ownImg = (c: PublicCard) => (c.customImage && /^https?:/.test(c.customImage) ? [c.customImage] : []);

export function Avatar({ p, size = 44 }: { p: Pick<Profile, "name" | "avatar">; size?: number }) {
  const [bad, setBad] = useState(false);
  return p.avatar && !bad
    ? <img className="av" src={p.avatar} alt="" referrerPolicy="no-referrer" width={size} height={size} style={{ width: size, height: size }} onError={() => setBad(true)} />
    : <span className="av av-txt" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.42 }}>{(p.name || "?").charAt(0).toUpperCase()}</span>;
}

/* ===== Treinadores: os decks públicos das outras pessoas, como uma rede social de decks =====
   Lista de treinadores → perfil (foto, nome, decks) → cartas do deck. Dá para copiar um deck para os seus (com as cópias). */
export function Community({ open, onClose, profileId, onProfile, onOpenCards, onManage, onLogin }: {
  open: boolean;
  onClose: () => void;
  /** perfil aberto (null = lista de treinadores) */
  profileId: string | null;
  onProfile: (id: string | null) => void;
  onOpenCards: (hits: Hit[], index: number) => void;
  onManage: () => void;
  onLogin: () => void;
}) {
  const { col, mode, addCards, createList, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [all, setAll] = useState<{ profile: Profile; lists: PublicList[] }[] | null | "erro">(null);
  const [prof, setProf] = useState<{ id: string; data: { profile: Profile; lists: PublicList[] } | null | "erro" } | null>(null);
  const [listId, setListId] = useState("");
  const [cards, setCards] = useState<{ id: string; list: PublicCard[] | null | "erro" } | null>(null);
  const [q, setQ] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [myName, setMyName] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = mode.kind === "cloud" ? mode.userId : "";
  const { cat } = useCatalog();

  // lista de treinadores: busca ao abrir (de novo a cada abertura, para ver as novidades)
  useEffect(() => {
    if (!open || profileId || !supabase) return;
    let alive = true;
    fetchCommunity().then((r) => { if (alive) setAll(r); }, () => { if (alive) setAll("erro"); });
    return () => { alive = false; };
  }, [open, profileId]);
  useEffect(() => {
    if (!open || !uid) return;
    myProfile(uid).then((p) => { setMe(p); setMyName(p?.name || ""); }, () => {});
  }, [open, uid]);
  // perfil aberto
  useEffect(() => {
    if (!open || !profileId || !supabase) return;
    let alive = true;
    fetchProfile(profileId).then((d) => {
      if (!alive) return;
      setProf({ id: profileId, data: d });
      setListId(d?.lists[0]?.id || "");
    }, () => { if (alive) setProf({ id: profileId, data: "erro" }); });
    return () => { alive = false; };
  }, [open, profileId]);
  // cartas da lista escolhida no perfil
  useEffect(() => {
    if (!open || !listId) return;
    let alive = true;
    fetchListCards(listId).then((l) => {
      if (alive) setCards({ id: listId, list: l });
    }, () => { if (alive) setCards({ id: listId, list: "erro" }); });
    return () => { alive = false; };
  }, [open, listId]);

  const myPublic = col.lists.filter((l) => l.visibility === "public").length;
  const shown = useMemo(() => {
    if (!Array.isArray(all)) return [];
    // o próprio perfil usa o nome e a foto da conta conectada se o banco ainda não tiver
    const fix = all.map((x) => x.profile.id !== uid || mode.kind !== "cloud" ? x
      : { ...x, profile: { ...x.profile, name: me?.name && me.name !== "Treinador" ? me.name : mode.name || x.profile.name, avatar: x.profile.avatar || me?.avatar || mode.avatar } });
    const n = norm(q.trim());
    return n ? fix.filter((x) => norm(x.profile.name).includes(n) || x.lists.some((l) => norm(l.name).includes(n))) : fix;
  }, [all, q, uid, me, mode]);

  async function copyList(l: PublicList, list: PublicCard[], owner: string) {
    if (!canEdit) { askLogin(); return; }
    const hits = list.map((c) => toHit(c, cat)).filter((h): h is Hit & { card: CatCard } => !!h);
    if (!hits.length) { toast("Esse deck não tem cartas para copiar."); return; }
    const name = `${l.name} (de ${owner})`.slice(0, 120);
    if (!confirm(`Criar o deck "${name}" com ${hits.length} cartas nos seus decks?`)) return;
    setBusy(true);
    const n = await addCards(hits, createList(name));
    setBusy(false);
    toast(`Deck "${name}" criado com ${n} cartas.`);
  }

  let body;
  if (!supabase) {
    body = <p className="note">Esta versão do site não está ligada a uma conta, por isso não há decks de outros treinadores para ver.</p>;
  } else if (!profileId) {
    body = (
      <>
        <div className="cm-head">
          <div>
            <h4>Treinadores</h4>
            <p className="meta">Todos os treinadores do MyDeck Pokémon. Clique num treinador para ver o perfil e os decks dele.</p>
          </div>
          <input type="search" className="cm-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar treinador ou deck" aria-label="Buscar treinador ou deck" />
        </div>

        <div className="cm-me">
          {mode.kind === "cloud" ? (
            <>
              <Avatar p={{ name: me?.name || mode.name || mode.email, avatar: me?.avatar || mode.avatar }} size={52} />
              <div className="cm-me-txt">
                <b>Seu perfil</b>
                <small>{myPublic ? `${myPublic} ${myPublic === 1 ? "deck público" : "decks públicos"}: outras pessoas podem ver.` : "Você ainda não tem decks públicos: seu perfil aparece sem decks."}</small>
                <form className="row" onSubmit={async (e) => {
                  e.preventDefault();
                  const v = myName.trim().slice(0, 60);
                  if (!v) { toast("Digite um nome."); return; }
                  try { await renameMe(mode.userId, v); setMe((p) => (p ? { ...p, name: v } : p)); toast("Nome do perfil salvo."); }
                  catch { toast("Não foi possível salvar o nome agora. Tente de novo."); }
                }}>
                  <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Nome que aparece para os outros" aria-label="Nome do perfil" maxLength={60} />
                  <button type="submit">Salvar nome</button>
                </form>
              </div>
              <div className="cm-me-act">
                <button type="button" className="success" onClick={onManage}>Gerenciar meus decks</button>
                {myPublic > 0 && <button type="button" onClick={() => onProfile(mode.userId)}>Ver meu perfil</button>}
              </div>
            </>
          ) : (
            <>
              <div className="cm-me-txt"><b>Quer aparecer aqui?</b><small>Entre com a sua conta: os decks que você criar aparecem no seu perfil (a não ser que marque "Deck privado").</small></div>
              <div className="cm-me-act"><button type="button" className="success" onClick={onLogin}>Entrar</button></div>
            </>
          )}
        </div>

        {all === null && <PokeLoader />}
        {all === "erro" && <p className="note">Não foi possível carregar os treinadores agora. Tente de novo mais tarde.</p>}
        {Array.isArray(all) && !shown.length && <p className="empty">{q ? "Ninguém com esse nome ou deck." : "Ainda não há treinadores cadastrados."}</p>}
        <div className="cm-grid">
          {shown.map(({ profile, lists }) => {
            const total = lists.reduce((s, l) => s + l.count, 0);
            const covers = lists.flatMap((l) => l.covers).slice(0, 3);
            return (
              <button key={profile.id} type="button" className="cm-card" onClick={() => onProfile(profile.id)}>
                <span className="cm-fan">{covers.length ? covers.map((id) => { const c = cat?.byId.get(id); return c ? <CardImage key={id} sources={cardSources(c, "low")} alt="" /> : null; }) : <span className="cm-backs" aria-hidden="true"><i /><i /><i /></span>}</span>
                <span className="cm-who">
                  <Avatar p={profile} size={48} />
                  <span><b>{profile.name}{profile.id === uid && " (você)"}</b><small>{lists.length ? `${lists.length} ${lists.length === 1 ? "deck" : "decks"} · ${total.toLocaleString("pt-BR")} cartas` : "Ainda sem decks públicos"}</small></span>
                </span>
                <span className="cm-lists">{lists.slice(0, 4).map((l) => <span key={l.id}>{l.name}</span>)}{lists.length > 4 && <span>+{lists.length - 4}</span>}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    const d = prof?.id === profileId ? prof.data : null;
    const cur = Array.isArray(cards?.list) && cards?.id === listId ? cards.list : null;
    const lst = d && d !== "erro" ? d.lists.find((l) => l.id === listId) : undefined;
    const pairs = cur ? cur.map((c) => ({ c, h: toHit(c, cat) })) : [];
    const hits = pairs.map((p) => p.h).filter((h): h is Hit & { card: CatCard } => !!h);
    body = (
      <>
        <button type="button" className="cm-back" onClick={() => onProfile(null)}>← Todos os treinadores</button>
        {d === null && <PokeLoader />}
        {d === "erro" && <p className="note">Não foi possível abrir este perfil agora.</p>}
        {d && d !== "erro" && (
          <>
            <div className="cm-profile">
              <Avatar p={d.profile} size={84} />
              <div>
                <h4>{d.profile.name}{d.profile.id === uid && <small> (você)</small>}</h4>
                <p className="meta">{d.lists.length} {d.lists.length === 1 ? "deck público" : "decks públicos"} · {d.lists.reduce((s, l) => s + l.count, 0).toLocaleString("pt-BR")} cartas</p>
              </div>
              <button type="button" className="cm-share" onClick={async () => {
                try { await navigator.clipboard.writeText(profileLink(d.profile.id)); toast("Link do perfil copiado."); }
                catch { prompt("Copie o link do perfil:", profileLink(d.profile.id)); }
              }}>Copiar link do perfil</button>
            </div>
            {!d.lists.length && <p className="empty">Este treinador não tem decks públicos no momento.</p>}
            {d.lists.length > 0 && (
              <div className="cm-tabs" role="tablist" aria-label="Decks do treinador">
                {d.lists.map((l) => (
                  <button key={l.id} type="button" role="tab" aria-selected={l.id === listId} onClick={() => setListId(l.id)}>
                    {l.name} <span className="n">{l.count}</span>
                  </button>
                ))}
              </div>
            )}
            {lst && (
              <div className="cm-listbar">
                <span>{lst.count} {lst.count === 1 ? "carta" : "cartas"}</span>
                {cur && d.profile.id !== uid && (
                  <button type="button" className="success" disabled={busy} onClick={() => void copyList(lst, cur, d.profile.name)}>Copiar para os meus decks</button>
                )}
              </div>
            )}
            {listId && (cards?.id !== listId || cards.list === null) && <PokeLoader />}
            {cards?.id === listId && cards.list === "erro" && <p className="note">Não foi possível carregar as cartas deste deck.</p>}
            {cur && (
              <div className="pgrid cm-cards">
                {pairs.map(({ c, h }) => {
                  const i = h ? hits.indexOf(h) : -1;
                  const srcs = [...ownImg(c), ...(h ? cardSources(h.card, "low") : [])];
                  return (
                    <button key={c.id} type="button" className="pcard" aria-pressed="true" disabled={!h} onClick={() => h && onOpenCards(hits, i)}
                      title={norm(c.namePt) !== norm(c.nameEn) ? `${c.namePt} (${c.nameEn})` : c.nameEn}>
                      <span className="img">{c.quantity > 1 && <span className="qty-badge">×{c.quantity}</span>}{srcs.length ? <CardImage sources={srcs} alt={c.namePt} /> : <span className="ph">{cat ? "Sem imagem" : "Carregando…"}</span>}</span>
                      <span className="pt">{c.namePt}</span>
                      {norm(c.namePt) !== norm(c.nameEn) && <span className="en">{c.nameEn}</span>}
                      <PriceTag card={h?.card} />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    );
  }
  return <Modal open={open} onClose={onClose} label="Treinadores" className="small cm">{body}</Modal>;
}
