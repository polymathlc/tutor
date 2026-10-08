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

Question previews contain the published question wording, diagrams, tables and
answer controls. They exclude correct choices, model answers, explanations and
interactive app code. A successful Science `check` returns a `review` with the
teacher's explanation, model answer, answer/explanation diagrams and widget HTML.
Blank, invalid, unavailable and uncertain checks cannot reveal that review.
The CER sample renders each widget through its shared `QuestionApps` renderer,
using the same opaque-origin iframe and enforced network-blocking CSP as CER.

`review.mcq` carries exact block and option IDs, the teacher's recorded correct
ID and reasons for the wrong options. Missing reasons are generated together in
one vision request grounded in the question's diagrams and tables; only exact
returned IDs can receive a reason. Edited wording, diagrams or keys invalidate
the bounded in-memory cache. A failed or incomplete reason request preserves the
grade and authored review, reports `review.reasonError`, and can be retried by
checking again. An MCQ without a valid teacher key cannot declare every option
wrong. When no authored explanation is available, the same vision request also
writes a short conceptual explanation from the teacher's model answer; an
authored block or legacy explanation is preserved. Automatic Science option labels use CER's secondary topics and the bank
owner's published custom topic assignments; teacher label overrides take priority.
Fill-in-the-blank questions retain their individual controls and CER's rule that
adjacent blanked words form one answer, with no answer text in the preview.

Authored drawing pads retain CER's gates: image annotation requires the
question's annotation flag and an image not explicitly excluded; working spaces
require their own annotation flag. Their responses are composite PNG data URLs
under the pad's block ID, limited to four pads, 1.8 million characters per PNG,
3,000 pixels per side and eight megapixels. Arbitrary URLs, forged pad IDs and
invalid/oversized images are refused before grading. Science checks allow an
eight-MiB request body; the other public activities keep their two-MiB limit.
The vision grader receives separately labeled original diagrams, student
drawings and the same pads' teacher model images/words. The initial preview
never carries the teacher's annotation answers. Grade and review calls share a
95-second budget, and original/model image requests run concurrently; reused
original diagrams are fetched once within a check.

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
