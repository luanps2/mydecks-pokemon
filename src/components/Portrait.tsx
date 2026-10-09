import { useState } from "react";
import { portraitSrc } from "../lib/presets";

/* Retrato do personagem (PNG transparente do próprio site); some se o arquivo não existir */
export function Portrait({ who, className }: { who?: string; className: string }) {
  const src = portraitSrc(who);
  const [bad, setBad] = useState("");
  if (!src || bad === src) return null;
  return <img className={className} src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(src)} />;
}
