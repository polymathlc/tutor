# Worksheet-level teaching guidance

The tutor uses the worksheet's school level to choose its vocabulary, examples
and explanation steps. These are teaching defaults; a school level does not
establish a child's exact age.

| Level | Teaching guidance |
| --- | --- |
| P3 | Concrete objects, simple pictures and one observation or action at a time. |
| P4 | Familiar examples that explain one relationship at a time. |
| P5 | Short sequences that explain how related ideas and steps connect. |
| P6 | Manageable steps through longer reasoning; explain symbols when the worksheet requires them. |
| S1 | Bridge familiar ideas to secondary terms and variables, explaining notation before using it. |

All levels use plain, respectful language, define unfamiliar terms and preserve
subject accuracy. If the student is confused, reduce the vocabulary and step
size without revealing more of the answer. Teacher help ceilings still apply.
Arithmetic remains the default maths teaching method; a worksheet that teaches
algebra can receive an explanation of that algebra.

## Level selection

`functions/learner-guidance.js` is shared by the browser and server. It accepts
only P3–P6 and S1, including common written aliases. The worksheet level takes
priority over the selected student profile. An unrecognised or missing level
falls back to the student's level, then to simple beginner guidance without
inventing an age. Arbitrary level text is never added to system instructions.

The server reads the current active assignment and owned saved worksheet before
using a prepared response or opening a voice session. Its fallback comes from
the selected saved profile. A centre practice session can select only the
student identified by its signed session. Text tutoring uses the open worksheet;
mistake-book practice uses that saved question's level, subject and relevant
teacher notes even when a different worksheet is open.

## Coverage and cached replies

The shared policy is included in chat, hint ladders, marking feedback, keyword
quizzes, maths work checks, mistake practice and live delegation. Prepared and
fresh server tutoring use the same policy, and voice playback preserves the
returned explanation's simple wording and permitted content.

The browser's reply and preparation context includes the resolved guidance.
The server cache includes the saved levels and policy version, and its revision
has been increased so older generic packs cannot be reused. Historical hints
and student work remain saved as they were.

## Verification and release

Run syntax checks, `node --test tools/*-tests.mjs`,
`node --test functions/test/*.test.js` and all browser checks. In particular,
`tools/learner-guidance-browser-check.mjs` captures real outgoing app prompts
using fixture accounts and model replies. It checks worksheet precedence,
profile fallback, malformed levels, cache changes and saved-question practice.
Function tests inspect outgoing prepared, fresh and voice instructions and
verify worksheet ownership and centre identity restrictions. These checks
verify the supplied instructions; they do not score paid model responses.

Publish the backend before the frontend using the existing scoped deployment:

```sh
firebase deploy --only functions:study-buddy-live --project mathgen--app --non-interactive
```

This release needs no Firestore rules or data migration. The existing functions
workflow deploys when its Firebase service-account secret is configured;
otherwise use an authenticated Firebase CLI before publishing GitHub Pages.
