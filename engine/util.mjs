export const stripTags = (html = '') =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(h3|p|li)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#x000A0;|&#160;/g, ' ').replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, c => decodeEnt(c))
    .replace(/[ \t​]+/g, ' ');

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': '’', '&ndash;': '–', '&times;': '×', '&minus;': '−' };
function decodeEnt(c) {
  if (ENT[c]) return ENT[c];
  const m = c.match(/^&#x([0-9a-f]+);$/i) || null;
  if (m) return String.fromCodePoint(parseInt(m[1], 16));
  const d = c.match(/^&#(\d+);$/);
  return d ? String.fromCodePoint(+d[1]) : c;
}

export const typeBlock = q => q[q.questionType];

export function parseOptions(html) {
  const t = stripTags(html);
  const re = /\(([A-D])\)\s*([^\n]*)/g;
  const out = {};
  let m;
  while ((m = re.exec(t))) out[m[1]] ??= m[2].trim();
  return out;
}

export function applyEdit(q, e) {
  const c = structuredClone(q);
  const blk = typeBlock(c);
  if (e.field === 'questionType') {
    if (c.questionType !== e.find) return { ok: false, reason: 'questionType mismatch' };
    return { ok: true, q: retype(c, e.replace) };
  }
  if (e.field === 'answer') {
    const cur = JSON.stringify(blk.answer), want = JSON.stringify(e.find);
    if (cur !== want) return { ok: false, reason: `answer is ${cur}, edit expects ${want}` };
    blk.answer = e.replace;
    return { ok: true, q: c };
  }
  if (!['question', 'solution'].includes(e.field)) return { ok: false, reason: 'unknown field ' + e.field };
  const s = blk[e.field], n = s.split(e.find).length - 1;
  if (n !== 1) return { ok: false, reason: `find string occurs ${n}x in ${e.field} (must be exactly 1)` };
  blk[e.field] = s.replace(e.find, () => e.replace);
  return { ok: true, q: c };
}
function retype(c, to) { c[to] = c[c.questionType]; delete c[c.questionType]; c.questionType = to; return c; }
