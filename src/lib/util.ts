/* Texto sem acentos e em minúsculas, para comparar nomes */
export const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const uuid = () => crypto.randomUUID();
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* localStorage pode falhar (modo privado, sem espaço): estas funções nunca quebram a página */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* Sinal simples para avisar o React de que um cache mudou (usado com useSyncExternalStore) */
export function createSignal() {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    get: () => version,
    bump() {
      version++;
      listeners.forEach((f) => f());
    },
  };
}
export type Signal = ReturnType<typeof createSignal>;

/* Dinheiro em reais: R$ 1.234,56 e a forma curta para etiquetas pequenas (R$ 1,2 mil) */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number) => BRL.format(v);
export function brlShort(v: number): string {
  if (v >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (v >= 1e4) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
  if (v >= 100) return "R$ " + Math.round(v).toLocaleString("pt-BR");
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: 2 });
}
/* Soma das cópias (3 Pikachu = 3 cartas) */
export const copies = (cs: { quantity?: number }[]) => cs.reduce((n, c) => n + (c.quantity || 1), 0);
