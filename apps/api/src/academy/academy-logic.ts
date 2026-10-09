/** B9 Academy pure helpers (tested without a database). */
export function sanitizeChecklist(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((i) => String(i ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, 30);
}

/** Only https links. YouTube/Vimeo become embeddable links; direct video files play in a <video> tag. */
export function videoInfo(url: string | null | undefined): { kind: 'none' | 'file' | 'youtube' | 'vimeo' | 'link'; embedUrl: string | null } {
  if (!url) return { kind: 'none', embedUrl: null };
  let u: URL;
  try { u = new URL(url); } catch { return { kind: 'none', embedUrl: null }; }
  if (u.protocol !== 'https:') return { kind: 'none', embedUrl: null };
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1).split('/')[0]}` };
  if (host.endsWith('youtube.com')) {
    const id = u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
    return id ? { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : { kind: 'link', embedUrl: null };
  }
  if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${u.pathname.split('/')[1]}` };
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { kind: 'file', embedUrl: u.toString() };
  return { kind: 'link', embedUrl: null };
}

export function progressPercent(lessonIds: string[], doneLessonIds: Iterable<string>) {
  if (!lessonIds.length) return 0;
  const done = new Set(doneLessonIds);
  return Math.round((lessonIds.filter((id) => done.has(id)).length / lessonIds.length) * 100);
}

/** New order must be exactly the same lesson ids. */
export function validReorder(current: string[], next: string[]) {
  return current.length === next.length && new Set(next).size === next.length && next.every((id) => current.includes(id));
}

/** Practice photo: JPEG/PNG/WebP, max 5 MB, checked by magic bytes (not by the name). */
export function decodePracticePhoto(base64: string): { buffer: Buffer; contentType: string; ext: string } {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Photo must be smaller than 5 MB.');
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { buffer, contentType: 'image/png', ext: 'png' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { buffer, contentType: 'image/webp', ext: 'webp' };
  throw new Error('Please send a JPEG, PNG or WebP photo.');
}
