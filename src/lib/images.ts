import type { CatCard, ImageLang, UserCard } from "../types";
import { getCatalog } from "./catalog";
import { getLocalImage } from "./localImages";

/* ===== Imagens das cartas =====
   Fonte: servidor de imagens da TCGdex (assets.tcgdex.net/{idioma}/{série}/{coleção}/{número}/{low|high}.webp).
   - low (~245×337, ~15 KB): grades, catálogo, faixas. Nunca usar a grande em centenas de cartas (estoura a memória do celular).
   - high (~600×825, ~60 KB): janela da carta, carta ampliada e prévia ao passar o mouse.
   Português primeiro (cartas impressas no Brasil) quando existe; inglês de reserva; por último, a imagem do pokemontcg.io. Com o espelho próprio no Cloudflare R2
   configurado (VITE_R2_URL), ele vem antes da TCGdex. */
const R2 = (import.meta.env.VITE_R2_URL || "").replace(/\/$/, "");
export type ImgSize = "low" | "high";

const tcgdex = (c: CatCard, lang: ImageLang, size: ImgSize) => `https://assets.tcgdex.net/${lang}/${c.set.s}/${c.set.id}/${c.num}/${size}.webp`;

/** Endereços da imagem de uma carta do catálogo, na ordem de preferência (o componente tenta o próximo se um falhar) */
export function cardSources(c: CatCard, size: ImgSize, lang: ImageLang | null = null): string[] {
  const langs: ImageLang[] = [];
  const want = lang || "pt";
  for (const l of [want, want === "pt" ? "en" : "pt"] as ImageLang[]) if (l === "pt" ? c.imgPt : c.imgEn) langs.push(l);
  if (!langs.length && !c.set.pc) langs.push("en");   // a TCGdex diz que não tem imagem e não há reserva: tenta assim mesmo
  const out: string[] = [];
  for (const l of langs) {
    if (R2) out.push(`${R2}/img/${l}/${size === "low" ? 300 : 700}/${c.id}.webp`);
    out.push(tcgdex(c, l, size));
  }
  // reserva: imagem em inglês do pokemontcg.io (tem cartas que faltam na TCGdex)
  if (c.set.pc) out.push(`https://images.pokemontcg.io/${c.set.pc}/${c.num.replace(/^0+(?=\d)/, "")}${size === "high" ? "_hires" : ""}.png`);
  return out;
}

/** Imagem própria da carta: link, imagem guardada neste navegador ("idb") ou do Supabase Storage */
export const customSrc = (u: UserCard) => (u.customImage === "idb" ? getLocalImage(u.id) : u.customImage || "");

/** Imagens de uma carta dos decks: a própria primeiro, depois as da carta no catálogo */
export function userCardSources(u: UserCard, size: ImgSize): string[] {
  const own = customSrc(u);
  const c = u.cardId ? getCatalog()?.byId.get(u.cardId) : undefined;
  return [...(own ? [own] : []), ...(c ? cardSources(c, size, u.imageLang) : [])];
}

/** Logo da coleção (TCGdex) */
export const setLogo = (c: CatCard, lang: ImageLang = "pt") => `https://assets.tcgdex.net/${lang}/${c.set.s}/${c.set.id}/logo.webp`;
/** Símbolo da coleção (fica no canto da carta) */
export const setSymbol = (c: CatCard) => `https://assets.tcgdex.net/univ/${c.set.s}/${c.set.id}/symbol.webp`;
