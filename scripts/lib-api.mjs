/* Funções comuns dos scripts que baixam dados (rodam no GitHub Actions, que tem internet). */

/** User-Agent de navegador: a TCGdex, a Limitless e o Fandom aceitam; a API pokemontcg.io recusa (use "sem"). */
export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET com até 4 tentativas (1, 2, 4 s). 404 devolve null (a carta/coleção não existe naquele idioma). */
export async function getJSON(url, { ua = UA, tentativas = 4, texto = false } = {}) {
  let erro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: ua ? { "User-Agent": ua } : {} });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return texto ? await r.text() : await r.json();
    } catch (e) {
      erro = e;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error(`${url}: ${erro?.message}`);
}

/** Roda `fn` em cada item com até `n` ao mesmo tempo; mostra o progresso a cada 10% */
export async function emParalelo(itens, n, fn, rotulo = "") {
  const out = new Array(itens.length);
  let i = 0, feitos = 0, marca = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) {
      const k = i++;
      out[k] = await fn(itens[k], k);
      feitos++;
      if (rotulo && feitos / itens.length >= marca + 0.1) { marca += 0.1; console.log(`${rotulo}: ${feitos} de ${itens.length}`); }
    }
  }));
  return out;
}

/** Cotação do dólar e do euro em reais: AwesomeAPI → Frankfurter → open.er-api (a AwesomeAPI às vezes recusa o GitHub com 429) */
export async function cotacao() {
  try {
    const d = await getJSON("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL", { tentativas: 1 });
    const usd = +d.USDBRL.bid, eur = +d.EURBRL.bid;
    if (usd > 0 && eur > 0) return { usd, eur, fonte: "AwesomeAPI", data: new Date().toISOString().slice(0, 10) };
  } catch (e) { console.log("AwesomeAPI falhou:", e.message); }
  try {
    const d = await getJSON("https://api.frankfurter.app/latest?from=USD&to=BRL,EUR", { tentativas: 2 });
    const usd = d.rates.BRL, eur = d.rates.BRL / d.rates.EUR;
    if (usd > 0 && eur > 0) return { usd, eur: +eur.toFixed(4), fonte: "Frankfurter (Banco Central Europeu)", data: d.date };
  } catch (e) { console.log("Frankfurter falhou:", e.message); }
  const d = await getJSON("https://open.er-api.com/v6/latest/USD", { tentativas: 2 });
  return { usd: d.rates.BRL, eur: +(d.rates.BRL / d.rates.EUR).toFixed(4), fonte: "ExchangeRate-API", data: new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10) };
}
