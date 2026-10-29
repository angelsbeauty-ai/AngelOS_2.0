/**
 * Legacy demo / proof / test contacts left in some studios by earlier seeds. They are hidden from every picker and
 * from the assistant, never deleted. Keep in sync with apps/mobile/src/lib/clients.ts (isDemoSeed).
 */
const DEMO_NAMES = [/^Demo Client$/, /^Proof Client/, /^Walk Client/, /^Test Client [A-Z]$/];
const DEMO_SOURCES = new Set(['test seed', 'manual-demo']);

export function isDemoSeedClient(c: { display_name?: string | null; source?: string | null } | null | undefined): boolean {
  if (!c) return false;
  const name = String(c.display_name ?? '').trim();
  return DEMO_SOURCES.has(String(c.source ?? '').trim().toLowerCase()) || DEMO_NAMES.some((re) => re.test(name));
}

/** A message thread belongs to a demo / proof / test seed contact (by its linked client or its contact name). */
export function isDemoSeedThread(t: { contact_display_name?: string | null; client?: { display_name?: string | null; source?: string | null } | null } | null | undefined): boolean {
  if (!t) return false;
  return isDemoSeedClient(t.client) || isDemoSeedClient({ display_name: t.contact_display_name ?? null });
}
