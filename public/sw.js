/* Service worker do MyDeck Pokémon: deixa o site instalável como app e abrindo mesmo sem internet.
   Só guarda arquivos do próprio site (páginas, código, dados, retratos, ícones):
   - páginas: sempre tenta a internet primeiro (cada publicação nova aparece na hora); sem internet, usa a última guardada;
   - código (assets/, com o código no nome): guardado uma vez; ao chegar uma versão nova, os antigos são apagados;
   - dados e imagens do site: mostra o guardado e atualiza em segundo plano.
   Imagens das cartas (TCGdex, R2), fontes, Supabase e APIs não passam por aqui: o cache normal do navegador cuida delas
   (respostas de outros sites sem CORS ocupariam ~7 MB cada no armazenamento do app). */
const VERSAO = "mdp-v1";
const PAGINAS = `${VERSAO}-paginas`, CODIGO = `${VERSAO}-codigo`, ARQUIVOS = `${VERSAO}-arquivos`;
const BASE = new URL("./", self.location).pathname;   // /mydecks-pokemon/
const INICIO = new URL("./", self.location).href;

/* Arquivos de código citados no index.html (ex.: assets/index-AbC123.js) */
const assetsDo = (html) => [...new Set([...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], INICIO).href))];

async function guardarVersao(resp) {
  const html = await resp.clone().text();
  const atuais = assetsDo(html);
  const c = await caches.open(CODIGO);
  await Promise.all(atuais.map(async (u) => { if (!(await c.match(u))) { try { await c.add(u); } catch { /* sem internet: fica para depois */ } } }));
  // apaga o código de versões antigas
  for (const req of await c.keys()) if (!atuais.includes(req.url)) await c.delete(req);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const r = await fetch(INICIO, { cache: "no-cache" });
    if (r.ok) {
      await (await caches.open(PAGINAS)).put(INICIO, r.clone());
      await guardarVersao(r);
    }
    await (await caches.open(ARQUIVOS)).addAll(["manifest.webmanifest", "icon-192.png", "icon-512.png", "favicon.svg"].map((f) => BASE + f)).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("mdp-") && ![PAGINAS, CODIGO, ARQUIVOS].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;   // outros sites: o navegador cuida

  // páginas: internet primeiro, guardada como reserva
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) {
          const copia = r.clone();
          e.waitUntil((async () => { await (await caches.open(PAGINAS)).put(INICIO, copia.clone()); await guardarVersao(copia); })());
        }
        return r;
      } catch {
        return (await caches.match(INICIO)) || Response.error();
      }
    })());
    return;
  }

  // código com o código no nome: nunca muda, então o guardado vale
  if (url.pathname.startsWith(BASE + "assets/")) {
    e.respondWith((async () => {
      const c = await caches.open(CODIGO);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) e.waitUntil(c.put(req, r.clone()));
      return r;
    })());
    return;
  }

  // dados (catálogo, decks prontos, populares), retratos, caixas e ícones: o guardado na hora, atualizado em segundo plano
  e.respondWith((async () => {
    const c = await caches.open(ARQUIVOS);
    const hit = await c.match(req);
    const rede = fetch(req).then((r) => { if (r.ok) e.waitUntil(c.put(req, r.clone())); return r; });
    if (hit) { e.waitUntil(rede.catch(() => {})); return hit; }
    return rede;
  })());
});
