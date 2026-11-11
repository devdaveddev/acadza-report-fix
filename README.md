# Report → Fix

Turns a student's "ans galat hai" into a **safe, reviewable fix**: a triage engine (Part 1), a faculty console (Part 2) and `results.json` (Part 3).

- `results.json`: output for all 44 reports (`npm run triage`)
- `public/`: the faculty console, a static site (no build step)
- `PROMPTS.md`, `PRODUCT.md`: the written deliverables
- Assignment brief: [docs-assignment-brief.md](docs-assignment-brief.md)

```
npm run triage     # regenerate results.json + public/data.json (offline/curated mode, no API key needed)
npm test           # 20 guard / verifier / consistency tests
npm run serve      # console at http://localhost:8765
node engine/run.mjs --freeze            # no auto-apply: writes results.freeze.json + public/data.freeze.json (console: ?freeze)
node engine/run.mjs --dry-run R021      # print the exact live prompts + estimated tokens for one report; sends nothing
ANTHROPIC_API_KEY=... npm run triage:live   # live LLM analyst (see "Honesty notes")
```

## How the engine works

```
reports ─► group by question ─► ① deterministic lint   (option count, duplicate/blank options, \frac leaks,
                                                         exam tags, known typos, missing figure, mcq key shape)
                              ─► ② independent re-solve (engine/verifiers.mjs: 29 questions recomputed from the
                                                         statement alone; never sees the key, solution or comment)
                              ─► ③ analyst              (LLM or curated judgments; the comment is an untrusted lead)
                              ─► ④ guards               (can only downgrade a route, never upgrade it)
                              ─► results.json + console bundle
```

**Guards** (`engine/guards.mjs`, tested in `tests/guards.test.mjs`):
1. **Scope**: an edit touching a field outside its repair's `fields` is dropped and the case goes to a human.
2. **Applies cleanly**: `find` must occur *exactly once* in the live field; answer edits must match the current key.
3. **answer_key needs proof**: auto-apply only if the independent re-solve *contradicts* the stored key *and* points at the proposed replacement. A student's number is never evidence.
4. **auto:false repairs never auto-apply** (identical options, diagram, wrong chapter, syllabus, ...).
5. **Confidence floors** per repair; non-defects can't carry an edit.
6. **Injection**: instruction-like comments are flagged; a reply that echoes them throws.
7. **Replies** capped at 3 sentences. If the comment is Hinglish, the reply must be too (live prompt rule 10; offline replies in `HINGLISH_REPLIES`).
8. **Type changes never auto-apply** (`type_mismatch` alters negative marking for every attempt).
9. **mcq answer arrays are never auto-edited** until the data holds at least 2 well-formed examples of the production format (it holds 0 today: both mcq keys are malformed).
10. **Freeze** (`--freeze`): any `auto_apply` becomes `faculty_review` and is marked `held_by_freeze`. Non-defects stay `no_change`, since nothing is written for them.

**Duplicate reports** are grouped per question: one proposed edit, one decision, each reporter gets their own reply.

## Console

Queue grouped by question; order = *damage if wrong* (answer key ≫ missing data ≫ cosmetic) × distinct students × needs-a-human. Per case: the change first (rendered before/after with MathML, raw HTML toggle, answer-key chips with option text), then why (evidence, independent re-solve, guard notes), then the reports, then the editable student reply. Approve / Edit / Reject with an audit entry for each (Export JSON). Keyboard: J/K, A, E, R, U. Light/dark, works at phone width. **Unreported** tab lists defects nobody reported.

Live console: https://devdaveddev.github.io/acadza-report-fix/ (GitHub Pages, served from the `gh-pages` branch; precomputed data, no LLM calls).

Deploy: any static host. `vercel --prod` or Netlify drag-drop of `public/` (config files included).

## Honesty notes

- **`results.json` was produced in "curated" mode.** No API key was available in the build environment, so the analyst step uses hand-curated, AI-assisted judgments written after reading each question and the lint/verifier output (`engine/curated.mjs`). They pass through the *same guards* a live LLM answer would. The live path (`engine/analyst-llm.mjs`, prompts in `engine/prompts.mjs`) is written but **has not been run**.
- The console is **precomputed**: it makes no LLM calls. Decisions persist in the browser's localStorage only; there is no backend.
- The independent re-solve covers numeric questions (29). Biology and assertion-reason questions rely on analyst judgment plus lint.

## Judgment calls a reviewer may disagree with

| Report | Call | Why |
|---|---|---|
| R034 | `no_error` (+ solution flagged) | Two equal waves at π/2 give 2I₀, not I₀, so the key (A false) holds; the stored solution is self-contradictory |
| R020 | `answer_key`, faculty | Content A,B,D is right, but the key is one comma-joined string; I can't see the production grader |
| R021 | `type_mismatch`, auto | Exactly one option is correct; stored as mcq with key `["","B"]` |
| R009/R010 | `option_repair`, faculty, conf 0.4 | Option D can't be recovered; the proposed text is a placeholder, never auto-written |
| R026 | `syllabus`, faculty | Borderline; question stays live |
| R040 | `no_error` | Comment is just "wrong"; checked and the key holds |
