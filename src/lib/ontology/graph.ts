import { LINK_TYPES, OBJECT_TYPES, type NodeType } from "@/ontology/world";

/** 객체·관계를 저장하기 전 설정(src/ontology/world.ts)에 맞는지 검사한다 */

export function nodeTypeOf(id: string): NodeType | null {
  const prefix = id.split(":", 1)[0];
  if (!id.includes(":")) return null;
  if (prefix === "article" || prefix in OBJECT_TYPES) return prefix as NodeType;
  return null;
}

export function isValidLink(type: string, src: string, dst: string): boolean {
  const def = LINK_TYPES[type as keyof typeof LINK_TYPES];
  if (!def) return false;
  const from = nodeTypeOf(src);
  const to = nodeTypeOf(dst);
  return !!from && !!to && (def.from as readonly string[]).includes(from) && (def.to as readonly string[]).includes(to);
}

/** PostgREST in 필터. id에 공백이나 따옴표가 있어도 깨지지 않게 */
export function inList(ids: readonly string[]): string {
  return `in.(${ids.map((id) => encodeURIComponent(`"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)).join(",")})`;
}
