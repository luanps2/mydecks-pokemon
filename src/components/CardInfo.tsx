import type { ReactNode } from "react";
import type { ApiCard, CatCard, EnergyType } from "../types";
import { CAT_PT, TYPES, kindLine, rarityPt, seriePt, stagePt, subPt, typeOf } from "../lib/labels";

/** Bolinha de energia (custo dos ataques, tipo, fraqueza): cor do tipo e a letra; o nome aparece ao passar o mouse */
export function Energy({ t }: { t: string | EnergyType }) {
  const k = (t.length === 1 ? t : typeOf(t)) as EnergyType | undefined;
  const d = k ? TYPES[k] : undefined;
  return <span className="nrg" style={d ? { background: d.bg, color: d.fg } : undefined} title={d?.pt || t} aria-label={d?.pt || t}>{k || "?"}</span>;
}

const dateBr = (d: string) => (d ? new Date(d + "T12:00").toLocaleDateString("pt-BR") : "");
/* {L}, {R}… no texto dos ataques viram bolinhas de energia */
function rich(text = ""): ReactNode {
  const parts = text.split(/(\{[A-Z]\})/g);
  return parts.map((p, i) => (/^\{[A-Z]\}$/.test(p) ? <Energy key={i} t={p[1]} /> : p));
}

/* Dados de uma carta: tipo, HP, estágio, habilidades, ataques (custo e dano), fraqueza, resistência, recuo, regras,
   coleção, número, raridade, ilustrador, marca de regulação e legalidade. Texto em português quando a carta saiu no
   Brasil; o original em inglês fica num "ver texto em inglês". */
export function CardInfo({ card, pt, en, loading }: { card: CatCard; pt: ApiCard | null; en: ApiCard | null; loading: boolean }) {
  const main = pt || en;
  const rows: [string, ReactNode][] = [];
  const add = (k: string, v: ReactNode) => { if (v !== "" && v != null && v !== false) rows.push([k, v]); };
  add("Categoria", kindLine(card) || CAT_PT[card.cat]);
  if (card.cat === 0) {
    add("Tipo", card.types.length ? <span className="nrg-row">{card.types.map((t) => <span key={t}><Energy t={t} /> {TYPES[t].pt}</span>)}</span> : "");
    add("HP", card.hp || "");
    add("Estágio", stagePt(card.stage) + (card.evolveFrom ? ` · evolui de ${card.evolveFrom}` : ""));
  } else add("Subtipo", subPt(card.sub));
  add("Coleção", <>{card.set.pt || card.set.en}{card.set.pt && card.set.en && card.set.pt !== card.set.en ? <small> ({card.set.en})</small> : null} · {seriePt(card.set.s)}</>);
  add("Número", `${card.num}${card.set.n ? "/" + String(card.set.n).padStart(card.num.length, "0") : ""}${card.set.ab ? " · " + card.set.ab : ""}`);
  add("Lançamento", dateBr(card.set.d));
  add("Raridade", rarityPt(card.rarity));
  add("Ilustrador", card.illus);
  add("Regulação", card.reg ? `Marca ${card.reg}` : "");
  add("Legalidade", <span className="legal"><b className={card.std ? "ok" : "no"}>{card.std ? "✓" : "✗"} Padrão</b> <b className={card.exp ? "ok" : "no"}>{card.exp ? "✓" : "✗"} Expandido</b></span>);

  const ab = main?.abilities || [], atk = main?.attacks || [];
  const effect = main?.effect || "";
  const enText = en && pt ? [...(en.abilities || []).map((a) => `${a.name}: ${a.effect}`), ...(en.attacks || []).map((a) => `${a.name}${a.damage ? " (" + a.damage + ")" : ""}${a.effect ? ": " + a.effect : ""}`), en.effect || ""].filter(Boolean).join("\n\n") : "";
  return (
    <>
      <dl>{rows.map(([k, v]) => <div key={k} className="dlrow"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {loading && !main && <p className="note">Buscando os textos da carta…</p>}
      {!loading && !main && <p className="note">Não foi possível buscar os textos da carta agora (sem internet ou a API não respondeu).</p>}
      {(ab.length > 0 || atk.length > 0 || effect) && (
        <div className="moves">
          {ab.map((a, i) => (
            <div key={"a" + i} className="move ability">
              <div className="move-h"><span className="ab-tag">{a.type || "Habilidade"}</span><b>{a.name}</b></div>
              {a.effect && <p>{rich(a.effect)}</p>}
            </div>
          ))}
          {atk.map((a, i) => (
            <div key={"t" + i} className="move">
              <div className="move-h">
                <span className="cost">{(a.cost || []).map((c, j) => <Energy key={j} t={c} />)}</span>
                <b>{a.name}</b>
                {a.damage != null && a.damage !== "" && <span className="dmg">{a.damage}</span>}
              </div>
              {a.effect && <p>{rich(a.effect)}</p>}
            </div>
          ))}
          {effect && <div className="move"><p>{rich(effect)}</p></div>}
        </div>
      )}
      {card.cat === 0 && main && (
        <div className="wrr">
          <span><small>Fraqueza</small>{main.weaknesses?.length ? main.weaknesses.map((w, i) => <b key={i}><Energy t={w.type} /> {w.value || ""}</b>) : <b>—</b>}</span>
          <span><small>Resistência</small>{main.resistances?.length ? main.resistances.map((w, i) => <b key={i}><Energy t={w.type} /> {w.value || ""}</b>) : <b>—</b>}</span>
          <span><small>Recuo</small><b>{main.retreat ? Array.from({ length: main.retreat }, (_, i) => <Energy key={i} t="C" />) : "—"}</b></span>
        </div>
      )}
      {(pt?.description || en?.description) && <p className="flavor">{pt?.description || en?.description}</p>}
      {!pt && en && <p className="note">Esta carta não saiu em português (ou a API ainda não tem a tradução): o texto está em inglês.</p>}
      {enText && <details className="det-more"><summary>Texto original (inglês)</summary><div className="desc">{enText}</div></details>}
    </>
  );
}
