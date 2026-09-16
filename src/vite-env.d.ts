/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; unset disables sync entirely. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/publishable key — safe in the client, RLS does the guarding. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
