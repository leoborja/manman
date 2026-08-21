-- Mànmàn 慢慢 — schema Supabase
-- Rodar no SQL Editor do projeto. Seguro rodar mais de uma vez (if not exists).

-- Cartas (geridas pelo Leo; o app só lê)
create table if not exists cards (
  id text primary key,
  hanzi text not null,
  pinyin text not null,
  pt text not null,
  deck text not null default 'geral',
  tags text[] default '{}',
  nota text,
  radical text,           -- V2
  audio_url text,         -- V2
  data_aula date,         -- V2.3: dia da aula em que a palavra entrou; null = veio de fora da aula
  fonte text,             -- V2.7: de onde veio quando não foi da aula ('duolingo', etc). null = aula
  created_by text,
  deleted boolean not null default false,
  created_at timestamptz default now()
);
-- tabela já existia antes da V2.3? o create table acima não roda de novo, então:
alter table cards add column if not exists data_aula date;
alter table cards add column if not exists fonte text;
create index if not exists cards_data_aula_idx on cards (data_aula);
create index if not exists cards_fonte_idx on cards (fonte);

alter table cards enable row level security;
drop policy if exists "cards_read" on cards;
create policy "cards_read" on cards for select using (true);
-- sem policy de INSERT/UPDATE/DELETE: escrita só com service_role (scripts do Leo)

-- Progresso SRS por usuário×carta (o app lê e escreve com a anon key)
create table if not exists progress (
  user_name text not null,
  card_id text not null,
  reps int default 0,
  ivl int default 0,
  ease float default 2.5,
  due text,               -- 'YYYY-MM-DD' local do usuário
  updated_ms bigint default 0,
  suspended boolean not null default false,
  off_ms bigint default 0,
  n_good int not null default 0,    -- V2.6: quantas vezes acertou esta carta
  n_hard int not null default 0,    -- ...marcou "Difícil"
  n_again int not null default 0,   -- ...errou. Contam nas duas fases, agendado e prática
  primary key (user_name, card_id)
);
-- tabela já existia antes da V2.6?
alter table progress add column if not exists n_good int not null default 0;
alter table progress add column if not exists n_hard int not null default 0;
alter table progress add column if not exists n_again int not null default 0;
alter table progress enable row level security;
drop policy if exists "progress_all" on progress;
create policy "progress_all" on progress for all using (true) with check (true);

-- Log diário de revisões por usuário (streak / gráfico)
create table if not exists review_log (
  user_name text not null,
  day text not null,      -- 'YYYY-MM-DD'
  rev int default 0,
  new_cnt int default 0,
  primary key (user_name, day)
);
alter table review_log enable row level security;
drop policy if exists "review_log_all" on review_log;
create policy "review_log_all" on review_log for all using (true) with check (true);
