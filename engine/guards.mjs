import { applyEdit } from './util.mjs';
import { verify } from './verifiers.mjs';

export const INJECTION = /ignore (all )?(previous|prior|above) instructions|you are (now )?(the )?(an? )?(admin|system|developer)|system prompt|mark (this|the) report as|as an? (ai|assistant)|<\/?(system|instructions?)>/i;

export const VERDICTS = ['defect', 'no_error', 'display_issue', 'app_issue', 'language_mode', 'already_fixed', 'not_actionable'];

const MIN_CONF = { answer_key: 0.9, stem_data: 0.85, solution_fix: 0.8, option_repair: 0.85, default: 0.8 };

export function guard(a, q, taxonomy, comment) {
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
  if (route === 'auto_apply' && !(r.edits ?? []).length && !r.edit) { notes.push('auto_apply without an edit'); route = 'faculty_review'; }
  const sentences = (r.student_reply.match(/[.!?](\s|$)/g) || []).length;
  if (sentences > 3 || r.student_reply.length > 420) notes.push('student_reply longer than 3 sentences');
  if (INJECTION.test(r.student_reply)) throw new Error('reply echoes injected text');
  r.route = route;
  r.guard_notes = notes;
  return r;
}
