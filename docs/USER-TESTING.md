# User testing (`/#/study`)

## Why this design
- 5 participants per round finds most problems that affect a third or more of users (Nielsen / MeasuringU); run small rounds, fix, retest.
- Metrics: binary task success, time on task, Single Ease Question (1–7) per task, a comprehension check on the two numbers people misread most (forecast %, capacity %), and the 10-item System Usability Scale (Brooke 1996). SUS average is 68; 80+ is excellent (Sauro & Lewis curved grades). SUS is reliable even at small n, but report the 95% CI.
- Unaltered SUS wording so scores compare with published benchmarks.

## Two tracks
| Track | Who | Tasks |
|---|---|---|
| Resident | anyone who drinks U.S. tap water (or a U.S. city they know) | lead, source, "ppb", 5-year violations, next-year forecast + "what does that % mean?" |
| Professional | utility staff, state program, consultant, TA provider, water-engineering students | open Texas queue, find first step, capacity planner (+ comprehension), EPA-formula filter, ask about a queued system |

## Running a round
1. Send the link `https://<deployment>/#/study` (works remote, ~10 min, anonymous; results saved in the browser until sent).
2. Optional moderated sessions: share screen, ask the participant to think aloud, note where they hesitate. Do not help.
3. Collect: Vercel → Project → Logs, filter `[feedback]`, export, then `node scripts/study/summarize.mjs export.txt`. Set `FEEDBACK_WEBHOOK_URL` (Slack/Discord/Google Apps Script) to receive records live.
4. Targets for submission: SUS ≥ 75 (B), task completion ≥ 80%, comprehension ≥ 80% on the forecast question.
5. Fix the top issues, run round 2, report both rounds (before/after) in the slides.

## Recruiting ideas
- Round 1 (residents): classmates, friends and family with a U.S. city they know; r/WaterTreatment and r/Plumbing only with mod permission.
- Round 2 (professionals): water-engineering students and faculty; AWWA student chapters; LinkedIn messages to state drinking-water program staff and rural water association TA providers.

## Ethics
Anonymous, no account, no IP stored in the record, optional comment only. Say in the slides that participants were volunteers and list any outside help (rules require disclosure).
