-- 파이프라인 예약 실행: GitHub 예약(schedule)은 3~6시간 간격으로 밀려서,
-- Supabase pg_cron이 30분마다 GitHub Actions workflow_dispatch를 호출한다 (무료 플랜 포함).
-- 토큰은 Vault의 'github_dispatch_token'에서 실행 시점에 읽는다 (scripts/setup-scheduler.sh가 넣음).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'world-pipeline-dispatch',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/lsh0113333/world-rss-desk/actions/workflows/pipeline.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'world-rss-desk-scheduler',
      'Content-Type', 'application/json'
    ),
    body := '{"ref":"main"}'::jsonb
  );
  $$
);
