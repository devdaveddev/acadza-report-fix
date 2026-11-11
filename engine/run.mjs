#!/usr/bin/env node
import fs from 'node:fs';
import { CURATED, HINGLISH_REPLIES } from './curated.mjs';
import { lint } from './lint.mjs';
import { verify } from './verifiers.mjs';
import { guard, HINGLISH } from './guards.mjs';
import { typeBlock, applyEdit, stripTags } from './util.mjs';

const argv = process.argv.slice(2);
const live = argv.includes('--live'), freeze = argv.includes('--freeze'), dry = argv.indexOf('--dry-run');
const suffix = freeze ? '.freeze' : '';
const J = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url)));
const questions = J('data/questions.json'), reports = J('data/reports.json'), taxonomy = J('data/taxonomy.json');
const qById = Object.fromEntries(questions.map(q => [q._id, q]));
const byQ = Object.groupBy(reports, r => r.questionId);

function resolveSentinels(a, q) {
  if (a.edits !== 'SOLUTION_STRAY') return a;
  const s = typeBlock(q).solution, end = s.indexOf('</math>') + '</math>'.length;
  const find = s.slice(s.indexOf('<h3>') + 4, end);
  return { ...a, edits: [{ field: 'solution', find, replace: 'Given λ = 0.3 nm = 3 Å. K = h²/(2mλ²) = 150/λ² eV (λ in Å) = 150/9 ≈ 16.7 eV ≈ 16.8 eV. ' }] };
}

if (dry >= 0) {
  const id = argv[dry + 1];
  const r = reports.find(x => x.reportId === id);
  if (!r) { console.error(`usage: node engine/run.mjs --dry-run <reportId>   (e.g. R021)`); process.exit(1); }
  const { buildSolverRequest, buildTriageRequest } = await import('./analyst-llm.mjs');
  const q = qById[r.questionId];
  const placeholderSolver = { final_answer: '?', derivation: 'Apply the relevant formula, substitute the given values, check units and compare with each option. '.repeat(3), problems_found: [] };
  const calls = [['1. solver (blind, once per question)', buildSolverRequest(q)], ['2. triage (once per report)', buildTriageRequest({ report: r, question: q, lint: lint(q), solver: placeholderSolver, taxonomy })]];
  const est = body => Math.ceil(JSON.stringify(body).length / 3.5);
  let total = 0;
  for (const [name, body] of calls) {
    const t = est(body); total += t;
    console.log(`\n===== ${name}  ~${t} input tokens =====`);
    console.log('SYSTEM:\n' + body.system + '\n');
    for (const m of body.messages) console.log(`${m.role.toUpperCase()}:\n` + m.content);
    if (body.tools) console.log('\nTOOL: ' + body.tools[0].name + ' (forced), schema ~' + est(body.tools[0].input_schema) + ' tokens');
  }
  const nQ = new Set(reports.map(x => x.questionId)).size;
  const [s1, s2] = calls.map(([, b]) => est(b));
  console.log(`\n----- ${id}: ~${total} input tokens for this report (estimate: characters / 3.5, not a tokenizer; output adds a few hundred) -----`);
  console.log(`Full run of ${reports.length} reports: ${nQ} solver calls + ${reports.length} triage calls = ~${nQ * s1 + reports.length * s2} input tokens (using this report as the average).`);
  console.log(`Model: ${process.env.ACADZA_MODEL || 'claude-sonnet-5-5'}. No request was sent; ANTHROPIC_API_KEY not needed.`);
  process.exit(0);
}

let analyse;
if (live) ({ analyse } = await import('./analyst-llm.mjs'));

const out = [], xcheck = [];
const SEV = { answer_key: 100, unsound: 90, wrong_question: 90, stem_data: 80, option_repair: 75, identical_options: 70, diagram: 70, type_mismatch: 70, solution_fix: 55, solution_missing: 55, notation: 40, markup_leak: 40, answer_form: 35, wrong_chapter: 30, syllabus: 25, spelling: 20, noise: 15, exam_reference: 15 };

for (const r of reports) {
  const q = qById[r.questionId], hints = lint(q), ver = verify(q);
  let a = live ? await analyse({ report: r, question: q, lint: hints, taxonomy }) : CURATED[r.reportId];
  if (!a) throw new Error('no analysis for ' + r.reportId);
  a = resolveSentinels({ ...a, reportId: r.reportId }, q);
  if (!live && HINGLISH.test(r.comment) && HINGLISH_REPLIES[r.reportId]) a.student_reply = HINGLISH_REPLIES[r.reportId];
  const g = guard(a, q, taxonomy, r.comment, { freeze });
  const edits = g.edits ?? (g.edit ? [g.edit] : []);
  if (ver && g.verdict === 'no_error' && !ver.keyMatches) xcheck.push(`${r.reportId}: no_error but solver disagrees with key (${JSON.stringify(ver)})`);
  if (ver && g.repair === 'answer_key' && ver.keyMatches && g.route !== 'faculty_review') xcheck.push(`${r.reportId}: answer_key but solver agrees with key`);
  if (g.verdict === 'defect' && g.repair === 'answer_key' && g.route === 'auto_apply' && (!ver || ver.keyMatches)) xcheck.push(`${r.reportId}: unverified answer_key auto_apply`);
  out.push({
    reportId: r.reportId, questionId: r.questionId, verdict: g.verdict, repair: g.repair ?? null,
    edit: edits[0] ?? null, ...(edits.length > 1 ? { additional_edits: edits.slice(1) } : {}),
    route: g.route, confidence: g.confidence, evidence: g.evidence, student_reply: g.student_reply,
    ...(g.held_by_freeze ? { held_by_freeze: true } : {}),
    ...(g.flags?.length ? { flags: g.flags } : {}), ...(g.suggestion ? { suggestion: g.suggestion } : {}),
    ...(g.guard_notes.length ? { guard_notes: g.guard_notes } : {}),
  });
}
out.sort((a, b) => a.reportId.localeCompare(b.reportId));
fs.writeFileSync(new URL(`../results${suffix}.json`, import.meta.url), JSON.stringify(out, null, 2) + '\n');

const resByQ = Object.groupBy(out, x => x.questionId);
const repByQ = Object.groupBy(reports, x => x.questionId);
const cases = Object.entries(resByQ).map(([qid, rs]) => {
  const q = qById[qid], reps = repByQ[qid], primary = rs.find(x => x.route !== 'no_change' && x.edit) ?? rs.find(x => x.route !== 'no_change') ?? rs[0];
  const distinct = new Set(reps.map(x => x.studentId)).size;
  const sev = primary.verdict === 'defect' ? (SEV[primary.repair] ?? 30) : 0;
  const urgency = Math.round(sev * (1 + 0.35 * (distinct - 1)) * (primary.route === 'faculty_review' ? 1.15 : 1) + (primary.flags?.includes('unreported_solution_defect') ? 10 : 0));
  return { questionId: qid, urgency, severity: sev, reportIds: rs.map(x => x.reportId), primaryReportId: primary.reportId, verifier: verify(q), lint: lint(q) };
}).sort((a, b) => b.urgency - a.urgency);

const addressed = new Set(out.filter(o => o.edit).map(o => o.questionId + ':' + o.repair));
const MAP = { typo: 'spelling', markup_leak: 'markup_leak', notation_glitch: 'notation', exam_reference: 'exam_reference', missing_space: 'spelling', chapter_mismatch: 'wrong_chapter', figure_missing: 'diagram', options_identical: 'identical_options', option_blank: 'option_repair', options_missing: 'option_repair', mcq_answer_shape: 'answer_key' };
const bonus = [];
for (const q of questions) for (const h of lint(q)) {
  if (!MAP[h.code]) continue;
  const reported = repByQ[q._id]?.length;
  if (reported && out.some(o => o.questionId === q._id && o.repair === MAP[h.code])) continue;
  bonus.push({ questionId: q._id, qid: q.qid, code: h.code, repair: MAP[h.code], detail: h.detail, reported: !!reported });
}
const manual = J('data/manual_findings.json');
fs.mkdirSync(new URL('../public', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../public/data${suffix}.json`, import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), mode: live ? 'live-llm' : 'curated-offline', freeze, questions, reports, taxonomy, results: out, cases, bonus: [...manual, ...bonus] }));

const c = k => out.filter(o => o.route === k).length;
console.log(`mode=${live ? 'live' : 'curated'}${freeze ? ' FREEZE (written to results.freeze.json, results.json untouched)' : ''}  reports=${out.length}  auto_apply=${c('auto_apply')}  faculty_review=${c('faculty_review')}  no_change=${c('no_change')}`);
const notes = out.filter(o => o.guard_notes); if (notes.length) console.log('guard notes:\n' + notes.map(o => ` ${o.reportId}: ${o.guard_notes.join(' | ')}`).join('\n'));
console.log(xcheck.length ? 'CROSS-CHECK FAILURES:\n' + xcheck.join('\n') : 'cross-checks: verifier agrees with every verdict');
console.log(`bonus findings: ${manual.length} manual + ${bonus.length} lint`);
