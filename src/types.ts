/* ===== Catálogo (public/data/cartas.json, gerado por scripts/gerar-catalogo.mjs a partir da TCGdex) ===== */

/** Tipos de energia em letras (como no jogo): G Planta, R Fogo, W Água, L Elétrico, P Psíquico, F Luta, D Escuridão, M Metal, Y Fada, N Dragão, C Incolor */
export type EnergyType = "G" | "R" | "W" | "L" | "P" | "F" | "D" | "M" | "Y" | "N" | "C";
/** 0 Pokémon, 1 Treinador, 2 Energia */
export type Category = 0 | 1 | 2;

export interface SetInfo {
  id: string;
  /** série (era): base, neo, ecard, ex, dp, pl, hgss, bw, xy, sm, swsh, sv, me… */
  s: string;
  en: string;
  pt: string;
  /** data de lançamento (AAAA-MM-DD) */
  d: string;
  /** sigla oficial impressa na carta (ex.: MEW, TEF), usada nas listas do Pokémon TCG Live */
  ab: string;
  /** cartas oficiais (o número impresso "/165") e total com as secretas */
  n: number;
  t: number;
  logo: number;
  sym: number;
}
export interface SerieInfo { id: string; en: string; pt: string }

/** Uma carta do catálogo (uma impressão: coleção + número). Versões da mesma carta em outras coleções são outras cartas. */
export interface CatCard {
  id: string;
  en: string;
  /** nome em português (igual ao inglês quando a carta não saiu em português ou o nome é o mesmo) */
  pt: string;
  set: SetInfo;
  num: string;
  cat: Category;
  types: EnergyType[];
  /** estágio (Basic, Stage1, Stage2, VMAX, VSTAR, MEGA, BREAK…) */
  stage: string;
  hp: number;
  rarity: string;
  /** subtipo: Treinador (Item, Supporter, Stadium, Tool) ou Energia (Normal, Special) */
  sub: string;
  /** sufixo do nome: EX, GX, V, ex… */
  suffix: string;
  /** marca de regulação (D, E, F, G, H, I, J…) */
  reg: string;
  std: boolean;
  exp: boolean;
  evolveFrom: string;
  dex: number;
  /** tem imagem em inglês / em português */
  imgEn: boolean;
  imgPt: boolean;
  /** valor de mercado em reais: versão mais barata e mais cara (0 = sem preço) */
  lo: number;
  hi: number;
  illus: string;
}

/* ===== Dados completos de uma carta (consulta na hora à TCGdex: /v2/{pt|en}/cards/{id}) ===== */
export interface ApiAttack { name: string; cost?: string[]; damage?: string | number; effect?: string }
export interface ApiCard {
  id: string;
  localId: string;
  name: string;
  category: string;
  illustrator?: string;
  image?: string;
  rarity?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  evolveFrom?: string;
  description?: string;
  effect?: string;
  trainerType?: string;
  energyType?: string;
  suffix?: string;
  abilities?: { type: string; name: string; effect: string }[];
  attacks?: ApiAttack[];
  weaknesses?: { type: string; value?: string }[];
  resistances?: { type: string; value?: string }[];
  retreat?: number;
  regulationMark?: string;
  legal?: { standard: boolean; expanded: boolean };
  variants?: Record<string, boolean>;
  set?: { id: string; name: string };
  pricing?: Pricing;
}
export interface Pricing {
  tcgplayer?: { unit?: string; updated?: string } & Record<string, unknown>;
  cardmarket?: { unit?: string; updated?: string; avg?: number; low?: number; trend?: number; avg1?: number; avg7?: number; avg30?: number;
    "avg-holo"?: number; "low-holo"?: number; "trend-holo"?: number; "avg30-holo"?: number } | null;
}

/** Carta para as janelas de detalhes e para adicionar (vem do catálogo; qty/art são opcionais) */
export interface Hit {
  card: CatCard;
  /** cópias ao adicionar (decks prontos com cartas repetidas) */
  qty?: number;
}

/* ===== Coleção do usuário ===== */
export type ImageLang = "pt" | "en";
export interface CardList {
  id: string;
  name: string;
  position: number;
  /** public: aparece no perfil da pessoa, em Treinadores (só com login) */
  visibility?: "private" | "public";
}
export interface UserCard {
  id: string;
  listId: string;
  /** código da carta na TCGdex (coleção-número, ex.: sv03.5-025); null em cartas que o catálogo não tem */
  cardId: string | null;
  nameEn: string;
  namePt: string;
  /** subtítulo dentro do deck (ex.: "Pokémon", "Treinador") */
  section: string;
  /** observação livre */
  note: string;
  position: number;
  /** idioma da imagem escolhido na janela da carta; null = automático (português quando existe) */
  imageLang: ImageLang | null;
  /** imagem própria: link, "idb" (guardada neste navegador) ou endereço no Supabase Storage */
  customImage: string | null;
  /** cópias desta carta no deck (1 a 999) */
  quantity: number;
}
export interface Collection {
  lists: CardList[];
  cards: UserCard[];
}
