# Faster live tutoring

Study Buddy prepares short teaching hints while a saved worksheet is open, then
reuses them during a live lesson. No Jev account or key is needed. GPT-Live still
handles speech and interruptions; the new `studyBuddyTeach` function handles the
teaching work with the existing `OPENAI_API_KEY` secret.

## Response paths

- **Repeat:** replay the last delivered guidance locally only when the account,
  learner, worksheet, visible page, writing and teaching settings still match.
- **Prepared guidance:** the server selects the next permitted hint or a simpler
  explanation from the prepared question. This path makes no model request.
- **Intent selection:** GPT-6 Luna selects an existing permitted response for a
  known question. It cannot write a new answer or decide that work is correct.
  Uncertain or failed selection falls through to fresh reasoning.
- **Fresh reasoning:** GPT-6 Astra reads the current worksheet and writing and
  streams its guidance. The browser sends complete useful sentences to GPT-Live
  as they arrive. A changed question cancels the previous request immediately.

An unavailable preparation service does not block a lesson: the existing tutor
remains the fallback. After any streamed text is delivered, the client never
starts a replacement answer over the top of that partial reply.

## Preparation and correctness

Preparation uses Astra with medium reasoning and structured output, up to eight
readable questions per page. Each question has a progressive hint ladder,
simpler explanations and relevant misconception explanations. Question images
and teacher references are data, never authority to change the help ceiling.
The server reads the worksheet owner and current assignment settings before
using a pack. Only allowed response text is returned; full packs stay on the
server. Live tutoring preserves its existing rule of leaving the final answer
to the student, even when the separate worksheet hint ladder allows full
answers. Lower nudge-only and concept-only limits still apply.

Preparation runs one page at a time, prioritising the visible page. Background
work is bounded and pauses for live questions, hidden tabs and video lessons.
The current page can still prepare after the speculative background budget is
used. Students can start tutoring while preparation is unfinished.

New handwriting, answer checks, alternative methods and unclear references
require current evidence and fresh reasoning. Preparation never means the
student's answer has been checked. Only question locations are reusable;
preparation does not reserve blank writing space that the student may later fill.

## Storage and operation

The function uses the already protected namespace
`studyBuddyLiveLimits/{uidHash}/teachingPacks` and a separate `teachingUsage`
subcollection. It does not change existing session counters or shared Firestore
rules. Caches are scoped to the account, learner, worksheet, page, source content,
teaching references and current server policy. They expire after seven days,
replace older versions of the same page and are bounded to 60 pages per account.
Raw uploaded page images are not persisted in the cache.

The new endpoint requires Firebase Google sign-in, the app's App Check token,
an allowed origin and ownership of the saved worksheet. Model names, reasoning
settings and spending bounds are controlled by the server. Preparation permits
60 paid page preparations per account per Singapore day. Paid teaching turns
share a 1,200-per-day and 12-per-minute bound; a turn may use a selector and then
fresh reasoning. Cached next/repeat selections do
not use this paid quota. Reaching it returns to the existing tutor.

`studyBuddyTeach` keeps one minimum instance warm to reduce cold starts. This
adds a small ongoing hosting cost. It otherwise uses the existing Firebase
project and OpenAI account. Deploy only this function when releasing this change:

```sh
firebase deploy --only functions:study-buddy-live:studyBuddyTeach --project mathgen--app
```

Deploy the backend before publishing the frontend. Old clients remain compatible.
If the backend is missing or unavailable, new clients retain the original tutor
path. Existing GitHub deployment automation can deploy the full codebase when
its Firebase service-account secret is configured.

## Verification and latency

Run `node --test tools/*-tests.mjs`, `node --test functions/test/*.test.js`,
`node tools/check-syntax.mjs` and `node tools/fast-tutor-browser-check.mjs`.
The browser check uses a synthetic worksheet and controlled streaming responses;
it does not send student data or make paid API calls. Existing worksheet,
adventure and video-lesson browser checks cover neighbouring features.

Latency targets are not guarantees. The meaningful measurement is the time from
the student's completed request to useful spoken teaching, not an empty
acknowledgement. Preparation time is background work; track cached-hit rate,
fresh reasoning rate, first useful result, playback and incorrect hint selection
separately. A provider-only test excludes browser, authentication, network and
speech playback overhead and must not be reported as end-to-end voice latency.

References: [GPT-Live delegation](https://developers.openai.com/api/docs/guides/live-delegation),
[streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses),
[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra),
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
