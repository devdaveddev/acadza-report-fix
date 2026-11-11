import { SOLVER_SYSTEM, TRIAGE_SYSTEM, triageUser, TRIAGE_SCHEMA } from './prompts.mjs';
import { typeBlock } from './util.mjs';

const MODEL = process.env.ACADZA_MODEL || 'claude-sonnet-5-5';
async function call(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, ...body }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
  return r.json();
}
const text = r => r.content.filter(b => b.type === 'text').map(b => b.text).join('');

const solverCache = new Map();
export async function solve(q) {
  if (!solverCache.has(q._id)) {
    const b = typeBlock(q);
    const r = await call({ system: SOLVER_SYSTEM, messages: [{ role: 'user', content: `Type: ${q.questionType}\n${b.question}` }] });
    let out; try { out = JSON.parse(text(r).match(/\{[\s\S]*\}/)[0]); } catch { out = { final_answer: null, problems_found: ['solver output unparseable'] }; }
    solverCache.set(q._id, out);
  }
  return solverCache.get(q._id);
}

export async function analyse({ report, question, lint, taxonomy }) {
  const solver = await solve(question);
  const r = await call({
    system: TRIAGE_SYSTEM,
    tools: [{ name: 'submit_triage', description: 'Submit the triage decision', input_schema: TRIAGE_SCHEMA }],
    tool_choice: { type: 'tool', name: 'submit_triage' },
    messages: [{ role: 'user', content: triageUser({ report, question, lint, solver, taxonomy }) }],
  });
  return { reportId: report.reportId, ...r.content.find(b => b.type === 'tool_use').input };
}
