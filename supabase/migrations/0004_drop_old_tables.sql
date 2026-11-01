-- 이전 세계 흐름의 테이블과 쓰지 않는 열을 지운다 (ADR-021). 코드는 2026-11-01부터 읽거나 쓰지 않는다.
drop table if exists story_entities;
drop table if exists story_snapshots;
drop table if exists story_insights;
drop table if exists story_articles;
drop table if exists entities;
drop table if exists stories;
alter table articles drop column if exists image;
