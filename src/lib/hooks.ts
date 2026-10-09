import { useEffect, useState, useSyncExternalStore } from "react";
import type { Signal } from "./util";

/* Redesenha o componente quando um cache (dados das cartas, imagens em português) muda */
export const useSignal = (s: Signal) => useSyncExternalStore(s.subscribe, s.get);

/* Valor que só muda depois de a pessoa parar de digitar por alguns instantes */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
