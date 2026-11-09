// Plate keys, tags and pairing lookups shared by candidates, scoring and swaps.
import type { Plate, Snapshot, Template } from './types';

// "{template}:{slot}={slug}[+{slug}],..." in template slot order, several components in one slot sorted (doc 05, section 3).
export function plateKey(plate: Plate, template: Template): string {
  const parts = template.slots.filter((s) => plate.slots[s.key]?.length).map((s) => `${s.key}=${[...plate.slots[s.key]].sort().join('+')}`);
  return `${plate.template}:${parts.join(',')}`;
}

export const plateComponents = (plate: Plate) => Object.values(plate.slots).flat();

// Explicit pairing if one exists, else the best default across the two components' types (doc 05, section 4).
export function pairing(snap: Snapshot, a: string, b: string): number {
  const explicit = snap.pairings.get(a < b ? `${a}|${b}` : `${b}|${a}`);
  if (explicit !== undefined) return explicit;
  const ca = snap.components.get(a);
  const cb = snap.components.get(b);
  if (!ca || !cb) return 0;
  let best = 0;
  for (const ta of ca.types) for (const tb of cb.types) best = Math.max(best, snap.pairingDefaults.get(ta < tb ? `${ta}|${tb}` : `${tb}|${ta}`) ?? 0);
  return best;
}

export function meanPairing(snap: Snapshot, ids: string[]): number {
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      total += pairing(snap, ids[i], ids[j]);
      pairs++;
    }
  return pairs ? total / pairs : 1;
}

// Descriptive tags plus the derived cuisine:, region:, type:, plate:, spice: and effort: tags (doc 03, section 4).
export function plateTags(snap: Snapshot, plate: Plate): string[] {
  const tags = new Set<string>([`plate:${plate.template}`]);
  for (const id of plateComponents(plate)) {
    const c = snap.components.get(id);
    if (!c) continue;
    c.tags.forEach((t) => tags.add(t));
    c.types.forEach((t) => tags.add(`type:${t}`));
    tags.add(`cuisine:${c.cuisine}`);
    tags.add(`region:${c.region}`);
    tags.add(`spice:${c.spice}`);
    tags.add(`effort:${c.effort}`);
  }
  return [...tags];
}
