import type { ApiCard, CatCard } from "../types";
import { getCatalog } from "../lib/catalog";
import { brl } from "../lib/util";

const VARIANT_PT: Record<string, string> = {
  normal: "Normal", holofoil: "Holo", "reverse-holofoil": "Reverse holo", "1st-edition": "1ª edição", "1st-edition-holofoil": "1ª edição holo",
  "unlimited": "Ilimitada", "unlimited-holofoil": "Ilimitada holo",
};
const money = (v: number, cur: "USD" | "EUR") => v.toLocaleString("pt-BR", { style: "currency", currency: cur });

/* Valor de mercado de uma carta: menor e maior em reais (versão mais barata e mais cara), o preço em cada loja e a cotação.
   Os preços da janela vêm da consulta na hora à TCGdex (live); sem ela, os do catálogo (gerado todo dia). */
export function PriceLine({ card, live, qty = 1 }: { card: CatCard; live?: ApiCard | null; qty?: number }) {
  const rate = getCatalog()?.rate;
  if (!rate) return null;
  const tcg = live?.pricing?.tcgplayer, cm = live?.pricing?.cardmarket;
  const tcgRows: [string, number][] = [];
  for (const [k, v] of Object.entries(tcg || {})) {
    if (!v || typeof v !== "object") continue;
    const p = v as { marketPrice?: number; midPrice?: number; lowPrice?: number };
    const x = p.marketPrice || p.midPrice || p.lowPrice;
    if (x) tcgRows.push([VARIANT_PT[k] || k, x]);
  }
  const dia = new Date(rate.data + "T12:00").toLocaleDateString("pt-BR");
  if (!(card.lo > 0) && !tcgRows.length && !cm?.avg && !cm?.trend)
    return <div className="price-line"><span className="pl-k">Valor de mercado</span><span className="pl-none">sem preço informado pelas lojas</span></div>;
  return (
    <div className="price-line">
      <span className="pl-k">Valor de mercado</span>
      <span className="pl-v">
        <b>{brl(card.lo)}</b>{card.hi > card.lo * 1.15 && <> – <b>{brl(card.hi)}</b></>}
        {qty > 1 && <small> · ×{qty} = {brl(card.lo * qty)}</small>}
      </span>
      {(tcgRows.length > 0 || cm) && (
        <span className="pl-src">
          {tcgRows.length > 0 && <>TCGplayer: {tcgRows.map(([k, v]) => `${k} ${money(v, "USD")}`).join(" · ")}</>}
          {tcgRows.length > 0 && cm && <br />}
          {cm && (cm.avg || cm.trend) ? <>Cardmarket: média {money(cm.avg || cm.trend || 0, "EUR")}{cm.low ? ` · mínimo ${money(cm.low, "EUR")}` : ""}{cm.trend ? ` · tendência ${money(cm.trend, "EUR")}` : ""}{cm.avg30 ? ` · 30 dias ${money(cm.avg30, "EUR")}` : ""}{cm["avg-holo"] ? ` · holo ${money(cm["avg-holo"], "EUR")}` : ""}</> : null}
        </span>
      )}
      <span className="pl-note">Menor valor = versão mais barata desta carta; maior = versão mais cara (holo, reverse, 1ª edição…). O preço muda com a raridade, a versão e o estado.
        Cotação de {dia} ({rate.fonte}): US$ 1 = {brl(rate.usd)} · € 1 = {brl(rate.eur)}.</span>
    </div>
  );
}
