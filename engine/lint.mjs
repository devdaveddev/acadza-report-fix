import { typeBlock, stripTags, parseOptions } from './util.mjs';

const TYPOS = { 'Epithellial': 'Epithelial', 'tisue': 'tissue', 'plexux': 'plexus', 'shurbs': 'shrubs', 'prominant': 'prominent', 'Maceus': 'Mucous', 'wheater': 'whether' };
const TAG = /\(\s*(JEE|NEET|AIPMT|AIEEE|MHT[- ]?CET|IIT)[^)]*\d{4}[^)]*\)/i;

export function lint(q) {
  const b = typeBlock(q), hits = [];
  const add = (code, detail) => hits.push({ code, detail });
  const qt = stripTags(b.question), st = stripTags(b.solution || '');
  const opts = parseOptions(b.question);
  const keys = Object.keys(opts);

  if (q.questionType !== 'integerQuestion') {
    if (keys.length < 4) add('options_missing', `only options ${keys.join(',') || 'none'} found in stem`);
    for (const k of keys) if (!opts[k]) add('option_blank', `option (${k}) has no content`);
    const seen = {};
    for (const k of keys) if (opts[k]) (seen[opts[k]] ??= []).push(k);
    for (const [v, ks] of Object.entries(seen)) if (ks.length > 1) add('options_identical', `options ${ks.join('&')} both read "${v}"`);
  }
  if (q.questionType === 'scq' && typeof b.answer === 'string' && keys.length && !keys.includes(b.answer))
    add('key_not_in_options', `key ${b.answer} not among parsed options`);
  if (q.questionType === 'mcq') {
    const ans = b.answer;
    if (!Array.isArray(ans) || ans.some(x => x === '') || ans.some(x => /,/.test(x)))
      add('mcq_answer_shape', `answer ${JSON.stringify(ans)} is not a clean list of option letters`);
    else if (ans.length === 1) add('mcq_single_key', 'mcq with exactly one correct letter');
  }
  if (q.questionType === 'integerQuestion' && !/^-?\d+(\.\d+)?$/.test(String(b.answer))) add('int_answer_shape', `answer "${b.answer}"`);
  for (const f of ['question', 'solution']) {
    const h = b[f] || '';
    if (/\\(frac|AA|times|sqrt|alpha|theta)\b|\\\(|\$\$/.test(stripTags(h))) add('markup_leak', `raw LaTeX visible in ${f}`);
    if (/&amp;<\/mi>|<mi>&<\/mi>|<mi>&amp;<\/mi>/.test(h)) add('notation_glitch', `stray "&" symbol in ${f} MathML`);
  }
  if (TAG.test(qt)) add('exam_reference', `exam tag "${qt.match(TAG)[0]}" inside question text`);
  if (/figure|diagram|as shown/i.test(qt) && !(b.quesImages || []).length) add('figure_missing', 'stem refers to a figure; quesImages is empty');
  for (const [w, r] of Object.entries(TYPOS)) if (new RegExp('\\b' + w + '\\b').test(qt + ' ' + st)) add('typo', `"${w}" → "${r}"`);
  if (/\w<span[^>]*>\w/.test(b.question) && /of<span[^>]*>leaf/.test(b.question)) add('missing_space', 'words glued across span boundary ("ofleaf")');
  const prop = q.errorHistory?.length ? `faculty already touched this on ${q.errorHistory.at(-1).at}: ${q.errorHistory.at(-1).note}` : null;
  if (prop) add('prior_fix', prop);
  const CH = [[/displacement current|electromagnetic/i, /optic/i, 'EM/AC content filed under optics'],
              [/action potential|neuron|refractory/i, /living world|photosynthesis/i, 'neuro content filed under botany/living world'],
              [/mean life|half.?life|nuclei/i, /mathematics in physics/i, 'radioactivity filed under maths-in-physics']];
  for (const [kw, ch, why] of CH) if (kw.test(qt) && ch.test(q.chapter)) add('chapter_mismatch', why);
  return hits;
}
