/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto no Supabase (Project Settings → API) */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública do Supabase ("publishable" ou "anon"). Nunca usar a chave secreta (service_role) aqui. */
  readonly VITE_SUPABASE_KEY?: string;
  /** Endereço público do espelho de imagens no Cloudflare R2 (opcional, https://pub-….r2.dev) */
  readonly VITE_R2_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
