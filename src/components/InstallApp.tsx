import { useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/util";

/* ===== Aviso "Instalar o app" (PWA) =====
   Android e computador (Chrome, Edge…): o navegador avisa que dá para instalar (beforeinstallprompt) e o botão abre o instalador.
   iPhone/iPad: o Safari não tem esse aviso; mostramos o caminho (Compartilhar → Adicionar à Tela de Início).
   Some quando o site já está aberto como app ou quando a pessoa fecha o aviso (volta depois de 30 dias). */
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let pending: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pending = e as InstallEvent; listeners.forEach((f) => f()); });
window.addEventListener("appinstalled", () => { pending = null; listeners.forEach((f) => f()); });

const OFF_KEY = "mdp-instalar-fechado", OFF_DAYS = 30;
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function InstallApp() {
  const [, redraw] = useState(0);
  const [off, setOff] = useState(() => Date.now() - readJSON<number>(OFF_KEY, 0) < OFF_DAYS * 864e5);
  useEffect(() => { const f = () => redraw((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  if (off || standalone()) return null;
  const close = () => { writeJSON(OFF_KEY, Date.now()); setOff(true); };

  if (pending) return (
    <div className="banner install">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={36} height={36} />
      <span>Instale o <b>MyDeck Pokémon</b> no seu aparelho: abre como um app, direto da tela inicial.</span>
      <button type="button" className="btn act" onClick={async () => {
        const ev = pending;
        if (!ev) return;
        await ev.prompt();
        const { outcome } = await ev.userChoice;
        pending = null;
        if (outcome === "dismissed") close(); else redraw((n) => n + 1);
      }}>Instalar app</button>
      <button type="button" className="btn ghost" onClick={close}>Agora não</button>
    </div>
  );
  if (isIos()) return (
    <div className="banner install">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={36} height={36} />
      <span>Para instalar o <b>MyDeck Pokémon</b> no iPhone: no Safari, toque em <b>Compartilhar</b>
        <svg className="ios-share" viewBox="0 0 24 24" aria-label="(ícone de compartilhar)"><path d="M12 15V3m0 0-4 4m4-4 4 4M7 10H5v11h14V10h-2" /></svg>
        e depois em <b>Adicionar à Tela de Início</b>.</span>
      <button type="button" className="btn ghost" onClick={close}>Entendi</button>
    </div>
  );
  return null;
}
