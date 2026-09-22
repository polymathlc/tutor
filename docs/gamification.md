# Study Buddy adventures and weekly leaderboard

The browser shows companions, quests, badges and weekly groups. `studyBuddyGame`
is the only writer of adventure profiles, reward events, approvals and scores.
Existing browser-written `studentProfiles.tutorUsage`, marking results and mistake
records are never accepted as reward evidence, and there is no historical XP
backfill. Schoolwork and normal marking remain usable if reward checking fails.

## Deployment

The function uses the existing Firebase project `mathgen--app`, Node 22 runtime,
`us-central1` region and `OPENAI_API_KEY` secret. It is exported alongside the live
tutor functions in `functions/index.js`; its HTTPS URL is:

`https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyGame`

Before enabling the function, the shared project's Firestore rules must deny all
browser reads and writes, including nested paths, for these new collections:

| Collection | Purpose |
| --- | --- |
| `tutorGameProfiles` | Server XP, quests, companion preferences and teacher-approved memberships |
| `tutorGameEvents` | Question fingerprints, idempotency leases and account verification quotas |
| `tutorGameBoards` | Weekly group rows containing generated aliases and scores |
| `tutorGameGroups` | Server-owned group membership and bounded group size |

An explicit denial alone does **not** override an existing permissive wildcard
match. The shared rules must exclude these collection names from any broader
allow rule. Do not replace the shared application's rules with a tutor-only
rules file. Deployment should verify the protected rules first and then deploy
`functions:study-buddy-live:studyBuddyGame` (the explicit codebase/function selector);
a missing secret or unconfigured endpoint must leave
the UI in its honest unavailable state, without invented local XP or ranks.

The service verifies revoked Firebase ID tokens and requires the Google sign-in
provider. App Check tokens must belong to the exact Study Buddy web app ID. CORS
permits only the existing Polymath GitHub Pages origin and loopback development
origins. Teacher actions require the verified Google email `chungzhikai@gmail.com`,
matching the existing app administrator. Neither a request-body admin flag nor
browser-written profile fields can grant teacher authority.

## Reward rules

- A first independently verified, substantive academic attempt earns **10 XP**,
  even when its answer is wrong.
- A subsequent independently verified correct answer to that same previously
  verified incorrect question earns **15 XP**, once.
- Daily quests add **5 XP** for studying, **15 XP** for three distinct practice
  questions and **20 XP** for a successful correction. Each bonus is awarded
  once in the same transaction as the qualifying attempt.
- All daily XP, including bonuses, is capped at **200** per learner. Asking for
  hints never subtracts points or changes reward eligibility.
- Levels advance every **200 XP**. Orbit is available immediately. Pip and the
  sunrise frame unlock at **400 XP**; Nova and starlight unlock at **800 XP**.
- Days and Monday week boundaries use **Asia/Singapore (UTC+8)**. Lifetime XP
  persists; each weekly board starts empty. A missed study day ends the current
  streak while the personal best remains.

The server independently checks question text, the student's answer and an
optional question crop with a fixed model, `gpt-4.1-mini-2025-04-14`. Its strict
boolean response must identify the work as relevant and confidently assessable.
No points are awarded for ambiguous, incomplete, irrelevant or refused input.
Browser claims about marks, correctness, XP, answer keys, models and grade levels
are ignored. The server supplies the level from the account's student profile.
The verifier returns no answer key or solution to the browser.

The [Responses structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs)
and [model image/structured-output support](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
are documented by OpenAI. The verification request uses `store: false`; the game
records retain only hashes and reward metadata, not question images or answers.

This is a low-stakes learning leaderboard, not proof of unaided work. Model
verification is fallible, and it cannot establish who completed an answer.
Question fingerprints prevent repeating the same normalized question across
uploads, IDs and cosmetic numbering changes; they are not semantic plagiarism
detection. A text-identical question with a different diagram is conservatively
treated as the same question. The daily cap bounds the effect of equivalent
reworded questions. For questions with very short text, image hashes help identify
the work. Paid verification is limited to **120 requests per Google account per
Singapore day** and **30 per minute**, shared by that account's students; these
limits do not limit tutoring or worksheet marking.

Each reservation has a 45-second lease and the upstream check a 30-second
timeout. Duplicate/in-flight work cannot mint multiple rewards. Failed calls
release the lease; expired leases are safely replaceable, and old results cannot
award against their replacement. Identical unsuccessful input is cached;
revising the answer or supplying a clearer image permits another check.

## Profiles and privacy

The existing account can contain up to eight students. Every request identifies
the active student by its index in the nonempty names of
`studentProfiles/{authenticatedUid}.tutorOnboard.students`. The server derives a
stable learner key from the authenticated UID and normalized student name, so
reordering students does not transfer XP. Renaming creates a fresh adventure and
requires fresh teacher approval; the paid-call quota remains attached to the
Google account. Students with identical normalized names under the same parent
share one adventure; use distinct names in the existing roster to distinguish
them. A client can include its previously received `learnerKey`; a mismatch
returns `profile_changed` instead of awarding another active student's work.

Leaderboard participation is off by default. Students use a generated alias,
companion and frame; peers receive no email, real student name, UID or learner
key. A verified teacher separately approves membership in the student's current
level and subject group. Changing the browser-editable student profile does not
approve a new group or move competitive scores. Only XP earned while the current
group is approved enters that subject's score. Approving a member does not
backfill prior personal XP. Groups support up to 300 approved members, keeping
reads and exact ranking bounded. Revocation immediately removes the current
weekly row and clears that subject's competitive score.

Opting out immediately removes the current weekly rows; opting back in restores
only already eligible scores for the current week. Only approved members can
read their own group's board. Tied XP receives shared competition ranks
(`1, 1, 3`). Responses show the top three and the active learner's neighbours,
including their own row even when far from the podium. Before they have a
rank, the first ten rows are shown. Historical boards are not exposed to clients.

## Browser contract

All requests use JSON POST with `Authorization: Bearer <Firebase ID token>` and
`X-Firebase-AppCheck: <App Check token>`. Every action includes `studentIndex` and
`subject` (`math`, `science`, `english` or `chinese`). Student subject restrictions
follow the existing profile; P3 narrows to science.

| Action | Additional fields | Result |
| --- | --- | --- |
| `snapshot` | Optional `learnerKey` | Current private profile, quests and authorized board |
| `preferences` | Optional `companion`, `frame`, `optIn`, `learnerKey` | Updated snapshot; locks enforced server-side |
| `attempt` | `kind: practice/correction`, `question`, `answer`, optional `questionImage` and `learnerKey` | Snapshot and `award` |
| `inspectMember` | Teacher only: `targetUid` | Generated alias and per-subject approval state |
| `approveMember` | Teacher only: `targetUid`, `approved: boolean` | Updated approval state for the selected subject |

Question images must be inline PNG, JPEG or WebP data URLs, at most 1.4 million
characters; arbitrary remote URLs are refused. Question text is 4–8,000
characters and nonblank answers are at most 4,000. Entire requests are bounded at
1.5 MB. The UI should submit reward checks asynchronously from marking and keep
account/profile-generation checks on pending callbacks.

The snapshot contains:

```js
{
  profile: {
    learnerKey, alias, companion, frame, optIn, xp, level,
    levelProgress, nextLevelXp: 200, completed, corrected,
    streak, bestStreak, studyDays, activeDays, currentWeekDays, weeklyXp,
    badges: [{ id, label, earned }], unlockedCompanions, unlockedFrames
  },
  quests: [{ id, label, progress, target, done, xp }],
  leaderboard: {
    status: 'ready' /* or 'approval_required' */, subject, level, week, resetsAt,
    rows: [{ alias, companion, frame, xp, rank, isYou }], myRank, totalParticipants
  },
  policy: { practiceXp: 10, correctionXp: 15, dailyXpCap: 200, /* request/group limits */ },
  serverTime,
  // Only present for attempts:
  award: { xp, baseXp, questXp, kind, duplicate, reason }
}
```

`activeDays` retains the most recent 35 study dates; `studyDays` is the lifetime
count. `currentWeekDays` contains ISO date strings for this week's study days.
`weeklyXp` is total personal XP this week; a subject board score can be lower
because it includes only that approved subject's eligible XP.

An `award.reason` of `earned` means the transaction succeeded. Other reasons are
`already_rewarded`, `daily_cap`, `not_verified`, `keep_trying` and `practice_first`.
`practice_first` means that a mistake from before adventure scoring began has
no server-verified incorrect attempt; it cannot earn a historical correction
reward. Failures use `{error:{code,message}}` and appropriate HTTP status codes.
The UI must not manufacture rewards when the endpoint cannot be reached.

## Verification

Run `npm --prefix functions test`. The isolated tests cover authentication,
App Check, admin authority, duplicate/concurrent award handling, server-verdict
requirements, wrong-to-correct eligibility, quest/daily limits, profile switching,
cross-group isolation, opt-out/revocation, locked cosmetics, week boundaries,
shared ranks, failed verification recovery and paid-call quota bypass attempts.
Provider calls are stubbed; tests make no paid model requests.
