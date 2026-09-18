# Live tutoring setup

Study Buddy uses `gpt-live-1` for full-duplex speech through the OpenAI Live API. Its client
delegation calls the app's existing Firebase teaching engine, so the visible worksheet page,
teacher grounding, help ceiling, and answer-key rules also apply to spoken tutoring.

## Deploy

The browser remains the existing GitHub Pages site. The session broker and cleanup job run in
Firebase project `mathgen--app`, region `us-central1`.

Deployment status on 16 September 2026: both `study-buddy-live` and
`ans-key-live` function codebases are deployed. The shared Firestore protection
below is also deployed, with all 166 server-side permission checks passing.
This confirms deployment and access controls; the spoken-session checks below
still verify model access and actual microphone/speaker behavior.

1. Use a Firebase account with permission to deploy functions in `mathgen--app`. The project
   needs billing enabled for Cloud Functions and Cloud Scheduler.
2. Keep the OpenAI project key in Firebase Secret Manager as `OPENAI_API_KEY`. If it already
   exists, use it. Otherwise run `firebase functions:secrets:set OPENAI_API_KEY --project mathgen--app`
   and enter the value privately at the prompt. Never add a key to the HTML, repository,
   browser storage, Firebase client configuration, or a GitHub comment.
3. Install dependencies with `npm ci --prefix functions`.
4. Run `npm test --prefix functions`, `node tools/live-tutor-tests.mjs`, and
   `node tools/tutor-tests.mjs`.
5. Apply and verify the [shared Firestore protection](#shared-firestore-protection)
   before enabling voice sessions. The browser must not read or modify session leases
   or usage limits.
6. Deploy both functions together:

   ```sh
   firebase deploy --only functions:study-buddy-live --project mathgen--app
   ```

   The dedicated `study-buddy-live` codebase avoids managing unrelated functions in the shared
   project. It contains `studyBuddyLive` and `studyBuddyLiveCleanup`.

7. Publish the updated default branch through the existing GitHub Pages configuration.

The browser posts only to
`https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyLive`, with its Firebase ID token
and App Check token. It never receives the OpenAI key. The app uses its existing App Check web
app registration. Production requests must originate from `https://polymathlc.github.io`.
Localhost origins are accepted for development but still require real authentication and App Check.

The Firestore collections `studyBuddyLiveSessions` and `studyBuddyLiveLimits` hold session IDs,
ownership, timestamps, and counters. They must be denied to client reads and writes; the Admin
SDK accesses them on the server. Do not deploy blanket client access rules for these collections.
No SDP, audio, worksheet image, or transcript is written to these collections. The OpenAI session
sets `store: false`.

## Shared Firestore protection

The full deployed rules are authoritative for the shared `mathgen--app` project.
The Math repository's `firestore.rules` and `storage.rules` are incomplete templates;
deploying them would replace other apps' permissions. This repository deliberately
does not configure a full rules replacement in `firebase.json`.

`tools/live-server-rules.mjs` reads the latest deployed Firestore release and adds
only `isLiveServerPath()` to exclude these four root collections, including their
descendants, from the existing shared catch-all:

- `studyBuddyLiveSessions`
- `studyBuddyLiveLimits`
- `ansKeyLiveSessions`
- `ansKeyLiveLimits`

All browser clients are denied, including clients with an admin claim. Cloud
Functions access these records through the Admin SDK, which bypasses client rules.
The existing student history policy and other app paths keep their permissions.
Storage rules are outside this tool's scope.

Use the same installed Firebase CLI package and already authorized Firebase login
used for function deployment. `FIREBASE_CLI_PACKAGE` below means the directory
containing that package's `package.json` and `lib/` directory; supply its actual path.
This tool reuses that login and never prompts for another sign-in or reads keys.

```sh
# Local tests: no login, network access, or Firebase changes.
node --test tools/live-server-rules-tests.mjs

# Fetch and inspect the current source; no remote mutations.
node tools/live-server-rules.mjs --firebase-tools FIREBASE_CLI_PACKAGE --read

# Default mode runs Firebase's server-side rules tests without publishing.
node tools/live-server-rules.mjs --firebase-tools FIREBASE_CLI_PACKAGE

# Explicitly compile and publish the verified focused update.
node tools/live-server-rules.mjs --firebase-tools FIREBASE_CLI_PACKAGE --apply
```

Validation tests deny anonymous, signed-in, and admin-claim clients on the four
namespaces, including collection listing and nested documents. They also check
unrelated app paths and the existing owner-only immutable student history on both
the original and candidate rules. These are synthetic permission tests, so they
do not read or alter students' records.

Unknown source shapes, failed permission tests, incomplete earlier patches, and
unexpected projects stop the operation. Apply mode compiles a candidate, rechecks
the release name and update time immediately before publishing, and reads back the
release afterward. This recheck is not an atomic lock: avoid concurrent rules
deployments. If the recheck detects a change, rerun against the newer source.
Already protected rules are tested without being published again.

## Usage controls

- One active session per Google account, shared by students on that account.
- Six starts per account per Singapore calendar day.
- Twenty concurrent sessions and 100 starts per day across this app.
- Ten minutes per session in the browser. A server cleanup job runs every minute to close
  expired or abandoned sessions, so server enforcement can have about one minute of normal
  scheduling delay. Cleanup failures are retried.

Limits are defined in `functions/live-service.js`. Failed startup attempts currently count
toward the daily start allowance. OpenAI voice usage and Firebase operation charges apply.
Do not deploy the session function without its cleanup job.

## Verify after deployment

Use a saved worksheet while signed into Study Buddy with a Google account:

1. Select Live, start, allow the microphone, and wait for “Listening”. Ask a question and verify
   that you hear the tutor, not just see a connected state. If needed, select **Enable sound**.
2. Ask about the visible worksheet. Verify the explanation follows the selected help level
   and teacher notes. Test a correction while the tutor is thinking.
3. Test mute/unmute, interruptions, End, leaving Live, switching worksheets, signing out,
   a rejected microphone permission, and a lost connection. Confirm the microphone stops.
4. Verify a second concurrent session is refused and server cleanup removes expired sessions.
5. Check Cloud Functions logs for sanitized failure codes if startup fails. Verify the key's
   OpenAI project has access to the Live model and sufficient quota.

6. Watch the orb in the live card (and the small one over the worksheet): the logo's spheres
   should breathe while listening, peel into a **spinning ring under “Thinking”** during a check,
   and rise and fall in a row while the tutor speaks. Listen for the tutor **never** saying
   “let me check”, “let me think”, “one moment” or “hmm” — the server prompt forbids it and the
   client scrubs the spoken reply (`liveStripFiller`) before it reaches the speaker.

Automated tests use mocked browser, Firebase, and OpenAI boundaries. They verify protocol
payloads and application behavior without spending API credits; they do not establish actual
model access or audio quality. A real spoken session is required for those checks.

Official implementation references: [Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live),
[client delegation](https://developers.openai.com/api/docs/guides/live-delegation),
[session lifecycle](https://developers.openai.com/api/docs/guides/live-conversations), and
[server controls](https://developers.openai.com/api/docs/guides/voice-server-controls?api=live).
