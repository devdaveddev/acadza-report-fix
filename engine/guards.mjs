import { applyEdit } from './util.mjs';
import { verify } from './verifiers.mjs';
import fs from 'node:fs';

const ALWAYS_FACULTY = new Set(['type_mismatch']);
const CLEAN_MCQ = a => Array.isArray(a) && a.length >= 2 && a.every(x => /^[A-D]$/.test(x)) && new Set(a).size === a.length;
export function mcqFormatExamples(questions = JSON.parse(fs.readFileSync(new URL('../data/questions.json', import.meta.url)))) {
  return questions.filter(q => q.questionType === 'mcq' && CLEAN_MCQ(q.mcq?.answer)).length;
}
const MCQ_EVIDENCE_NEEDED = 2;
export const HINGLISH = /\b(hai|nahi|nhi|kyu|kyun|kya|chahiye|galat|toh|raha|hona|karu|kuch|pucha|aana|hoga|mein)\b/i;

export const INJECTION = /ignore (all )?(previous|prior|above) instructions|you are (now )?(the )?(an? )?(admin|system|developer)|system prompt|mark (this|the) report as|as an? (ai|assistant)|<\/?(system|instructions?)>/i;

export const VERDICTS = ['defect', 'no_error', 'display_issue', 'app_issue', 'language_mode', 'already_fixed', 'not_actionable'];

const MIN_CONF = { answer_key: 0.9, stem_data: 0.85, solution_fix: 0.8, option_repair: 0.85, default: 0.8 };

export function guard(a, q, taxonomy, comment, opts = {}) {
  const notes = [], r = { ...a };
  const rep = r.repair && taxonomy.repairs[r.repair];
  const edits = r.edits ?? (r.edit ? [r.edit] : []);
  r.edits = edits; r.edit = edits[0] ?? null;

  if (!VERDICTS.includes(r.verdict)) throw new Error(`bad verdict ${r.verdict}`);
  if (r.verdict === 'defect' && !rep) throw new Error(`defect without valid repair for ${r.reportId}`);
  if (r.verdict !== 'defect' && r.repair) { notes.push('repair dropped: verdict is not defect'); r.repair = null; }

  if (INJECTION.test(comment)) { r.flags = [...(r.flags || []), 'prompt_injection']; notes.push('comment contains instruction-like text; treated as data only'); }

  let route = r.route;
  if (rep) {
    for (const e of edits) {
      const field = e.field === 'questionType' ? 'questionType' : e.field;
      if (!rep.fields.includes(field)) { notes.push(`SCOPE VIOLATION: ${r.repair} may not touch "${field}" - edit rejected`); r.edits = []; r.edit = null; route = 'faculty_review'; }
    }
    if (!rep.auto && edits.length) { notes.push(`${r.repair} is auto:false - edit kept as suggestion only`); route = 'faculty_review'; }
    if (!rep.auto) route = 'faculty_review';
  }
  if (rep && ALWAYS_FACULTY.has(r.repair) && route === 'auto_apply') { notes.push(`${r.repair} changes how every student is marked; never auto-applied`); route = 'faculty_review'; }
  const touchesMcqKey = edits.some(e => e.field === 'answer' && (q.questionType === 'mcq' || Array.isArray(e.find) || Array.isArray(e.replace)));
  if (touchesMcqKey && route === 'auto_apply' && mcqFormatExamples(opts.questions) < MCQ_EVIDENCE_NEEDED) { notes.push(`mcq answer array not auto-edited: found ${mcqFormatExamples(opts.questions)} well-formed examples of the production format, need ${MCQ_EVIDENCE_NEEDED}`); route = 'faculty_review'; }
  let cur = q;
  for (const e of r.edits) {
    const res = applyEdit(cur, e);
    if (!res.ok) { notes.push(`edit does not apply: ${res.reason}`); route = 'faculty_review'; r.edits = []; r.edit = null; break; }
    cur = res.q;
  }
  if (r.repair === 'answer_key' && route === 'auto_apply') {
    const v = verify(q);
    if (!v || v.keyMatches) { notes.push('answer_key auto-apply blocked: no independent solve contradicting the key'); route = 'faculty_review'; }
    else if (q.questionType === 'scq' && v.expectedOption !== r.edit?.replace) { notes.push(`answer_key auto-apply blocked: solver says ${v.expectedOption}, edit says ${r.edit?.replace}`); route = 'faculty_review'; }
    else if (q.questionType === 'integerQuestion' && String(v.expected) !== String(r.edit?.replace)) { notes.push(`answer_key auto-apply blocked: solver says ${v.expected}`); route = 'faculty_review'; }
  }
  if (route === 'auto_apply' && (r.confidence ?? 0) < (MIN_CONF[r.repair] ?? MIN_CONF.default)) { notes.push('confidence below auto-apply floor'); route = 'faculty_review'; }
  if (r.verdict !== 'defect') { r.edit = null; r.edits = []; route = 'no_change'; }
  if (opts.freeze && route === 'auto_apply') { notes.push('FREEZE: auto-apply disabled for this run; held for faculty'); r.held_by_freeze = true; route = 'faculty_review'; }
  if (route === 'auto_apply' && !(r.edits ?? []).length && !r.edit) { notes.push('auto_apply without an edit'); route = 'faculty_review'; }
  const sentences = (r.student_reply.match(/[.!?](\s|$)/g) || []).length;
  if (sentences > 3 || r.student_reply.length > 420) notes.push('student_reply longer than 3 sentences');
  if (HINGLISH.test(comment) && !HINGLISH.test(r.student_reply)) notes.push('reply_language_mismatch: comment is Hinglish, reply is not');
  if (INJECTION.test(r.student_reply)) throw new Error('reply echoes injected text');
  r.route = route;
  r.guard_notes = notes;
  return r;
}
