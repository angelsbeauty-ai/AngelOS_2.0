import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Web-only. Active only while a non-locked screen is in Night, so locked screens stay untouched. */
const CSS = `
html[data-nightfix="1"] input::placeholder,
html[data-nightfix="1"] textarea::placeholder { color: #9A9A9F !important; opacity: 1; }
`;

type RGB = { r: number; g: number; b: number; a: number };

function parseColor(input: string): RGB | null {
  const m = input.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
}

function lum(c: RGB) { return (c.r + c.g + c.b) / 3; }

/** Near-white paper. Keeps the intentional light control #F4F4F5. */
function isPaper(c: RGB) {
  if (c.a < 0.72) return false;
  if (c.r < 228 || c.g < 228 || c.b < 228) return false;
  if (c.r === 244 && c.g === 244 && c.b === 245) return false;
  return true;
}

function isDarkInk(c: RGB) { return c.a > 0.55 && lum(c) < 96; }

function paintNight(root: ParentNode) {
  const nodes = root.querySelectorAll<HTMLElement>('body *');
  nodes.forEach((el) => {
    if (el.closest('[data-keep-light="1"]')) return;
    const cs = getComputedStyle(el);
    const bg = parseColor(cs.backgroundColor);
    if (bg && isPaper(bg) && el.offsetWidth > 8 && el.offsetHeight > 8) {
      el.dataset.nightTouched = '1';
      el.style.backgroundColor = '#161618';
      el.style.borderColor = 'rgba(255,255,255,0.14)';
      const bw = parseFloat(cs.borderTopWidth) || 0;
      if (bw < 1) el.style.borderWidth = '1px';
      el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.16)';
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      if (radius > 6 && radius < 20 && el.offsetHeight > 64) el.style.borderRadius = '20px';
    }
    const tag = el.tagName;
    if (tag === 'svg' || tag === 'path') {
      // Icons sitting on a light button (e.g. the "+" on New post) keep their dark ink.
      let up: HTMLElement | null = el.parentElement; let onLightBtn = false;
      for (let i = 0; up && i < 5 && !onLightBtn; i++, up = up.parentElement) { const b = parseColor(getComputedStyle(up).backgroundColor); if (b && b.a > 0.7) { onLightBtn = lum(b) > 180 && !isPaper(b); break; } }
      if (onLightBtn) return;
      const fill = parseColor(cs.fill);
      if (fill && isDarkInk(fill)) { el.dataset.nightTouched = '1'; el.style.fill = '#F4F4F5'; }
      return;
    }
    const fg = parseColor(cs.color);
    if (!fg || !isDarkInk(fg)) return;
    const self = parseColor(getComputedStyle(el).backgroundColor);
    const parent = el.parentElement ? parseColor(getComputedStyle(el.parentElement).backgroundColor) : null;
    const onLight = (self && !isPaper(self) && lum(self) > 180 && self.a > 0.7) || (parent && !isPaper(parent) && lum(parent) > 180 && parent.a > 0.7);
    if (onLight) return;
    const size = parseFloat(cs.fontSize) || 15;
    el.dataset.nightTouched = '1';
    el.style.color = size >= 17 ? '#F4F4F5' : size >= 14 ? '#C7C7CC' : '#9A9A9F';
  });
}

export function useNightCss() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'angelos-nightfix';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }, []);
}

/** Marks the document so the night surface rules apply. Locked screens pass false. */
export function useNightFix(on: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (on) document.documentElement.dataset.nightfix = '1';
    else delete document.documentElement.dataset.nightfix;
    if (!on) return;
    let frame = 0;
    const run = () => { if (document.documentElement.dataset.nightfix === '1') paintNight(document); };
    run();
    const kick = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(run); };
    const obs = new MutationObserver(kick);
    obs.observe(document.body, { subtree: true, childList: true });
    const timer = window.setInterval(run, 500);
    return () => {
      delete document.documentElement.dataset.nightfix;
      obs.disconnect();
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      document.querySelectorAll<HTMLElement>('[data-night-touched]').forEach((el) => {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.borderWidth = '';
        el.style.boxShadow = '';
        el.style.borderRadius = '';
        el.style.color = '';
        el.style.fill = '';
        delete el.dataset.nightTouched;
      });
    };
  }, [on]);
}

/** Friendly popup copy. Never the raw server sentence. */
export function humanMessage(message?: string): string | undefined {
  if (!message) return message;
  const cleaned = message.replace(/project key/gi, '').replace(/admin key/gi, '').replace(/\s{2,}/g, ' ').trim();
  const technical = /exception|stack|ECONN|supabase|status code|\bSQL\b|syntax|undefined is not|Cannot read|service_role|anon key|\bError:|\{.*\}|\[FILL|node_modules|fetch failed|NetworkError|PGRST|JWT/i.test(cleaned);
  if (technical || cleaned.length > 180) return 'Something went wrong on our side. Please try again in a moment.';
  return cleaned;
}
