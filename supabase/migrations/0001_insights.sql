-- 세계 흐름 파이프라인 저장소 (intent/2026-10-18-sensemaking.md)
-- 쓰기: GitHub Actions 파이프라인(secret 키, RLS 우회). 읽기: Vercel /api/insights(publishable 키, 아래 select 정책).

create table if not exists articles (
  id text primary key,                -- Article.id (정규화 링크 해시)
  link text not null,
  title text not null,
  summary text,
  source text not null,
  feed_id text,
  country text,
  continent text,
  category text,
  image text,
  published_at timestamptz not null,
  first_seen_at timestamptz not null default now()
);
create index if not exists articles_published_idx on articles (published_at desc);

create table if not exists stories (
  id text primary key,
  lead_title text not null,
  lead_link text not null,
  image text,
  terms text[] not null default '{}',
  countries text[] not null default '{}',
  sources text[] not null default '{}',
  size int not null default 0,
  score real not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists stories_last_seen_idx on stories (last_seen_at desc);

create table if not exists story_articles (
  story_id text not null references stories (id) on delete cascade,
  article_id text not null references articles (id) on delete cascade,
  primary key (story_id, article_id)
);
create index if not exists story_articles_article_idx on story_articles (article_id);

-- 사건의 시간축: 매 실행마다 크기를 기록 (급상승·타임라인)
create table if not exists story_snapshots (
  story_id text not null references stories (id) on delete cascade,
  at timestamptz not null,
  size int not null,
  countries int not null,
  primary key (story_id, at)
);

-- AI 보강 결과 (근거 기사 id 포함)
create table if not exists story_insights (
  story_id text primary key references stories (id) on delete cascade,
  input_hash text not null,
  model text not null,
  title_ko text not null,
  summary_ko text[] not null default '{}',
  why_ko text,
  perspectives jsonb not null default '[]',   -- [{country, angle_ko, article_ids[]}]
  generated_at timestamptz not null default now()
);

-- 온톨로지: 엔티티와 사건 연결
create table if not exists entities (
  id text primary key,                 -- "<type>:<정규화 이름>"
  name text not null,
  name_ko text,
  type text not null                   -- person | org | place | topic
);
create table if not exists story_entities (
  story_id text not null references stories (id) on delete cascade,
  entity_id text not null references entities (id) on delete cascade,
  primary key (story_id, entity_id)
);

-- 실행 기록 (모니터링)
create table if not exists pipeline_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}',
  error text
);

alter table articles enable row level security;
alter table stories enable row level security;
alter table story_articles enable row level security;
alter table story_snapshots enable row level security;
alter table story_insights enable row level security;
alter table entities enable row level security;
alter table story_entities enable row level security;
alter table pipeline_runs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['articles','stories','story_articles','story_snapshots','story_insights','entities','story_entities','pipeline_runs'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
