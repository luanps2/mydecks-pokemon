import { createClient } from "@supabase/supabase-js";

/* Sem as variáveis do Supabase (arquivo .env.local), o app funciona só neste navegador, como a versão antiga */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
