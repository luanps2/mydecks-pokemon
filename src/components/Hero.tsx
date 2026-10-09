import { useEffect, useState } from "react";
import { useCatalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { loadPresets, presetCover, presetTotals, type Preset } from "../lib/presets";
import { CardImage } from "./CardImage";
import { Portrait } from "./Portrait";

/* Decks em destaque na vitrine (o resto fica em "Ver todos os decks prontos") */
const FEATURED = ["Deck do Ash", "Deck da Misty", "Deck do Brock", "Deck do Gary", "Deck da Equipe Rocket", "Deck do Red", "Deck da Cynthia", "Deck da Liko"];

/* ===== Abertura da página: destaque para os Decks prontos =====
   Cada deck mostra a arte do Pokémon principal (recorte da imagem grande da carta de capa) e o retrato do personagem. */
export function Hero({ onPresets, onCatalog }: { onPresets: (nome?: string) => void; onCatalog: () => void }) {
  const { cat } = useCatalog();
  const [presets, setPresets] = useState<Preset[]>([]);
  useEffect(() => { void loadPresets().then(setPresets); }, []);
  const decks = cat ? FEATURED.map((n) => presets.find((p) => p.nome === n)).filter((p): p is Preset => !!p) : [];
  const total = presets.length;

  return (
    <section className="hero" aria-labelledby="hero-t">
      <div className="hero-txt">
        <p className="kicker">Decks prontos</p>
        <h1 id="hero-t">Monte o deck do seu treinador favorito</h1>
        <p>{total ? `${total} decks` : "Decks"} com as cartas do Ash, da Misty, do Brock e de outros personagens do anime, decks oficiais, o meta atual dos torneios e os campeões mundiais. Escolha um e o deck fica pronto.</p>
        <div className="hero-cta">
          <button type="button" className="btn act" onClick={() => onPresets()}>Ver todos os decks prontos</button>
          <button type="button" className="btn onDark" onClick={onCatalog}>Explorar o catálogo</button>
        </div>
      </div>
      <div className="hero-decks" role="list">
        {decks.map((p) => {
          const c = presetCover(p, cat!)[0];
          return (
            <button key={p.nome} type="button" role="listitem" className="deck" onClick={() => onPresets(p.nome)} title={`${p.nome}: ${p.desc}`}>
              {c && <span className="deck-art"><CardImage sources={cardSources(c, "high")} alt="" /></span>}
              <span className="deck-name">{p.nome.replace(/^Deck d[oa]s? /, "")}<small>{presetTotals(p, cat!).n} cartas · {p.era}</small></span>
              <Portrait who={p.retrato} className="deck-who" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
