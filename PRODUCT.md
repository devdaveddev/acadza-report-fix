# PRODUCT.md

## Who loses the most when a question is broken
**The student who trusts it, and nobody tells them.** A wrong answer key is the worst case: a student in a small-town coaching class, practising alone at night with no one to check against, *gets it right and is marked wrong*, or worse, memorises the wrong method. They lose marks and confidence, and many won't report it because they assume they are the one who's mistaken (in this set 18 of 44 reports needed no content change, so students are often wrong too, which makes real reports easy to dismiss). The three wrong keys found here (R001–R003 are one key, plus R004 and R005) would have cost every attempt, silently.

**Design reflects it:**
- The queue ranks by *damage × distinct students × needs-a-human*; a wrong key outranks any cosmetic fix.
- Wrong keys must be proved by an **independent re-solve that never sees the student's claim**; their number is a lead only.
- Student replies teach the *why* (and never validate wrong working, e.g. R003), because the reply is often the only explanation they get.
- A faculty member's time is the scarce resource: the change is shown first, one key approves, duplicates collapse into one decision.

## What I would never let the AI auto-apply
1. **Anything that authors content**: new distractors, figures, rewritten stems. (R009/R010 stay with faculty.)
2. **An answer-key change unless the independent solve contradicts the key** *and* picks the replacement; and none at all while the question is in a live test: re-scoring is a human call.
3. **Chapter/subject moves and syllabus calls**: they change who sees the question and how it's scored.
4. **Anything triggered by instruction-like text** in a comment (R027), or any reply that promises a fix date.
5. **Grader-format changes I can't see** (R020), since a "fix" could break working scoring.

## One metric for week 1
**Exposure before fix**: attempts on a question between its first report and its fix being live, for questions later confirmed defective. It measures the actual harm and the speed of this loop. Guardrail beside it: **auto-apply reversal rate** (target < 2%). If faculty revert often, the guards are too loose.

## One idea beyond the brief
**Find broken keys before anyone reports them, from attempt data.** If most high-scoring students pick one option that isn't the key, or the key's option is chosen by almost no one who got the rest of the paper right, the key is probably wrong. That signal exists for every question already. Run the independent re-solver on just those, and the report queue becomes a backstop. Students can stop being the QA team.
