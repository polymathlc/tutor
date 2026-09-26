# Centre students

Sign in as the teacher, then open **People**.

- **Add centre student** creates a separate student account without an email address. Choose a name, level and subject access. Each new centre student has their own saved worksheets and progress.
- Search for an existing student, parent or email, then open the account. **Edit access** changes one child's level and subjects while preserving other children, billing answers and recorded work. Existing names remain fixed because adventure history uses the name as part of the learner identity.
- **Practise as …** saves the current worksheet, ends the admin login, and opens the selected student's account. The header shows who is practising. Student Gmail credentials are not needed.
- **End centre practice** saves the worksheet and signs out. Sign in with the teacher's Google account to return to admin controls. A centre session is stored for this browser tab and ends after four hours. A failed save keeps the page open so the work can be retried.

P3 remains Science only. Other levels offer Mathematics, Science, their existing combined option, English or Chinese. Existing family accounts keep their shared worksheet storage; the selected child determines class filtering, tutoring identity and adventure rewards. New centre accounts are separate for each student.

## Deployment

The browser files ship through GitHub Pages. Deploy `studyBuddyCentre` and the updated tutoring/adventure functions together before handing a device to a student:

1. Run `node tools/check-syntax.mjs`, `node --test tools/*-tests.mjs`, and `npm test --prefix functions`.
2. Run `tools/gamification-rules.mjs` and then `tools/centre-admin-rules.mjs` with `--firebase-tools <installed firebase-tools directory> --apply`. Both inspect and test the live shared rules before publication. Never replace this shared project's rules with an app-local file. `tutorCentreAdmin` contains server-only audit records and creation receipts.
3. Deploy with `firebase deploy --only functions:study-buddy-live --project mathgen--app --non-interactive`. Do not use `--force`; other apps use this Firebase project.

The existing main-branch workflow runs these steps when its `FIREBASE_SERVICE_ACCOUNT` secret is configured. Without that secret, deploy using an authenticated Firebase CLI.

The function's runtime service account must be able to sign custom tokens. Enable the IAM Service Account Credentials API and grant that account `roles/iam.serviceAccountTokenCreator` **on itself**, preserving all existing bindings. Firebase documents this requirement in [Create custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens). No service-account key belongs in the browser or repository.

Only the configured, verified Google teacher identity may create students, change access or issue practice tokens. Teacher/staff identities and disabled accounts cannot be practice targets. Practice tokens carry the selected index, a profile fingerprint and an expiry; changed or missing profiles are rejected by the tutoring and adventure services. Ending an existing live call remains allowed after the practice window expires so cleanup can finish.
