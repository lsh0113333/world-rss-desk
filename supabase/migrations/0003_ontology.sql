-- 온톨로지 저장소 (docs/ONTOLOGY.md 6절, ADR-017). 분야와 무관한 객체·관계 + 화면용 결과.
-- 객체·관계의 종류는 코드의 설정(src/ontology/world.ts)이 정하고, 쓸 때 검증한다.

create table if not exists objects (
  id text primary key,                 -- "event:20261101-ab12", "actor:person:elon musk", "country:KR"
  type text not null,                  -- event | actor | flow | country | continent | outlet
  props jsonb not null default '{}',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists objects_type_seen_idx on objects (type, last_seen desc);

create table if not exists links (
  src text not null,
  type text not null,                  -- reports | subject | target | participant | occurs_in | part_of | based_in | belongs_to
  dst text not null,
  props jsonb not null default '{}',
  observed_at timestamptz not null default now(),
  evidence text[] not null default '{}', -- 근거 기사 id
  made_by text not null,               -- rule | ai | config
  primary key (src, type, dst)
);
create index if not exists links_dst_idx on links (dst, type);
create index if not exists links_type_time_idx on links (type, observed_at desc);

-- AI에 이미 보낸 기사 (사건으로 인정되지 않아도 다시 보내지 않아 무료 한도를 지킨다)
create table if not exists extraction_log (
  article_id text primary key,
  at timestamptz not null default now()
);

-- 규칙으로 계산한 화면 결과. 화면은 가장 최근 것만 읽는다
create table if not exists board_snapshots (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists board_snapshots_time_idx on board_snapshots (generated_at desc);

alter table objects enable row level security;
alter table links enable row level security;
alter table extraction_log enable row level security;
alter table board_snapshots enable row level security;

drop policy if exists "public read" on objects;
drop policy if exists "public read" on links;
drop policy if exists "public read" on board_snapshots;
create policy "public read" on objects for select to anon, authenticated using (true);
create policy "public read" on links for select to anon, authenticated using (true);
create policy "public read" on board_snapshots for select to anon, authenticated using (true);
