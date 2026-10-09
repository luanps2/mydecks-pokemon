import { useEffect } from "react";

/* Comportamentos da página inteira, ligados uma vez só:
   1) prévia ampliada ao passar o mouse sobre uma carta (grade, modo Lista, busca, catálogo, relacionadas, decks prontos);
   2) faixas horizontais (relacionadas, artes, sugestões, abas dos perfis, filtros, decks da vitrine):
      com mouse, rolam pela roda e arrastando (no toque o dedo já rola). */
const HOV_SEL = ".card .img, .sp-card .img, .citem .img, .relc .img, .pcard .img, .sugc .img, .vers .img, .rowc";
const STRIP_SEL = ".rel, .vers, .sug-strip, .tabs, .chips, .cat-chips, .hero-decks";

export function GlobalBehaviors() {
  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const hov = Object.assign(document.createElement("div"), { className: "hoverprev", innerHTML: '<img alt="">' });
    const im = hov.firstChild as HTMLImageElement;
    im.addEventListener("error", () => hov.classList.remove("on"));
    let timer = 0, hovEl: Element | null = null, mouseX = 0;

    // a prévia mostra na hora a imagem que já está na tela (já carregada) e troca pela versão maior quando ela chegar
    const big = (u: string) => u.replace(/\/low\.webp$/, "/high.webp").replace("/300/", "/700/");
    const srcOf = (el: Element) => {
      // linha do modo Lista não tem imagem: usa o endereço guardado em data-hover
      if (el.matches(".rowc")) return (el as HTMLElement).dataset.hover || "";
      const img = el.querySelector("img");
      return img && img.naturalWidth ? img.currentSrc || img.src : "";
    };
    const loaded = new Set<string>();   // versões maiores que já chegaram (trocam sem esperar)
    let want = "";
    const show = (el: Element) => {
      const src = srcOf(el);
      if (!src || !el.isConnected) return;
      // dentro de uma janela aberta, a prévia precisa estar nela para aparecer por cima
      const host = el.closest("dialog") || document.body;
      if (hov.parentNode !== host) host.appendChild(hov);
      const hi = big(src);
      want = hi;
      if (loaded.has(hi) || hi === src) im.src = hi;
      else {
        im.src = src;
        const pre = new Image();
        pre.onload = () => { loaded.add(hi); if (want === hi) im.src = hi; };
        pre.src = hi;
      }
      const vw = innerWidth, vh = innerHeight, w = Math.min(500, vw * 0.42, ((vh - 24) * 63) / 88), h = (w * 88) / 63;
      let r: { left: number; right: number; top: number; height: number } = el.getBoundingClientRect();
      if (el.matches(".rowc")) r = { left: mouseX - 20, right: mouseX + 20, top: r.top, height: r.height };   // linha larga: perto do mouse
      let x = r.right + 14;
      if (x + w > vw - 8) x = r.left - w - 14;
      if (x < 8) x = 8;
      const y = Math.max(8, Math.min(vh - h - 8, r.top + r.height / 2 - h / 2));
      Object.assign(hov.style, { left: x + "px", top: y + "px", width: w + "px" });
      hov.classList.add("on");
    };
    let hideTimer = 0;
    const hide = () => { clearTimeout(timer); clearTimeout(hideTimer); hovEl = null; want = ""; hov.classList.remove("on"); };
    const onMove = (e: MouseEvent) => { mouseX = e.clientX; };
    const onOver = (e: MouseEvent) => {
      if (!canHover.matches) return;
      const el = (e.target as Element).closest?.(HOV_SEL) || null;
      if (el === hovEl) return;
      clearTimeout(timer); clearTimeout(hideTimer);
      if (!el) {
        // saiu da carta: espera um instante, porque o mouse pode estar só passando pelo espaço entre duas cartas
        hideTimer = window.setTimeout(hide, 120);
        return;
      }
      hovEl = el;
      // prévia já aberta: troca na hora; senão, uma pequena espera evita prévias ao só cruzar a tela com o mouse
      if (hov.classList.contains("on")) show(el);
      else timer = window.setTimeout(() => show(el), 140);
    };
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) hide(); };

    // roda do mouse: no começo ou no fim da faixa, a rolagem volta a mover a janela normalmente
    const glide = new Map<HTMLElement, { target: number }>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onWheel = (e: WheelEvent) => {
      const strip = (e.target as Element).closest?.(STRIP_SEL) as HTMLElement | null;
      if (!strip || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * strip.clientWidth : e.deltaY;
      const st = glide.get(strip);
      const from = st ? st.target : strip.scrollLeft;
      if ((dy < 0 && from <= 0) || (dy > 0 && from >= max - 1)) return;
      e.preventDefault();
      if (reduce.matches) { strip.scrollLeft += dy; return; }
      // rolagem suave: anda até o alvo aos poucos (cada giro da roda empurra o alvo; o movimento desacelera no fim)
      const target = Math.max(0, Math.min(max, from + dy * 1.15));
      if (st) { st.target = target; return; }
      const snap = strip.style.scrollSnapType;
      strip.style.scrollSnapType = "none";   // o "encaixe" das faixas brigaria com o movimento suave
      const g = { target };
      glide.set(strip, g);
      const tick = () => {
        const cur = strip.scrollLeft, d = g.target - cur;
        if (Math.abs(d) < 0.6) { strip.scrollLeft = g.target; glide.delete(strip); strip.style.scrollSnapType = snap; return; }
        strip.scrollLeft = cur + d * 0.2;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    // arrastar com o mouse: só vira rolagem depois de 6px (um clique normal continua sendo clique);
    // depois de arrastar, o clique que o navegador dispara ao soltar é ignorado
    let drag: { el: HTMLElement; x: number; left: number; moved: boolean } | null = null;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !canHover.matches) return;
      const el = (e.target as Element).closest?.(STRIP_SEL) as HTMLElement | null;
      if (!el || el.scrollWidth <= el.clientWidth || (e.target as Element).closest("input,select,textarea")) return;
      drag = { el, x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const onDragMove = (e: MouseEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 6) return;
      if (!drag.moved) { drag.moved = true; drag.el.classList.add("dragging"); hide(); }
      drag.el.scrollLeft = drag.left - dx;
      e.preventDefault();
    };
    const onUp = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      d.el.classList.remove("dragging");
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("scroll", hide, { capture: true, passive: true });
    document.addEventListener("click", hide, true);
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("scroll", hide, { capture: true });
      document.removeEventListener("click", hide, true);
      document.removeEventListener("wheel", onWheel);
      hov.remove();
    };
  }, []);
  return null;
}
