import { useState } from "react";

/* Imagem com reservas: se uma fonte falhar, tenta a próxima da lista (português → inglês → espelho) */
export function CardImage({ sources, alt, lazy = true, onShown, onClick, className }: {
  sources: string[];
  alt: string;
  lazy?: boolean;
  onShown?: (src: string) => void;
  onClick?: () => void;
  className?: string;
}) {
  const key = sources.join("|");
  const [st, setSt] = useState({ key, i: 0 });
  const i = st.key === key ? st.i : 0;   // a lista mudou (ex.: trocou o idioma da imagem): recomeça do início
  if (i >= sources.length) return <span className="ph">Imagem indisponível</span>;
  return (
    <img className={className} src={sources[i]} alt={alt} loading={lazy ? "lazy" : "eager"} decoding="async" onClick={onClick}
      onError={() => setSt({ key, i: i + 1 })} onLoad={(e) => onShown?.(e.currentTarget.currentSrc)} />
  );
}
