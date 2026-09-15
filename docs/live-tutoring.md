# Live tutoring setup

Study Buddy uses `gpt-live-1` for full-duplex speech through the OpenAI Live API. Its client
delegation calls the app's existing Firebase teaching engine, so the visible worksheet page,
teacher grounding, help ceiling, and answer-key rules also apply to spoken tutoring.

## Deploy

The browser remains the existing GitHub Pages site. The session broker and cleanup job run in
Firebase project `mathgen--app`, region `us-central1`.

1. Use a Firebase account with permission to deploy functions in `mathgen--app`. The project
   needs billing enabled for Cloud Functions and Cloud Scheduler.
2. Keep the OpenAI project key in Firebase Secret Manager as `OPENAI_API_KEY`. If it already
   exists, use it. Otherwise run `firebase functions:secrets:set OPENAI_API_KEY --project mathgen--app`
   and enter the value privately at the prompt. Never add a key to the HTML, repository,
   browser storage, Firebase client configuration, or a GitHub comment.
3. Install dependencies with `npm ci --prefix functions`.
4. Run `npm test --prefix functions`, `node tools/live-tutor-tests.mjs`, and
   `node tools/tutor-tests.mjs`.
5. Deploy both functions together:

   ```sh
   firebase deploy --only functions:study-buddy-live --project mathgen--app
   ```

   The dedicated `study-buddy-live` codebase avoids managing unrelated functions in the shared
   project. It contains `studyBuddyLive` and `studyBuddyLiveCleanup`.

6. Publish the updated default branch through the existing GitHub Pages configuration.

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

Automated tests use mocked browser, Firebase, and OpenAI boundaries. They verify protocol
payloads and application behavior without spending API credits; they do not establish actual
model access or audio quality. A real spoken session is required for those checks.

Official implementation references: [Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live),
[client delegation](https://developers.openai.com/api/docs/guides/live-delegation),
[session lifecycle](https://developers.openai.com/api/docs/guides/live-conversations), and
[server controls](https://developers.openai.com/api/docs/guides/voice-server-controls?api=live).
