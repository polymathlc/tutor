# Public sample materials

The website opens `sample.html?subject=math` or `sample.html?subject=science` in
an iframe with `allow="microphone; autoplay"`. Live tutoring is selected by
default and requests microphone access after the published PDF loads. A student
can write on the PDF, type working, request hints, or speak to the tutor without
a student account. The browser may require a tap to grant microphone access or
enable audio. Leaving the iframe stops local media and requests remote cleanup.

`studyBuddySample` accepts JSON POST requests from the website domains, GitHub
Pages and localhost. `initialize` resolves only the current worksheet at
`schedule_config/main.sampleMaterials[subject].worksheet`; clients cannot choose
an arbitrary PDF. It returns a random guest token, a 15-minute expiry and the
published worksheet title/PDF URL. Subsequent `ask`, `start`, `stop` and `check`
requests include that token and subject. `questions` can also create a guest
token without a worksheet. Tokens are hashed in server-only Firestore records.

Every trial allows 15 tutor/check requests and one live session of at most five
minutes. IP hashes allow 25 trial starts per Singapore day; the whole suite
allows 300. These caps apply independently of existing signed-in tutoring.
Worksheet replacement invalidates previous worksheet tokens. A server sweep
every minute closes expired voice sessions and retries failed cleanup.

`sampleMaterialsAdmin` verifies a revocation-checked Firebase Google token for
the existing verified administrator email. `uploadWorksheet` accepts `subject`,
`title`, optional `level`, and `pdfBase64` (a PDF up to 10 MB), saves a generated
file under `sample_materials/{subject}/{id}.pdf`, then updates only that subject's
published worksheet. Failed publication removes the newly uploaded file. The
other admin actions are `listQuestions` and `publishQuestions`.

All three new functions (`studyBuddySample`, `sampleMaterialsAdmin` and
`studyBuddySampleCleanup`) live in the existing `study-buddy-live` codebase in
`us-central1`. Merging functions changes triggers the existing deployment
workflow. A missing deployment credential must be resolved before the widgets
can use their live API; GitHub Pages deployment alone does not deploy functions.
