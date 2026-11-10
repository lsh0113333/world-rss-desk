import { inList } from "@/lib/ontology/graph";
import { ACTOR_ROLES, type ActorRole, type EventType } from "@/ontology/world";
import type { ActorProfile, BoardActor, WorldBoard } from "@/types/world";
import { createDb, type Db } from "./supabase";

/**
 * 화면용 읽기. 계산은 파이프라인이 끝내 두었고, 여기서는 읽기만 한다 (publishable 키, RLS로 읽기 전용).
 */

const EVENT_LIMIT = 30;
const TOGETHER_LIMIT = 10;

export function readerDb(): Db {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY가 필요합니다");
  return createDb({ url, key });
}

export async function readBoard(db: Db): Promise<WorldBoard | null> {
  const rows = await db.select<{ payload: WorldBoard }>("board_snapshots", "select=payload&order=generated_at.desc&limit=1");
  return rows[0]?.payload ?? null;
}

interface RoleLink {
  src: string;
  type: ActorRole;
  dst: string;
  props: { name?: string; nameKo?: string; kind?: BoardActor["kind"] };
}

export async function readActor(db: Db, id: string): Promise<ActorProfile | null> {
  const roles = inList(ACTOR_ROLES);
  const own = await db.select<RoleLink>("links", `select=src,type,dst,props&dst=eq.${encodeURIComponent(id)}&type=${roles}&order=observed_at.desc&limit=200`);
  if (own.length === 0) return null;

  const eventIds = [...new Set(own.map((l) => l.src))];
  const events = await db.select<{ id: string; last_seen: string; props: { eventType: EventType; title: string; summary: string } }>(
    "objects",
    `select=id,last_seen,props&id=${inList(eventIds.slice(0, 100))}&order=last_seen.desc`,
  );
  const others = await db.select<RoleLink>("links", `select=src,type,dst,props&src=${inList(eventIds.slice(0, 100))}&type=${roles}`);

  const together = new Map<string, { id: string; nameKo: string; kind: BoardActor["kind"]; events: Set<string> }>();
  for (const l of others) {
    if (l.dst === id) continue;
    const entry = together.get(l.dst) ?? { id: l.dst, nameKo: l.props.nameKo ?? l.props.name ?? l.dst, kind: l.props.kind ?? "group", events: new Set<string>() };
    entry.events.add(l.src);
    together.set(l.dst, entry);
  }

  const [affiliation] = await db.select<{ dst: string }>("links", `select=dst&src=eq.${encodeURIComponent(id)}&type=eq.affiliated_with&order=observed_at.desc&limit=1`);
  const first = own[0].props;
  const roleOf = new Map(own.map((l) => [l.src, l.type]));
  return {
    id,
    name: first.name ?? id,
    nameKo: first.nameKo ?? first.name ?? id,
    kind: first.kind ?? "group",
    ...(affiliation ? { country: affiliation.dst.replace("country:", "") } : {}),
    events: [...events]
      .sort((a, b) => b.last_seen.localeCompare(a.last_seen))
      .slice(0, EVENT_LIMIT)
      .map((e) => ({ id: e.id, title: e.props.title, summary: e.props.summary, type: e.props.eventType, role: roleOf.get(e.id)!, lastSeenAt: e.last_seen })),
    together: [...together.values()]
      .sort((a, b) => b.events.size - a.events.size || a.nameKo.localeCompare(b.nameKo, "ko"))
      .slice(0, TOGETHER_LIMIT)
      .map((t) => ({ id: t.id, nameKo: t.nameKo, kind: t.kind, count: t.events.size })),
  };
}
