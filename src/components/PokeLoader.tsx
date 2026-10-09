import { useEffect, useState } from "react";

const MSGS = ["Embaralhando o deck…", "Comprando 7 cartas…", "Escolhendo o Pokémon Ativo…", "Separando as cartas de Prêmio…", "Que comece a batalha!"];

/* Carregando: uma Poké Bola balançando (como quando um Pokémon está sendo capturado) e frases de batalha */
export function PokeLoader({ text }: { text?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % MSGS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="poke-loader" role="status" aria-live="polite">
      <svg className="pl-ball" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M4 32a28 28 0 0 1 56 0z" fill="#e3350d" />
        <path d="M4 32a28 28 0 0 0 56 0z" fill="#fff" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#1d1b20" strokeWidth="4" />
        <path d="M4 32h56" stroke="#1d1b20" strokeWidth="4" />
        <circle cx="32" cy="32" r="8" fill="#fff" stroke="#1d1b20" strokeWidth="4" />
        <circle className="pl-btn" cx="32" cy="32" r="3.2" fill="#e3350d" />
      </svg>
      <b>{MSGS[i]}</b>
      {text && <small>{text}</small>}
    </div>
  );
}
