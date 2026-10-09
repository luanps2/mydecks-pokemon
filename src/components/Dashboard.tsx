import { useMemo, useState, type MouseEvent } from "react";
import { useCatalog } from "../lib/catalog";
import { TYPES, TYPE_ORDER, rarityPt, stagePt } from "../lib/labels";
import { brl, copies, norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { Modal } from "./Modal";

/* ===== Meu painel: números e gráficos dos decks =====
   Cores das categorias validadas com o validador do skill dataviz (daltonismo, claro e escuro):
   Pokémon azul, Treinador laranja, Energia verde-água; série única azul. Os valores ficam escritos (o verde-água
   tem pouco contraste no modo claro) e há a visão em tabela. Todas as contagens somam as cópias. */
type Kind = "p" | "t" | "e";
const KINDS: { k: Kind; label: string }[] = [{ k: "p", label: "Pokémon" }, { k: "t", label: "Treinador" }, { k: "e", label: "Energia" }];
const STAGE_ORDER = ["Basic", "Stage1", "Stage2", "BREAK", "LEVEL-UP", "MEGA", "VMAX", "VSTAR", "V-UNION", "RESTORED", "Restored", "Baby"];

interface Bar { label: string; value: number }
interface Tip { x: number; y: number; title: string; lines: string[] }
const pct = (v: number, t: number) => (t ? Math.round((v / t) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const sortDesc = (m: Map<string, number>) => [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const add = (m: Map<string, number>, k: string, q: number) => m.set(k, (m.get(k) || 0) + q);

/* Barras horizontais de uma série só (rótulo à esquerda, valor na ponta) */
function HBars({ data, total, unit, onTip, onHide }: { data: Bar[]; total: number; unit: string; onTip: (e: MouseEvent, title: string, lines: string[]) => void; onHide: () => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hb">
      {data.map((d) => (
        <div key={d.label} className="hb-row" onMouseMove={(e) => onTip(e, d.label, [`${fmt(d.value)} ${unit}`, `${pct(d.value, total)}% do total`])} onMouseLeave={onHide}>
          <span className="hb-l">{d.label}</span>
          <span className="hb-track"><span className="hb-bar" style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="hb-v">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { col } = useCollection();
  const { cat } = useCatalog();
  const [listId, setListId] = useState("");
  const [table, setTable] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const lists = useMemo(() => [...col.lists].sort((a, b) => a.position - b.position), [col.lists]);
  const sel = lists.some((l) => l.id === listId) ? listId : "";

  const s = useMemo(() => {
    const cards = col.cards.filter((c) => !sel || c.listId === sel);
    const kind = { p: 0, t: 0, e: 0 }, types = new Map<string, number>(), stage = new Map<string, number>(), rar = new Map<string, number>();
    const sets = new Map<string, number>(), hp = new Map<number, number>(), sub = new Map<string, number>();
    const perList = new Map<string, { p: number; t: number; e: number; x: number }>();
    const top = new Map<string, { name: string; qty: number; unit: number }>();
    let noData = 0, value = 0, priced = 0;
    for (const l of lists) perList.set(l.id, { p: 0, t: 0, e: 0, x: 0 });
    for (const u of cards) {
      const c = u.cardId ? cat?.byId.get(u.cardId) : undefined, pl = perList.get(u.listId), q = u.quantity || 1;
      if (!c) { noData += q; if (pl) pl.x += q; continue; }
      const k: Kind = c.cat === 0 ? "p" : c.cat === 1 ? "t" : "e";
      kind[k] += q;
      if (pl) pl[k] += q;
      if (c.cat === 0) {
        for (const t of c.types.slice(0, 1)) add(types, t, q);
        add(stage, c.stage || "Sem estágio", q);
        if (c.hp) { const b = Math.min(340, Math.floor(c.hp / 20) * 20); hp.set(b, (hp.get(b) || 0) + q); }
      } else add(sub, c.cat === 1 ? ({ Supporter: "Apoiador", Item: "Item", Stadium: "Estádio", Tool: "Ferramenta" } as Record<string, string>)[c.sub] || "Outros Treinadores" : c.sub === "Special" ? "Energia Especial" : "Energia Básica", q);
      if (c.rarity) add(rar, rarityPt(c.rarity), q);
      add(sets, c.set.pt || c.set.en, q);
      if (c.lo > 0) {
        value += c.lo * q; priced += q;
        const t = top.get(c.id) || { name: `${u.namePt} (${c.set.ab || c.set.id} ${c.num})`, qty: 0, unit: c.lo };
        t.qty += q; top.set(c.id, t);
      }
    }
    return {
      total: copies(cards), unique: new Set(cards.map((c) => norm(c.nameEn))).size, noData, kind, value, priced,
      perList: lists.filter((l) => !sel || l.id === sel).map((l) => ({ name: l.name, ...perList.get(l.id)! })),
      types: TYPE_ORDER.map((t) => ({ label: TYPES[t].pt, value: types.get(t) || 0, t })).filter((b) => b.value),
      stage: [...stage].map(([k, value]) => ({ label: stagePt(k), value, o: STAGE_ORDER.indexOf(k) })).sort((a, b) => (a.o < 0 ? 99 : a.o) - (b.o < 0 ? 99 : b.o)),
      rar: sortDesc(rar).slice(0, 10), sets: sortDesc(sets).slice(0, 10), sub: sortDesc(sub),
      hp: [...hp].sort((a, b) => a[0] - b[0]).map(([b, value]) => ({ label: b >= 340 ? "340+" : String(b), value })),
      top: [...top.values()].sort((a, b) => b.unit * b.qty - a.unit * a.qty).slice(0, 8),
    };
  }, [col.cards, lists, sel, cat]);

  const known = s.kind.p + s.kind.t + s.kind.e;
  const showTip = (e: MouseEvent, title: string, lines: string[]) => setTip({ x: e.clientX, y: e.clientY, title, lines });
  const hide = () => setTip(null);
  const empty = !s.total;

  return (
    <Modal open={open} onClose={() => { hide(); onClose(); }} label="Meu painel" className="small dash">
      <div className="dash-head">
        <div>
          <h4>Meu painel</h4>
          <p className="meta">Os números dos seus decks: quantas cartas, de que tipo, quanto valem e como se dividem.</p>
        </div>
        <div className="dash-filters">
          <label>Mostrar
            <select value={sel} onChange={(e) => setListId(e.target.value)} aria-label="Escolher o deck">
              <option value="">Todos os decks</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <span className="vtoggle" role="group" aria-label="Ver como">
            <button type="button" aria-pressed={!table} onClick={() => setTable(false)}>Gráficos</button>
            <button type="button" aria-pressed={table} onClick={() => setTable(true)}>Tabela</button>
          </span>
        </div>
      </div>

      {empty ? <p className="empty">Ainda não há cartas {sel ? "neste deck" : "nos seus decks"}. Adicione cartas para ver os números aqui.</p> : (
        <>
          <div className="tiles">
            {!sel && <div className="tile"><small>Decks</small><b>{fmt(lists.length)}</b></div>}
            <div className="tile"><small>Cartas</small><b>{fmt(s.total)}</b></div>
            <div className="tile"><small>Cartas diferentes</small><b>{fmt(s.unique)}</b></div>
            {s.value > 0 && <div className="tile tile-money" title="Soma do menor valor de mercado de cada carta, vezes as cópias (cotação do dia)"><small>Valor estimado</small><b>{brl(s.value)}</b>{s.priced < s.total && <em>{fmt(s.total - s.priced)} sem preço</em>}</div>}
            {KINDS.map(({ k, label }) => (
              <div key={k} className="tile"><small><i className={"sw sw-" + k} aria-hidden="true" />{label}</small><b>{fmt(s.kind[k])}</b><em>{pct(s.kind[k], known)}%</em></div>
            ))}
          </div>
          {s.noData > 0 && <p className="note">{fmt(s.noData)} {s.noData === 1 ? "carta não está" : "cartas não estão"} no catálogo (ou ele ainda está carregando): ficam fora dos gráficos.</p>}

          {table ? (
            <div className="dash-tables">
              {([
                ["Por categoria", KINDS.map(({ k, label }) => ({ label, value: s.kind[k] })), known],
                ["Tipos de energia (Pokémon)", s.types, s.kind.p],
                ["Estágios", s.stage, s.kind.p],
                ["Treinadores e Energias", s.sub, s.kind.t + s.kind.e],
                ["Raridades", s.rar, known],
                ["Coleções mais presentes", s.sets, known],
                ["HP dos Pokémon", s.hp, s.kind.p],
              ] as [string, Bar[], number][]).map(([t, data, total]) => (
                <table key={t}><caption>{t}</caption>
                  <thead><tr><th>Item</th><th>Cartas</th><th>%</th></tr></thead>
                  <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{fmt(d.value)}</td><td>{pct(d.value, total)}%</td></tr>)}</tbody>
                </table>
              ))}
              <table><caption>Por deck</caption>
                <thead><tr><th>Deck</th><th>Pokémon</th><th>Treinador</th><th>Energia</th><th>Total</th></tr></thead>
                <tbody>{s.perList.map((l) => <tr key={l.name}><td>{l.name}</td><td>{l.p}</td><td>{l.t}</td><td>{l.e}</td><td>{l.p + l.t + l.e + l.x}</td></tr>)}</tbody>
              </table>
              {s.top.length > 0 && (
                <table><caption>Cartas mais valiosas</caption>
                  <thead><tr><th>Carta</th><th>Cópias</th><th>Valor</th></tr></thead>
                  <tbody>{s.top.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.qty}</td><td>{brl(t.unit * t.qty)}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="charts">
              <section className="chart wide">
                <h5>Composição</h5>
                <div className="legend">{KINDS.map(({ k, label }) => <span key={k}><i className={"sw sw-" + k} aria-hidden="true" />{label}</span>)}</div>
                <div className="stack" role="img" aria-label={KINDS.map(({ k, label }) => `${label}: ${s.kind[k]}`).join(", ")}>
                  {KINDS.filter(({ k }) => s.kind[k]).map(({ k, label }) => (
                    <span key={k} className={"seg sw-" + k} style={{ flexGrow: s.kind[k] }}
                      onMouseMove={(e) => showTip(e, label, [`${fmt(s.kind[k])} cartas`, `${pct(s.kind[k], known)}% das cartas`])} onMouseLeave={hide}>
                      {pct(s.kind[k], known) >= 8 && <b>{pct(s.kind[k], known)}%</b>}
                    </span>
                  ))}
                </div>
              </section>

              {!sel && s.perList.length > 1 && (
                <section className="chart wide">
                  <h5>Cartas por deck</h5>
                  <div className="legend">{KINDS.map(({ k, label }) => <span key={k}><i className={"sw sw-" + k} aria-hidden="true" />{label}</span>)}</div>
                  <div className="hb">
                    {(() => {
                      const max = Math.max(1, ...s.perList.map((l) => l.p + l.t + l.e + l.x));
                      return s.perList.map((l) => {
                        const tot = l.p + l.t + l.e + l.x;
                        return (
                          <div key={l.name} className="hb-row" onMouseMove={(e) => showTip(e, l.name, [`${fmt(tot)} cartas`, `Pokémon: ${l.p}`, `Treinador: ${l.t}`, `Energia: ${l.e}`, ...(l.x ? [`Fora do catálogo: ${l.x}`] : [])])} onMouseLeave={hide}>
                            <span className="hb-l">{l.name}</span>
                            <span className="hb-track">
                              <span className="hb-stack" style={{ width: `${(tot / max) * 100}%` }}>
                                {(["p", "t", "e", "x"] as const).filter((k) => l[k]).map((k) => <span key={k} className={"sw-" + k} style={{ flexGrow: l[k] }} />)}
                              </span>
                            </span>
                            <span className="hb-v">{fmt(tot)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>
              )}

              {s.types.length > 0 && <section className="chart"><h5>Tipos de energia dos Pokémon</h5><HBars onTip={showTip} onHide={hide} data={s.types} total={s.kind.p} unit="Pokémon" /></section>}
              {s.stage.length > 0 && <section className="chart"><h5>Estágios</h5><HBars onTip={showTip} onHide={hide} data={s.stage} total={s.kind.p} unit="Pokémon" /></section>}
              {s.hp.length > 0 && (
                <section className="chart">
                  <h5>Curva de HP</h5>
                  <div className="cols">
                    {(() => {
                      const max = Math.max(1, ...s.hp.map((b) => b.value));
                      return s.hp.map((b) => (
                        <div key={b.label} className="col" onMouseMove={(e) => showTip(e, `HP ${b.label}${b.label.endsWith("+") ? "" : "–" + (+b.label + 19)}`, [`${fmt(b.value)} Pokémon`])} onMouseLeave={hide}>
                          <span className="col-track"><span className="col-v">{b.value || ""}</span><span className="col-bar" style={{ height: `${(b.value / max) * 88}%` }} /></span>
                          <span className="col-l">{b.label}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="note">Pokémon agrupados de 20 em 20 pontos de HP.</p>
                </section>
              )}
              {s.sub.length > 0 && <section className="chart"><h5>Treinadores e Energias</h5><HBars onTip={showTip} onHide={hide} data={s.sub} total={s.kind.t + s.kind.e} unit="cartas" /></section>}
              {s.rar.length > 0 && <section className="chart"><h5>Raridades</h5><HBars onTip={showTip} onHide={hide} data={s.rar} total={known} unit="cartas" /></section>}
              {s.sets.length > 0 && <section className="chart"><h5>Coleções mais presentes</h5><HBars onTip={showTip} onHide={hide} data={s.sets} total={known} unit="cartas" /></section>}
              {s.top.length > 0 && (
                <section className="chart wide">
                  <h5>Cartas mais valiosas</h5>
                  <div className="hb">
                    {(() => {
                      const max = Math.max(...s.top.map((t) => t.unit * t.qty));
                      return s.top.map((t) => (
                        <div key={t.name} className="hb-row" onMouseMove={(e) => showTip(e, t.name, [`${brl(t.unit)} cada`, ...(t.qty > 1 ? [`×${t.qty} = ${brl(t.unit * t.qty)}`] : [])])} onMouseLeave={hide}>
                          <span className="hb-l">{t.qty > 1 ? `${t.qty}× ` : ""}{t.name}</span>
                          <span className="hb-track"><span className="hb-bar" style={{ width: `${(t.unit * t.qty / max) * 100}%` }} /></span>
                          <span className="hb-v">{brl(t.unit * t.qty)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="note">Menor valor de mercado de cada carta (a versão mais barata dela); versões raras valem mais.</p>
                </section>
              )}
            </div>
          )}
        </>
      )}
      {tip && (
        <div className="dtip" style={{ left: Math.min(tip.x + 14, innerWidth - 220), top: tip.y + 14 }} role="tooltip">
          <b>{tip.title}</b>{tip.lines.map((l) => <span key={l}>{l}</span>)}
        </div>
      )}
    </Modal>
  );
}
