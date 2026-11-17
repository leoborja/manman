-- Mànmàn 慢慢 — Fase 2 do login: o estado da conta que hoje mora só no aparelho.
-- Ver Apps/Manman/docs/estado-da-conta.md (o formato de cada chave).
--
-- Rodar no SQL Editor do projeto. Seguro rodar mais de uma vez.
-- Não mexe em nada que já existe: progress, review_log, profiles e as policies de
-- hoje continuam iguais. Web e iOS só passam a usar a tabela quando o app novo sair.
--
-- O que vai aqui: a teoria lida, as folhas do professor feitas e paradas no meio, as
-- lições do Hoje e o ✓ delas, os sons do pinyin ouvidos e as trocas do 🔗 Casar. Hoje
-- isso fica no iPhone (ou no navegador) e não passa pro outro aparelho.
--
-- Uma linha por conta e por CHAVE, com o mapa inteiro num jsonb. Uma tabela pra cada
-- coisa seriam seis DDLs pra cada coisa nova que aparecer; com a chave, coisa nova é só
-- código nos dois apps. Nada aqui é da Turma, então só o dono lê.

create table if not exists estado (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{1,40}$'),
  valor jsonb not null default '{}'::jsonb check (pg_column_size(valor) < 262144),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table estado enable row level security;
drop policy if exists estado_meu on estado;
create policy estado_meu on estado for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on estado to authenticated;
revoke all on estado from anon;

-- atualizado_em é do servidor: o relógio de cada aparelho não decide nada aqui
create or replace function estado_tocar() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists estado_tocar on estado;
create trigger estado_tocar before insert or update on estado
  for each row execute function estado_tocar();

-- Conferir depois de rodar (deve listar a tabela com RLS ligado e a policy):
-- select relname, relrowsecurity from pg_class where relname = 'estado';
-- select policyname, cmd from pg_policies where tablename = 'estado';
