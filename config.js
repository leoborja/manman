// Configuração do Supabase (Settings → API no dashboard).
// A anon key é pública por design — a proteção real é o RLS no banco.
// Enquanto estiver vazio, o app roda com o deck local (seed/seed_cards.json).
const HW_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
