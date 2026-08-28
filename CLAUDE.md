# CLAUDE.md

Guidance for Claude when working in this repo.

## App
- `index.html` — **"Study Buddy"**. One self-contained file (markup + CSS + JS) on the shared
  `mathgen--app` Firebase project with Google sign-in. **A student uploads their own worksheet as a
  PDF, writes their answers on it, and works through it with a buddy that HINTS rather than
  answers.** When they are done it MARKS the paper, and every question they did not get right goes
  into a **mistake book** with a picture of the question that can be cropped down to just that
  question. `README.md` is the feature log, newest version first — add a section there for anything
  user-visible.
- Version badge (`APP_VERSION`, shown in the header) is hard-coded — bump it on every change.
- Roles: `isAdmin()` is the one admin email (`chungzhikai@gmail.com`) — the teacher. Everyone else
  is a student, and a student's device runs the hints and the marking itself. Only the admin sees
  the 📚 Teaching notes window and the AI engine dialog, and only the admin ever writes a note.

## THE HELP CEILING — the thing the whole app turns on
`HINT_RUNGS` / `GUIDANCE_GRADES` / `guidanceDepth` / `rungsAllowed` / `hintLadderFor` /
`buddyCeilingRule` / `markBlankRule` (search `THE HELP LADDER` and `THE STUDY BUDDY`).

A student handed the answer has learned nothing. The parent or student picks a **help level** when
the worksheet is uploaded, and that level is the CEILING the buddy may climb to — never the rung it
starts on. Four rungs: **a nudge**, **concept & keywords**, **how to do it**, **the answer**.

- **THE CEILING IS ENFORCED IN THREE PLACES, and that is the point of it.** A ladder that stops at
  "the method" is worth nothing if the same child can type *"so what's the answer"* into the chat
  and be told, or press **Mark my work** on an untouched worksheet and get the lot. So the level
  reaches the **hint** prompt (`hintLadderFor` asks only for the rungs it allows), the **chat**
  prompt (`buddyCeilingRule`) and the **marking** (`markBlankRule`). Add a fourth thing that talks
  to the student and it needs the rule too.
- **THE LADDER IS ONLY GENERATED AS FAR AS THE CEILING.** On *Nudges only* the answer was never
  asked for and never came back — it is not sitting in the page waiting for anyone curious enough
  to open the developer tools. Hiding a rung that is in the DOM is the kind of lock a ten-year-old
  opens in about a minute.
- **A rung the model returns that nobody asked for is DROPPED**, and the rungs are read back in the
  LADDER's order rather than the reply's. A model that answers with an extra key must not be able
  to hand over a rung the parent switched off.
- **An unknown help level falls back to `HINT_DEFAULT`, never to the top.** A worksheet saved by a
  later version with a level this build has never heard of must not quietly become one that gives
  out full answers.
- **Locked rungs are SHOWN, locked**, not left out. A ladder that simply stops reads as an app that
  ran out of things to say; one that names the rule reads as the rule it is.
- **Marking may give the answer to a question that was ATTEMPTED, at every level** — they have done
  the work, and a mark you cannot learn from is a red pen and nothing more. A question left BLANK
  is the opposite: below the top level it comes back with a place to start instead of its answer.
- **Both ceiling rules go in the SYSTEM prompt**, beside the grounding. A hard constraint carried in
  the user message is one the next question can talk over.
- **The rungs already shown are never taken back** when the level is lowered. Un-reading something a
  student has read is a lie about what they have seen; the new ceiling governs the NEXT hint.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## The AI is Ans Key's, ported whole
Everything that decides what the buddy SAYS is a lift from `polymathlc/anskey`, by way of
`polymathlc/scan` — **keep the shape in step and ship a change to all of them together**:

- **`aiGrounding(kind)` is the ONE door.** Every AI call in this app appends it to its system
  prompt. Adding an AI feature means calling it too — grounding one call site and not another is
  how the app ends up speaking in the teacher's voice on one button and not the next. The harness
  checks **every `window.askGemini(` call site passes `aiGrounding(`**, because nothing else can
  see it.
- `kind` is `'answer'`, `'mark'`, **`'hint'` (this app's own)** or `'teach'`. **`'mark'` gets the
  marking standards and never the key facts or the exemplar answers** — a marker handed the answer
  stops marking against the paper. **`'hint'` gets the key facts and the keywords, because those
  are what a hint is BUILT from, and NOT the marking standards — a hint is not a mark.** It does
  get the exemplars: they are answers to *other* questions, and they are what makes a hint sound
  like this teacher rather than like a textbook.
- **`guidance` is the hand-typed note and it is the ONLY field that reaches every `kind`**, marking
  included. It goes in verbatim through `guidanceBlock()`, ahead of `notesBlock`/`styleBlock`, and
  the authority order names it right after the worksheet.
- **The authority order is stated in the digest and never changes**: what the worksheet itself
  prints wins, then the teacher's general guidance, then the notes and the style, and ordinary
  syllabus knowledge only where they say nothing. What the student has already written on the page
  is never evidence of anything.

## ONE notebook, FOUR apps
- The notes live at `users/{adminUid}/teachingNotes/{id}` — the same collection **Ans Key**
  (`polymathlc/anskey`), **Scan & Answer** (`polymathlc/scan`) and the **Science Learning Portal**
  (`polymathlc/cer`) read and write. Keep the fields compatible: `topics` is reserved for the
  Portal's syllabus list and this app writes it **empty**, so a note written here reads as a general
  note there rather than one tagged with topics it has never heard of. This app's own wording goes
  in `noteTopics` / `subjects` / `levels`. Renaming `keywords`, `markingStandards`, `keyFacts` or
  `guidance` silently ungrounds the other three — nothing throws, the digests just come back empty.
- **`source: 'tutor'` is how the other three name this app on a note's card.** All four carry a
  `noteSourceLabel` / `notesSourceLabel` that falls through to *"from the Learning Portal"* for a
  source it does not know, so a rule typed here would be attributed to the wrong app in every other
  one of them. **Ship a change to the word in all four repos together.**
- **THE NOTEBOOK IS LIVE.** `loadTeachingNotes` attaches `onSnapshot` on the notes AND on the style
  profile — not a one-shot `.get()`. A single read at sign-in meant this tab held whatever the
  notebook said then and never looked again: a rule typed in Ans Key mid-lesson reached the app it
  was typed in and NO other. Three rules hold it: **`_notesDetach` releases anyone waiting on the
  first snapshot** (a waiter holding a promise whose listener has just been unsubscribed is never
  answered, and the hint simply never arrives); **`_notesAttachSeq`** makes a superseded attach
  stand down; and **the listeners come down on every account change**, or one account's notes go on
  grounding the next person to sign in on the device.
- **A hint awaits the notebook before it writes a word**, so a rule typed seconds earlier is obeyed
  by the very next hint.
- **The style profile is READ here and never written.** It lives at
  `users/{adminUid}/aiTraining/answerStyle` and is distilled in **Ans Key** from the answers the
  teacher has written on their own worksheets. Nothing a student writes here is an answer the
  teacher wrote, so there is nothing honest to learn from. Do not add a harvest path without
  deciding first whose answers those are.
- **A student's device reads the notes too** and learns whose notes to read from the Portal's
  `config/admin` pointer, remembered in `localStorage`. A read that is denied is not an error worth
  showing — the buddy carries on ungrounded, exactly as it did before the feature existed.
- **The page SAYS whether it is grounded** (`groundingSummary`, on the hints tab). An ungrounded
  hint looks identical to a grounded one.

## Marking — Scan & Answer's rules, on a worksheet the student wrote on
`MARK_RULE` / `MARK_SYS` / `MARK_SUBJECT_RULE` / `_markFields` / `_markNewItem` / `_markFoldRows`
(search `Marking`).

- **The correct answer is worked out FIRST, from the printed question alone.** A model that reads
  the pupil's "1.4" before it does the sum agrees with it far too often, and an app that agrees
  with a wrong answer is worse than no app.
- **A blank is NEVER marked wrong.** `_markFields` is the ONE door for the marking fields and it
  drops a `verdict`, `marks` and `feedback` that came back with an empty `studentAnswer`. A red
  cross on an untouched worksheet is the one mistake this feature can make.
- **The three verdicts are `correct` / `partial` / `wrong`** (`MARK_VERDICTS`). Anything else the
  model invents is dropped, but the question still shows as marked with what the student wrote —
  half a mark is better than silently losing their work off the card.
- **The pages are read as ONE RUN, `MARK_BATCH` (3) at a time**, so a question spread over a page
  break comes back as one question. **A question straddling a batch boundary is stitched by the
  `continuation` entry** — the same mechanism Scan & Answer and the Portal's exam-paper builder use.
- **The page number is GLOBAL, not batch-local.** The model numbers the pictures 1..n within the
  batch it was handed; get this wrong and every question after the third cites the wrong page — and
  every mistake picture is cropped from it.
- **The pages are COMPOSITED before they are sent** (`compositeJpeg` → `drawAnnsOnCtx`): the AI
  must see the worksheet with the student's own ink on it, or it marks every question as blank.
- **ONE unreadable batch never sinks the rest of the worksheet** — those pages are reported and the
  run carries on.
- **`renderMarking` says nothing when nothing was attempted.** A fresh worksheet must not be
  announced as a score of zero out of nothing.

## The mistake book
`mistakes` / `mistakeKey` / `fileMistakes` / `mistakeShotFor` / `openCrop` / `saveCrop`
(search `The mistake book`).

- **Filing is AUTOMATIC.** A mistake book that has to be remembered is an empty mistake book. Every
  `wrong` and `partial` lands in `users/{uid}/mistakes/{id}` with a picture; a blank never does — a
  question nobody attempted is not a mistake.
- **`mistakeKey` is `docId | page | number`**, so marking the same worksheet twice does not file the
  same question twice, and a re-read that words the question slightly differently still matches.
- **The picture is the WHOLE PAGE, honestly.** The marking knows which page a question is on and
  nothing finer, so guessing a band would crop half the questions in half. The student crops it
  themselves with ✂️ when the page is too much — that is what "crop if needed" means.
- **The row is written BEFORE the picture is uploaded**, so a Storage rule that says no leaves a
  mistake with no picture rather than no mistake.
- **The cropper measures against the PICTURE, never the window**, and converts displayed pixels to
  natural ones at the end of the drag. A box drawn against one rectangle and cut out of another is
  a crop that lands somewhere else entirely — the only way this can go wrong and still look like it
  worked.
- **`crossOrigin` is set BEFORE `src`.** Setting it afterwards does nothing, the picture loads
  tainted, and the crop then dies on a `SecurityError` when it is SAVED rather than when it is
  opened — which reads as "cropping is broken" rather than "that bucket has no CORS rule". The
  catch names the real cause.
- **The child's work stays here.** Nothing from this app is written into any question bank.

## The annotation engine is Ans Key's
The annotation SHAPES are that app's exactly, so ink written here means the same thing there:
`pen` / `highlight` / `rect` / `ellipse` / `line` / `arrow` / `text`.

- **`a.heads` and `a.dash` are ABSENT on everything already saved, and the fallbacks are what keep
  those worksheets right.** `annHeads` falls back to the TYPE (an `arrow` has always had a head at
  the end, a `line` has never had one) and `annDashName` falls back to `'solid'`. Break either and
  every arrow quietly loses its point, or every line turns dotted.
- **A LINE AND AN ARROW ARE ONE SHAPE**: a `line` with two heads IS a double-headed arrow, which is
  why the SVG overlay and the canvas flatten each have ONE branch for the pair.
- **The dash pattern is a MULTIPLE OF THE STROKE WIDTH.** A fixed pattern reads as dashed at 1px and
  as a solid line at 12px.
- **The dashes are on the SHAFT and never on the heads.** A dotted arrowhead is two dots where the
  point should be.
- **A DASHED LINE IS MOSTLY GAPS**, so the line branch appends a fat `stroke: 'transparent'` path —
  without it a student aiming at a dotted line hits the page between the dashes and cannot select
  or erase it at all.
- **`annBounds` must know every type.** The marking and the crop measure with it, and a shape it
  does not know is measured at the top of the page.
- **The box being typed in keeps its own DOM node across an overlay rebuild.** The caret, the focus
  and (on an iPad) the keyboard all live on that node; a fresh one loses all three mid-word.
- **Only pages within a screen of the viewport are rasterised.** A 10-page worksheet at fit-width on
  an iPad is tens of megabytes of canvas, and holding every one resident is what makes Safari
  discard the tab. `ensurePageRaster` is what the marking and the crops go through, so a question on
  page 9 is read from the page rather than from a blank canvas.
- **`fittedWidth` decides whether a resize re-fits.** A phone turned on its side must re-fit or the
  worksheet runs off the right of the screen; a student who deliberately zoomed into a diagram must
  not have it undone by the keyboard opening.

## The libraries come off a CDN, and a school network blocks them
`MISSING_LIBS` / `libsReady()` / `renderMissingLibs()`.

pdf.js and the Firebase SDK are two `<script src>` tags away from a filtered school wifi, a content
blocker, or Lockdown Mode on an iPad. An unguarded `pdfjsLib.` or `firebase.` at the top of the
script throws BEFORE a single constant below it has been assigned, so the whole script stops there:
the page paints, every button does nothing at all, and there is nothing anywhere to say why. **Both
are checked, what is missing is NAMED on the page, and everything that does not need them goes on
working.** It is the same reasoning that keeps `aiEngineName()` a hoisted function returning a
literal rather than a `var` assigned up there.

## 🤖 The assistant is called Chung GPT
`aiEngineName()` / `aiVendorName()` / `refreshAiEngineNames`.

- **`aiEngineName()` returns `'Chung GPT'`, full stop**, and every student-facing mention goes
  through it. It is the centre's assistant, not a vendor's, and which company served a given call
  is no use to a child mid-worksheet.
- **It returns a LITERAL, never a variable declared above it** — see the CDN section above.
- **`aiVendorName()` is the vendor**, and the admin's two surfaces keep using it. Branding the
  student's side must not take the truth away from the teacher's: an admin who cannot tell which
  engine answered cannot tell a missing key from a broken one.
- **There is deliberately no API-key box in this app.** Ans Key keeps the ChatGPT and Kimi keys in
  the admin's own record; a key field in an app students sign into on shared iPads is a key waiting
  to be typed on the wrong device.

## 🎙️ TRANSCRIPTION — one model, one door (v1.1.0)

`AI_TRANSCRIBE_MODEL` / `window.transcribeAudio` / `window.transcribeRouteNote`
in the module (search `TRANSCRIPTION — ONE MODEL, ONE DOOR`). **Every Polymath
app that turns speech into text carries the same door — ship a change to all of
them together.**

- **`gemini-3.5-transcribe` reads every recording**, through
  `window.transcribeAudio`. A call site that reaches past it to
  `window.askGemini` is a surface still transcribing on the chat model, and
  nothing on any screen would say so: the words come back either way, a little
  worse.
- **THE MODEL IS A ROUTE, NOT A PROMISE.** An id gets renamed, withdrawn and
  rolled out region by region, and one this project cannot reach is a 400/404
  on EVERY recording — which reads as "the mic is broken" rather than "that id
  is a release out of date". So it is tried first with `AI_MODEL` behind it, a
  refusal is remembered for `AI_TRANSCRIBE_DOWN_MS`, and a success clears the
  mark — the day the id starts answering, the app uses it with nothing
  redeployed.
- **NO THINKING LEVEL IS SENT.** A level a model does not know is a 400, not a
  worse answer, and a speech model has no reason to know the chat models'
  scale. Transcription is reading, not reasoning.

## 🎤 SPEAKING AN ANSWER (v1.1.0)

`VOICE_MAX_MS` / `voice` / `voiceSupported` / `voiceHint` / `startVoice` /
`stopVoice` / `cancelVoice` / `finishVoice` / **`placeSpokenAnswer`** /
`putSpokenIntoChat` / `renderMicBtns` / `renderVoiceBar` (search `SPEAKING AN
ANSWER`), plus the 🎤 tool in the toolbar, the `#voiceBar` and the mic on the
chat row.

A P3 child who can explain evaporation out loud in one breath will spend four
minutes writing the same sentence badly, and by the end of it the science has
gone out of the answer and the handwriting is what is being marked. So they can
**say** it: tap 🎤, tap the spot on the page, speak, and what they said is
written into a text box exactly where they tapped.

- **IT BECOMES ORDINARY INK**, and that is the whole point of putting it on the
  page rather than into a box beside it. A spoken answer is a `text` annotation
  like any other — it moves, it is erased, it undoes, it saves, it is
  composited onto the page for the marking run and it is in the picture that
  goes into the mistake book. Nothing downstream is told it was spoken rather
  than typed, because nothing downstream should care.
- **IT IS NEVER MARKING AND IT IS NEVER A HINT.** It writes down what the
  student said and stops: it does not answer, does not correct, does not finish
  the sentence, and never so much as looks at the page —
  `window.transcribeAudio` is handed audio and nothing else. A mic that quietly
  improved an answer on the way in would mark the student on words they never
  said, and the ✅ Marking tab would then be marking the app.
- **THE LANGUAGE TRAVELS** (`voiceHint`). It is the one thing this app knows
  and the model cannot, and it is not a nicety: a 华文 answer transcribed as
  English phonetics comes back as nonsense.
- **The box is MEASURED after it is drawn**, never guessed at: a sentence
  spoken in one breath is three lines on a phone and one on a laptop, and a box
  too short clips the answer the marking then never sees.
- **A recording that arrives late is DROPPED** (`wsEpoch`), because writing an
  answer onto somebody else's worksheet is worse than losing it.
- **Both mics are painted from ONE function** (`renderMicBtns`), so the two can
  never disagree about whether the app is listening — and a mic that is not
  going to work is not drawn at all, because a button that silently does
  nothing is worse than no button.
- **The bar is FIXED to the viewport, not to the worksheet.** The page under it
  scrolls while a student is speaking, and a ⏹ Done button that scrolls away is
  one they cannot find.

## 🔑 THE ANSWER KEY — hidden from the student, read by the buddy (v1.1.0)

`wsKey` / `pageIsKey` / **`studentPages`** / `applyKeyVisibility` /
`keyPageLooksLikeKey` / `pageText` / `keyScanPdf` / `keyScanByEye` /
`keyAutoScan` / `keyReadImages` / `keyRefreshRows` / `attachKeyPdf` /
**`keyContext`** / **`keyRuleBlock`** / `openKeyModal` (search `THE ANSWER
KEY`), plus the 🔑 chip in the worksheet bar and the `#keyModal`.

Half the worksheets a child brings in have the answers printed at the back, and
a past paper has its marking scheme stapled to it. This app used to render
those pages like any other — the whole worksheet given away by scrolling — and
then MARK them, so the "score" included the answer key the student never
attempted. The same pages are the best thing the buddy could possibly have, so
they are taken out of the STUDENT'S view and put into the BUDDY'S.

- **`wsKey.pages` are never rendered, never marked, never in a mistake
  picture.** They stay in `pages` with `p.num` intact and are HIDDEN, rather
  than being left out of the list — so every page number in the app is still
  the PDF's own, and a key page can still be rasterised when it is read.
  **`studentPages()` is the ONE place "the pages the student has" is decided**,
  and the marking, the progress bar and `visiblePage()` all read it.
- **`wsKey.rows` is the key TRANSCRIBED** — number → answer → working. TEXT,
  not pictures, so it costs nothing to carry into every marking batch and every
  hint. That is the difference between "the key is considered" and "the key is
  considered on the first page".
- **A key can arrive as its OWN PDF**, which is how a maths marking scheme
  usually comes. It is never rendered at all.
- **THE KEY IS THE AUTHORITY ON WHAT THE ANSWER IS, NOT ON HOW IT MUST BE
  WORDED** (`keyRuleBlock`). It does not replace the teaching notes and it does
  not replace the marking standard: a key that says "24 g" is satisfied by "24
  grams", and which of those earns full marks is the notes' business. Grounding
  happens exactly as it did — `aiGrounding(...)` is still there and the key is
  added **beside** it, never instead of it.
- **AND THE KEY NEVER LIFTS THE HELP CEILING.** Handing the model the answers
  and then asking for "a nudge" is precisely the door the ladder exists to
  shut, so the ceiling is restated wherever the key is used. A key that quietly
  turned "Nudges only" into full answers would be the worst bug this app could
  have: it would look like the buddy working unusually well.
- **Three prompts carry it and all three must**: the hint, the marking and the
  chat. A key that reaches two of them is a buddy that marks against the paper
  and hints against a guess, with nothing on screen to say which.
- **Finding a key page errs towards leaving it alone.** A key page left showing
  is the bug this fixes and the student can tick it themselves in one tap; a
  question page wrongly hidden is a question that has VANISHED, and they have
  no way of knowing it was ever there. Two guards make hiding pages safe at
  all, and neither is optional: it will never hide **every** page, and it will
  never hide a page the student has **already written on**.
- **A HEADING IS SHORT.** `KEY_TITLE_MAX_LINE` is what stops "the answer key is
  on page 12, but do not look at it until you have finished" — a sentence
  printed in a question — reading as a heading and taking that question page
  out of the worksheet.
- **`KEY_ROW_RE`'s end is a LOOKAHEAD.** `(?:$|\n)` consumes the newline the
  next row needs for its own `(?:^|\n)`, so with the `g` flag every other row
  is skipped: a page of ten answers counts as five, falls under `KEY_MIN_ROWS`,
  and the back page of a past paper is served to the student with the answers
  on it.
- **The scan is never silent.** The chip says how many pages went and opens the
  list to put any of them back.
- **The key is read ONCE.** `attachKeyPdf(file, defer)` and
  `keyAutoScan(defer)` exist so the upload path attaches, then finds the key
  pages, then transcribes the lot in one pass rather than transcribing the
  marking scheme twice.

## 📌 WORKSHEETS THE TEACHER SETS (v1.1.0)

`ASSIGN_COLLECTION` / `loadAssignments` / `myCopyOf` / `startAssignment` /
`pushWorksheet` / `unpushWorksheet` / `renderAssignments` (search `WORKSHEETS
THE TEACHER SETS`), plus 📌 **Set for my students** on a worksheet card and the
**📌 Set for you** section on Home.

- **A PUSH IS A COPY, NOT A SHARE.** Starting an assignment creates a worksheet
  document of the STUDENT'S OWN — their ink, their hints, their marking, their
  mistake book — under their own uid where they can write and nobody else can
  read. What is shared is the PDF in Storage: one file the class reads rather
  than thirty uploads of the same paper.
- **`sharedPdf` is what stops a student's tidy-up deleting the class's file.**
  `deleteWorksheet` and `detachKeyPdf` both check it. Without it, one student
  deleting their own copy takes the worksheet away from everybody.
- **The answer key travels ALREADY READ.** The teacher's copy transcribed it
  once; every student's copy is handed the rows, so a class of thirty costs one
  reading of the marking scheme rather than thirty (`scanned: true` is what
  stops each copy looking for key pages all over again).
- **`myCopyOf` is what stops a second visit starting a blank copy** and making
  yesterday's work look lost.
- **IT NEEDS ONE LINE IN THE FIRESTORE RULES**, and the failure without it is
  why `pushWorksheet` checks and SAYS SO. A collection the rules do not know
  about fails CLOSED: the write is denied, the read comes back empty, and
  nothing on any screen explains why — the teacher would push a paper, see no
  error, and find out a week later that no student ever got it. The student
  side degrades quietly on purpose (no assignments is the ordinary case); the
  teacher side names the rule to paste. See README.md.
- **Taking one off the list leaves the copies alone.** A worksheet that
  disappeared half way through, with the marking on it, would be work taken
  away rather than an assignment withdrawn.

## 📏 How big the mark is (v1.2.0)

`ANN_SIZE_KINDS` / `ANN_FONT_TOOLS` / `annSizeTarget` / `annSizeKind` /
`annSizeValue` / `annSizeClamp` / `highlightWidthFor` / **`setAnnSize`** /
`annFitTextHeight` / `nudgeAnnSize` / `syncSizeCtl` (search `HOW BIG THE MARK
IS`), plus `#sizeGroup` in the toolbar and the `.size*` CSS.

The thickness was a `<input type="range">` that only ever moved the PEN, and
the text size was a constant nobody could reach: a student who wanted bigger
handwriting had no control at all, and one who wanted 24pt could only aim a
slider at it.

- **ONE control for two numbers, because to a student it is one question.** A
  drawing tool's size is a stroke WIDTH and the 🅣 / 🎤's is a FONT size —
  different units, different sensible ranges, and no phone toolbar has room
  for two spinners of which one is always useless. So it changes meaning with
  what is in hand and **says which** (`#sizeLabel` reads "Pen" or "Text").
- **IT DESCRIBES THE SELECTION FIRST.** Tap a text box written earlier and it
  shows THAT box's size, and typing a new number changes that box — the same
  rule `setColor` already follows, and without it a student has to delete
  something and redraw it to resize it.
- **The two numbers are remembered SEPARATELY** (`strokeW`, `fontSize`), so
  pen → text → pen does not come back with a 16px-thick pen, which reads as
  the app forgetting.
- **A HIGHLIGHTER'S WIDTH IS DERIVED** (`highlightWidthFor`, the ONE place
  that relationship lives — it is marking a line of print, not writing on
  it), so the control shows the PEN number behind it rather than the derived
  width. Showing 27 and setting it back to 3 would silently triple it, and
  doing that twice would reach 81.
- **A box being TYPED IN is never the target.** `annSizeTarget` refuses
  `selectedId === editingId`: resizing a box out from under the caret
  mid-word is not something anybody asked for.
- **`setAnnSize` is the ONE writer** — the arrows, the typed box, `[` / `]`
  and the spinner keys all land there, so the clamp, the restyle and the
  repaint cannot drift apart.
- **A text box GROWS with its size** (`annFitTextHeight`, re-measured off the
  live element rather than scaled, because how many lines the words take at
  this width is not a thing arithmetic knows). A size put up on a box that
  does not grow clips the answer the marking then never sees. It never
  SHRINKS a box the student dragged taller — that was their decision.
- **`syncSizeCtl` is painted from `renderAllOverlays`**, the one function
  every selection change already goes through. Hooking the dozen places that
  set `selectedId` is how one of them gets missed and the control goes stale
  on exactly one route — the reasoning Ans Key's `syncLineStyleCtl` carries.
  It **never writes the box while it is being typed in**, or "24" becomes "2"
  the moment the 2 is pressed, and an EMPTY box is left alone until `blur`
  rather than clamped to the minimum, which is what would stop anybody
  clearing it to type a number at all.
- On a phone the LABEL gives way and the arrows and the box both stay: the
  lit tool button already says which size this is, and the arrows are what
  make it usable with a thumb.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 💾 Auto-save — and what happens when it FAILS (v1.2.0)

`AUTOSAVE_DELAY` / `AUTOSAVE_MAX_DELAY` / `autoSaveDelay` / `scheduleAutoSave`
/ `setSaveState` / `savingNow` / `saveAgain` / `saveFails` / `flushSave` /
`localBackupWrite` / `localBackupRead` / `localBackupClear` /
**`offerLocalBackup`** / `stampOf` / **`applyWorksheetBody`** (search
`AUTO-SAVE`).

Auto-save existed and worked — **until it didn't**. `performSave`'s catch put
the button back to "Save" and stopped: `dirty` stayed true, nothing re-armed
the timer, and the next auto-save waited for the next stroke. So one dropped
connection mid-lesson left the tab on its own for the rest of it, silently,
with a button reading the same word it reads when there is nothing to save.

- **A FAILED SAVE RETRIES**, with the wait doubling to `AUTOSAVE_MAX_DELAY` —
  a tab that cannot reach the server must not spend a lesson retrying every
  two seconds and flattening a phone, and it must not stop either.
- **WHAT IT COULD NOT SEND IS KEPT ON THE DEVICE.** That is the whole
  difference between "auto-save" and "your work is safe": before this, a
  refused write left the only copy in a tab the student was about to close.
  It is written on failure and on the way out, and **cleared the moment a
  save lands** — a rescue, never a cache, so it can never quietly serve stale
  work in place of the real thing.
- **IT IS OFFERED, NEVER APPLIED** (`offerLocalBackup`). The server's copy may
  be NEWER — written from another device or another tab — and overwriting
  that with whatever this browser was holding is a worse bug than the one
  this rescues. So it only speaks up when it is genuinely ahead, and then it
  asks. `stampOf` reads a Firestore stamp, a `Date`, a number or nothing, and
  **an unreadable one comes back 0 so the backup is offered rather than
  assumed stale**: the student is the one who knows.
- **`LOCAL_BACKUP_MAX` bounds it.** localStorage is a few megabytes for the
  whole origin and a worksheet heavy enough to overflow into Storage can be
  most of that alone; a body past the cap is dropped rather than allowed to
  evict everything else in there. The retry is still the real rescue.
- **`applyWorksheetBody` is the ONE place a saved body becomes the open
  worksheet.** Opening one and putting a rescued copy back are the same job,
  and a second copy of that list is one that forgets a field the day another
  is added to `worksheetBody`. It sets the body-derived state and **nothing
  else** — not `currentDocId`, not `bodyOverflow` — because the rescue is
  putting work back into a worksheet that is already open.
- **BOTH `visibilitychange` AND `pagehide`**, because neither is enough:
  Safari on iOS very often gives a swiped-away tab `pagehide` and nothing
  else, and a desktop tab switched away gets `visibilitychange` long before
  it is closed.
- **`savingNow` / `saveAgain`**: one write in flight at a time. Auto-save, a
  hidden tab and a pressed button can all fire within a second, and two
  writes of the same body racing is how the older one lands last.
- **The status is three states, not one word.** "Save" used to mean *nothing
  to save*, *not saved yet* and *the save just failed* alike — three things a
  student would act on differently. `setSaveState` is the ONE writer, and
  `setDirty` will not paint a plain "Save" over a ⚠ that is still true.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## ✒️ The caret lands on the I-beam (v1.1.2)

`ANN_TEXT_PAD_X` / `ANN_TEXT_PAD_Y` / `ANN_TEXT_LINE` / `ANN_TEXT_FONT` /
`ANN_CARET_PROBE` / **`textCaretRect`** / `textCaretModel` /
**`textCaretDelta`** / `startTextBox` / `textBoxWidth` (search `WHERE THE
CARET REALLY IS`), and the `a.type === 'text'` branch of `drawAnnsOnCtx`.

A text box is an HTML `div` inside a `foreignObject`, so **the caret is not at
the box's x/y**: it sits inside the padding, and it is a whole line box tall.
The I-beam's hot spot is its **middle**, not its top. `startTextBox` dropped
the box's top-left on the pointer, so the first letter appeared a padding to
the right and half a line **below** where the student was pointing — about
thirteen pixels at 16px, which is exactly the "that is not where I clicked"
that was reported.

- **THE CARET IS MEASURED, NEVER MODELLED — and the difference is not
  theoretical.** v1.1.1 modelled it as *content-box top + line-height / 2*,
  which is wrong on EVERY placement by the same small amount, always upwards:
  **Blink FLOORS the half-leading** rather than splitting it. At 16px on a
  21.6px line the exact half-leading is 2.3px and the caret box starts 2.0px
  down, so the modelled centre sat **0.297 page units** low — and 0.95 at
  34px. No constant fixes that, because the flooring depends on the font's own
  metrics at the size and scale it is laid out at, which only the browser
  knows.
  **`textCaretRect` asks the browser instead.** A zero-width space gives the
  first line box a real fragment, the range round it is measured, and the
  probe comes straight back out — it is zero-width, it joins a line box that
  is there either way, and it is gone before the box is focused, so it can
  never be typed over or saved. It is written as `'\u200B'` rather than as the
  character, because an invisible literal is one a later edit silently drops.
- **`textCaretModel` is the FALLBACK, for a browser that hands back no rect at
  all**, and it **REFUSES rather than guess** when the line-height will not
  parse. `line-height: normal` computes to the string, and the real normal
  line box is nothing like `fontSize * ANN_TEXT_LINE`. Measured, guessing with
  that multiplier lands in the **same place** as refusing (16px: −2.297
  guessed against −2.313 refused; identical at 34 and 48), so the guess buys
  nothing and **pretends to have corrected** — which is the half that matters:
  a correction that is really a guess hides the fact that the measurement
  failed. Keep the constants in step with `.annText` anyway.
- **KNOWN HAZARD in `textCaretRect`, and it is written on the function.**
  U+200B is a BREAK OPPORTUNITY, so while the probe is in a box whose first
  word is longer than the box the div is a line TALLER (47.19 → 68.78 →
  47.19 once it comes out). Nothing is harmed today — only the probe's own
  rect is read, and every caller reads `scrollHeight` after the probe has
  gone — but anything that later reads a layout property inside that window
  gets an answer about a box that does not exist.
- **THE TWO COORDINATE SYSTEMS ARE THE TRAP.** `getBoundingClientRect` comes
  back in SCREEN pixels; `getComputedStyle` comes back in the SVG's own USER
  units, because the div is laid out inside a `foreignObject` and the whole
  overlay is then scaled to the page's zoom. Mixing them is right at 100% and
  wrong at every other zoom — the one bug that would look fixed on the machine
  it was written on and be wrong on every iPad in the centre. Hence `kx`/`ky`,
  and hence a harness that sweeps seven zooms rather than one.
- **The correction moves the foreignObject, it does not re-render.** A rebuild
  throws away the node about to be focused, and with it the caret and — on an
  iPad — the keyboard, mid-tap. That is the trap Ans Key's own text tool
  documents at length.
- **`textBoxWidth` has a FLOOR.** `baseW - x - 12` goes to nothing and then
  negative within a few centimetres of the right-hand edge, and a box with a
  negative width wraps every single word onto its own line.
- **A spoken answer is placed by the SAME rule**, so tapping a spot and
  speaking puts the words where tapping that spot and typing would have.
- **The flattened picture had to be fixed with it.** `drawAnnsOnCtx` is what
  the marking run reads and what goes into the mistake book, and all four of
  its text numbers were wrong: no padding, a baseline guessed at
  `y + fontSize`, the full box width rather than the width inside the padding,
  and `sans-serif` where the screen uses Century Gothic. Text drawn somewhere
  other than where the student sees it is the app marking a page nobody was
  looking at. Its position now agrees with the screen to under a device pixel
  at the real raster scale.
- **KNOWN LIMIT, and the harness reports it rather than hiding it**: the
  flatten WRAPS differently from the screen in three ways it always has. The
  screen is `white-space: pre-wrap; overflow-wrap: break-word`; the canvas
  splits on `/\s+/`, so a **run of spaces collapses**, a **tab becomes one
  space**, and a **word longer than the box is never broken** (the screen
  breaks it mid-word, the picture runs it off the edge). Those change the line
  breaks the AI marks from. They are older than the caret fix and are left
  alone deliberately — matching `pre-wrap` and `break-word` in canvas is its
  own change with its own risks, and it is not what a misplaced caret is.
- **KNOWN LIMIT, the other one**: `textBoxWidth`'s floor is 80 units, so a box
  started within ~92 units of the right edge runs off the page and is clipped
  out of the flattened picture. Clamping `x` to make it fit would move the
  caret off the pointer — the two goals genuinely conflict there, and the
  caret is the one that was asked for.

**`node tools/text-caret-check.mjs`** is the only honest check of any of it:
it loads the REAL `.annText` rule and the REAL placement functions out of
`index.html`, builds the same `foreignObject`-inside-a-scaled-SVG the app
builds, clicks at a known point and then measures the caret's own rectangle
in the browser. It sweeps eight zooms × seven font sizes × seven points
including all four edges (392 placements), a `devicePixelRatio: 2` pass, three
stylesheet variants, the flattened picture against the screen, and **72
placements of the SPOKEN answer** — the one path that puts a box on a div
that already has words in it — and passes only inside half a page unit.

- **IT MEASURED NOTHING FOR ITS FIRST 168 GREEN TICKS, and that is the
  cautionary tale of this whole section.** `range.setStart(div, 0)` on an
  **empty** contenteditable returns **zero rects** in Chromium, so every
  placement fell through to a fallback that computed *content-box top +
  line-height / 2* — byte-for-byte `textCaretDelta`'s own formula. The check
  agreed with the code because it **was** the code. The four mutants still went
  red, because they broke the placement rather than the shared formula. So the
  probe is not a nicety: **without the zero-width space there is no
  measurement at all**, and a fallback that fires is now reported and FAILS the
  run rather than passing quietly.
- **THE VERDICT IS READ OFF A REFERENCE THAT SHARES NO MECHANISM WITH THE
  CODE**, which is the other half of that lesson. `textCaretRect` answers with
  a zero-width space and a `Range`; ask the harness the same question the same
  way and the two agree because they are the same trick, not because the caret
  is anywhere in particular. So the judged measurement is a **real glyph's
  inline box** read with `getBoundingClientRect` — different probe, different
  API, same truth — and the two are asserted to AGREE on every placement. A
  disagreement fails the run: one of them is then lying and the check is worth
  nothing until it is known which.
- **A PROBE LEFT IN THE BOX IS AN ANSWER WITH A U+200B IN IT.**
  `commitActiveTextEdit` reads `div.innerText`, so it would be saved, marked
  and filed in the mistake book, invisibly. The harness asserts the box is
  empty again after every placement.
- **`--selftest` breaks the placement twelve ways and requires each to go
  red**, over BOTH sweeps (a mutant that only shows in one of them is still
  caught — the appended-probe one shows only in the spoken sweep),
  and **`sub()` THROWS when a mutant matches nothing.** That is the
  load-bearing half: a mutant is a string replacement against code that is
  being edited, so a rename turns it into a no-op — and a no-op reports "not
  caught", which reads as a hole in the measurement rather than as a stale
  test. It has already happened here, to two of them at once.
- Three mutants are worth keeping by name. **Mixed units** is clean at 100%
  zoom, which is precisely why one zoom level would have passed the original
  bug straight through. **A ±0.55 drift** sizes the tolerance, and it must go
  red in BOTH directions — while the code was leaning one way, the drift that
  cancelled the lean was not caught, which was itself evidence the lean was
  real. And **"the caret is MODELLED again instead of measured"** is the alarm
  on this section's own history: it reproduces v1.1.1 exactly, and without it
  the bias could come back under a screenful of green ticks. **"The probe is
  appended"** is the fourth: it is invisible on the empty box the text tool
  makes and puts the spoken answer a whole line out, which is why that sweep
  had to exist at all.
- Like scan's `mobile-check`, it needs `playwright-core` and the Chromium
  already on the machine, so it is a tool you reach for rather than a gate.

## 📊 The report, and the ticks on the page (v1.3.0)

`MARK_TOPIC_RULE` / `MARK_MARKS_RULE` / `MARK_WHERE_RULE` / `_markPair` /
`markPairOf` / `_markAt` / `markMarkTally` / `reportTopicKey` / `reportTopics`
/ `reportLost` / `reportRevise` / `markPinFor` / `renderMarksOn` /
`renderReport` / `reportAsText` (search `THE REPORT` and `The MARKS on the
page`), plus `#reportModal` and the `.rep*` / `.markPin` CSS.

The marking cards answer *"how did I do on question 12"*. They cannot answer
the two questions a student and a parent actually have — **how many marks**,
and **what do I go and revise** — because those are questions about the paper
as a whole, and thirty cards is not a whole.

- **THE TOPIC CAN ONLY COME FROM THE MARKING READ ITSELF.** This app has no
  question bank and no syllabus list: it is handed a PDF nobody has ever seen
  before. So `"topic"` and `"objective"` are asked for per question in the
  same call that marks it — no second pass, no extra cost.
- **The one instruction that makes them worth having is the one about
  CONSISTENCY.** The report GROUPS by topic, so a model that names one topic
  five slightly different ways reports five topics with one question each and
  tells the student nothing at all. `MARK_TOPIC_RULE` names that consequence
  in the prompt, and `reportTopicKey` catches the times it does not listen.
- **A question the marking could not place is SHOWN, under its own heading**,
  and never quietly filed under a topic somebody else's question is in. It is
  also **always last** on the revise list however much was lost on it: *"go
  and revise Not labelled"* is not advice anybody can act on.
- **EVERYTHING IN THE REPORT IS PLAIN CODE.** There is no second AI call and
  there must never be one — the same marked paper has to produce the same
  report every time it is opened, and a model asked to summarise its own
  marking talks itself into a different total. Same rule as `akcCompare` in
  the Maths app and `reportScore` in Scan & Answer.
- **The ranking is by what was LOST, then by the rate**, because three wrong
  out of six is more work than one out of one — and **both numbers are
  printed on the row**, so a student can check the order rather than being
  asked to trust it. A partial counts half: it is half a misunderstanding.
- **A topic nobody attempted is UNTRIED, not weak**, and gets its own line. A
  topic that went perfectly is named as a strength — a report that only ever
  lists failures is one nobody opens twice.

### The marks

- **`MARK_MARKS_RULE` works out an allocation for EVERY question**, because a
  marked paper without marks on it is a paper a student cannot read. What the
  paper prints always wins; the defaults are only for a paper that prints
  nothing, and **a science MCQ being 2 marks is this centre's own
  convention** rather than anything a model would know.
- **`_markPair` settles every contradiction ON THE WAY IN, once.** A correct
  answer earns the lot, a wrong one earns nothing, a blank earns nothing, and
  a partial earns something that is neither — an answer that earns neither is
  not a partial one. Doing it at each of the places that SHOW the marks is
  how the chip ends up saying "partly right" beside a number saying "wrong".
- **`markPairOf` is a plain re-read and re-applies none of it**, or a
  worksheet would quietly re-mark itself every time it was opened.
- **The marks are the one thing that survives a blank**, and that is not an
  exception to "a blank is never marked wrong": "0 out of 2" is the
  allocation the paper printed, not a judgement on an answer nobody wrote.
  The verdict, the feedback and the cross all still stand down.
- **Two totals appear on one page and both are labelled.** The headline is
  what was earned out of what was ATTEMPTED; the table's foot is every mark
  printed on the paper. Unlabelled they read as a contradiction.

### The ticks and crosses

- **THEY ARE NOT ANNOTATIONS, and that is the load-bearing part.** They are
  not in `annotations`, so they cannot be dragged, erased or undone, they are
  not saved into the body, and — the one that matters — `drawAnnsOnCtx` never
  draws them. Put a tick in `annotations` and the next marking run reads a
  page already covered in ticks, agrees with them, and no screen anywhere
  says why the second marking is so much kinder than the first.
- **`renderMarking` is the ONE hook**, because it is the function every path
  that changes the marking already calls — including the early return that
  empties the list, or the last run's ticks stay on the page.
- **The position is a POINT, 0–1000, and it is NEVER clamped.** Out of range
  comes back null and no tick is drawn: a clamped point is a guess, and a
  tick against the wrong question is worse than no tick — which is what the
  prompt says too.
- **The symbol carries the verdict and the colour only reinforces it.** A
  partial is a tick whose NUMBER makes it a partial, so a mono printer and a
  reader who cannot tell red from green both still get the answer. The
  report's table follows the same rule, which is why every row prints the
  word as well as the colour.
- A blank gets **no pin at all**, with or without a position.

## 🤖 Chung GPT has a face (v1.3.0)

`CHUNG_SVG` / `chungAvatar` / `chungSays` / `renderChungHead` (search
`CHUNG GPT'S FACE`), and the `.chungAv` / `.cg*` / `.speech` CSS.

The assistant had a name and no face, so every hint arrived as a paragraph of
grey text. A child working alone at a table reads a face answering them very
differently from a block of prose.

- **IT IS INLINE SVG, drawn in code**, for exactly the reason the logo
  carries an inline-SVG fallback: this app is opened on school wifi and on
  iPads in Lockdown Mode, and a picture that 404s leaves a broken-image icon
  beside every single thing the assistant says. Drawn, it costs no request,
  it is sharp at every size, and it animates.
- **`chungAvatar()` IS THE ONE PLACE THE FACE IS DRAWN** — the panel head, the
  head of a hint, beside a chat reply and on a marked question's feedback.
  Four surfaces, one face.
- **NO `id`, NO GRADIENT, NO FILTER ANYWHERE IN THE DRAWING.** The avatar is
  on screen a dozen times at once, and an `id` repeated a dozen times means
  every `url(#…)` after the first resolves against the wrong element — which
  the Science app's own hero art documents at length. Flat fills only.
- **The face is drawn once per RUN of messages** (`chungSays(node, withFace)`),
  the way every chat app does it: a column of five identical faces down the
  side of a panel is a sheet of stickers, not somebody talking. The
  alignment is kept either way, so the bubbles stay in one column.
- **`transform-box: fill-box` is what makes the blink work.** Without it
  `transform-origin: top` means the top of the whole 64-unit canvas rather
  than the top of the lid, and the eyelid slides down the face instead of
  closing over the eye.
- **`mood` is a class, not a different drawing** — `thinking` while a call is
  in flight, `happy` beside a correct answer. And it is a **transform**, never
  the CSS `d:` property: `d: path(...)` is Chromium and Safari only, so the
  first version smiled in Chrome and nowhere else.
- Everything that moves stops under `prefers-reduced-motion`.
- **The PRODUCT is still Study Buddy; the assistant in it is Chung GPT.**
  `noteSourceLabel` writes `'Study Buddy'` into the shared notebook and the
  four sibling apps read that word — renaming the app would attribute every
  note it has ever written to an app none of them has heard of.

## House rules
- After touching **📊 the report, the marks or the ticks on the page**
  (`MARK_TOPIC_RULE`, `MARK_MARKS_RULE`, `MARK_WHERE_RULE`, `_markPair`,
  `markPairOf`, `_markAt`, `markMarkTally`, `reportTopicKey`, `reportTopics`,
  `reportLost`, `reportTried`, `reportRevise`, `markPinFor`, `renderMarksOn`,
  `renderReport`, `reportAsText`, or `_markNewItem`'s new fields), run
  `node tools/tutor-tests.mjs`. Every failure here is silent and the report
  still prints. A topic named five ways is five topics with one question each,
  which is a revise list that tells a student nothing while looking complete.
  A partial counted whole puts a topic they nearly have above one they do not
  have at all. Marks settled at the places that SHOW them rather than once on
  the way in is a chip reading "partly right" beside a number reading
  "wrong". A blank whose marks are dropped loses the allocation the paper
  printed; a blank that gets a CROSS is the one mistake this whole app is
  built not to make. A position that is clamped instead of refused puts a tick
  against the wrong question. And a tick that ends up in `annotations` is read
  by the NEXT marking run as the student's own work — the paper marks itself
  kinder every time, and nothing anywhere says why.
- After touching **🤖 Chung GPT's face** (`CHUNG_SVG`, `chungAvatar`,
  `chungSays`, `renderChungHead`, or any `.chungAv` / `.cg*` / `.speech`
  rule), run `node tools/tutor-tests.mjs` **and look at it in a browser** —
  a drawing is the one thing reading the source cannot check. An `id` in the
  SVG is invisible on the first copy and breaks every copy after it. A blink
  without `transform-box: fill-box` slides an eyelid down the face. A `d:
  path()` smile works in Chrome and nowhere else. A face per bubble instead
  of per run is a column of stickers. And a `.speech` that stops supplying
  its own background is a stray triangle beside some plain text.
- After touching **📏 the size control or 💾 auto-save** (`ANN_SIZE_KINDS`,
  `annSizeTarget`, `annSizeKind`, `annSizeValue`, `annSizeClamp`,
  `highlightWidthFor`, `setAnnSize`, `annFitTextHeight`, `syncSizeCtl`,
  `autoSaveDelay`, `scheduleAutoSave`, `setSaveState`, `flushSave`,
  `localBackup*`, `offerLocalBackup`, `stampOf`, `applyWorksheetBody`, or
  `performSave`'s catch), run `node tools/tutor-tests.mjs`. Every failure is
  silent and the app goes on looking right. A size control that stops
  describing the selection leaves a student redrawing something to resize it;
  one that shows a highlighter's derived width triples it every time it is
  touched; one written to mid-keystroke turns "24" into "2"; and a text box
  that does not grow with its size clips the answer the marking never sees.
  On the save side the quiet ones are worse: a catch that stops re-arming the
  timer turns one dropped connection into a lesson with no auto-save at all,
  a backup applied rather than OFFERED overwrites newer work from another
  device with whatever this browser was holding, a backup that is not cleared
  on success is stale work waiting to be offered back, and a second copy of
  `applyWorksheetBody` is one that forgets a field the day another is added
  to `worksheetBody`.
- After touching **the text box's placement** (`ANN_TEXT_PAD_X`,
  `ANN_TEXT_PAD_Y`, `ANN_TEXT_LINE`, `ANN_TEXT_FONT`, `ANN_CARET_PROBE`,
  `textCaretRect`, `textCaretModel`, `textCaretDelta`,
  `startTextBox`, `textBoxWidth`, `placeSpokenAnswer`'s placement, the
  `a.type === 'text'` branch of `drawAnnsOnCtx`, or **the `.annText` rule in
  the stylesheet**), run
  **`node tools/text-caret-check.mjs --selftest`** and look at the numbers.
  Reading the source cannot answer this one: where a caret lands is decided by
  the padding, the line height, the font's own metrics and the zoom the page
  happens to be at, and only a browser knows all four. Put the box's top-left
  on the pointer and the first letter is half a line below the I-beam — which
  is the bug this fixed. **Model the caret instead of measuring it and it is
  out by a fraction of a pixel on every placement, always the same way**, which
  no screenshot shows and only a `Range` catches. Mix
  `getBoundingClientRect`'s screen pixels with `getComputedStyle`'s user units
  and it is perfect at 100% and wrong on every iPad in the centre, which is why
  the sweep is eight zooms and not one. Take the width floor away and a box
  near the right edge wraps every word onto its own line. Leave the probe in
  the box and it is saved into the student's own answer, invisibly. Append it
  instead of putting it first and the empty box the text tool makes is
  perfect while every spoken answer is a whole line out. **And add a rule to
  the placement without adding its mutant to `--selftest` — or rename a
  variable a mutant names and let it match nothing — and you have added a tick
  rather than a check.**
- After touching **🔑 the answer key, 🎤 speaking an answer, 📌 the worksheets
  the teacher sets, or the marking's page numbers** (`wsKey`, `pageIsKey`,
  `studentPages`, `applyKeyVisibility`, `keyPageLooksLikeKey`, `KEY_TITLE_RE`,
  `KEY_ROW_RE`, `KEY_TITLE_MAX_LINE`, `keyScanPdf`, `keyScanByEye`,
  `keyAutoScan`, `keyReadImages`, `keyRefreshRows`, `attachKeyPdf`,
  `detachKeyPdf`, `keyContext`, `keyRuleBlock`, `voiceHint`, `startVoice`,
  `finishVoice`, `placeSpokenAnswer`, `renderMicBtns`, `window.transcribeAudio`,
  `_markNewItem`, `_markFoldRows`, `pushWorksheet`, `startAssignment`,
  `myCopyOf`, or `deleteWorksheet`'s `sharedPdf` guard), run
  **`node tools/tutor-tests.mjs`**. Every failure in there is silent and the
  app carries on looking right. A key page left showing is the whole worksheet
  given away by scrolling; a question page wrongly hidden is a question that
  has VANISHED, and the student has no way of knowing it was ever there. A key
  that stops reaching one of the three prompts is a buddy that marks against
  the paper and hints against a guess. A `keyRuleBlock` that stops restating
  the ceiling turns "Nudges only" into full answers, which looks exactly like
  the buddy working unusually well. A page number worked out from an index
  rather than passed through crops every mistake picture from the wrong page,
  and both numbers are perfectly plausible. A mic that answers or corrects on
  the way in marks the student on words they never said. And a `sharedPdf`
  guard that goes away lets one student tidying up their own copy delete the
  worksheet for the whole class.
- **The Gemini model is `AI_MODEL` and its thinking floor is `AI_THINK_MIN`, and the two move
  TOGETHER.** Every model has its own thinking scale, and a level it does not know is a
  **400 INVALID_ARGUMENT on every AI call in the app** — not a worse answer, no answer at all.
  `gemini-3.7-flash` takes `low` / `medium` / `high` and **dropped the `"minimal"` 3.6 accepted**,
  exactly as 3.x had already dropped 2.x's numeric `thinkingBudget`. So the floor is a named
  constant used at every call site, and swapping the model means checking its scale first.
  `polymathlc/anskey`, `polymathlc/scan` and `polymathlc/cer` carry the same pair — keep all four
  in step.
- After touching **the help ceiling, the grounding, the live notebook, the marking, the mistake
  book or the annotation shapes** (`HINT_RUNGS`, `GUIDANCE_GRADES`, `guidanceDepth`, `rungsAllowed`,
  `hintLadderFor`, `hintPromptFor`, `buddyCeilingRule`, `markBlankRule`, `aiGrounding`,
  `notesBlock`, `guidanceBlock`, `styleBlock`, `noteAppliesHere`, `noteSubjects`, `notesRelevant`,
  `groundingSummary`, `loadTeachingNotes`, `_notesDetach`, `stopTeachingNotes`, `_markFields`,
  `_markNewItem`, `_markFoldRows`, `MARK_SYS`, `MARK_RULE`, `MARK_SUBJECT_RULE`, `mistakeKey`,
  `fileMistakes`, `annHeads`, `annDashName`, `annDashPattern`, `annBounds`, `_parseAIJson`), run
  **`node tools/tutor-tests.mjs`**. It loads the REAL sections out of `index.html` and runs them
  against stubs. **Every failure in there is silent and the app goes on looking perfectly right:** a
  ceiling that stops being applied hands a ten-year-old the answer their parent switched off, on a
  screen that still says *Nudges only*; a verdict left on a blank is a red cross on a question
  nobody attempted; a batch-local page number cites the wrong page on every question after the
  third and files every mistake picture from it; a digest that comes back empty is an ungrounded
  hint; and an `askGemini` call site that forgets `aiGrounding` grounds one button and not the next.
- **There is no secret in this file.** The Firebase web API key and the reCAPTCHA site key are
  public client config; quota abuse is prevented by App Check, enforced in the Firebase console.
  Never commit an OpenAI-style key here — this is a public static site served to every student's
  browser, and it would be in the repository history for good.
- After editing `index.html`, syntax-check both script blocks:
  `python3 -c "import re;s=open('index.html').read();b=re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',s,re.S);open('/tmp/c0.js','w').write(b[0]);open('/tmp/c1.mjs','w').write(b[1])" && node --check /tmp/c0.js && node --check /tmp/c1.mjs`
- Commit messages and pushed artifacts must not contain the model identifier.

## Versioning convention — applies to EVERY change (do this every time)
1. **Bump the version.** In `index.html`, update `var APP_VERSION = 'vX.Y.Z'`. Patch bump for
   fixes/small tweaks, minor bump for new features.
2. **Keep it visible.** It renders in the header (`#versionTag`).
3. **Report it.** When summarising an update in chat, always state the new version number.

The whole point: the user checks the version shown in the app against the number reported in chat
to know whether the upload/deploy went through.

## Design convention — breathing space (applies to EVERY UI you build/touch)
- Give elements room to breathe: generous, consistent padding inside cards, clear vertical spacing
  between title → description → meta → buttons, and comfortable line-height. Never cram content
  edge-to-edge or stack lines tightly.
- Cards are rounded rectangles constrained to a sensible max-width and centred — not a dense,
  full-bleed block.
- When the user says something is "too big/thick/messy", the fix is usually *more* whitespace and a
  tighter width, not shrinking fonts until it is cramped.
- The design tokens at the top of the file are the family's — the same palette, radii, shadows and
  type scale as Ans Key and Scan & Answer, so the apps read as one system.
- **On a phone the furniture must not become the window.** Under 640px the toolbar is ONE row you
  swipe sideways rather than three stacked ones, and the buddy is a sheet over the worksheet rather
  than a column beside it.
