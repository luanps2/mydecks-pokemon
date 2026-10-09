import { createSignal } from "./util";

/* Imagens enviadas do aparelho no modo "só neste navegador": ficam no IndexedDB (cabe muito mais que o localStorage).
   Na carta, customImage = "idb" indica que a imagem está aqui, guardada pelo id da carta. */
const DB_NAME = "mdp-imagens";
const IMG: Record<string, string> = {};
export const localImgSignal = createSignal();
let db: IDBDatabase | null = null;

export function openLocalImages(): Promise<void> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("img");
      r.onerror = () => res();
      r.onsuccess = () => {
        db = r.result;
        const cur = db.transaction("img").objectStore("img").openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { IMG[String(c.key)] = String(c.value); c.continue(); }
          else { localImgSignal.bump(); res(); }
        };
        cur.onerror = () => res();
      };
    } catch {
      res();
    }
  });
}
export const getLocalImage = (cardId: string) => IMG[cardId] || "";
export function setLocalImage(cardId: string, dataUrl: string) {
  IMG[cardId] = dataUrl;
  try { db?.transaction("img", "readwrite").objectStore("img").put(dataUrl, cardId); } catch { /* sem IndexedDB: fica só nesta sessão */ }
  localImgSignal.bump();
}
export function delLocalImage(cardId: string) {
  delete IMG[cardId];
  try { db?.transaction("img", "readwrite").objectStore("img").delete(cardId); } catch { /* nada a fazer */ }
  localImgSignal.bump();
}

/* Reduz a foto enviada para 900px de altura (JPEG), para não ocupar espaço demais */
export function resizeImage(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 900 / im.height), cv = document.createElement("canvas");
        cv.width = Math.round(im.width * s);
        cv.height = Math.round(im.height * s);
        cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
        res(cv.toDataURL("image/jpeg", 0.9));
      };
      im.onerror = rej;
      im.src = String(fr.result);
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
