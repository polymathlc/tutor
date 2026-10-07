# Faster live tutoring

Study Buddy prepares short teaching hints while a saved worksheet is open, then
reuses them during a live lesson. No Jev account or key is needed. GPT-Live still
handles speech and interruptions; the new `studyBuddyTeach` function handles the
teaching work with `OPENAI_API_KEY`, followed by the server-side
`GEMINI_API_KEY` and `MOONSHOT_API_KEY` backups.

## Response paths

- **Repeat:** replay the last delivered guidance locally only when the account,
  learner, worksheet, visible page, writing and teaching settings still match.
- **Prepared guidance:** the server selects the next permitted hint or a simpler
  explanation from the prepared question. This path makes no model request.
- **Intent selection:** OpenAI Decisions (`gpt-6-luna`) selects an existing permitted response for a
  known question. It cannot write a new answer or decide that work is correct.
  Uncertain or failed selection falls through to fresh reasoning.
- **Fresh reasoning:** GPT-6.1 Sol reads the current worksheet and writing and
  streams its guidance. The browser sends complete useful sentences to GPT-Live
  as they arrive. A changed question cancels the previous request immediately.

An unavailable preparation service does not block a lesson: the existing tutor
remains the fallback. After any streamed text is delivered, the client never
starts a replacement answer over the top of that partial reply.

Since v1.56.1, exact repeats are checked before loading teaching references or
rendering and encoding worksheet images. Familiar follow-ups with an unchanged
context can also make an image-free `reply` request with `preparedOnly: true`.
The server still checks authentication, worksheet ownership and current teaching
settings. Older clients request only directly matched prepared responses, without a model call or paid teaching turn. Current clients also send `allowDecision: true`: when the direct phrase matcher has no result, Decisions may choose from the server-approved hints for the known question. The request carries no worksheet image and cannot generate a new explanation. A miss returns
`fresh_image_required` before any text, allowing the browser to capture the
current worksheet and continue through the full teaching path once.

The browser and server share a whole-utterance phrase classifier for familiar
requests such as “give me another clue”, repeats and simpler explanations.
Compound requests, answer checks, changes of method and unclear references do
not gain a direct shortcut. New phrases do not change the permitted hint ladder.
Cached text still passes through GPT-Live for spoken delivery; avoiding image
work and selection calls does not remove the voice generation time.

## Preparation and correctness

Since v1.57.0, live teaching uses `[[focus pN | Q7 | exact printed words]]`
markers instead of model-estimated underline coordinates. The question label is
optional. Quotes appear as plain text in a small focus card outside the worksheet
canvas. PDF text positions are used only for a unique, trustworthy match;
scanned pages and ambiguous matches retain the quote without a guessed mark.
Text extraction runs asynchronously and never blocks speech. Old `point`
markers are removed from live speech and no longer draw a coordinate-based cue.
Prepared packs use a new revision so old underlines are not reused.

Preparation uses GPT-6.1 Sol with medium reasoning and structured output, up to eight
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
Raw uploaded page images are not persisted in the cache. Version 1.60.0 changes
the preparation revision so packs created under the older model are regenerated.

The server tries OpenAI, Gemini, then Kimi. Every backup receives the same
question images, teacher instructions and response schema. Malformed or truncated
structured output is rejected before use. Each configured route has a bounded
share of the overall timeout so a stalled first route leaves time for backups.
After the first streamed text, failure stops the request rather than combining
responses from two providers. Gemini and Kimi backups deliver one complete reply;
OpenAI continues streaming useful text as it arrives.

The new endpoint requires Firebase Google sign-in, the app's App Check token,
an allowed origin and ownership of the saved worksheet. Model names, reasoning
settings and spending bounds are controlled by the server. Preparation permits
60 paid page preparations per account per Singapore day. Paid teaching turns
share a 1,200-per-day and 12-per-minute bound; a turn may use a selector and then
fresh reasoning. Cached next/repeat selections do
not use this paid quota. Reaching it returns to the existing tutor.

`studyBuddyTeach` keeps one minimum instance warm to reduce cold starts. This
adds a small ongoing hosting cost. It otherwise uses the existing Firebase
project and provider accounts. Bind the existing shared project secrets
`OPENAI_API_KEY`, `GEMINI_API_KEY` and `MOONSHOT_API_KEY` to both the teaching and
adventure functions when deploying. Deploy only this function when releasing this change:

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
[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Decisions selector

The prepared-response selector calls OpenAI Decisions (`/v1/decisions`, `gpt-6-luna`) using the existing server-side `OPENAI_API_KEY`. It chooses only `FRESH` or a server-approved response ID. Named answer and probability arrays are validated; malformed/refused responses and timeouts use the existing fresh-teaching fallback. The 0.90 confidence threshold, help ceilings, worksheet revision checks and interruption handling remain in force. Pack preparation and fresh teaching retain their existing models. Redeploy `functions:study-buddy-live` to activate.

## Decisions before worksheet capture

For an unchanged learner, worksheet, visible page, writing, references and help level, live follow-ups now try the prepared hint selector before loading notes, rasterising the page, encoding JPEGs or uploading worksheet images. Natural requests such as “Could you explain why equal groups matter?” can use this path; repeats remain local and familiar next/simpler requests still use deterministic lookup.

The early Decisions request has a 1.2-second provider deadline inside the client's existing 2.5-second probe limit. These are timeout budgets, not promised response times. Low confidence, refusal, invalid IDs, unavailable packs and provider failures return a miss before any teaching is emitted. The client then captures the current worksheet once and forces fresh reasoning, avoiding a second selection attempt for the same utterance. A miss marker is consumed by the next full request and cannot affect a later turn. A partial spoken response never restarts through a fallback.

The server still checks authentication, ownership, policy revision and the 0.90 threshold. Decisions receives only the eligible hint choices; final answers remain excluded. Answer checks, new writing, changed state and multiple visible pages require fresh evidence. Paid selection uses the existing quota and lease; an image-backed fallback is a separate paid request. No raw audio or worksheet images reach Decisions in this early path.

The real-browser fixture exercises the actual live delegation and commentary handoff. It verifies zero note/key waits, rasterisations, JPEGs, encodes and hashes on a selected natural follow-up, and exactly one image capture on a miss. These synthetic checks do not establish microphone-to-speech latency with the live APIs.

Deployment still requires `FIREBASE_SERVICE_ACCOUNT` in this repository and a redeploy of `studyBuddyTeach`. Older deployed backends ignore the new opt-in and return the existing miss/fresh fallback. The frontend change is in `fast-tutor.js`; refresh the page after deployment to load it.

See [Connect voice to Decisions](https://developers.openai.com/api/docs/guides/decisions-voice).
