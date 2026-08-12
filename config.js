// Configuração do Supabase (Settings → API no dashboard).
// A anon key é pública por design — a proteção real é o RLS no banco:
// cards é somente leitura; progress/review_log são graváveis (progresso individual).
const HW_CONFIG = {
  SUPABASE_URL: "https://qjlynkymcfixtxtdvzdf.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbHlua3ltY2ZpeHR4dGR2emRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NjgyMjMsImV4cCI6MjEwMjE0NDIyM30.S8hQRDSU36pTEKSTKRoO1RfEGmyL1ekxGr9mlPznyKA"
};
