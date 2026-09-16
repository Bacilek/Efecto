/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; unset disables sync entirely. */
  readonly VITE_SUPABASE_URL?: string
  /**
   * Supabase **publishable** key (`sb_publishable_…`) — safe in the client, RLS
   * does the guarding. Never the secret key: it bypasses RLS, and a `VITE_`
   * variable is baked into the bundle for anyone to read.
   */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** The pre-rename name for the same key; still accepted. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
