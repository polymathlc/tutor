# CLAUDE.md

Guidance for Claude when working in this repo.

## 🔮 THE LIVE ORB — the WHOLE logo in sand, inside a glass sphere, and no "let me check" (v1.21.0)

`LIVE_ORB_TEAL` … `LIVE_ORB_MAGENTA_DARK` / `LIVE_ORB_PALETTE` / **`LIVE_ORB_MASK`** /
`LIVE_ORB_MASK_W` / `LIVE_ORB_MASK_H` / **`LIVE_ORB_STRIDE`** / `LIVE_ORB_STRIDE_FLOAT` /
**`LIVE_ORB_GRAIN_COVER`** / `LIVE_ORB_LOGO_W` / `LIVE_ORB_TALK_MS` / `LIVE_ORB_TALK_FLOOR` /
`LIVE_ORB_RING_R` / `LIVE_ORB_RING_BAND` / `LIVE_ORB_SPIN` / `LIVE_ORB_BREATH` / `LIVE_ORB_DRIFT` /
**`LIVE_ORB_IDLE_GUSTS`** / `LIVE_ORB_GUST_MS` / `LIVE_ORB_GUST_LEN` / `LIVE_ORB_SNAP` /
`LIVE_ORB_SANDY_RATE` / `liveOrbRng` / `liveOrbMaskCells` / `liveOrbPitch` / **`liveOrbGrains`** /
`liveOrbModel` / **`liveOrbState`** / **`liveOrbBroken`** / **`liveOrbTarget`** / `liveOrbEnter` /
**`liveOrbStep`** / `liveOrbSettle` / `liveOrbMotionOk` / `liveOrbHosts` / `liveOrbStrideFor` /
`liveOrbStage` / `liveOrbVisible` / `liveOrbDraw` / **`liveOrbFrame`** / `liveOrbLoopStart` /
**`liveOrbPaint`** / `liveOrbListen` / `liveOrbHush` / `liveOrbSpoke`, and `LIVE_FILLER_LEAD` /
`LIVE_FILLER_VERB` / `LIVE_FILLER_CLAUSE` / `LIVE_FILLER_RE` / `LIVE_FILLER_SENTENCE_RE` /
**`liveStripFiller`** (search `THE LIVE ORB` and `NO "LET ME CHECK"`), plus `#liveOrb` in the live
card, `#liveOrbFloat` beside `#liveSubs`, the `.liveOrb` / `.orbBody` / `.orbGlass` / `.orbStage` /
`.orbGloss` / `.orbCap` / `.orbShadow` CSS with the `orbFloat` / `orbShadow` keyframes, the
`orbAudio` / `level` / `spokeAt` / `orbTalking` fields on `liveTutor`, the repaint in `openBuddy`,
and the strengthened prompts in `worksheetContextRule`, `runLiveDelegation` and
`functions/live-service.js`.

The live card was a line of text. It is the centre's own logo now — the teal block and the
magenta ribbon that make the M — in two and a half thousand grains of sand INSIDE A FLOATING
GLASS SPHERE, and what the sand DOES is what the session is doing. At rest it is the WHOLE
logo, solid, with no gap between grains: while it idles and while it listens the M simply stands
(breathing, drifting a little in the glass). ONLY thinking and talking break it apart — a swirl
into a ring of sand that spins under the word *Thinking* while a check runs, a row that rises
with the voice while it talks — and it re-forms, grain for grain, the moment either ends.
v1.19.0 drew it as sixteen DOM spheres moved by CSS transitions; v1.20.0 as a thousand loose
grains with an idle gust blowing them about. The spheres could not look like the logo and the
gust meant the logo was never quite there; both went.

- **THE SHAPE IS THE ARTWORK.** `LIVE_ORB_MASK` is the logo itself, read off the centre's own
  picture cell by cell (66 × 58, one letter per cell naming which of the six colours it is, a
  dot for paper, run-length encoded) and `liveOrbGrains` makes ONE grain per cell (per
  stride × stride block of cells in the float — `LIVE_ORB_STRIDE_FLOAT`), each with its HOME at
  the exact centre of that cell. So the sand settles into the real logo — the block's lit face, its shadowed face and the
  fold of the ribbon come out in their own colours without anybody drawing them — and a sketch of
  the logo in polygons is exactly what this replaced. Re-reading the mask means re-running the
  classification against the picture (six nearest colours, strays with fewer than three inked
  neighbours dropped, cropped to the ink), never editing the string by hand.
- **THE LOGO IS SOLID BY CONSTRUCTION, not by tuning.** The homes are an exact lattice (no
  jitter inside the cell — `(cell.px + stride / 2) * scale`), and `liveOrbDraw` draws a grain as
  a disc of `LIVE_ORB_GRAIN_COVER` × the cell pitch (`liveOrbPitch`), which is above √½ and so
  covers the cell corner to corner and overlaps its neighbours. At rest the jitter force is ZERO
  and a grain that has arrived is put EXACTLY on its target (`LIVE_ORB_SNAP`), so the settled
  logo is a tiling and not a tremor — the harness asserts that ten seconds of idle stepping
  moves nothing by a hair, and that every home has a neighbour exactly one pitch away. The
  breath and the drift while listening are a uniform scale and a translation, the two motions
  that cannot open a gap. Lower the cover under 0.7071, jitter the homes, or let the idle
  jitter back in, and the logo is a scatter of dots again.
- **ONLY THINKING AND TALKING BREAK THE LOGO APART**, and `liveOrbBroken(state)` is the ONE
  place that is decided: the renderer reads it to switch between solid tiles and sand of uneven
  sizes (`sz`, eased through `model.sandy` so a change never pops), `liveOrbStep` reads it to
  switch the jitter on, and `liveOrbEnter` reads it to add the impulse that makes the break
  visible (a swirl into the ring, a puff into the row, a scatter on the way back). The idle gust
  of v1.20.0 is KEPT, switched off by `LIVE_ORB_IDLE_GUSTS` — the harness flips it on to prove
  the machinery still runs off the frame clock, and it must never be on by default: an idle
  logo that blows apart is not the logo.
- **THE GLASS IS THE STYLESHEET'S.** `.orbBody` is the sphere (it bobs on `orbFloat`, slowly),
  `.orbGlass` its body — a radial gradient lit from the top left, an inner shadow at the foot, a
  hairline rim, a `backdrop-filter` so the float frosts the page behind it — `.orbStage` the
  canvas inside it, `.orbGloss` the specular highlight over the sand, and `.orbShadow` the shadow
  the sphere casts on the surface BENEATH it, shrinking and fading as the sphere rises
  (`orbShadow`). `--halo` is the glow round the glass: teal while it thinks, magenta while it
  talks, nothing at rest — one custom property per state, so the halo is a transition on
  `box-shadow` rather than four copies of the shadow list. Every measurement is in `--u`, so
  the card's orb and the float are one drawing at two sizes; the host's bottom margin (and the
  float's `bottom`) reserve the room the shadow needs. `prefers-reduced-motion` stops the bob
  and the shadow's breath here as well as the sand in the JS.
- **THE MOTION IS PHYSICS, NOT A KEYFRAME.** Each grain is a particle with a position and a
  velocity. `liveOrbTarget` says where a grain WANTS to be in a state — its home, its spot on a
  ring that turns with time, its place on a row whose height is a travelling wave scaled by the
  voice level — and `liveOrbStep` pulls it there with a spring, damps it, and adds the state's
  own field: a vortex while thinking, a whisper of jitter while broken apart, nothing at all
  at rest. A state change never teleports a grain; `liveOrbEnter` only adds the impulse that
  makes the change read (a kick along the ring's turn on the way in, a puff into the row, a
  scatter on the way back to the M).
- **`liveOrbState()` IS THE ONE PLACE THE PHASE BECOMES A STATE**, and both orbs are painted by
  the one `liveOrbPaint`, so the card and the float can never disagree about what the tutor is
  doing. Talking is READ OFF `liveTutor.spokeAt` — a timestamp, not a flag — so the 1-second
  tick's ordinary render lets the row settle back into the M.
- **NOTHING HERE SETS A TIMER, and the harness counts.** Half a dozen cases assert
  `timers.size === 0` after a session ends. The loop is ONE `requestAnimationFrame`
  (`liveOrbFrame`) that runs only while an orb is on screen (`liveOrbVisible`) and stops itself
  when none is — `liveOrbPaint` starts it again, which is why `openBuddy` repaints when the
  buddy reopens on the live tab. The (switched-off) idle gust is scheduled off the FRAME CLOCK
  inside that loop (`model.nextGust`), never a `setTimeout`. The analyser's own `requestAnimationFrame` is
  separate and is cancelled by `liveOrbHush()` in the same `release()` that closes the
  transport.
- **THE MODEL IS PURE, and that is what makes it testable.** `liveOrbGrains`, `liveOrbTarget`,
  `liveOrbStep` and `liveOrbSettle` touch no DOM, so the harness — which has no canvas and no
  `requestAnimationFrame` — pins the physics by stepping the model by hand: the ring turns, the
  wave rises with the level, thinking breaks the logo apart and idling re-forms it exactly.
  Where there is
  no frame loop (the harness) or the student asked for reduced motion (`liveOrbMotionOk`), the
  grains are SETTLED straight onto their targets and drawn once.
- **THE GRAINS ARE GROUPED BY COLOUR AT BIRTH**, so `liveOrbDraw` is six fills a frame — six
  paths of a few hundred arcs — rather than two and a half thousand DOM nodes (measured at
  61 fps in headless Chromium with both orbs running). The float carries a quarter of the
  grains, each covering a 2 × 2 block (`LIVE_ORB_STRIDE_FLOAT`, through `liveOrbStrideFor`, the
  ONE place a host's stride is decided); `--u` sizes the glass and the caption and is the only
  thing the stylesheet knows about the grid.
- **THE VOICE IS MEASURED, WITH A FALLBACK.** `liveOrbListen` hangs an AnalyserNode on the SAME
  remote track the speaker plays, so the row rises with the voice the student is hearing. Where
  Web Audio is missing (the harness, an iPad in Lockdown Mode) `liveOrbSpoke` counts each
  output-transcript delta as a heard syllable, so the row talks either way; the analyser's
  level wins when both exist, because it is measured and the pulse is not. The loop reads
  `liveTutor.level` every frame, so the analyser only paints on a talking transition.
- **EVERY DOM CALL IS DEFENSIVE.** The harness runs the live block in a vm with a mock document:
  a host with no stage grows a canvas, a stage with no 2D context draws nothing, and a missing
  host is simply not painted.
- **THE FLOAT NEVER TAKES A POINTER** — it sits over a page a child writes on with a stylus, the
  rule `#liveSubs` already carries — and it is up only while `liveActive()` on an open worksheet.

### No "let me check" — the scrubber

The voice model is told, in `functions/live-service.js`, to stay silent while a delegation is
pending and to begin with the first teaching sentence when the result arrives; the delegation's
own system prompt says the reply is READ ALOUD and must never open with filler. A text model
still opens with "Let me check the worksheet…" often enough that the reply is **scrubbed before
it is handed to the speaker** (`liveStripFiller` on `spokenReply`).

- **IT IS A SCRUBBER, NOT A REWRITER.** Only a leading run of filler clauses is cut, then any
  whole sentence that is nothing but filler, then a thinking sound opening a sentence ("Hmm,
  what is the unit?"). The teaching itself is never touched.
- **"LET ME KNOW" IS DELIBERATELY NOT FILLER.** `LIVE_FILLER_VERB` names the verbs that mean
  waiting — think, check, see, look, read, go over, figure out — so "Let me know when you have
  tried it" survives, as does a bare "Wait, that is not right" and "Look at the diagram first".
- **A REPLY THAT WAS ALL FILLER COMES BACK EMPTY**, so the caller's existing fallback line
  speaks — better than reading "Let me check." to a child and stopping.
- **Only the FIRST letter is recapitalised** after a cut: an "e.g." mid-reply is an abbreviation.
- Run **`node --test tools/live-tutor-tests.mjs`**, **`node tools/tutor-tests.mjs`** and
  **`cd functions && node --test test/*.test.js`** after touching any of it.

## ✏️ THE MATHS PAD — the working line and the drawn model (v1.27.0)

`mathWorksheet` / `MTH_KEY` / `MTH_MODEL_RUNG` / `MTH_SYMBOLS` / `MTH_WORK_MAX` /
`MTH_STEPS_MAX` / `MTH_LIVE_GAP_MS` / `MTH_BARS_MAX` / `MTH_SEGS_MAX` /
`mthPref` / `toggleMthPref` / `mthPad` / **`mthAllowed`** / **`mthModelAllowed`** /
`mthModelLockedNote` / `mthAnswerAllowed` / **`mthArith`** / `mthInsert` /
`mthShow` / `mthClose` / `mthRender` / `mthRenderWork` / `MTH_WORK_SYS` /
`mthWorkPrompt` / **`mthWorkCheck`** / **`mthWorkClean`** / `mthTellTutor` /
`MTH_MODEL_SYS` / `mthModelCeilingRule` / **`mthModelBuild`** /
**`mthModelClean`** / `mthModelBlanks` / `mthRenderModel` / `mthLabelNorm` /
`mthModelCheck` / **`mthModelLayout`** / **`mthModelPlace`** / `mthArmPlace` /
`mthAfterHint` / `mthAfterLive` / `mthOpenForHint` (search `THE MATHS PAD`),
plus `kwQuizOffReason`, **`floatBoxLayout`**, the one-shot `model` tool in the
pointer handler, `#mthPad`, the `.mth*` / `.hintMathLine` CSS, and the
`mathpad` / `mathstep` / `mathmodel` / `mathmodelput` rows of `USAGE_EVENTS`.

A 🧩 keyword check asks for the WORDS an answer needs. On a maths worksheet
that is the wrong question — a child stuck on question 7 does not need the word
*fraction*, they need to know what to write on the next line — so on a maths
worksheet the keyword check stands down and this takes its place: a **working
line** with the symbols a school keyboard cannot reach, and a **drawn bar
model**.

- **`mathWorksheet()` IS THE ONE PLACE "is this maths" IS DECIDED**, and every
  door asks it: `mthAllowed`, `kwQuizOffReason`, the hint card's buttons, the
  hints tab's helper line, the Live card's switch and the 🧩 button's handler.
  A second test is how the pad appears on a science worksheet or the keyword
  check on a maths one, with nothing on any screen saying which. **`'both'` is
  NOT maths**: it is Ans Key's legacy maths-and-science pairing, so a worksheet
  wearing it is as much science as maths and keeps the keyword check.
- **THE TWO ARE NEVER BOTH OFFERED.** `kwQuizOffReason()` returns `'maths'`
  before it asks the ladder at all, and it is what the locked note reads, so a
  maths worksheet says the keyword check is off *because it is maths* and names
  what it has instead — rather than the level note, which would be true of a
  different worksheet and wrong here.

### The working line is offered at EVERY help level, and that is deliberate

- **ASKING A CHILD TO TRY THE NEXT STEP TELLS THEM NOTHING**, so there is no
  rung for the ceiling to protect: `mthAllowed()` is `mathWorksheet()` and
  nothing else, and `mthShow` / `mthAfterHint` / `mthAfterLive` ask only that.
  A ladder test here would switch the pad off for the children on *Nudges
  only*, who are exactly the ones who need somewhere to attempt a step.
- **IT COSTS NOTHING TO OPEN**, because the ask is already in hand: on a hint
  it is the LAST RUNG THE STUDENT HAS BEEN SHOWN, and in live mode it is what
  the tutor has just said. Only ✅ Check and 📐 the model spend a call.
- **`mthWorkCheck` IS GROUNDED AS `'hint'`**, carries `keyRuleBlock` (so the
  key says what the answer is and never lifts the ceiling), carries
  `tutorMethodRule()` (arithmetic and the unitary method, no algebra, one step
  at a time) and is **NEVER `'mark'`** — a marker handed the answer stops
  marking against the paper, and this is teaching rather than marking. The
  harness pins all four against the file.
- **THE APP'S OWN ARITHMETIC OVERRULES A "right", AND ONLY IN THAT DIRECTION**
  (`mthArith`). `12 × 4 = 46` is not right whatever a model says, and that
  check is free, instant and always the same answer. It is deliberately NARROW
  — `number op number = number`, nothing else — because a parser that tries to
  read real working would fail on the working that is correct, and it may
  never turn a *close* or a *not yet* into something better: a model that read
  the question is a better judge of a step than a regular expression that did
  not.
- **A RIGHT STEP IS KEPT AND THE PAD ASKS FOR THE NEXT ONE**, up to
  `MTH_STEPS_MAX` — a chain longer than that is not a step, it is the whole
  answer being typed in one box.
- **THE TUTOR IS TOLD, AS CONTEXT AND NEVER AS SPEECH** (`mthTellTutor` → the
  general `session.thinking.append` with `delegation_id: null`), so a live
  lesson carries on from the step rather than repeating the sentence before it.

### The model sits on the method rung, and the unknown is never filled in

- **A MODEL OF THE QUESTION *IS* THE METHOD SET OUT**, so `mthModelAllowed()`
  asks the LADDER for `MTH_MODEL_RUNG` (`'method'`) and nowhere decides it a
  second time — and `mthModelBuild` **REFUSES IN THE HANDLER** as well, because
  a hidden button has never been the lock in this app.
- **THE UNKNOWN COMES OUT AS `?` BELOW THE ANSWER RUNG**, on the drawing and on
  the page alike (`mthModelBlanks`, `mthRenderModel`, `mthModelPlace`). A model
  with the answer written in one of its bars is the answer with a rectangle
  round it, which is the same hole `kwQuizGivesAnswer` exists to shut.
- **THE SPECIFICATION NEVER CARRIES THE FINAL ANSWER AT ALL.** `MTH_MODEL_SYS`
  does not ask for it and `mthModelClean` would drop it, so below the top rung
  there is nothing sitting in the page for anybody curious enough to open the
  developer tools — the rule `hintLadderFor` already follows for the rungs.
- **`mthModelCeilingRule()` goes LAST in the system prompt**, where the bars
  are decided, beside the grounding and the key. A hard constraint carried in
  the user message is one the next sentence can talk over.

### What lands on the page is ORDINARY INK

- **IT IS `rect` / `line` / `text` AND NOTHING NEW** (`mthModelPlace`). A new
  annotation type would have to be taught to both renderers, `annBounds`, the
  hit test, the eraser, the resize handles and the print path — six places, and
  the one that gets missed is silent. As ordinary shapes it moves, it is
  erased, it undoes, it saves, it is composited onto the page for the marking
  run and it prints, with nothing told about it.
- **ONE `pushUndo` BEFORE THE GROUP**, so one Ctrl+Z takes the whole model off
  again. The pieces move individually afterwards, which is the accepted trade
  for not adding a type.
- **THE PLACE TOOL IS ONE-SHOT.** It arms, the next tap on a page drops the
  model, and the tool goes straight back to what it was (`mthPad.prevTool`) — a
  mode left armed is a mode that drops a second model the next time a child
  taps the page.
- **`mthModelLayout` IS THE ONE LAYOUT AND BOTH RENDERERS READ IT**, so the
  drawing in the pad and the ink on the page cannot disagree about a model the
  student is copying. **The LAST segment takes whatever is left** rather than
  its own rounded width, or three equal parts of 268 leave a hairline gap at
  the end of the bar that reads as a fourth part.
- **A LABEL IS CHECKED LOCALLY** (`mthLabelNorm`): *"3 units"*, *"3units"* and
  *"3 UNITS"* are one answer to a child who has understood it, a different
  number is not, and nothing is sent anywhere to decide it.

### The box

- **IT IS A FLOATING BOX, NOT A MODAL**, the rule 🧩 already carries: the page
  can still be written on and the tutor still heard while it is open. It closes
  on Escape, on ✕, on a new worksheet (`loadPdf`) and on leaving the worksheet
  (`showView`), and `mthRender` refuses to paint a pad whose `epoch` is not the
  open worksheet's.
- **ONE FLOATING BOX AT A TIME**: `mthShow` closes the quiz and `kwQuizShow`
  closes the pad. They can never both be offered on one worksheet, but a
  worksheet's subject can change under an open box.
- **`floatBoxLayout` READS BOTH BOXES** (it was `kwQuizLayout`), so the
  subtitle bar is lifted clear of whichever one is up. Reading one is a spoken
  answer captioned underneath the box it just set.
- **MODEL OUTPUT IS PAINTED AS TEXT, never as markup** — the ask, the verdict,
  the note, every label — exactly like the quiz, the transcript rows and the
  hint cards.
- **In live mode the pad is raised AFTER the spoken reply is on its way**,
  at most one per reply, never while one is being done, and never more often
  than `MTH_LIVE_GAP_MS`. A box that popped on every "yes" is a box that gets
  closed unread.
- **`mthBusyHints` is kept OFF the hint object**, the reason `kwQuizBusyHints`
  is: a busy flag saved mid-flight comes back true for ever on the next open.
- **The switch is a PREFERENCE, per device**, and a device that refuses storage
  still gets the pad: it is the default.
- Run **`node --test tools/live-tutor-tests.mjs`** and
  **`node tools/tutor-tests.mjs`** after touching any of it.

## 🧩 KEYWORD CHECKS — the concepts rung asked as a question (v1.17.0)

`KWQ_KEY` / `KWQ_RUNG` / `KWQ_MAX_BLANKS` / `KWQ_LIVE_GAP_MS` / `kwQuizPref` /
`kwQuiz` / `kwQuizBusyHints` / **`kwQuizAllowed`** / `kwQuizLockedNote` /
`KWQ_SYS` / `kwQuizCeilingRule` / `kwQuizNorm` / `kwQuizKeyAnswers` /
**`kwQuizGivesAnswer`** / **`kwQuizClean`** / `kwQuizMatch` / **`kwQuizBuild`**
/ `kwQuizShow` / `kwQuizClose` / **`floatBoxLayout`** / `kwQuizRender` /
`kwQuizCheck` / `kwQuizSolved` / `kwQuizReveal` / `kwQuizTellTutor` /
`kwQuizAfterHint` / `kwQuizForHint` / `kwQuizForLive` (search `THE KEYWORD
QUIZ`), the syllabus it reads — `SYLLABUS_TOPICS` / `sylLevelNum` / `sylNorm` /
`sylRows` / **`sylObjectivesFor`** / `sylPromptBlock` (search `THE SCIENCE
SYLLABUS`) — plus `#kwQuiz`, `#liveQuizBtn`, the `.kwq*` CSS, the hooks in
`askHintAt` / `runLiveDelegation` / `loadPdf` / `showView` / the Escape
handler, the 🧩 button on `hintCard`, and the `quiz` / `solved` rows of
`USAGE_EVENTS`.

A box pops up over the page and asks the student to FILL IN the words a
question needs instead of telling them — *"Water turns into [1] by [2]."* — in
hint mode and in live mode alike. It is the "Concept & keywords" rung of the
ladder asked as a question rather than read out.

- **IT SITS ON A RUNG, SO THE CEILING GATES IT.** A quiz hands over exactly
  what the concepts rung hands over, so `kwQuizAllowed` asks the LADDER
  (`rungsAllowed`) whether that rung is allowed and nowhere decides it a second
  time. **`kwQuizOffReason` is what it reads** (v1.27.0): the ladder, and
  before it `mathWorksheet()` — on a maths worksheet the keyword check stands
  down entirely and the ✏️ maths pad takes its place, and the locked note says
  which of the two reasons it is, because the level note would be true of a
  different worksheet and wrong here. Below that level it is shown 🔒 locked on the card and on the hints
  tab, like any other locked rung — and `kwQuizClean` refuses a reply outright
  when the level has changed under it, which is the belt to that brace.
- **THE KEY NEVER LIFTS THE CEILING**, and this is the one that matters:
  `kwQuizGivesAnswer` refuses the WHOLE quiz below full help when any blank's
  word (or an accepted form of it) is exactly what the paper's key gives as
  the answer. Filling that hole in would state the answer; leaving it empty
  would be a hole the student cannot fill; and "the puddle dried up because
  of [evaporation]" beside a key that says *Evaporation* is the answer with a
  box round it. With no question number every row on the paper counts, because
  a word that is ANY answer on the paper is an answer on the paper.
- **ONE BUILDER, ONE CLEANER, ONE BOX.** The 💡 card and the 🎧 tutor both
  reach the quiz through `kwQuizBuild` → `kwQuizClean` → `kwQuizShow`, so the
  two modes can never disagree about what a quiz may hold. A second cleaner is
  a second place to forget the key guard.
- **IT IS GROUNDED AS `'hint'`**, because the keywords and the key facts are
  what a quiz is built from and the marking standards are not; the key rides
  beside it through `keyRuleBlock`; **the syllabus comes AFTER the notes and
  says the notes win** (`sylPromptBlock`) — the syllabus is the floor under
  how this teacher teaches a topic, never a second authority beside it; and
  `kwQuizCeilingRule` restates the ceiling last, where the blanks are decided.
  The harness pins that order against the file.
- **THE SYLLABUS IS MATCHED, NEVER SENT WHOLE.** `sylObjectivesFor` scores the
  79 objectives by the keywords the text actually uses (a two-word phrase
  counts double) and hands over the best three past a floor — so a maths
  question, which mentions "water" and nothing else on the list, gets no
  syllabus block at all, and a subject that is not science gets none whatever
  the words. The student's level CAPS it: a P4 worksheet is never told it tests
  a P6 objective, while a P6 child is still reminded of P3 science. It is a
  COPY of Ans Key's `SYLLABUS_TOPICS` (itself a copy of the Portal's
  `SYLLABUS_LO_TOPICS`) and drifts only when MOE changes the syllabus — edit
  all three then.
- **IN LIVE MODE IT IS BUILT AFTER THE SPOKEN REPLY IS ON ITS WAY**, never
  before it, so the student hears the tutor at the moment they always did and
  the box arrives while it is talking. At most one per reply, never while one
  is still being done, never more often than `KWQ_LIVE_GAP_MS` — a box that
  popped on every "yes" is a box that gets closed unread. The tutor is TOLD
  it is on the screen through a general `session.thinking.append`
  (`delegation_id: null` — context, never speech) and is never handed the
  missing words; when the student solves it, it is told that too.
- **IN HINT MODE IT IS BUILT IN THE BACKGROUND off the hint that just landed**
  (`kwQuizAfterHint`): the hint never waits for it and never loses anything if
  it fails. It goes along with the question the hint read, the keywords the
  ladder found, and **only the rungs the student has been SHOWN** — a rung
  still folded away is one the ladder has not handed over yet. The quiz is
  remembered ON the hint (`h.quiz`), so it is saved into the body with the
  hints and comes back done; a second press reopens it with no second call.
  `kwQuizBusyHints` is kept OFF the hint object on purpose — a busy flag
  saved mid-flight would come back true for ever on the next open.
- **`kwQuizClean` decides what a quiz may hold, once**: every hole in the
  sentence needs its blank and every blank its hole (or the box asks for a
  word it cannot check — refused); an answer word printed beside its own hole
  is filled in and dropped from the check; more than `KWQ_MAX_BLANKS` is a
  test, not a reminder, so the later holes are filled in as given; and what is
  left is renumbered 1..k in order of appearance, so the sentence and the
  blanks can never disagree about which is which.
- **A plural or a tense ending is the same keyword** (`kwQuizMatch`): "water
  vapours" is "water vapour" and "condenses" is "condense" to a child who has
  the science right. A different word is not, and the model's `alt` list
  carries the forms a suffix rule cannot reach.
- **IT IS A FLOATING BOX, NOT A MODAL.** No backdrop, so the rest of the page
  can still be written on — and in live mode the tutor still heard — while it
  is open. It lifts `#liveSubs` clear of itself (`floatBoxLayout`, which since
  v1.27.0 reads the ✏️ maths pad too), so a spoken answer is never captioned
  underneath the box it just set. Escape and ✕
  close it; a new worksheet (`loadPdf`) and leaving the worksheet (`showView`)
  close it too, and `kwQuizRender` refuses to paint a quiz whose `epoch` is
  not the open worksheet's.
- **MODEL OUTPUT IS PAINTED AS TEXT, never as markup** — the sentence, the
  concept, the clues and the praise are all `textContent` or text nodes,
  exactly like the transcript rows and the hint cards.
- **"Show me" appears only after one honest go.** A box that offers the words
  before anything has been typed is a box nobody fills in.
- **The switch is a PREFERENCE, per device**, offered on the Live card and the
  Hints tab whether or not a session is running, and a device that refuses
  storage still gets quizzes: they are the default. Off, a hint still offers
  the quiz on its card; it just stops popping up by itself.
- Run **`node tools/tutor-tests.mjs`** and **`node --test
  tools/live-tutor-tests.mjs`** after touching any of it.

## 💬 SUBTITLES — what the tutor just said, over the page (v1.16.0)

`SUBS_KEY` / `SUBS_HOLD_MS` / `SUBS_MAX_CHARS` / `liveSubs` / **`liveSubsNote`**
/ `liveSubsClear` / `renderLiveSubs` / `setLiveSubs` / `toggleLiveSubs` (search
`SUBTITLES — what the tutor just SAID`), plus `#liveSubs`, `#liveSubsBtn` and
the `#liveSubs` CSS.

A spoken sentence is gone the moment it is said, and a student working on the
question is looking at the PAGE, not at the transcript panel beside it. The
tutor's own words are repeated across the bottom of the screen while they are
being spoken — translucent grey, black text, centred over the worksheet.

- **`pointer-events: none` IS LOAD-BEARING.** This sits over a page a child
  writes on with a stylus. A box that swallowed a stroke — or a tap on a text
  box under it — would be far worse than no subtitles at all, and it would look
  like the pen had stopped working rather than like a caption in the way.
- **ONLY THE TUTOR'S REPLIES.** A student knows what they themselves just said,
  and captioning it back is noise printed over the very question they are
  reading. `liveSubsNote` takes the `who` the one transcript handler already
  decides, so the two can never disagree about who spoke. The panel still holds
  both sides for anyone who wants them.
- **IT IS A CUE, NOT A LOG, and two rules keep it one.** `fresh` is set the
  moment the STUDENT speaks, so the next reply starts a new cue instead of
  growing the last one for ever; and `SUBS_HOLD_MS` takes a finished reply off
  the page. Drop either and the worksheet ends a ten-minute session under a
  wall of transcript. The last reply is deliberately left up WHILE the student
  answers — that is exactly when they are re-reading what they were asked.
- **`SUBS_MAX_CHARS` keeps the TAIL**, so a long answer scrolls itself the way a
  subtitle does rather than growing a paragraph over the page.
- **THE CUE IS CLEARED WHERE THE PHASE BECOMES `closing`, not in `release()`.**
  `stopLiveTutor` holds the transport open for up to three seconds waiting for
  `session.closed`, and the screen is done with the caption the instant ending
  begins. (The bar is hidden by the phase either way — `renderLiveSubs` asks
  for `'live'` — but leaving the text in state is a caption waiting to come
  back on the next render.)
- **`textContent`, NEVER `innerHTML`.** This is model output painted onto the
  page, exactly like the transcript rows beside it.
- **The switch is a PREFERENCE, so it is offered whether or not a session is
  running** — a student who turned subtitles off wants them back before they
  press Start, not once the tutor is already talking. It is remembered per
  device, and **an unreadable or unwritable `localStorage` still gets
  subtitles**: they are the default, and a device that refuses storage is not a
  reason to turn an accessibility aid off.
- The bar clears the 💬 button on a phone. It can never collide with
  `#voiceBar`, because dictation and live mode can never both hold the
  microphone.
- Run **`node --test tools/live-tutor-tests.mjs`** after touching any of it.

## ⚡ THE ANSWER ARRIVES SOONER — four changes on one critical path (v1.26.0)

`LIVE_CONTEXT_MAX` / `LIVE_CONTEXT_DOMINANT` / `LIVE_PAGE_PX` / `LIVE_PAGE_QUALITY` /
`LIVE_STREAM_ON` / `LIVE_STREAM_MAX_APPENDS` / `LIVE_STREAM_MIN_CHARS` /
`liveWarmContext` / `liveSentenceEnd` / `liveMaySpeak` / **`liveFlush`** and the
`Promise.all` prep inside `runLiveDelegation` (search `THE ANSWER ARRIVES
SOONER`), plus the `opts` arm of `worksheetContextPages`, and the two halves of
the door the live section cannot reach: `onStream` in **`askGeminiDirect`** and
the `emitted` guard in **`aiAskRoutes`**.

A spoken question used to be answered like this, one after the other: read the
teaching notes, transcribe the answer key, rasterise up to three pages,
composite and encode three full-size JPEGs, upload them, and then wait for the
model to write the LAST word of the LAST sentence before the student heard the
first. Four things now overlap or shrink, and none of them changes what is
said.

**Every one of these fails silently.** The tutor still answers — just as slowly
as before, or (worse) saying something twice — so each is pinned in
`tools/live-tutor-tests.mjs`, and the two door-level halves in
`tools/tutor-tests.mjs`.

### ① The reply STREAMS, and `liveFlush` is the ONE place anything is spoken

- **`askGemini` still RETURNS the complete reply.** `onStream` is an optional
  early-delivery side channel, never the answer, which is what makes a route
  with no stream behind it — either backup engine, reached through a Cloud
  Function callable — completely unaffected and simply never call it. **A reply
  that never streams is spoken through the very same `liveFlush(true)`**: two
  paths here would be two places for the filler scrub, the fallback line and
  the 🧩 quiz hand-off to drift.
- **`raw` and `cursor` are deliberately two different numbers.** `cursor` is
  how much of the reply has been DEALT WITH — spoken, *or* dropped as filler —
  so a first chunk that is nothing but "Let me check the worksheet." is
  consumed without being said and can never come back as part of the tail.
- **A stop is the end of a sentence only when whitespace AND a capital follow
  it** (`liveSentenceEnd`). Without that, "e.g." and "2.5 kg" read as
  boundaries and half a clause is spoken; and a reply still mid-word simply
  waits for the final flush, which is the safe way to be wrong.
- **EVERY chunk is scrubbed, not just the first.** A reply spoken whole has
  always had its filler removed wherever it sat — `liveStripFiller` drops a
  filler SENTENCE in the middle as well as a leading clause — so scrubbing only
  the opening would mean streaming and not streaming said different things,
  which is the one difference this split must not introduce.
- **`LIVE_STREAM_MAX_APPENDS` (2) reserves its LAST append for the remainder**,
  so a long reply is never left half-spoken because the budget ran out
  mid-answer. `LIVE_STREAM_MIN_CHARS` (24) holds a short opening back — the one
  early append is worth spending on teaching rather than on "Good try." — and
  it is deliberately low enough to let a real sentence through, because the
  cost of holding one back is the whole latency win.
- **`liveMaySpeak()` is asked before every flush**, and the `pendingDelegation`
  half of it is the one that is easy to lose: once the student has asked
  something newer, everything still to come answers a question they have moved
  on from. **Interrupting LATE is stopped by the append budget anyway**, so a
  test that interrupts after the first sentence passes with the guard removed —
  it has to interrupt *before* it.
- **NO ROUTE FALLS BACK ONCE ONE HAS EMITTED** (`aiAskRoutes`), and the
  thinking-level retry inside `askGeminiDirect` stands down for the same
  reason. Otherwise a route that streams two sentences and then drops is
  followed by a backup engine's complete and quite different answer — half of
  one explanation welded to the whole of another, read aloud to a child.
- **A reply asked for as `json` is NEVER streamed.** Half an object parses as
  nothing, and the tolerant parser is the one thing that makes a truncated one
  survivable.
- **`LIVE_STREAM_ON` is a kill switch.** False and the reply is assembled whole
  and spoken in one append exactly as before, with the rest of the file
  behaving identically — which is what makes it safe to flip. Raising
  `LIVE_STREAM_MAX_APPENDS` past 2 is a different matter: watch the live
  model's behaviour on a second commentary append in a real lesson first.

### ② One page, not three, and a smaller picture

`worksheetContextPages({ max, dominant })`. `dominant` is the share of the
visible area the top page must hold before the rest are dropped: below it the
student is straddling a boundary and the question may well be about the half
they can also see. **Called with nothing it is byte-for-byte what it always
was**, which is what the chat, the hints and `visiblePage()` all get.
`LIVE_PAGE_PX` came down from 1300 because bytes scale with the square of it;
`LIVE_PAGE_QUALITY` deliberately did not, because JPEG artefacts on
handwriting are read as strokes.

### ③ The prep runs side by side

The notes, the key and the rasters are one `Promise.all`. Neither branch needs
anything the other produces, so serially the shorter one is pure waiting. Two
orderings are still load-bearing: **the viewport is read FIRST**, before
anything is awaited (the student asked about what was on screen when they
spoke), and **the pages are composited LAST**, so the picture carries whatever
they have typed up to this moment.

### ④ The key and the notes are warmed at session start

`liveWarmContext()`, called before the microphone prompt — granting permission
and exchanging SDP is several seconds the answer key can be transcribed in for
free, instead of the first question of every session wearing that whole pass
with nothing on screen but "Thinking…". **Nothing waits on it and nothing fails
because of it**: both calls cache, and a refusal is swallowed because it will
be met again, and REPORTED properly, by `keyEnsureReady` inside the check that
depends on it. Reporting it here would put an error on screen about a question
nobody has asked yet.

Run **`node --test tools/live-tutor-tests.mjs`** and **`node
tools/tutor-tests.mjs`** after touching any of it.

## Visible answers and quiet Live checks (v1.15.4)

`syncActiveTextEditValue` reads the current contenteditable without committing it,
rebuilding the SVG or changing focus. Call it before image/text capture: an answer
still being typed is otherwise only in the DOM, not `annotations`. Both composite
images and cropped bands use it. `worksheetTypedContext` additionally sends bounded,
exact typed text with page/position and active/selected markers, as untrusted data.

`worksheetContextPages` uses screen-rectangle intersections, orders by visible
area and includes at most three student-visible pages. Do not fall back to hidden
key pages or choose a previous-page sliver by offset coordinates. Live and Ask use
the same context. Keep the answer-key readiness gate and the help ceiling. Called
with `{max, dominant}` it NARROWS that, for the one caller a student sits waiting
on — see ⚡ THE ANSWER ARRIVES SOONER.

`liveShareWorksheetContext` sends initial and changed view summaries through
`session.thinking.append`, with `delegation_id: null` for general context and the
delegation ID for a check. Appends allow 500 tokens: the silent summary carries
only page/count metadata and a 60-codepoint text preview; full typed answers stay
in the delegated check. It does not speak. Progress stays **Thinking…**; only
the teaching result — whole, or streamed sentence by sentence as it is written —
or a useful terminal failure is sent through `session.commentary.append`. Do not
add spoken acknowledgements or check narration.

Run `node --test tools/live-tutor-tests.mjs tools/check-latency-tests.mjs
tools/writing-tests.mjs` and `node tools/tutor-tests.mjs` after changing these paths.

## Check deadlines and teaching method (v1.15.3)

`aiWithDeadline` bounds the entire operation as well as individual provider
attempts. Preserve cancellation checks before fallback and after every Live
preparation step. A late answer must not speak or launch another request.
Firebase 11.10.0 request timeouts are supplied to `getGenerativeModel` through
its third argument. Keep the longer budgets for full-paper marking.

Teaching uses `tutorMethodRule`: arithmetic and the unitary method first,
units and parts only for clearly suitable questions, no algebraic unknowns,
and one step at a time in Live. `keyEnsureReady` must precede hints, marking,
chat and Live. Share `keyReadJob`, reuse saved rows, and do not answer while
an attached key is unreadable. Read the matching key entry and its working
before planning the explanation. Keep the existing help ceiling.

Run `node --test tools/check-latency-tests.mjs tools/live-tutor-tests.mjs`
and `node tools/tutor-tests.mjs` after changes to these paths.

## Writing responsiveness and palm ownership (v1.15.3)

`appendDrawingSamples` records coalesced pen positions with one geometry read
per batch; `scheduleInkPreview` paints only the current annotation once per
frame. Preserve the other SVG nodes. Reacquire the active node if an asynchronous
hint/mark refresh replaced it, flush the final `pointerup` position, and never
append cancellation or capture-loss coordinates. Cancel queued frames when
the gesture or worksheet ends. Keep each completed stroke as one undo entry.

`navBind` sees input before overlay tools. Pen contact must stop existing pan,
pinch and momentum and take ownership before any touch handler changes the page.
`penBlocksTouch` covers pen-down and the 350 ms gap after it; `rejectedTouches`
keeps an already rejected contact out until lift. Contact size may start small
and grow, so check moves too and restore an accidental erase/move snapshot when
a contact becomes a palm. Reset rejected IDs on a fresh down and input state on
blur, hidden document and worksheet replacement. Raw touch undo/redo must obey
the same pen/palm rules. A captured pointer leaving the overlay keeps drawing;
actual lost capture closes the gesture once.

Run `node --test tools/writing-tests.mjs` and `node tools/tutor-tests.mjs`.
The deterministic handler/DOM tests cannot measure pencil-and-hand feel on glass;
retain the hardware check described below and report when it was unavailable.

## App
- `index.html` — **"Study Buddy"**. One self-contained file (markup + CSS + JS) on the shared
  `mathgen--app` Firebase project with Google sign-in. **A student uploads their own worksheet as a
  PDF, writes their answers on it, and works through it with a buddy that HINTS rather than
  answers.** When they are done it MARKS the paper, and every question they did not get right goes
  into a **mistake book** — the question SET OUT AGAIN, its wording typeset and the paper's own
  figures cut out and put back where they belong, so it can be practised one at a time on screen or
  printed as a worksheet (and saved as a PDF from the print dialog). `README.md` is the feature log,
  newest version first — add a section there for anything user-visible.
- Version badge (`APP_VERSION`, shown in the header) is hard-coded — bump it on every change.
- Roles: `isAdmin()` is the one admin email (`chungzhikai@gmail.com`) — the teacher. Everyone else
  is a student, and a student's device runs the hints and the marking itself. Only the admin sees
  the 📚 Teaching notes window and the AI engine dialog, and only the admin ever writes a note.

## 🧭 All the apps under one roof, and 📖 a worksheet sent from the Science portal (v1.24.0)

`APP_KEY` / `POLYMATH_APPS` / `appsIsFramed` / `renderAppsMenu` / `appsMenuOpen` (search
`ALL THE APPS UNDER ONE ROOF`), `OPEN_LINK_ID` / **`openFromLink`** (search `A WORKSHEET NAMED
ON THE URL`), the `source === 'cer'` chip in `renderWorksheets`, and the `.appsMenu` / `.appsPanel`
CSS.

- **`POLYMATH_APPS` is ONE table carried by every Polymath app** — the four subject portals
  (`SUBJECT_APPS` + `POLYMATH_TOOLS` there) and the two tools. Same keys, same relative urls,
  same folder-is-the-repo-name rule (Science is `cer`). Ship a change to all of them; a menu that
  differs between two apps is a menu one of them has let drift.
- **A link followed from inside the Science portal's frame goes to `_top`.** This app is
  embedded there on a page of its own, and a subject link navigating the FRAME would put a
  portal inside a portal.
- **`?ws=<id>` is read ONCE and taken off the address bar** (`history.replaceState`), or a reload
  opens it again over whatever the student moved on to. It is resolved AFTER `loadWorksheets`
  (own copy first, then a set worksheet through `startAssignment`, which is the same door
  “Start it” uses) — resolved before the list is in, every id is “not in your list”.
- **The Science portal writes THIS app's shape** (`tutorWorksheets`, `tutorAssignments`,
  `tutor-worksheets/`, `HINT_DEFAULT`, `GUIDANCE_GRADES` keys, `LEVELS`, `ADMIN_DISPLAY_NAME`) and
  its harness `tools/tutor-bridge-tests.mjs` reads this file to pin every one of those names.
  Rename any of them here and that harness is what says so — nothing here throws; the key pages
  simply show, or the class never gets the sheet.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 📌 The teacher is "Mr Chung", not the name on their Google account (v1.9.1)

`setterName()` (search `WHO SET IT, as a student reads it`).

A worksheet set for a class came back saying **"Set by Zhi Kai Chung"** — the display name off the
admin's Google sign-in. That is a personal detail from an OAuth profile, and it has no business on
a card in front of thirty children. `ADMIN_DISPLAY_NAME` is what the centre calls its teacher, and
`setterName()` is the one door to it.

- **It is a FUNCTION over the stored value, not only a fix at the write.** Every assignment set
  before this carries the full name, so a write-side fix alone would leave the worksheets already
  on thirty screens saying the wrong thing for ever.
- **It can answer without consulting the value at all**, because setting work is the admin's and
  nobody else's — `pushWorksheet` checks `isAdmin` and the box is hidden besides — so every setter
  that has ever been stored IS the one teacher. **Give the centre a second teacher and this is the
  ONE place that has to learn to tell them apart.**
- **Five student-facing surfaces go through it**: the 📌 chip on the class card, the copy's own
  `setBy`, the answer-key line and its 🔑 chip, and the locked-help-level note. A surface reading
  `byName` or `wsMeta.setBy` raw is a surface that shows the Google name on everything already set,
  while the one beside it says Mr Chung.
- **The write is put right too** (`byName: setterName()`), so the stored data stops carrying a
  personal name at all.
- `ownerName` is deliberately left as the account's own display name: that is the student's name on
  their OWN copy, which is a different thing, and nothing displays it.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🔑 THE KEY THAT TRAVELS IS THE ONE ON SCREEN (v1.10.1)

`pushWorksheet`'s live re-read and `keyPagesFromAssignment` (search `THE ANSWER KEY THAT TRAVELS`
and `A KEY MARKED AFTER THE CLASS STARTED`).

Setting a worksheet read its body off `worksheets` — **a list fetched earlier**, whose entries
carry the body as it was then. So a key marked since was not in the object being read, the
assignment went out with `keyPages: []`, and every student in the class could scroll through the
marking scheme.

- **It failed silently and looked like success.** The teacher saw *"Set at…"*; the student's copy
  still wore the 🔑 chip naming whose key it was, above every page of that key. Nothing threw and
  no screen said anything was wrong.
- **`openWorksheet` had already learned this** — *"whatever the list is holding can be old news"* —
  and always opens from the live document. The push never did. **Anything that reads a worksheet's
  BODY from the list is reading history**; go to the document.
- **A pending save is flushed first.** Ticking key pages only SCHEDULES an auto-save, and setting
  the worksheet straight afterwards is the obvious thing to do — so the live document has to be
  made current before it is read, or reading it live changes nothing.
- **An empty list never overrides a summary that names pages.** Between hiding a page that need not
  be hidden and showing the marking scheme, only one of those is a safe way to be wrong.
- **A read that FAILED refuses to set the worksheet.** Setting one whose key we are no longer sure
  of is the outcome worth refusing outright.
- **A key marked AFTER the class started still reaches them** (`keyPagesFromAssignment`). A copy's
  key pages are frozen when it is made, so without this a page marked yesterday stays readable on
  every copy already begun — and those are exactly the students who have the paper open. It is read
  live from the assignment, the same way the locked help level is.
- **That fold-in only ever ADDS a page, never un-hides one.** One stale read putting the marking
  scheme back on screen is the worse fault; a page hidden by mistake is un-ticked on the teacher's
  own copy.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 👤 EVERY STUDENT HAS A LEVEL, AND P3 IS SCIENCE ONLY (v1.9.0, P6 added v1.10.0)

`STUDENT_LEVELS` / `STUDENT_SUBJECTS` / `levelSubjects` / `subjectOkForLevel` / `studentSubject` /
`studentSubjectList` / `studentComplete` / `normStudents` / `activeStudent` / `canSeeWorksheet`
(search `EVERY STUDENT HAS A LEVEL`), plus step 2 of the onboarding gate.

The centre takes **P3 to P6**, and **P3 is SCIENCE ONLY** — there is no P3 maths class. Every
other level takes Maths, Science or both, so **P3 is the only special case in `levelSubjects`** —
adding P6 in v1.10.0 was one entry in `STUDENT_LEVELS` and nothing else, which is what that one
door is for.

- **A student tagged P3 Mathematics is a student whose worksheet list is empty for ever**, with
  nothing on any screen saying why: the filter simply never matches, and an empty list looks exactly
  like somebody who has not uploaded anything yet. That is the whole reason this is a section.
- **`levelSubjects` is the ONE place the rule lives**, because a pair is offered, saved and READ in
  four places here — the onboarding chips, `onboardValid`, `canSeeWorksheet` and the upload dialog.
  A rule enforced in three of them is not a rule.
- **It is asked in the EXISTING gate, as step 2**, never a second dialog: one first sign-in, three
  steps — the names, the levels, the fee. Two modal gates on one sign-in is two things to get past.
- **`ONBOARD_VERSION` was bumped to 2 so the whole roster is asked again.** That is exactly what
  that constant is for: a student who answered under v1 has no level, and letting them through
  would leave the rule true of new students and false of everyone already here.
- **The chips are BUILT from the rule.** At P3 the subject row holds one chip, so there is nothing
  to choose wrongly — the rule being *seen* rather than enforced after the fact.
- **A subject the new level does not offer is DROPPED when the level changes.** Switching from P5
  Mathematics to P3 must not leave Mathematics selected on a row that no longer contains it, and
  saved on the next tap of Next. `onboardClean` re-narrows it anyway, so a P3 student cannot be
  WRITTEN as maths at all.
- **`studentSubject` is how a stored pair is READ.** A P3 student saved as `both` means Science;
  reading it raw is what hands them the maths worksheets the centre does not teach. It can only ever
  NARROW what they see, which is the safe direction for a rule about who sees what.
- **A level from outside the range keeps every subject and stays on the chips.** A Sec 1 row set
  up in Ans Key is not silently re-tagged.
- **`normStudents` is the ONE reader**: students were plain NAMES before v1.9.0 and are
  `{ name, level, subject }` now, and both shapes come out of it the same way. Every screen that
  lists students goes through it, or a row answered under v1 reads as nobody and the teacher's list
  empties itself.
- **ONE ACCOUNT CAN CARRY SEVERAL STUDENTS**, so there is an ACTIVE one, remembered on the device,
  and the header says who it is with a tap to switch. Without it the rule could only ever be
  honoured for the first child on a parent's login, which is not a rule. `activeStudent` CLAMPS the
  stored index — a student taken off the roster leaves it pointing past the end, and a filter
  reading `undefined.level` would show nothing at all.
- **The answer is MIRRORED onto the row's own `level` / `subject`**, which are the fields Ans Key
  and the Scan app read: they hold one answer rather than a list, so the active student is written
  there. Without it a student set up here is levelless everywhere else on the shared roster. And a
  student already set up in Ans Key is **seeded from that row** rather than asked to retype it —
  only on a single-student account, because with two children there is no way to know whose the
  row's one pair is.
- **AN UPLOAD TAKES THE LEVEL OFF THE ACTIVE STUDENT, never a picker.** The level field is hidden
  for a student: a worksheet tagged with a level they are not is one that vanishes from their own
  list the moment it is saved. The subject picker is only drawn for a student who really takes both.
- **A worksheet with NO level is still shown to its owner.** Hiding somebody's own work with no
  explanation is worse than showing it, and every new upload is tagged, so that case dies out.
- **The students are dropped on every account change**, or one account's level decides what the
  next person on the device is shown.
- `polymathlc/anskey` carries the identical rule over the identical collection
  (`tools/profile-tests.mjs` there) — **ship a change to it in both**.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

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

## 🧠 The teacher's corrections reach this app (v1.24.0)

`cerStyle` / `cerStyleDocRef` / `styleBucketKey` / `styleProfilePick` / `_styleCountIn` /
`_styleTokens` / `_styleOverlap` / `_styleTier` / `_styleRetrieve` / `styleExemplarsFor` /
`styleEditsAll` / `styleCorrections` / `styleEditRules` / `styleLessons` / `styleRecentEdits` /
`_styleProfileBits` / `styleCorpusCount` / **`styleBlock(kind, q)`** / `aiGrounding(kind, opts)`,
**`hintRetrievalQuery`** / `HINT_SAME_SPOT` beside `hintLadderFor`, the fair-share pots
`notesTrimTo` / `notesDedupe` / `notesFairShare` / `notesJoinField` / `notesLedger*` (search `THE
WHOLE LOOP IS READ` and `Every note gets a GUARANTEED share`), and the corrections stat in the 📚
window. **`polymathlc/scan` carries the same block byte for byte, and both are a port of
`polymathlc/anskey` — ship a change to all three together.**

Until this the buddy read ONE field of the style document — the flat `profile` mirror — and six
frozen exemplars, and nothing else. So a P3 Maths profile was averaged into every Sec 1 Science
hint, a correction the teacher made in Ans Key on Monday reached Ans Key and NO other app, and the
Science portal's corrections reached nothing here at all. Every one of those was silent: the hint
still came back, it simply went on making the mistake the teacher had already corrected.

- **DOCUMENT A IS READ WHOLE, AND DOCUMENT C BESIDE IT.** A is Ans Key's
  `users/{adminUid}/aiTraining/answerStyle` — the corpus (`samples`), the corrections (`edits`,
  each with the lesson it taught), one profile per level×subject bucket (`profiles`) and the flat
  mirror. C is the Science portal's `users/{adminUid}/settings/answerStyle`, which holds only that
  app's corrections. A second `onSnapshot` sits beside the first in `loadTeachingNotes`, comes
  down in `_notesDetach` / `stopTeachingNotes` on every account change (the same three rules the
  notebook listener carries), and a denied read is a `console.warn` and nothing more — the block
  carries fewer corrections, exactly as it did before the listener existed. A student's device
  reads both through the same `config/admin` pointer the notebook uses.
- **`styleProfilePick(lvl, sub)` IS THE ONE PLACE THE BUCKET IS CHOSEN**, and the chain is the
  family's: `lvl:sub` when that bucket has `STYLE_BUCKET_MIN` (30) answers behind it, then
  `any:sub`, then `_global` (or the flat `profile`). The count is taken off `samples` when the
  corpus travelled, and off the bucket profile's own `n` when it did not. The level and subject
  are the WORKSHEET's (`wsMeta.level` / `wsMeta.subject`), so another worksheet is never served a
  bucket that is not its own, and an unlevelled worksheet is the global one.
- **THE EXEMPLARS AND THE RAW CORRECTIONS ARE RETRIEVED FOR THE QUESTION** (`opts.q`, token
  Jaccard over `q`), tier by tier — this bucket, then the same subject at any level, then
  everything — so a strong Maths match never displaces a weaker one from this worksheet's own
  bucket. Omitting `q` is the old behaviour byte for byte: the profile's own six and the NEWEST
  corrections.
  - **The chat passes the student's own message.** It IS the question.
  - **A hint passes `hintRetrievalQuery(p, pt)`**, and the choice is deliberate. A hint is asked
    about a spot on a PICTURE: the question's wording is not known until the model has read the
    page, and the answer key (`keyContext`) holds numbers, answers and working — never the
    question — so it cannot supply one. The best text in hand is an EARLIER hint within
    `HINT_SAME_SPOT` of this tap on this page (a student who raises the help level and taps the
    same question again is the common re-ask, and that hint already carries the wording the model
    transcribed). Failing that the level/subject line goes, which resembles nothing and so hands
    back the profile's own exemplars and the NEWEST corrections — the old behaviour, and the right
    fallback, because a correction the teacher made a minute ago is the one they are watching for.
  - **The two marking sites pass nothing**: `'mark'` retrieves nothing.
- **`styleEditsAll()` IS THE UNION**: A's edits (src defaults `'anskey'`) and C's (keyed
  `'cer:' + slot`, src `'cer'`), sorted by time so "the newest" is the newest whichever document
  holds it. They reach a prompt three ways — the profile's distilled `fixes` (up to 6), the
  lessons (up to 8, deduped by exact lowercase text, this bucket first and newest first inside
  each tier) and up to 3 raw before/after pairs, which go LAST, nearest the question.
- **NO EARLY RETURN ON A NULL PROFILE.** The exemplars, the lessons and the pairs come out of the
  corpus and are current the moment the teacher saves; only the distilled description waits for a
  rebuild. `if (!p) return ''` is what made a teacher's very first correction reach nothing.
- **WHAT EACH KIND GETS.** `'mark'` gets the profile's `styleRules`, `phrasing` and `keywords`
  and nothing else — never an exemplar, a fix, a lesson or a pair, because every one of those is
  an ANSWER and a marker handed the answer stops marking against the paper. `'hint'`, `'teach'`
  and `'answer'` get all of it. **NO KIND GETS THE PROFILE'S `markingStandards` ANY MORE.** That
  field is INFERRED by a model from the teacher's own answers, and an inference must never decide
  a mark: the standard a student is held to is the typed notes and the guidance (`notesBlock`'s
  `markingStandards` still reaches `'mark'` exactly as it did). The help ceiling is untouched: the
  corrections are wording, never rungs, and `keyRuleBlock` still restates it after the grounding.
- **THE HEADING SAYS WHICH BUCKET AND HOW MANY CORRECTIONS** — *learned from 30 of their own P5
  Science answers, following 4 corrections* — and `groundingSummary()` says *the teacher's learned
  style (P5 Science)* and *N corrections* on the hints tab, because a hint grounded on the global
  fallback looks exactly like one grounded on this worksheet's own bucket.
- **THE NOTE BUDGETS ARE POTS, NEVER A LENGTH TO CUT TO.** `notesJoinField` used to be a
  `.slice()` over the JOINED text of every relevant note, so with two standing instructions of
  1,600 characters the first lost most of itself and the second reached no prompt at all.
  `notesFairShare` water-fills: every note takes its floor (`NOTES_GUIDE_MIN_EACH` /
  `NOTES_FIELD_MIN_EACH`), the remainder is handed round, a short note is never trimmed, a long
  one is trimmed on a word and SAYS so (`NOTES_TRIM_MARK`), the pot grows to `n × minEach` when
  it cannot floor everybody, and `NOTES_HARD_CHARS` is the only path on which a note is lost.
  The same rule typed in two apps is ONE rule (`notesDedupe`). The per-app caps stayed as the
  pots. `notesLedger` records what was trimmed or dropped on every `aiGrounding` call.
- **This app still WRITES nothing to either document.** Nothing a child writes here is an answer
  the teacher wrote.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

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
**The SHAPES are, and for a long time only the shapes were** — the input
pipeline was this app's own until v1.12.0, and that is the half a child
feels. See **✍️ WRITING ON THE PAGE WITH A STYLUS** below for the pipeline;
this section is the data.

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
- **There is deliberately no API-key box in this app**, and that has not changed now
  that ChatGPT and Kimi answer here: both are reached through their **server-keyed**
  Cloud Functions, so no key ever reaches the page. A key field in an app students
  sign into on shared iPads is a key waiting to be typed on the wrong device — see
  **⚙️ THREE ENGINES** above.
- **`window.askGemini` KEEPS ITS NAME AND ITS SHAPE**, and that is why this
  was one change rather than fifteen. It is the ONE door every call site
  already goes through — the hint ladder, the marking run, the chat, the
  mistake reader, the practice check — so all of them gained the backup at
  once and not one of them had to be told. `aiAskWith` is the failover loop
  and `_aiRun` the dispatcher; **a route past them is a call that still dies
  on the cap with nothing on screen saying why**, so `askGeminiDirect` is
  reached from exactly one place and the harness counts it.
- **THERE IS NO KEY BOX HERE, AND THERE NEVER WILL BE.** This app is opened by
  children on shared iPads, so the backups are **server-keyed only**: the keys
  are Firebase secrets behind the `askOpenAi` / `askKimi` Cloud Functions in
  `polymathlc/math/functions`, and a browser never sees one. That is also what
  makes them work on a student's phone with nothing set up on it — the half of
  the school that matters. Ans Key keeps the pasted-key fallback; this app
  deliberately does not.
- **IT NEEDS ONE DEPLOY** — `firebase functions:secrets:set OPENAI_API_KEY`
  (and `MOONSHOT_API_KEY`) and a functions deploy. Until then the call returns
  `failed-precondition` and the engine panel says **in those words** that the
  secret is not set, rather than reporting it as an AI error the teacher would
  go looking for in the wrong place.
- **A REFUSED ROUTE GOES TO THE BACK AND NEVER OFF THE LIST.** A cap is lifted
  eventually and a network does come back; an app that refuses on a stale note
  is worse than one that spends a call finding out. The mark expires by itself
  after `AI_DOWN_MS` and a success clears it. `sort` is stable, so the
  preference order survives underneath the down-marking.
- **NO TEMPERATURE AND NO MODEL ARE SENT TO A SERVER ROUTE.** A reasoning
  model runs only at its own default temperature and one sent is a **400** —
  not a worse answer, no answer at all — and the server chooses the model
  anyway. `thinkingLevel` is deliberately not translated either. And **nothing
  names a model to Kimi**: Moonshot renames its flagship every release, this
  app has no box to correct a stale id in, and the function falls back to its
  own current one when the client names none.
- **WHEN NOTHING ANSWERS, EVERY ROUTE IS NAMED.** The first error is kept as
  `cause`, but the message lists them all — reporting one hides the rest, and
  *"Gemini: your billing account has exceeded its monthly spending cap"* sends
  the teacher to the Google console when the job is to deploy a function.
- **The callable rides the COMPAT app**, because that is the app holding the
  signed-in user; the modular app beside it carries App Check but no session,
  and the function refuses a caller it cannot name. A blocked
  `firebase-functions-compat.js` leaves the route unavailable rather than
  throwing on load — a backup degrading quietly is the whole point of it.

### …and the switch is the CENTRE'S, not this device's

- **It is a field on `config/admin`** — the Learning Portal's own admin
  pointer, which this app **already reads** to learn whose teaching notes to
  apply, and which only the admin can write. So it needs **no rules change and
  no deploy**, and it is the very SAME field the Portal's and Scan & Answer's
  toggles write: **one switch moves them all**.
- **A device-local choice is the bug wearing a feature's clothes** — the
  teacher switches engine on their own laptop, watches it work, and every
  student stays on the capped one, with the screen on the machine they set it
  on looking exactly as it should.
- **It is a LIVE listener**, so a phone with the app open follows within
  seconds, and it **comes down on every account change** — one account's
  setting governing the next person to sign in on a shared iPad is the same
  fault the teaching-notes listener already guards against.
- **The write is a MERGE, always.** That document is the bank pointer as well,
  and a plain set would take `uid` off it — which is how every student in the
  Learning Portal loses the question bank. Only the admin may write it, and
  **that is checked in `aiEngineSetShared` rather than only on the picker**:
  hiding a control is never the lock.
- **An unset field means Gemini**, the default this app already had, so a
  centre that never touches it is unaffected — and a read that is DENIED
  changes nothing at all.
- **A write that FAILED is reported.** A teacher told nothing would believe the
  whole centre had moved.
- **`aiVendorName()` reads `window.aiEngines()`**, the one door, rather than
  assembling the engine state a second time — that second reading is exactly
  how the badge comes to say *Gemini* while ChatGPT is answering. The
  student's side is still **Chung GPT**, from a literal, and always will be.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

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

## 📌 WHETHER THE CLASS HAS IT, SAID ON THE CARD (v1.29.0)

**`worksheetSetState`** / `worksheetSetChip` / `worksheetSetBlocker` (beside
`assignmentUntaggedNote`), **`setAllWorksheets`** / `blockedList` (just above
`unpushWorksheet`), `unsetWorksheetCount` / `syncSetAllBtn` (just above
`wsCardNode`), `pushWorksheet`'s `opts.quiet` and its RETURNED outcome, the
`setSkip` on `uploadOne`'s answer and the `notSet` list in `handleUpload`,
plus `#setAllBtn` and the `.chip.chipSetOut` / `.chip.chipSetNone` CSS.

A teacher uploaded a term's worth of P5 papers and **not one of them reached a
student**, because the upload's auto-set had quietly skipped them and nothing
anywhere said so. The only signal a paper had reached the class was whether its
button read *"📌 Set for my students"* or *"📌 Set — take it off"* — two words
apart, on a shelf of thirty cards, and read as decoration rather than as state.
So a paper nobody was ever given looked EXACTLY like one every student has.

- **`worksheetSetState(w)` IS THE ONE PLACE IT IS DECIDED**, and it is read
  LIVE off the assignment list the way the locked help level already is
  (`guidanceRule`). `w.pushed` is a flag on the teacher's OWN copy and it is
  written SECOND — `unpushWorksheet` clears the assignment first — so a refused
  second write leaves a paper whose flag says set when it is not.
  **`assignmentsLoaded` is what tells "not arrived yet" from "taken off the
  list"**, which want opposite answers: until the list is in, the copy's own
  flag stands. Four answers, and the two in the middle are the ones worth
  having: `''` (not the teacher's to set), `'off'`, **`'nobody'`** (SET, and
  with no level or subject, so on NO shelf) and `'set'`.
- **`'nobody'` IS NOT A SUCCESS.** The write landed and no child can see it,
  and those are not the same thing — `pushWorksheet` returns it as a refusal
  for exactly that reason.
- **THE CHIP IS THE TEACHER'S ALONE.** A student's shelf holds the papers they
  were given, so the ones they were NOT given are exactly the ones that are not
  there to be marked; the word carries it and the colour only reinforces it,
  the rule the marking's own verdicts follow.
- **IT IS NOT `.chipSet`, AND IT IS DECLARED AT TWO CLASSES.** `.chipSet`
  already means *"📌 Set by Mr Chung"* on a student's copy and is written
  `.chip.chipSet`, so a class-state chip borrowing that name — or written at
  one class — LOSES to it and comes out in the setter's blue on a card that
  otherwise looks perfectly right. Same trap as `.shelfHead .shelfBtn`, one
  rule further down the same stylesheet.
- **📌 SET THEM ALL, and four rules keep it honest.** It only ever sets what is
  NOT set (`worksheetSetState`, so a paper already on a shelf keeps the help
  level, the lock and the key it went out with); **ONE AT A TIME, NEVER IN
  PARALLEL** — `pushWorksheet` reads and writes the module's own globals and
  calls `performSave`, so two in flight interleave exactly as two uploads do,
  and a `Promise.all` in that loop is the one change that must never be made;
  it ASKS first, naming the count; and **every paper it could not set is NAMED
  with the reason** (`blockedList`, one wording shared with the batch upload's
  summary). A refused write says so and carries `assignRulesHint()`.
- **`opts.quiet` MUST NEVER MEAN A FAILURE NOBODY HEARS ABOUT.** It suppresses
  the per-paper toast so ten papers are one sentence, and every exit hands the
  outcome BACK instead; the caller is what names it.
- **A PUSH THAT FAILED IS NEVER COUNTED AS ONE THAT WENT OUT.** `uploadOne` set
  `pushed = true` the moment `pushWorksheet` had been CALLED, so a refused
  write was reported as a paper the class had been given and a batch of ten
  said *"9 set for the class"* over nine papers no child could see.
- **AND A SKIP IS NAMED IN A BATCH TOO.** The "could not be set" explanation
  was `solo`-only, so in a pile of ten it was completely silent and the count
  was the only clue anything had been left behind — which is the rule
  📚 UPLOADING is built on, broken in its own section.
- **`syncSetAllBtn` is painted from `renderWorksheets`**, the one function every
  path that changes the list already goes through — the reasoning `syncSizeCtl`
  carries. It SAYS how many are waiting, so the teacher never presses it to
  find out whether it had anything to do.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 📚 A WHOLE PILE OF PDFs AT ONCE (v1.28.0)

`UPLOAD_MAX_FILES` / `isPdfFile` / `pdfBaseName` / **`uploadName`** /
**`uploadSettings`** / **`uploadOne`** / **`handleUpload`** (in `index.html`,
search `📚 UPLOADING — ONE PAPER, OR A WHOLE PILE OF THEM`), plus `multiple` on
`#fileInput`, its `change` handler, and the three lines of dialog copy that say
what choosing several changes.

A teacher does not have one worksheet, they have a term's worth, and the picker
took exactly one. Now it takes as many as they like.

- **`handleUpload(files)` IS THE ONE DOOR and it takes a LIST.** Every route
  hands its files here — the picker, and anything added later. A route with a
  pipeline of its own is a route that drifts, and the drift reads as "it works
  when I drop them and not when I pick them".
- **THE PAPERS GO UP ONE AT A TIME, NEVER IN PARALLEL, and everything else here
  rests on that.** The whole pipeline is module globals — `pdfBytes`, `pdfDoc`,
  `pages`, `wsMeta`, `currentDocId`, `annotations`, `wsKey` — so two in flight
  interleave and each corrupts the other: paper 3's key pages hidden on paper 7,
  paper 5's bytes inside paper 2's Storage object. **And the upload still
  reports success**, which is what makes it the worst failure here. `Promise.all`
  in that loop is the one change that must never be made.
- **THE DIALOG IS READ ONCE, BEFORE THE LOOP** (`uploadSettings`), and shut in
  the same breath — both before the first `await`. Its fields are cleared the
  next time it opens and the loop has dozens of awaits in it, so a setting read
  per file hands paper 2 a blank level, on two worksheets that look perfectly
  right on the shelf.
- **A NAME BELONGS TO ONE PAPER, and `uploadName` is the ONE place that is
  decided.** With several files each takes its own file name and the read at
  upload may improve it; ten worksheets sharing one typed name is a shelf nobody
  can search. **`typed` comes back from the same call as `name`** because it is
  what tells `paperApplyRead` whether it may replace the name — computed
  separately, the two disagree and either a typed name is silently overwritten
  or a file name is left on a paper the read could have named properly.
- **THE ATTACHED KEY BELONGS TO ONE PAPER TOO**, so in a batch it goes on the
  FIRST and the summary names which paper got it. One marking scheme spread over
  ten papers keys nine of them wrongly, and every one of those nine looks
  finished.
- **A FAILURE NEVER SINKS THE BATCH, AND IT IS NAMED.** Each paper is caught on
  its own and the ones after it still go up; "upload failed" over a pile of ten
  leaves the teacher with no idea which one to do again. A file that is not a
  PDF is skipped and named rather than stopping the upload, and past
  `UPLOAD_MAX_FILES` the rest are COUNTED and left, never dropped in silence.
- **EVERY PAPER IS OPENED, batch or not** (`showView('ws')` outside the `solo`
  branch). `paperReadEnds` rasterises the pages and `loadPdf` fits them to a
  width a hidden view reports as nothing — so the flicker through the pile is
  the price of the read working at all.
- **A SINGLE UPLOAD IS BYTE-FOR-BYTE WHAT IT ALWAYS WAS**: it opens the buddy,
  says *Ready*, names what the read filled in, and explains a paper that could
  not be set for the class. `if (solo) return;` is what keeps the batch summary
  off it. **A BATCH ENDS ON THE SHELF** with everything it just filed on it,
  because the teacher was filing rather than starting work.
- **PROGRESS IS VISIBLE** (`s.step`). Ten papers behind one toast at the start
  is an app that looks hung.
- Run **`node tools/upload-batch-tests.mjs`** after touching any of it. It
  replaces `uploadOne` with a recorder and runs the REAL door, so what it pins
  is the door's own rules — including a concurrency counter that goes red the
  moment two papers are in flight at once.

## 📖 THE PAPER, READ AT UPLOAD — subject, level, name and key pages off its first and last pages (v1.22.0)

`PAPER_READ_HEAD` / `PAPER_READ_TAIL` / `KEY_WALK_MAX` / `PAPER_READ_PX` /
`PAPER_READ_TITLE_MAX` / `PAPER_READ_SYS` / `paperReadWindow` / `paperReadSubject` /
`paperReadLevel` / **`paperReadClean`** / **`paperReadEnds`** / **`paperApplyRead`** /
**`keyEyeOn`** / `keyScanByEye` / **`keyWalkBack`** / `keyScanPdf(read)` /
`keyAutoScan(defer, read)` (all inside the 🔑 THE ANSWER KEY section — search `THE PAPER, READ AT
UPLOAD`), the `read` / `got` half of `handleUpload`, the ✨ *Let Chung GPT read it off the paper*
rows on `#upLevel` and `#upSubject`, and the 🔑 hint in the upload dialog.

A worksheet arrives as a PDF and nothing about it is known until somebody says: the upload dialog
asked for the level, the subject and the name, and got most of them blank or wrong — *Not sure*,
the first subject on the list, the file's own name. The key scan then read the PDF's text layer,
which a scanned paper does not have, so a marking scheme at the back of a photographed paper was
served to the student as ordinary pages. The paper already prints all four things on its cover and
its last pages, so **those pages are shown to the model ONCE, as pictures**, and it is asked what
the paper IS.

- **IT FILLS BLANKS AND OVERRIDES NOTHING, and `paperApplyRead` is the ONE place that is
  decided.** A student's level comes off THEIR OWN ROW (see EVERY STUDENT HAS A LEVEL) and is
  handed in with `levelFree: false`, so a paper that says "Primary 6" cannot re-tag a P5 child's
  worksheet — which would take it off their own list the moment it was saved, with nothing on any
  screen to say why. A subject is filled only from the list the student takes (`subjects`), and a
  two-subject student whose paper names neither gets the FIRST of their own, never one they do not
  take. A name the uploader TYPED is kept; only a file name is replaced by what the paper calls
  itself. Everything filled is named back in a toast, because a worksheet quietly re-titled and
  re-filed is one nobody can find.
- **THE READ IS ADDED TO THE SCAN, NEVER SUBSTITUTED FOR IT.** `keyScanPdf(read)` still runs the
  text pass, still refuses to hide an inked page and still refuses to hide every page — the two
  guards the 🔑 section has always carried — and UNIONS the read's key pages with what the text
  found. The whole-paper eye pass stands down only when the read already saw every page
  (`readSawAll`), which on a paper of seven pages or fewer it did: the same question asked twice is
  a second bill for the same answer.
- **THE KEY IS WALKED BACKWARDS, ONE PAGE AT A TIME** (`keyWalkBack`, v1.23.0 — it was
  `keyExtendTail`, four pages a call, until then). A marking scheme is often longer than the last
  four pages, and a read that stops at the window's edge hides pages 11–12 and serves page 10 of
  the same key. So from just below the HIGHEST key page already known in the tail (the last page
  when none is) each page is shown to `keyEyeOn` **on its own**, added while it is a key, and
  **THE FIRST PAGE CONFIRMED NOT TO BE A KEY ENDS THE WALK**. `KEY_WALK_MAX` bounds the calls;
  the never-every-page guard in `keyScanPdf` is what stops a paper that is all key being hidden
  whole. `keyEyeOn` is `keyScanByEye`'s body lifted out to take a page list, so the whole-paper
  look and the walk are one eye and the `KEY_EYE_SYS` exemption is still used by a real call.
  - **ONE PAGE PER CALL, deliberately.** Four pages in one call let the model answer the batch
    rather than each page — a key that ended on page 10 came back with 9 and 8 tagged along as
    "the same section", and a page asked beside three keys is a page it can be talked into. Asked
    alone the question is simply *is THIS page a key*, and the one it says no to is the edge.
  - **IT STARTS FROM THE TOP OF THE KNOWN PAGES, NOT THE BOTTOM.** A page the text scan already
    called a key is stepped over rather than asked again — but the walk begins just below the
    highest known page, so a page the text scan MISSED between two it found is still asked instead
    of being left showing below them. Started from the lowest known page, that gap could never be
    reached.
- **A KEY PAGE THE MODEL NEVER SAW IS NOT A KEY PAGE.** `paperReadClean` keeps only page numbers
  that were in the window, deduped and sorted; the model is told the numbers as LABELLED beside
  each picture, so a paper of twelve pages is asked about 9–12, not "the third picture".
- **IT ERRS TOWARDS LEAVING A PAGE ALONE**, the rule the whole 🔑 section carries, and the prompt
  says so twice: leave a doubtful page out, and handwriting is the student's work, not the key.
- **THE LEVEL IS READ OFF THE PAPER'S OWN HEADING, never guessed from difficulty.** The prompt
  says that in as many words, and `paperReadLevel` accepts only the ladder (`LEVELS`) after folding
  "Primary 5" / "Pri 5" / "Sec 1" — "Grade 5", "5" and "hard" come back empty, and an empty level
  leaves the field blank rather than filing the worksheet somewhere.
- **IT IS ONE CALL, SMALL, WITH A DEADLINE, and it runs AFTER the worksheet is on screen.** Seven
  pages at `PAPER_READ_PX`, `timeoutMs` 45 s, and a failure is caught and read as "nothing learned":
  an upload with the AI off, or a read that times out, is byte-for-byte the upload it always was.
  It sits between the "Ready" toast and `keyAutoScan(true, read)`, which still runs before
  `ensureCover` — the read's key pages must be put away before the cover is drawn, or a marking
  scheme on the last page is still an ordinary page when the front page is chosen.
- **IT IS UNGROUNDED BY DESIGN and exempt from the census by name** (`PAPER_READ_SYS`). It reads
  what a paper IS — metadata — and says no science to anybody; grounded, it would file every paper
  under whatever the teaching notes happen to be about.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 👤 THE ROSTER IS SETTLED BEFORE A SINGLE ROW IS FILTERED (v1.25.2)

`ROSTER_WAIT_MS` / **`rosterReset`** / **`rosterSettled`** / **`rosterReady`** (beside
`activeStudent` — search `THE ROSTER IS SETTLED`), the `await rosterReady()` at the top of
`loadWorksheets`, the `rosterSettled()` in `adoptStudents` and `onboardSave`, the
`.then(rosterSettled, rosterSettled)` on the sign-in's `onboardRequire`, and the closed
`!st || !st.level` branch of `canSeeAssignment`.

A P5 account was shown every P6 and P4 paper the teacher had set, on a home screen that looked
perfectly ordinary. Nothing about the level rules was wrong; **the list was filtered before anybody
knew who was looking at it.**

- **THE SIGN-IN FIRED THE LIST AND THE ROSTER SIDE BY SIDE.** `loadWorksheets()` and
  `onboardRequire()` were started in the same breath with `myStudents` freshly emptied, so
  `activeStudent()` was null and both filters took their "not answered yet — the gate has them
  anyway" escape and let EVERYTHING through. That escape is honest only while the gate is up. An
  account that has ALREADY answered never sees the gate: `onboardRequire` reads the profile, calls
  `adoptStudents`, and `adoptStudents` repainted the HEADER and nothing else — so the list stayed
  as it was first painted, and the next reload raced the same way.
- **`onboardSave` HAD ALREADY LEARNED THIS AND THE OTHER PATH HAD NOT.** It ends with a
  `loadWorksheets()` under a comment saying the list *"was filtered against no student at all"* —
  which is exactly why a newly onboarded account looked right and every existing one did not. A
  fix on one of two paths is the shape of bug to look for here.
- **SO THE ROSTER IS A PROMISE, AND THE LIST IS NEVER PAINTED WITHOUT IT.** `rosterReady()`
  resolves the moment `myStudents` is settled for this account; `loadWorksheets` awaits it BEFORE
  it reads or filters a row. Waiting rather than repainting is the point — a list filtered first
  and corrected afterwards is a flash of another class's papers, and whether anybody sees that
  flash is a matter of how fast the profile read is.
- **IT IS SETTLED FROM EVERY PATH, AND FROM A `finally`.** The profile read, the gate being
  answered (`onboardSave`, BEFORE it asks for the list again), a read that failed, **the teacher —
  who returns from `onboardRequire` immediately and adopts nobody** — and signing out. A waiter
  holding a promise nothing will ever resolve is a home screen that stays empty for ever, which is
  the trap this app documents wherever it awaits anything. `rosterSettled` is idempotent so every
  path may call it and the `finally` may call it again, and `ROSTER_WAIT_MS` bounds the wait so a
  path nobody thought of cannot hang the screen.
- **AN UNKNOWN STUDENT IS SHOWN NO SET WORKSHEET AT ALL**, and that is the belt to the promise's
  brace. A set worksheet belongs to a CLASS, so "we do not know who this is" must never mean "show
  every class's paper". **`canSeeWorksheet` stays permissive on purpose and the asymmetry is the
  design**: a student's own uploads are their own work, and hiding those with no explanation is the
  worse fault, while a set worksheet briefly missing is one reload away and another class's paper
  on a child's shelf is something nothing on the screen would ever explain.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 📚 WOODEN SHELVES, EVERY PAPER ON ONE, and a posted PDF files itself (v1.25.0)

`canSeeAssignment` / `assignmentUntaggedNote` (beside `canSeeWorksheet` — search `THE SET LIST GOES
THROUGH A RULE OF ITS OWN`), **`shelfEntries`** (just above `/* ---- The worksheet list ---- */`, so
`SRC_COVER` in the harness loads it), **`setCardNode`** (the set card factored out of
`renderAssignments`), the `topic` / `school` on the record `pushWorksheet` writes, the `upPush`
default in `openUploadModal` and the `got.level && got.subject` gate in `handleUpload`, plus the
`.shelf` / `.shelfHead` / `.shelfPlank` wood and the `.wsCard.booklet` / `.chipNew` CSS.

- **A SET WORKSHEET HAS A RULE OF ITS OWN, AND IT IS STRICT.** `canSeeWorksheet` lets a student's OWN
  untagged upload through (hiding somebody's own work with no explanation is worse than showing it).
  `canSeeAssignment` does not: a set worksheet is the teacher's, meant for a class, and one with no
  level or no subject is on NOBODY's shelf — it used to be on every shelf in the school, which is the
  fault the shelves exist to stop. `assignmentsForMe` and `startAssignment`'s handler both ask it;
  the TEACHER's card says in words which tag is missing (`assignmentUntaggedNote`), because to a
  student the paper simply is not there and only the teacher can put it right. Do not merge the two
  predicates: they are different on purpose.
- **`shelfEntries(own, sets)` IS THE ONE PLACE A STUDENT'S OWN PAPERS AND THE SET ONES BECOME ONE
  SHELF LIST**, and it is pure. A set worksheet counts as started when an own worksheet is its copy
  (`assignmentId`) or IS it (the teacher's own upload carries the assignment's id), so the same paper
  is never on a shelf twice; a set entry wears `level` / `subject` / `topic` / `school` / `pageCount`
  and is stamped by its set date, so `shelfGroups` files it exactly as it files an opened paper. It
  FILTERS NOTHING — `sets` arrives narrowed by `assignmentsForMe`. `shelfNode` draws an entry with
  `set` through `setCardNode` and everything else through `wsCardNode`, and adds `booklet` to both.
- **THE "📌 SET FOR THE CLASS" SECTION IS THE TEACHER'S ALONE.** A student's set papers stand on their
  shelves, opened or not, so a second list of the same papers above the shelves is the same paper
  twice. `renderAssignments` paints an empty list for anyone but the admin; the teacher's list is
  every active assignment at every level, which is where one is taken off.
- **THE WOOD IS DRAWN, NEVER DOWNLOADED.** Layered gradients on `.shelf` and `.shelfPlank`, the timber's
  colours in `--wood*` custom properties on the shelf so the board, the plank and the uprights are one
  piece of wood. A picture of grain is one more request on a school wifi that blocks half of them, and
  a broken-image tile behind every shelf is worse than a plain one. The booklet is the SAME `.wsCard`
  wearing a class: the spine and staples are `::before`, the fold shadow `::after`, the fanned sheets
  a stacked `box-shadow` — no new node, no new handler, so the booklet changes how a paper LOOKS and
  never what it does. `.wsCard.booklet.setCard` has the class's blue spine.
- **`.shelfHead .shelfBtn`, NOT `.shelfBtn`, in the phone media query.** The generic `.iconBtn` rule is
  declared later in the sheet and sets `display`, so a single-class `display: none` loses to it and the
  ‹ › buttons the row was meant to lose on a phone stay — which is how v1.23.0 shipped.
- **A POSTED PDF FILES ITSELF.** `upPush` is ticked by default for the admin; `handleUpload` sets the
  worksheet AFTER the paper read and the key scan (so the level, the subject and the hidden key pages
  travel with it) and ONLY when `got.level && got.subject` are both known. A paper set for no level is
  on nobody's shelf and looks, to the teacher, exactly like one that went out — so it is uploaded, not
  set, and the toast names what could not be read. `pushWorksheet` writes `topic` and `school` onto
  the record, and its toast names the shelf the paper landed on.
- Run **`node tools/tutor-tests.mjs`** after touching any of it **and look at the home screen** — the
  wood and the booklets are the one thing reading the source cannot check.

## 🏫 THE SCHOOL IS IN THE NAME, and 📚 THE WORKSHEETS ARE ON A BOOKSHELF (v1.23.0)

`PAPER_READ_SCHOOL_MAX` / `PAPER_READ_TOPIC_MAX` / the `school` / `exam` / `topic` fields of
`PAPER_READ_SYS` and `paperReadClean` / **`paperReadName`** / the `school` / `topic` / `exam` on
`paperApplyRead`'s answer, the two fields on `wsMeta` (written by `performSave`, read back by
`openWorksheet`, set by `handleUpload`), and the shelf — `SHELF_LEVEL_ORDER` /
`SHELF_SUBJECT_ORDER` / `SHELF_WHEEL_TURN` / `SHELF_WHEEL_DEPTH` / `SHELF_WHEEL_SHRINK` /
`SHELF_WHEEL_MAX` / `shelfLevelRank` / `shelfSubjectRank` / `shelfStamp` / `shelfCompare` /
**`shelfGroups`** / `shelfTitle` / **`shelfWheelPose`** / `shelfWheelCss` / `shelfWheelApply` /
`shelfWheelWatch` / `shelfNudge` / **`shelfNode`** / `wsCardNode` (all just above
`/* ---- The worksheet list ---- */`, so `SRC_COVER` in the harness loads them), plus the
`.shelf*` / `.chipTopic` / `.chipSchool` CSS.

### 🏫 The school's name is read off the cover and put in the file name

An exam paper prints the school that set it across the top of its first page, and *"P5 Science
SA2 2024"* is a name that fits eleven papers on one shelf. The read (v1.22.0) now asks for the
**school** as printed, whether the paper is an **exam** (a cover sheet, marks, a time allowed —
not a topical worksheet), and for a topical worksheet the ONE **topic** it drills.

- **`paperReadName` IS THE ONE PLACE THE NAME IS PUT TOGETHER**, and it puts the school in ONLY
  on an exam paper: a school worksheet on fractions is a fractions worksheet, and prefixing every
  one of them with the school's name is what makes a shelf of thirty unreadable. A title that
  already names the school is left alone — *"Nan Hua Primary School — Nan Hua P5 SA2"* is the
  name read twice — and a paper the model could not title at all becomes *"<school> exam paper"*
  rather than the file's own name.
- **IT FILLS THE NAME ONLY WHEN NOBODY TYPED ONE**, exactly as v1.22.0's title did: a name the
  uploader wrote is theirs, and only a bare file name is replaced.
- **`school` and `topic` are FIELDS on the worksheet, never parsed back out of the name.** The
  shelf sorts on the topic and the card wears both as chips, and a topic that had to be cut out of
  a title would be wrong the first time a title did not follow the pattern. They are written on
  every save and read back on every open, so a worksheet uploaded before this simply has neither
  and sorts to the end of its shelf.
- **THE MODEL IS TOLD NEVER TO GUESS THE SCHOOL.** A name not printed on the paper is `""`; a
  school invented from the paper's style is a wrong name on a file for good.

### 📚 The bookshelf — level, then subject, then a wheel of topics

The list of worksheets was one grid, newest first. It is a **bookshelf** now: one shelf per
level-and-subject (P3 · Science, P5 · Science, P5 · Maths, …), levels in the ladder's order and
subjects in the app's, and on each shelf the papers stand in a **row that scrolls sideways like
a wheel** — the card in the middle faces you, the ones either side turn away, sink back and
shrink — sorted by **topic** (alphabetically, untopiced papers last) and then newest first.

- **`shelfGroups` IS THE ONE PLACE THE SHELVES ARE DECIDED**, and it is pure: a list in, ordered
  groups out. A worksheet with a level or subject the app does not know is shelved AFTER the known
  ones rather than dropped — a Sec 1 paper set up in Ans Key is still somebody's paper — and a
  worksheet with neither goes on one last *Any level · Any subject* shelf. **Nothing is ever
  filtered out here.** A shelf that lost a paper would look exactly like a shelf that never had
  it, which is the fault the whole list exists to prevent.
- **`shelfStamp` reads a Firestore stamp, a `Date`, a number or nothing**, the same way
  `stampOf` does for the backup: a worksheet whose date will not parse sorts as oldest rather
  than throwing the render.
- **`shelfWheelPose` IS PURE, and that is what makes the wheel testable.** It takes a card's
  distance from the row's centre in viewport widths and gives back the turn, the sink, the shrink
  and the fade, clamped at `SHELF_WHEEL_MAX` so a card ten screens away is posed exactly like one
  a screen away; `shelfWheelCss` turns that into one `transform`. With `motion === false` — or
  junk in — it is the identity, which is how `prefers-reduced-motion` gets a flat row through
  `liveOrbMotionOk()`, the ONE motion preference this app already keeps.
- **THE POSE IS PAINTED ON SCROLL, NEVER ON A TIMER.** `shelfWheelWatch` listens to the row's
  own `scroll` (passive) and to `resize`, and coalesces into one `requestAnimationFrame` — a row
  of thirty cards re-posed on every scroll event is a list that stutters on an iPad, and a timer
  is what the live orb's house rule forbids. `scroll-snap-type: x mandatory` on the row is what
  makes it settle on a card rather than between two.
- **‹ › nudge by one card and scroll the ROW, not the page**, so the shelves above and below stay
  where they are; on a phone the buttons go and the row is swiped, which is the gesture the wheel
  was built for.
- **`wsCardNode` is the card factored OUT of the render**, unchanged in what it draws except the
  two new chips — the cover stack, the setter chip, the attempts, every button and every handler
  are the same node they were, so the shelf changed where a card SITS and not what it does.
- The row's side padding is `calc(50% - <half a card>)`, so the first and last card can reach
  the centre and be faced; without it the first paper on every shelf is permanently turned away.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

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
- **DELETING THE TEACHER'S OWN COPY LEAVES THE FILE ALONE TOO** (v1.23.1,
  `worksheetReadByClass`). `sharedPdf` is on the STUDENT's copy; the
  teacher's original is the one the file belongs to and never carried the
  flag, so the teacher tidying up after setting a worksheet deleted the one
  PDF thirty copies read — the assignment stayed on every home screen and
  every Start / Carry on came back *"Object 'tutor-worksheets/…pdf' does
  not exist"*. The answer is read LIVE off `tutorAssignments/{id}`, never
  off `w.pushed` alone (cleared by Take off the list, while the copies
  started before that still read the file), and a read that fails keeps the
  file. `startAssignment` checks the file BEFORE writing a copy
  (`pdfMissingError`), `openFailureText` names a missing PDF in words, and
  `checkAssignmentPdfs` flags a set worksheet whose file has gone on the
  TEACHER's home screen only — a student's device may not be allowed to
  read metadata, and a refused read would flag a worksheet that opens.
- **THE SET LIST GOES THROUGH `canSeeWorksheet` TOO** (v1.23.1,
  `assignmentsForMe` / `assignmentNotMineText` / `blankStarterCopy` /
  `duplicateBlankCopies`). It never did: `renderAssignments` painted every
  active assignment for every student, so a P5 Maths paper sat on a P6
  account — and Start wrote a P5 copy that `loadWorksheets` filtered straight
  back out, `openWorksheet` found nothing and RETURNED IN SILENCE, and every
  press wrote one more hidden copy. The list is drawn from
  `assignmentsForMe()`, `startAssignment` asks the rule AGAIN in the handler
  (a hidden card is never the lock) and refuses in words, `openWorksheet`
  says when an id is not in the list, and `loadWorksheets` drops the blank
  DUPLICATE copies the bug wrote — the document only, never the sole copy,
  never a copy with ink on it, never the class's PDF. Drop the filter and a
  child is shown another class's paper; drop the handler check and a link
  starts a copy that can never open; let `blankStarterCopy` pass a copy with
  work on it and a tidy-up deletes a child's work.


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

## 🧭 THE DIAGNOSTIC — every question filed under the SYLLABUS, and kept for the long run (v1.18.0)

`SYLLABUS` / `syllabusEntries` / `syllabusLo` / `syllabusTopic` / `diagChoices` /
`markSyllabusBlock` / **`diagPlace`** / `diagItemPlace` / `reportDiagnostic` /
`diagPct` / `diagResult` / **`diagSummary`** / `progressRows` / `progressFocus` /
`diagAsText` / `diagTrendText` / `diagGroupsOf` (search `THE DIAGNOSTIC — every
question filed`), the `ctx` on `_markNewItem` / `_markFoldRows`, `diagTableNode`
/ `renderProgress` / `progressAsText` beside the report's renderers, the
`diagnostic` field `performSave` writes, `#progressModal` and 📈 **My progress**
on Home.

The report grouped by whatever topic the marking happened to name — right for
"what went wrong on THIS paper" and useless for "is Heat still the problem?",
because a topic named freely is named five ways over five papers and never adds
up. So the marking is handed THE SAME TWO LISTS the teacher's own apps file a
question under, and every question lands on a syllabus line.

- **`SYLLABUS.science` is cer's `SYLLABUS_LO_TOPICS` and `SYLLABUS.math` is
  the Maths app's `MOE_SYLLABUS` (P3–P6), IDS AND ALL** — `heat-flow`,
  `P5.FR.2.6`. A diagnostic filed here names the objective a question in those
  banks is filed under, which is what lets a weak line be matched to practice
  there. Each science heading is tagged with the portal's rapid-add TOPIC
  (`bank`, with a per-objective override where one heading spans several —
  Reproduction is two topics there, the Environment three), so the student
  reads *Heat*, not *Energy Forms and Uses (Heat)*. **Edit an id and the two
  apps stop meaning the same thing with nothing anywhere to say so** — the
  harness pins both counts (79 and 171) and a sample of ids. MOE changes the
  syllabus rarely; when it does, all three files want editing.
- **`syllabusEntries` is the ONE reader** of the catalogue: one row per
  objective, in syllabus order, with `tkey` unique across the subject. A maths
  topic is "Fractions: Four Operations" with its strand, because "Four
  Operations" is two topics at P5 and "Angles" is a topic at three levels.
- **THE LIST IS NARROWED TO THE WORKSHEET'S LEVEL** (`diagChoices`), the way
  ⚡ Rapid add's batch level narrows the topics — and, like that picker's "Any
  level" row, a worksheet with no level is offered the whole subject. A subject
  with no list (English, Chinese, a Sec 1 paper) gets **no block at all**
  (`markSyllabusBlock` returns `''`) and the generic topic rule stands byte for
  byte. The block goes into the SYSTEM prompt beside the grounding and the key.
- **A REPLY OFF THE LIST IS SHOWN, NEVER SNAPPED** (`diagPlace`). The portal's
  `_rapidApplyLevel` files an off-list topic into the level's first topic and
  marks it low because a person vets every low there. Nobody vets a diagnostic
  — it is written into a record the student keeps for years — so a wrong snap
  here is a lesson filed under the wrong topic for good. A real objective id
  wins outright; a topic matching a name on the list is placed under it with no
  objective, preferring the worksheet's level where the name exists at several;
  anything else keeps the model's own wording, unplaced, under *Not on the
  syllabus list* — visible, and last.
- **The placement rides the ITEM** (`lo`, `sylTopic`) and the fold carries it
  with the topic, from the half that saw the whole question. **A worksheet
  marked before this is placed BY NAME at render time** (`diagItemPlace`), so an
  old paper is not all "unlisted".
- **EVERYTHING IS PLAIN CODE over the marking that already happened** — no
  second AI call, the rule the report has always carried; the harness fails on
  an `askGemini` anywhere in the block.
- **The rate is over what was ATTEMPTED** (`diagPct`), the headline score's own
  rule: a blank keeps its full marks, adds nothing obtained, is counted blank
  and never wrong, and a row nothing was attempted on reads *Untried* rather
  than nought per cent. The result is a WORD with a class, never a colour
  alone, for the reason the report's verdicts are.
- **`diagSummary()` is what survives the tab**: one small row per
  topic-and-objective — the topic key, the objective id and the numbers,
  capped at `DIAG_ROWS_MAX` — written beside `score` on EVERY save, because
  the long run is added up off the worksheet LIST and never off a body. An
  unplaced row keeps the model's wording (`n`) so the long run can still name
  it. No marking is `null`, never an empty summary.
- **`progressRows` adds the summaries up across every worksheet the student
  can see**, per subject, in syllabus order, with each objective's history
  oldest first; a row that is not a row is skipped, not the paper. The
  objective's wording is read from the CATALOGUE, never from the summary.
  `progressFocus` is the weakest first, under `DIAG_FOCUS_PCT`, then the most
  marks behind them.
- **ONE table builder draws both tables** (`diagTableNode`) and ONE text
  renderer both copies (`diagAsText`), so the report and 📈 My progress cannot
  disagree about what a row is. The print rules key off `.modalBack.printMe`
  rather than the report's id — a second printable window was exactly the case
  `printThis` was written for.
- A filed mistake carries `topic` / `lo` / `sylTopic` too, so the book can one
  day be read by objective.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

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

## ✏️ Practising the mistakes, and the sheet they print as (v1.4.0)

`pracSel` / `mistakesShown` / `pracPruneSel` / `pracSelectedIds` / `pracStart`
/ `pracCheck` / `pracRender` / `PRAC_SYS` / `mwsLines` / `mwsBuild` /
`mwsExport` / **`printThis`** (search `PRACTISING THE MISTAKES` and `THE
PRINTED WORKSHEET`), plus `#pracModal`, `#mistSheet` and the `.prac*` /
`.mws*` CSS.

A mistake book that can only be READ is a list of everything a student has
ever got wrong, which is a list nobody opens twice. What empties it is doing
the questions again — so the book is worked through here, one question at a
time, or printed as a worksheet and done on paper.

- **THE ANSWER IS NOT ON SCREEN UNTIL THEY HAVE ANSWERED.** It is right there
  on the card in the book, which is fine for looking something up and useless
  for practice: a question shown next to its own answer is a question nobody
  attempts. `prac.revealed` is the one flag that decides it.
- **"All" means every card the student can SEE.** `mistakesShown()` is the ONE
  place that set is worked out — the filter chips decide it — and the buttons
  say which. Practising or printing questions hidden behind a filter is the
  one outcome nobody could have predicted from the button they pressed.
- **The ticks are pruned on every render** (`pracPruneSel`), not in each of
  the paths that can remove a card. "3 selected" outliving the cards it
  counted is how the wrong questions end up on the sheet.
- **A blank retry is never marked wrong**, the same rule the marking has
  carried since it shipped: it has simply not been attempted, and marking one
  would be the app telling a child they failed a question they never tried.
- **A correct retry files the mistake under Sorted then and there**, because
  getting it right is what the book is FOR — and the card's own ↩︎ puts it
  straight back, which is what makes that safe.
- **What the question is WORTH, never what it scored.** `pracWorth` shows the
  total; last time's "0 out of 2" hanging over the retry is the one thing on
  that screen that could put a child off starting.
- **The typed answer lives on the SESSION, not in the textarea.** The body is
  rebuilt on every render, so pressing Check would otherwise wipe the answer
  being checked the moment the "Marking…" state repaints.

### The printed worksheet

- **"Export as a PDF" is the browser's own Save as PDF, reached through
  print.** There is no PDF *writer* in this app — pdf.js reads them — and
  adding one is a third of a megabyte of library for a button every browser
  and every phone already has.
- **`printThis(el)` is the ONE door, and the stylesheet keys off `.printMe`
  rather than an id.** Naming the report by its id worked while it was the
  only printable thing in the app and hid the worksheet the moment there were
  two.
- **Every picture is AWAITED before the dialog opens.** `window.print()` does
  not wait for an `<img>`, so a sheet printed the instant it is built comes
  out with the questions missing and a student holding a page of ruled lines.
  A picture that will not load takes itself off the sheet and the question
  falls back to its wording.
- **The ruled space is sized by what the question was worth** (`mwsLines`),
  floored at two lines and capped at six — a 4-mark answer given two lines is
  as wrong as a 1-mark answer given a page.
- The answer key breaks to its **own page**, so the sheet can be handed over
  without it.

## 👥 The first sign-in, and who has signed in (v1.5.0)

`PEOPLE_COL` / `ONBOARD_VERSION` / `APP_FEE` / `onboardNeeds` / `onboardClean`
/ `onboardValid` / `onboardRequire` / `noteSignedIn` / `onboardSave` /
`personRow` / `peopleSort` / `peopleLoad` / `renderPeople` (search `WHO IS
USING THIS`), plus `#onboardModal`, `#peopleModal` and the `.ob*` CSS.

On a first sign-in the app asks two things and then gets out of the way: who
the parent and the student are (**more students can be added** — one account
is often one family), and **whether they are enrolled at Polymath**. Enrolled
is free; not enrolled is **$100 a month**, agreed to by a parent or guardian.

- **THE ROSTER IS THE ONE THE CENTRE ALREADY HAS.** `studentProfiles` is the
  Ans Key annotator's collection, already admin-readable and already writable
  by the account it belongs to, and the Scan app reads the same list. A second
  roster here would be a second list to keep in step, and the first thing
  anybody would notice is a student who exists in one app and not the other.
- **IT NEEDED NO FIRESTORE RULES CHANGE**, and that is not luck — it is what
  made it worth doing this way. Those rules live in `polymathlc/math` and are
  shared with four other apps, so a feature that needs one is a feature that
  waits.
- **This app writes ONE namespaced field** (`tutorOnboard`) and never touches
  what the other apps own. `name` is the single exception and is written
  **only when it is empty**: a name a teacher typed in Ans Key must not be
  replaced by whatever a parent typed here, and a row with no name at all is
  worse than either. Every write is a **merge**.
- **A failed READ asks.** Letting somebody through on a read error is an
  account that silently skips the fee question for good.
- **A failed WRITE lets them through and asks again next time.** Trapping
  somebody behind a dialog they have already answered — on a dropped
  connection, of all things — is far worse than asking twice. Same for a gate
  that throws: `onboardRequire`'s caller catches and opens the door.
- **Bump `ONBOARD_VERSION` to ask the whole roster again** — a changed fee, a
  changed question. The stored answer records the version it was given under,
  so an old answer to an old question is never counted as an answer to a new
  one.
- **The teacher is not asked and does not get a row.** Their own list is a
  list of the people they teach.
- **`payingFee` is stored as its own flag**, not inferred from `enrolled`
  later. It is a billing commitment and the teacher's list reads it directly.
- **Neither route is preselected and neither is louder.** An agreement to pay
  something has to be CHOSEN, never arrived at by pressing whichever button
  happened to be highlighted. The dialog has no ✕ and Esc does not close it —
  it is the one thing in the app that must be answered.
- **Nothing is charged through the app, and it says so.** There is no payment
  processor here; what is recorded is the agreement, and the teacher's list
  says how many accounts need invoicing.
- **Every sign-in is recorded** (`tutorLastSeen`), so 👥 is who has actually
  been in rather than who once filled a form in — and an account that signed
  in and closed the dialog is shown, saying it has not answered, because that
  is exactly the person worth chasing.

## 📈 WHO DID WHAT — student usage (v1.6.0)

`USAGE_EVENTS` / `usageLabel` / `USAGE_RECENT_MAX` / **`usageNote`** /
`usageAdd` / `usageFlush` / `usageStart` / `usageStop` / `usageDayKey` /
`usageOf` / `usageAccuracy` / `usageRecent` / `openPersonUsage` (search `WHO
DID WHAT`), plus the extra columns on 👥 and the `#personModal`.

The roster said who had signed in. It could not say what any of them had
**done** — which is the question a teacher opens that list with.

- **`usageNote(key, detail)` IS THE ONE DOOR**, and `usageAdd` is its only
  sibling (for the counts that are not one-per-event: a marking run is ONE
  `mark` and eighteen questions). A second writer is a second place to forget
  the two rules below, and a path added later that logs its own way is a piece
  of work that shows up in no total.
- **WHAT LEAVES THE DEVICE IS COUNTS AND A WORKSHEET'S OWN NAME.** Never a
  question, never an answer, never the mark on a particular question — a
  child's work stays in their own account, which is the rule the mistake book
  already carries. The detail is folded to one line and cut to 80 characters,
  so a caller that hands it something bigger cannot turn the feed into a
  transcript.
- **THE COUNTERS ARE `FieldValue.increment`, and the feed is not.** A student
  has the app open on an iPad and a phone; a counter written as a number this
  tab worked out is a counter the other tab overwrites. The recent list is
  written whole and IS last-writer-wins, deliberately — it is a convenience,
  the counters are the truth, and forty rows of it is not worth a transaction.
- **The teacher is never recorded** (`usageStart` asks `isAdmin`). Their own
  list is a list of the people they teach, and recording their own use would
  put them at the top of their own roster every single day.
- **Signing out FLUSHES and then records nothing.** The last few minutes of a
  lesson must not die with the tab, and a write after it would file one
  student's work under whoever signs in next on a shared iPad. Both
  `visibilitychange` and `pagehide`, for the reason auto-save carries: Safari
  on iOS very often gives a swiped-away tab `pagehide` and nothing else.
- **Accuracy is over what was ATTEMPTED.** A blank was not an attempt, and
  counting it as one reports a child who ran out of time as a child who got it
  wrong — the same rule the marking, the report and the practice retry each
  carry. A partial counts half.
- **"Anything at all" deliberately does NOT count a sign-in.** Signing in and
  doing nothing is its own answer and the panel says it in words; folded in, it
  would show a grid of twelve zeros instead, which reads as a broken panel
  rather than as a student who has not started.
- **Every key a call site raises must be in `USAGE_EVENTS`**, or the feed
  prints an internal name — "practiceRight" — into a panel a teacher reads. The
  harness reads the call sites out of the file and fails on one that is not
  named there.
- **An account from before any of this reads as ZEROS, never as nothing.** A
  dash where a count should be reads as a fault rather than as "none yet".
- **It needed no Firestore rules change**: more namespaced fields
  (`tutorUsage`, `tutorRecent`) on a document this app already writes, merged.
  Those rules live in another repository and are shared with four apps, so a
  feature that needs one is a feature that waits.
- **The panel is a READ.** Nothing in `openPersonUsage` writes anything
  anywhere.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🗂 THE COVER — the front page, on a stack of sheets (v1.7.0)

`COVER_W` / `COVER_Q` / `COVER_MAX` / `coverOf` / **`makeCoverDataUrl`** /
**`ensureCover`** / `coverSheets` / `coverNode` (search `THE COVER`), plus the
`.wsCover` / `.wsSheet` / `.wsFace` CSS.

A list of file names is a list nobody can read at a glance — *Term 1 Paper 2*
and *Term 1 Paper 2 (1)* are the same row twice — so every card wears the
worksheet's own first page.

- **IT IS MADE ONCE, FROM THE PDF ALREADY IN HAND**, and stored on the
  worksheet's own document. Rendering it in the LIST would mean downloading
  ten PDFs to draw ten pictures, on a school connection, every time the home
  screen is opened. So it is made at upload — the bytes are right there — and,
  for every worksheet older than this, the first time it is **opened**. The
  library fills itself in as it is used and **no migration runs anywhere**.
- **IT IS NEVER A KEY PAGE.** `studentPages()` is the ONE place "the pages the
  student has" is decided and the cover reads it; the whole 🔑 section exists
  to keep a marking scheme off the student's screen, and putting page 1 of one
  on the HOME screen instead is the same leak through a side door. That is
  also why the upload makes it **after `keyAutoScan`** rather than beside the
  PDF write: before the scan has run, a marking scheme on page 1 is still an
  ordinary page.
- **THE SHEET IS PAINTED WHITE BEFORE THE PAGE IS DRAWN.** A PDF page is
  transparent where nothing is drawn and a transparent canvas flattens to
  **black** in a JPEG — the whole page, ink and all.
- **`COVER_MAX` is a REFUSAL, not a cap.** The cover and the body share one
  Firestore document (`BODY_INLINE_LIMIT` is 600 KB of it), so a cover that
  will not fit comfortably underneath is not stored at all. A card with no
  picture is a small loss; a document that cannot be written is the student's
  work.
- **`coverOf` only ever accepts a `data:image/` url.** It is a field on a
  document rendered straight into an `<img src>`; anything else the record
  happens to be carrying is not a picture this app drew.
- **It is written with its own small update**, never folded into
  `performSave`: a cover never changes, and re-sending it on every auto-save
  would put tens of kilobytes on the wire every couple of seconds. A cover
  that cannot be written is not worth a word to the student.
- **A worksheet SET for the class carries its cover to every copy**
  (`cover: coverOf(w)` on the push, `coverOf(a)` on the start), so thirty
  students cost one render — the same way the key rows travel already read.
- **The stack is the PAGE COUNT** (`coverSheets`: 1 → none, 2 → one, 3+ →
  two), so it says how much paper there is rather than being decoration. The
  sheets are **absolutely positioned**, so however many there are the card is
  the size of the front page and the grid never goes ragged.
- The two greys the sheets are drawn in are deliberately **not `--line`**:
  #ECECEA against a white card is invisible from a step back, and a stack
  nobody can see is not a stack.
- An empty face **says how it fills in** on a worksheet of your own, and says
  **nothing** on one the teacher set — that one fills in from the teacher's
  copy, which is not something a student can do anything about, and asking
  for something impossible is worse than saying nothing.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🔒 A WORKSHEET THE TEACHER SET IS THE TEACHER'S (v1.8.0)

`keyLocked` / `keyLockedNote` (search `WHOSE KEY IS IT?`) and
`assignmentFor` / `guidanceRule` / `guidanceLockedNote` / `assignmentsLoaded`
(search `WHOSE HELP LEVEL IS IT?`), plus `openPushModal` / `renderPushLock` /
`pushConfirm` and the `#pushModal`.

Two things on a set worksheet belong to the teacher, and they are **locked in
deliberately different ways**.

### The answer key — locked, and never released

- **THE 🔑 WINDOW IS A LIST OF EVERY PAGE WITH A TICK BESIDE IT.** So a
  student who can open it can UNTICK a key page and read the marking scheme
  — the one thing this feature exists to prevent, reached through its own
  settings window. That was the hole: `keyPages` travelled to the student's
  copy and were hidden, and the window that hid them was wide open.
- **Four ways in, and all four refuse**: `openKeyModal`, `toggleKeyPage`,
  `attachKeyPdf`, `detachKeyPdf`. Hiding the chip is not the lock — every one
  of those is reachable from a stale chip and from the console.
- **The chip STAYS, and says whose key it is.** Pages really are missing from
  the worksheet, and `renderKeyChip` exists precisely because a page that has
  quietly disappeared is the other thing this feature can get wrong. What it
  must not do is enumerate them: on a locked worksheet it names the teacher
  and stops, and it is a label rather than a button.
- **It is NEVER released.** Taking a worksheet off the class list is not a
  decision to hand out the marking scheme, and the file is still the class's
  — so `keyLocked` reads `wsMeta.assignmentId || wsKey.shared` and nothing
  else. That is the deliberate difference from the help level below.

### The help level — locked, and released when the worksheet comes off

- **The teacher chooses it when they set the worksheet, and says whether the
  class may change it.** `openPushModal` is the same dialog for setting one
  and for changing what an already-set one gives; a `confirm()` could ask one
  question and this asks the two that decide how the worksheet behaves for
  thirty people.
- **A LOCKED level is read LIVE from the assignment**, never from the
  student's copy. A lock read off each copy would only ever govern the
  students who had not started yet, so pressing 💡 Level for the class would
  do nothing for the ones already working. It also means the teacher's level
  beats a level the student set for themselves **before** it was locked,
  which is the whole point of a lock.
- **`assignmentsLoaded` is what tells "not loaded yet" from "taken off the
  list"**, and those two want opposite answers. Off the list → the copy is
  the student's own and the lock falls away, or it would stay locked for ever
  at a level nobody, teacher included, could still change. Not loaded → the
  copy's own flag stands, so it errs locked. **A read that FAILED sets it
  back to false**, because a denied read is not proof that nothing is set.
- **`openWorksheet` awaits the class list** when the worksheet has an
  `assignmentId` and the list has not arrived. Everything downstream reads
  `wsMeta.guidance`, so getting it wrong at open time is a whole session run
  at the wrong level with the lock never applied.
- **The button is not drawn AND the handler refuses** — `openGradeModal` and
  `saveGrade` both ask. A student is told **who** set it rather than left
  with a control that does nothing.
- An assignment pushed before this shipped has no `guidanceLocked` field and
  reads as **unlocked**: nobody's class is locked down by a deploy, and one
  tap on 💡 Level for the class locks it.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## ↻ A SECOND ATTEMPT, AND 🖨 THE PAPER ON PAPER (v1.11.0)

`practiseAgainAvailable` / `practiseAgain` / `attempts` (search `PRACTISING IT
AGAIN`), and `PRINT_MAX_SIDE` / `printKeyAllowed` / `printHasKeyPages` /
`printWorksheet` / `openPrintModal` (search `PRINTING THE PAPER`), plus
`#printBtn`, `#printModal` and `#printSheet`.

**Marking a paper puts the answer to every question on the screen**, so
without a way back there is exactly ONE honest attempt at any worksheet: open
it again tomorrow and the answers are still sitting above the questions.

- **THE HINTS GO WITH THE MARKING, and that is the half that is easy to
  miss.** A hint climbed to the top of the ladder holds the answer just as
  plainly as a marked card does, so clearing one and leaving the other hides
  the answers in one panel and keeps them in the next.
- **THE MISTAKE BOOK STAYS, and it is what makes clearing the rest safe.**
  Everything they got wrong is already filed with a picture of the question —
  that IS the record of the attempt being cleared. The chat stays too: it is a
  conversation, and under the help ceiling it never held the answer unless the
  level allowed it anyway.
- **THREE THINGS MAKE THE DESTRUCTIVE HALF SAFE and none is optional**: it
  ASKS first, naming what goes and what stays; the ink is pushed onto the
  **undo stack BEFORE** it is cleared, so one Ctrl+Z is the whole attempt
  back; and nothing is written until the student has confirmed. This is the
  only button in the app that throws a student's own work away.
- **`attempts` is what stops it being invisible.** A cleared paper and a paper
  never started look identical, so the card and the marking pane say which go
  this is.
- It is **not offered mid-run**: clearing half a marking run leaves marking
  for questions that no longer have any ink behind them.

**🖨 Print** is the worksheet; **🔑 Print with the answer key** is the worksheet
plus the key pages.

- **A PLAIN PRINT GOES THROUGH `studentPages()`**, the ONE place "the pages
  the student has" is decided. Read `pages` here and the marking scheme comes
  out of the printer — the leak the whole 🔑 section exists to prevent,
  through a side door, on paper, where it cannot be un-seen.
- **THE KEY OBEYS `keyLocked()`, IN THE HANDLER AND NOT ONLY ON THE BUTTON.**
  On a worksheet the teacher set, printing the key is simply another door to
  the marking scheme — the one the 🔑 window was shut to stop. Hiding a button
  has never been the lock in this app.
- **WHAT IS ON THE SCREEN IS WHAT PRINTS**: the pages go out composited with
  the student's own ink, because that is what "print this worksheet" means for
  a worksheet you have been writing on. Wanting a clean copy is what ↻
  Practise again is for.
- **EVERY PAGE IS DECODED BEFORE THE DIALOG OPENS.** `window.print()` does not
  wait for an `<img>` — the same lesson the mistake worksheet learned, and the
  failure is a printed sheet with the questions missing.
- **`#printSheet` IS A DIRECT CHILD OF BODY.** The print stylesheet hides
  `body > *:not(.printMe)`, so a sheet nested inside the app is hidden along
  with everything around it: a print dialog with nothing in it, on a page that
  looks perfectly right.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🧩 THE MISTAKE IS THE QUESTION, SET OUT AGAIN (v1.12.0)

`MB_*` / `_mb*` / `rbCleanPage` / `mbRebuild` (search `REPRODUCING THE
QUESTION`), `mistakeTier` / `mistakeBlocks` / `mistakeOptions` (search `WHICH
TIER THIS ONE IS`) and `questionNodes` / `MQ_SKIN` (search `THE ONE PLACE A
MISTAKE'S QUESTION IS DRAWN`).

A mistake used to be kept as a photograph of the **whole page** it was printed
on — with the two questions either side of it, and the student's own wrong
answer written across it. Printed on a practice sheet that is a photocopy of
the paper with one question somewhere in it, which is not a question anybody
can practise. So the question is read into **ordered blocks** instead: the
wording typeset, with an `image` block wherever a figure belongs, each figure
cut out of the page by its own rectangle. That is the Science portal's ⚡
**Rapid add**, by way of Scan & Answer's port of it.

- **THE IDENTIFIERS ARE DELIBERATELY THE SAME ONES** — `_mbBoxOk`,
  `_mbTightenRect`, `_mbCleanBlocks`, `_mbUnionBox`, `MB_*`. That is the rule
  Nova Protocol follows against Realm of Embers: a fix in `polymathlc/scan` or
  `polymathlc/cer` copies straight across rather than being re-derived, and
  what genuinely differs here is called out below and nowhere else.
- **THIS APP CROPS A CLEAN PAGE, WHICH IS THE ONE THING SCAN & ANSWER CANNOT
  DO.** That app only ever has a photograph of a worksheet somebody has
  already written on. This one holds the PDF, so `rbCleanPage` re-renders the
  page out of it with no annotations at all: the crop is sharp, square, and
  carries none of the student's answer. **Every tier is clean, including the
  whole page** — `mistakeShotFor` was `compositeJpeg`, the page as it was
  MARKED, which is right for looking back at what you wrote and useless for
  doing the question again. What they wrote is kept as TEXT and shown beside
  it, which is where it can be read.
- **THREE TIERS, BEST FIRST, and `mistakeTier` is the ONE place the choice is
  made**: ① the blocks, ② the whole-question crop, ③ the whole page. Every
  consumer asks it — the card, the practice session, the printed sheet, and
  the ✂️ Crop button. Two readings of it is a card showing one thing and the
  sheet printing another, and nothing anywhere would say so.
  - A question shown as **blocks** must NOT also show its picture: the picture
    is the same question, so the student is asked it twice.
  - A **whole-question** crop prints no wording of its own, for the same
    reason. A **whole page** keeps it, because the page has other questions on
    it and the wording is what says which one this is.
  - ✂️ **Crop** is offered only where the picture is actually on screen. On a
    rebuilt question it would crop a picture nobody can see.
- **`questionNodes` is the ONE renderer** the card, the practice session and
  the printed sheet all build the question with. `MQ_SKIN` is three sets of
  class names over one function, not three functions. A second copy would be
  free to drift, and the drift is silent.
- **IT IS ITS OWN CALL, and that is deliberate.** The marking run is already
  doing two hard things at once — marking what is written, answering what is
  not — on a prompt tuned for both, and bolting a block specification onto
  `MARK_SYS` would buy a better practice sheet at the price of worse marking.
  The **whole-question rectangle is asked for in the rebuild call too**, for
  the same reason: it is the call already drawing rectangles.
- **IT CAN NEVER COST THE MISTAKE.** The document is written FIRST and every
  picture is an extra on it; every failure returns null and the entry is filed
  exactly as it would have been before any of this existed.
- **THE RATION IS PER RUN.** `MB_BUILD_MAX` (10), spent **before** the call so
  a failure cannot buy another try, and refilled in `fileMistakes` and nowhere
  else. A paper where every question is wrong must not quietly spend twenty
  vision calls.
- **THE PROMPT IS EXEMPT FROM THE GROUNDING CENSUS, BY NAME.** `MB_BUILD_SYS`
  is a transcriber with a ruler: it sets out what is PRINTED and draws
  rectangles round the figures. A reproducer told how this teacher words an
  answer rewords the QUESTION, and a question quietly improved on the way into
  the mistake book is not the question the student got wrong.
- **THE OPTIONS TRAVEL WITH THE QUESTION** (`type`, `options`, `option`). The
  rebuild is TOLD to leave word options out of its blocks precisely because
  they are held on the mistake and printed underneath — so losing them breaks
  both halves at once, and a multiple-choice question printed with nothing to
  choose between is a question nobody can answer. `mistakeOptions` is the one
  door, and it goes quiet when a picture already holds the choices.
- **`role: 'options'` is the picture-options contract**, shared with
  `polymathlc/scan` and `cer/mistakes.html`: four little drawings travel as
  ONE rectangle, because cut out separately they lose the row they were
  printed in and a student answering "(3)" cannot see which one (3) was. It is
  a field on a known TYPE rather than a type of its own, so anything that has
  never heard of it draws a figure — untidy, and still answerable. **Ship a
  change to the word in all three.**
- **The ink threshold is MEASURED, not assumed**, and it is the one thing that
  could not be ported as it stood. A PDF re-rendered here is white at 255 and
  a fixed line would do — but the PDF is very often a SCAN of a paper
  worksheet, where the paper is grey, and a fixed line then reads the whole
  page as ink: the trimmer finds one band covering everything and does nothing
  at all, with nothing on screen to say it has stopped working.
- **At most two clean pages are held** (`RB_PAGE_CACHE`). One at 2200px is
  tens of megabytes of canvas, and holding a twelve-page paper resident is
  what makes Safari discard the tab — the lesson `rasterVisiblePages` already
  learned. Two, because a question running over a page break is measured on
  both.
- **A block figure is stored as a PATH, never a download URL.** Everything in
  this book is a path resolved on demand, so a URL stored here would be the
  one row the deleting and the caching could not see — and `deleteMistake`
  takes every picture a mistake owns, or a figure is left in the bucket that
  nothing will ever point at again.
- **It needed NO Firestore or Storage rules change**: more fields on a
  document this app already writes, and more files under the folder it already
  uploads to. Those rules live in `polymathlc/math` and are shared with five
  apps, so a feature that needs one is a feature that waits.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## ✍️ THE STYLUS, THE PALM AND THE FINGERS (v1.13.0)

`stylusOnly` / `PALM_CONTACT` / `isPalmTouch` / `isDrawTool` / `claimPointer` /
`cancelStaleGesture` / `abortYoungStroke` / `commitTouchStrokeForNav` / `nav` /
`navBind` / `zoomAt` / `startNavMomentum` / `setStylusOnly` (search `THE STYLUS,
THE PALM AND THE FINGERS`), plus the ✍️ button in the toolbar and
`touch-action: pan-x pan-y` on `#viewerArea`.

**Ported whole from `polymathlc/anskey`** — the same iPad, flat on a table, an
Apple Pencil in one hand and the heel of the other resting on the page. Keep
the two in step; a fix to either belongs in both.

- **PENCIL-ONLY MODE IS ON FROM THE START**, and that default is the feature: a
  palm that can draw ruins a worksheet before anyone notices, and a student who
  has just watched it happen has no idea what to press. Turning it off is one
  tap on ✍️, remembered per device — and **the first time a real stylus touches
  down it comes back on**, because whoever has just picked a pencil up is about
  to rest a hand on the screen.
- **A PALM IS A CONTACT PATCH.** iPads report ordinary fingertips at up to
  ~45px, so `PALM_CONTACT` (55) has to sit above that: set it lower and
  ordinary finger scrolling is eaten instead, which is the same feature failing
  the other way round.
- **ONE POINTER AT A TIME, AND A PALM LIFTING OFF MUST NOT END THE STROKE.**
  `activePointerId` does both jobs, and it is claimed exactly where the pointer
  is CAPTURED — the eraser, the move and the draw — never on a tap that returns
  (💡 hint, 🎤 speak, 🅣 text), which would leave it claimed with no pointerup
  coming. A gesture whose end never arrived would lock every later touch out of
  the page for the rest of the session, so a fresh PRIMARY pointer of the same
  kind clears the stale one (`cancelStaleGesture`) rather than being refused.
- **`isDrawTool` deliberately excludes 💡 hint, 🎤 speak and 🖱️ select.** Those
  are a tap and a drag of something already on the page; a finger doing either
  is not a palm about to ruin the worksheet, and handing them to the pan engine
  would make them unusable without a pencil.
- **A SECOND FINGER MEANS NAVIGATE, AND THE INK IS NOT THE PRICE.** Under 300ms
  the stroke is an accidental dot and is thrown away (`abortYoungStroke`); over
  it, the stroke is real work — it is COMMITTED as one undo step and the two
  fingers get the pinch (`commitTouchStrokeForNav`). Leaving it running instead
  is what makes the second finger appear dead.
- **THE ENGINE IS BOUND IN CAPTURE ON `#viewerArea`**, ahead of the page
  overlay, which is the only reason a second finger can take a stroke over into
  a pinch at all.
- **The pinch is collected into ONE zoom per animation frame** (`scheduleNavZoom`
  / `endNavZoom`). A zoom per `pointermove` resizes every page and then reads
  the scroll back — a forced layout twice a frame on a twenty-page document,
  which IS the lag. `endNavZoom` flushes the last few milliseconds so the page
  lands exactly where the fingers left it.
- **`touch-action: pan-x pan-y` on the scroller is load-bearing**: it keeps the
  ordinary scroll in the margins either side of a page and takes the browser's
  own pinch-zoom away. Left on, a pinch zooms the whole app instead of the
  worksheet and fights the gesture the whole way.
- **`zoomAt` clears `fittedWidth`** — a pinch is a decision, and the next
  window resize must not undo it. That rule is older than this block and is the
  reason `fittedWidth` exists.
- The ✍️ button carries **no `data-tool`**: it is a MODE, and the tool buttons
  are wired and lit by that attribute. `S` toggles it, and is handled before the
  tool table for the same reason.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## House rules
- After touching **📌 whether the class has it** (`worksheetSetState`,
  `worksheetSetChip`, `worksheetSetBlocker`, `setAllWorksheets`, `blockedList`,
  `unsetWorksheetCount`, `syncSetAllBtn`, `pushWorksheet`'s `opts.quiet` or its
  returned outcome, the `setSkip` on `uploadOne`, the `notSet` list in
  `handleUpload`, `#setAllBtn` or the `.chip.chipSetOut` /
  `.chip.chipSetNone` CSS), run
  `node tools/tutor-tests.mjs` **and** `node tools/upload-batch-tests.mjs`.
  Every failure here is silent and the shelf still paints — which is the whole
  fault this answers: a term's worth of papers set for nobody, on a home screen
  that looked perfectly ordinary. Read `w.pushed` instead of the live
  assignment and a refused take-off leaves a paper claiming to be set; drop
  `assignmentsLoaded` and every paper reads as unset for the moment before the
  list arrives, so the button offers to set the whole shelf again. Fold
  `'nobody'` into `'set'` and the one case that was already invisible — a paper
  set with no level or subject, on NO shelf — goes back to being invisible.
  Draw the chip for a student and their shelf is captioned with a state that
  can only ever say "not set" about papers they were simply not given. Let
  `setAllWorksheets` touch a paper that is already set and the help level, the
  lock and the answer key it went out with are quietly rewritten; `Promise.all`
  that loop and two papers interleave through the module globals exactly as two
  uploads do. Let `opts.quiet` swallow the refusal as well as the noise, or
  stop NAMING what was skipped, and this is the original bug wearing its own
  fix. And put `pushed = true` back after the call rather than after the
  ANSWER, and a batch of ten reports nine papers set that no child can see.
- After touching **📚 uploading a pile of PDFs** (`handleUpload`, `uploadSettings`,
  `uploadOne`, `uploadName`, `isPdfFile`, `pdfBaseName`, `UPLOAD_MAX_FILES`, the
  `multiple` on `#fileInput` or its `change` handler), run
  `node tools/upload-batch-tests.mjs` **and** `node tools/tutor-tests.mjs`. Every
  failure here is silent and the upload still reports success. **A `Promise.all`
  in that loop is the worst of them**: the whole pipeline is module globals, so
  two papers in flight interleave and each corrupts the other — paper 3's key
  pages hidden on paper 7, paper 5's bytes inside paper 2's Storage object — and
  nothing on any screen says so. Read the dialog inside the loop and paper 2
  takes a blank level; close the dialog or clear `upKeyFile` after the loop and
  the second paper is uploaded against a form the teacher may already have
  reopened. Use the typed name for every paper and the shelf is ten worksheets
  with one name; compute `nameTyped` apart from the name and a file name is
  flagged as one somebody typed, so the read never improves it. Give the
  attached key to every paper and nine of ten are keyed against a scheme that
  is not theirs. Let one paper's failure escape the loop and the nine after it
  are lost; stop NAMING it and the teacher has no idea which one to do again.
  Move `showView('ws')` inside the `solo` branch and the read fits a hidden
  page to a width of nothing. And drop `if (solo) return;` and a single upload
  is buried under a batch summary it was never part of.
- After touching **👤 the roster promise** (`rosterReset`, `rosterSettled`, `rosterReady`,
  `ROSTER_WAIT_MS`, the `await rosterReady()` in `loadWorksheets`, the `rosterSettled()` in
  `adoptStudents` / `onboardSave` / the sign-in's `.then(rosterSettled, rosterSettled)` / the
  signed-out branch, or `canSeeAssignment`'s `!st` branch), run `node tools/tutor-tests.mjs`.
  Every failure here is silent and the home screen looks perfectly ordinary. Take the await out of
  `loadWorksheets` and the list is filtered against nobody again, so a P5 child is reading every P6
  and P4 paper the teacher has set — which is the bug this fixed, and it shows on accounts that
  have ALREADY answered while a freshly onboarded one looks right. Filter first and repaint once
  the roster lands and it is a flash of another class's papers instead, seen or not depending on
  how fast the network is. Miss `rosterSettled` on ONE path — the teacher, who adopts nobody, or a
  gate that threw, or signing out — and that account's home screen never fills in at all. Drop
  `ROSTER_WAIT_MS` and a path nobody thought of hangs it for ever. And let `canSeeAssignment` go
  back to `return true` for an unknown student and the promise is the only thing standing between a
  child and another class's papers, where it was meant to be the second of two.
- After touching **📚 the wooden shelves, the set rule or the auto-set** (`canSeeAssignment`,
  `assignmentUntaggedNote`, `shelfEntries`, `setCardNode`, `renderAssignments`' admin gate, the
  `topic` / `school` on `pushWorksheet`'s record, `upPush`'s default, the `got.level && got.subject`
  gate in `handleUpload`, the `.shelf*` wood or the `.wsCard.booklet` CSS), run
  `node tools/tutor-tests.mjs` **and look at the home screen** at a desk and a phone width. Every
  failure is silent and the shelves still paint. Fold `canSeeAssignment` back into `canSeeWorksheet`
  and a set paper with no level is on every shelf in the school again; make the OWN rule strict
  instead and a child's own untagged upload vanishes from their list. Let `shelfEntries` count a set
  paper as unstarted when the teacher's own upload IS it and the teacher's shelf holds every paper
  twice; let it filter and a paper is gone from a shelf that looks complete. Paint the set list for a
  student and every unopened paper is on the screen twice. Set the paper before the read and it goes
  out untagged, on nobody's shelf, with a toast that says it went; set it when only one tag is known
  and the same. Draw the wood from a picture and a school wifi leaves a broken tile behind every
  shelf; make the booklet a new node instead of a class on the card and its buttons stop working on
  one surface. And put `.shelfBtn` back in the phone rule without `.shelfHead` and the buttons that
  should give way to swiping are back.
- After touching **🏫 the school in the name or 📚 the bookshelf** (`paperReadName`, the `school`
  / `exam` / `topic` fields in `PAPER_READ_SYS` / `paperReadClean` / `paperApplyRead`, the two
  `wsMeta` fields and their `performSave` / `openWorksheet` / `handleUpload` lines, `shelfGroups`,
  `shelfCompare`, `shelfStamp`, `shelfWheelPose`, `shelfWheelCss`, `shelfWheelApply`,
  `shelfWheelWatch`, `shelfNudge`, `shelfNode`, `wsCardNode`, or the `.shelf*` CSS), run
  `node tools/tutor-tests.mjs` **and look at the home screen**. Every failure is silent and the
  list still paints. Put the school on every worksheet's name and a shelf of thirty reads as one
  name repeated thirty times; put it on a title that already carries it and the name reads twice.
  Parse the topic back out of the name instead of reading the field and the first title that does
  not follow the pattern shelves the paper in the wrong place. Let `shelfGroups` FILTER anything —
  an unknown level, a blank subject — and a paper vanishes from a list that looks complete, which
  is the one fault the list exists to prevent. Pose the wheel on a timer, or on every scroll event
  without the frame, and the row stutters on an iPad and runs after the tab is closed; ignore
  `motion === false` and the cards turn for a child who asked them not to; drop the side padding
  and the first paper on every shelf can never face the reader. And stop writing `school` / `topic`
  in `performSave` and both chips vanish on the next open, on a card that otherwise looks right.
- After touching **📖 the paper read at upload** (`PAPER_READ_SYS`, `paperReadWindow`,
  `paperReadSubject`, `paperReadLevel`, `paperReadClean`, `paperReadEnds`, `paperApplyRead`,
  `keyEyeOn`, `keyWalkBack`, `KEY_WALK_MAX`, `keyScanPdf`'s `read`, `keyAutoScan`'s `read`, the `read` / `got`
  half of `handleUpload`, or the ✨ rows on `#upLevel` / `#upSubject`), run
  `node tools/tutor-tests.mjs`. Every failure is silent and the upload still lands. Let
  `paperApplyRead` take the paper's level over a STUDENT's own and a P5 child's worksheet is filed
  at P6 and vanishes from their list the moment it is saved; let it fill a subject they do not take
  and the same happens through the other field. Let `paperReadClean` keep a page number the model
  never saw and a question page is put away as a key. Substitute the read for the text scan instead
  of unioning it and a text-layer key the read did not see comes back on screen; drop the
  `readSawAll` guard and a short scanned paper pays for the same look twice. Stop walking the tail
  and pages 11–12 of a marking scheme are hidden while page 10 of it is served; walk it four pages
  a call again and the model answers the batch rather than each page, so the edge of the key lands
  wherever the batch happened to end; start the walk from the LOWEST known key page and a page the
  text scan missed between two it found is never asked and is served to the student. Read the level from
  how hard the questions look and a P4 revision sheet is filed at P6. Move the read after
  `keyAutoScan` and the key pages it found are never put away; move `keyAutoScan` after
  `ensureCover` and the marking scheme's last page can be the cover. And ground the prompt and
  every paper is filed under whatever the notes are about that week.
- After touching **🔮 the live orb or the filler scrubber** (`LIVE_ORB_MASK`, `LIVE_ORB_STRIDE`,
  `LIVE_ORB_GRAIN_COVER`, `LIVE_ORB_IDLE_GUSTS`, `LIVE_ORB_SNAP`, `liveOrbPitch`,
  `liveOrbGrains`, `liveOrbBroken`, `liveOrbTarget`, `liveOrbEnter`, `liveOrbStep`,
  `liveOrbSettle`, `liveOrbState`, `liveOrbPaint`, `liveOrbFrame`, `liveOrbStrideFor`,
  `liveOrbDraw`, `liveOrbVisible`, `liveOrbListen`, `liveOrbHush`, `liveOrbSpoke`,
  `LIVE_FILLER_RE`, `LIVE_FILLER_SENTENCE_RE`, `liveStripFiller`, the `.liveOrb` / `.orbBody` /
  `.orbGlass` / `.orbShadow` CSS, or the prompts in `worksheetContextRule` / `runLiveDelegation` /
  `functions/live-service.js`), run `node --test tools/live-tutor-tests.mjs`,
  `node tools/tutor-tests.mjs` and `cd functions && node --test test/*.test.js` **and watch
  one live session** — a drawing is the one thing reading the source cannot check. Every
  failure is silent. Schedule the talking state or a gust with a timer and End leaves it
  running, on a session that says it has ended. Let the loop run while no orb is on screen
  and a phone burns its battery drawing thousands of grains nobody can see; stop it and never
  restart it from a paint and the orb freezes the next time the buddy is opened. Sample the
  homes from anything but the mask and the sand settles into a sketch of the logo rather than
  the logo. Jitter the homes inside their cells, let the cover fall under √½, or let the idle
  jitter back in, and the logo is a scatter of dots with paper showing between them — which is
  exactly what was asked to go. Switch `LIVE_ORB_IDLE_GUSTS` on and the idle logo blows apart
  every eight seconds, so it is never quite the logo. Let the renderer size a grain from
  anything but the pitch and the float is either sprinkles or a blob. Draw the shadow inside
  the host's box and the card clips it; put the caption outside `.orbBody` and it stops bobbing
  with the glass it is written on. Let the card and the float read the phase separately and one spins while the other
  listens. Attach the analyser to a stream other than the one the speaker plays and the row
  rises with nothing the student can hear; drop the transcript fallback and an iPad in Lockdown
  Mode has a tutor that talks with a still face. Loosen `LIVE_FILLER_VERB` and "let me know when
  you have tried it" is cut to "when you have tried it"; tighten it and "Let me check the
  worksheet" is read aloud again, which is the one sentence this whole change exists to remove.
  Hand an all-filler reply to the speaker and the tutor says "Let me check." and stops. And
  let the frame loop ignore `liveOrbMotionOk` and the sand swirls for a child who asked it not
  to.
- After touching **✏️ the maths pad** (`mathWorksheet`, `mthAllowed`,
  `mthModelAllowed`, `mthAnswerAllowed`, `mthArith`, `mthShow`, `mthRender`,
  `mthWorkCheck`, `mthWorkClean`, `mthTellTutor`, `MTH_MODEL_SYS`,
  `mthModelCeilingRule`, `mthModelBuild`, `mthModelClean`, `mthModelBlanks`,
  `mthModelLayout`, `mthModelPlace`, `mthArmPlace`, `mthLabelNorm`,
  `mthModelCheck`, `mthAfterHint`, `mthAfterLive`, `kwQuizOffReason`,
  `floatBoxLayout`, the one-shot `model` tool, or the hooks in `askHintAt` /
  `runLiveDelegation` / `loadPdf` / `showView`), run
  `node --test tools/live-tutor-tests.mjs` **and** `node tools/tutor-tests.mjs`.
  Every failure here is silent and the pad still opens looking helpful. Test
  the subject a second time anywhere and the pad appears on a science worksheet
  — or the keyword check on a maths one — with nothing on any screen saying
  which. Put a LADDER test on the working line and the children on *Nudges
  only* lose the one box in the app that asks them to try something, which is
  exactly backwards. Take the ladder OFF the model, or refuse it only on the
  button and not in the handler, and a child on *Nudges only* is handed the
  method drawn out. Let the unknown be filled in below the top rung — on the
  drawing or on the page — and the model is the answer with a rectangle round
  it. Let `mthArith` overrule a *close* as well as a *right* and a regular
  expression that cannot read working is overruling a model that read the
  question. Drop the last segment's remainder and three equal parts leave a
  hairline gap that reads as a fourth. Let the placed model become a new
  annotation type and it has to be taught to six places, the one that is
  missed being silent; drop the single `pushUndo` and a model dropped in the
  wrong place takes forty taps to remove. Leave the place tool armed and the
  next tap on the page drops a second model. And let `floatBoxLayout` read one
  box and a spoken answer is captioned underneath the box it just set.
- After touching **🧩 the keyword check or the syllabus** (`kwQuizAllowed`,
  `kwQuizClean`, `kwQuizGivesAnswer`, `kwQuizKeyAnswers`, `kwQuizMatch`,
  `kwQuizBuild`, `KWQ_SYS`, `kwQuizCeilingRule`, `kwQuizShow`, `kwQuizRender`,
  `kwQuizForHint`, `kwQuizForLive`, `kwQuizTellTutor`, `sylObjectivesFor`,
  `sylPromptBlock`, `SYLLABUS_TOPICS`, or the hooks in `askHintAt` /
  `runLiveDelegation` / `loadPdf` / `showView`), run `node tools/tutor-tests.mjs`
  **and** `node --test tools/live-tutor-tests.mjs`. Every failure here is
  silent and the box still pops up looking helpful. Let `kwQuizAllowed` stop
  asking the ladder and a child on *Nudges only* is handed the concept and the
  keywords their parent switched off, in a box that looks like a game. Drop
  the key guard — or make it drop the ONE blank instead of refusing the quiz —
  and the paper's own answer is on the screen with a box round it, or a hole
  nobody can fill. Send the syllabus whole and every quiz costs thousands of
  tokens; put it BEFORE the notes and a rule Mr Chung typed this morning loses
  to a public syllabus. Build the live quiz before the reply is sent and the
  tutor goes slow on every answer; hand the tutor the missing words and it
  reads them out. Save the busy flag ON the hint and a quiz built while the
  tab closed is "building" for ever. Paint the sentence with `innerHTML` and
  model output is markup on the page. And let a hole and its blank disagree
  and the box asks for a word it cannot check, which reads as a child getting
  it wrong.
- After touching **✍️ the stylus, the palm and the fingers** (`stylusOnly`,
  `PALM_CONTACT`, `isPalmTouch`, `isDrawTool`, `claimPointer`,
  `cancelStaleGesture`, `abortYoungStroke`, `commitTouchStrokeForNav`, `nav`,
  `navBind`, `zoomAt`, `startNavMomentum`, `setStylusOnly`, the pointer gates
  in `attachOverlayHandlers`, or `#viewerArea`'s `touch-action`), run
  `node tools/tutor-tests.mjs` **and use it with a pencil and a hand on the
  glass** — no test can feel a gesture. Every failure is silent and the page
  still draws: a palm threshold under a fingertip eats ordinary scrolling,
  one over a palm lets the heel of a hand write across the worksheet, a
  pointer claimed on a tap that returns locks every later touch out of the
  page for the rest of the session, and a palm allowed to end a stroke cuts
  the pencil off mid-word. On the other side, a second finger that aborts an
  established stroke throws the student's own work away to make a pinch
  work, and one that does not commit it leaves the second finger apparently
  dead. And `touch-action` left off the scroller zooms the whole app instead
  of the worksheet.
- After touching **🧩 the question rebuild or the three tiers** (`MB_BUILD_SYS`,
  `_mbBoxOk`, `_mbInkLevel`, `_mbTrimTextRows`, `_mbTightenRect`, `_mbCropBox`,
  `_mbUnionBox`, `_mbCleanBlocks`, `_mbCleanBuild`, `_mbText`, `_mbBuildBlocks`,
  `_mbBuildFigures`, `_mbUpload`, `mbRebuild`, `rbCleanPage`, `rbJpeg`,
  `mistakeTier`, `mistakeBlocks`, `mistakeOptions`, `mistakeHasPictureOptions`,
  `questionNodes`, `MQ_SKIN`, or the `blocks` / `shot` / `options` fields
  `fileMistakes` writes), run `node tools/tutor-tests.mjs`. Every failure here
  is silent and the mistake is still filed — the app quietly drops back a tier
  and hands the student a photocopy of a whole page with nothing on any screen
  to say so. The failures in the other direction are worse: a rectangle nobody
  checked keeps somebody else's question and looks exactly like a working crop;
  a build with no wording in it is a question made of pictures asking nothing;
  four picture options cut out separately lose the row they were printed in, so
  a student answering "(3)" cannot see which one (3) was; and a fixed ink level
  reads a scanned paper worksheet as ink from edge to edge, so the trimmer
  finds one band, does nothing, and never says it stopped working. Two readings
  of `mistakeTier` is a card showing the question set out properly and a sheet
  printing a photograph of the page. Word options dropped is a multiple-choice
  question printed with nothing to choose between. And a whole-page picture
  that goes back to `compositeJpeg` puts last week's wrong answer across every
  question on the sheet.
- After touching **🧠 the corrections loop** (`cerStyle`, `cerStyleDocRef`, the third listener
  in `loadTeachingNotes`, `styleBucketKey`, `styleProfilePick`, `_styleCountIn`, `_styleTier`,
  `_styleRetrieve`, `styleExemplarsFor`, `styleEditsAll`, `styleCorrections`, `styleEditRules`,
  `styleLessons`, `styleRecentEdits`, `_styleProfileBits`, `styleBlock`, `aiGrounding`'s
  `opts.q`, `hintRetrievalQuery`, the `{ q: … }` at the hint or chat call site, `notesTrimTo`,
  `notesDedupe`, `notesFairShare`, `notesJoinField`, or the `NOTES_*_MIN_EACH` /
  `NOTES_HARD_CHARS` pots), run `node tools/tutor-tests.mjs`. Every failure is silent and the
  hint still comes back. Put the `if (!p) return ''` back in `styleBlock` and a teacher's first
  correction reaches nothing at all; read `profile` instead of `styleProfilePick` and every hint
  is written in the averaged voice again; let the profile's `markingStandards` reach `'mark'` and
  a guess a model drew from the teacher's answers decides a child's mark; let an exemplar, a fix,
  a lesson or a pair reach `'mark'` and the marker has been handed the answer; drop the C
  listener and a correction made in the Science portal reaches nothing here, while the panel
  says the loop is in force; stop sorting the union by time and "the newest correction" is
  whichever document happens to come second; let `hintRetrievalQuery` pick a hint from another
  page or the far end of this one and the exemplars are retrieved for the wrong question; and
  turn a pot back into a `.slice()` and the teacher's second standing instruction reaches no
  prompt while sitting in the notebook looking obeyed.
- After touching **↻ Practise again or 🖨 Print** (`practiseAgainAvailable`,
  `practiseAgain`, `attempts`, `printKeyAllowed`, `printHasKeyPages`,
  `printWorksheet`, `openPrintModal`, `PRINT_MAX_SIDE`, the `#printSheet`
  markup or the `@media print` rules), run `node tools/tutor-tests.mjs` **and
  print one worksheet to PDF to look at it**. The loud half is silent and the
  quiet half is worse: a plain print that reads `pages` instead of
  `studentPages()` hands the marking scheme out on paper, and a key print that
  stops asking `keyLocked()` does it on a worksheet that is not even the
  student's. On the other side, clearing the marking and leaving the hints
  hides the answers in one panel and keeps them in the next; clearing without
  `pushUndo()` first, or without asking, makes one mis-tap the end of an
  hour's work with nothing to bring it back; touching the mistake book deletes
  the record of the very attempt being cleared; and pages that are not decoded
  before the dialog opens print as a stack of blank sheets.
- After touching **🔒 what the teacher keeps** (`keyLocked`, `keyLockedNote`,
  `renderKeyChip`'s locked branch, the guards in `openKeyModal` /
  `toggleKeyPage` / `attachKeyPdf` / `detachKeyPdf`, `assignmentFor`,
  `guidanceRule`, `assignmentsLoaded`, `openPushModal`, `pushWorksheet`'s
  `level` / `locked`, or `startAssignment`'s copy of them), run
  `node tools/tutor-tests.mjs`. The key half fails in the way that matters
  most in this whole app: drop any one of the four guards and a student can
  open the 🔑 window on their copy, untick a page and read the marking
  scheme — through the feature's own settings window, on a screen that looks
  exactly as it should. Let the locked chip go back to listing what is
  hidden and it tells them which pages to go looking for. Release the key
  when a worksheet comes off the class list and taking an assignment down
  becomes a way to hand the answers out. The level half is quieter and still
  wrong: read the lock off the copy instead of the assignment and 💡 Level
  for the class does nothing for anyone who has already started; forget
  `assignmentsLoaded` and either a cold start unlocks the whole class for a
  moment or a withdrawn worksheet stays locked for ever at a level nobody
  can change; and skip the await in `openWorksheet` and the session runs at
  whatever level the copy happens to carry.
- After touching **🗂 the worksheet cover** (`COVER_W`, `COVER_Q`,
  `COVER_MAX`, `coverOf`, `makeCoverDataUrl`, `ensureCover`, `coverSheets`,
  `coverNode`, the `.wsCover` / `.wsSheet` / `.wsFace` rules, or where the
  cover is made in `handleUpload` / `openWorksheet` / `pushWorksheet` /
  `startAssignment`), run `node tools/tutor-tests.mjs` **and look at the home
  screen**. A drawing is the one thing reading the source cannot check, and
  every other failure here is silent. Make it from `pages` rather than
  `studentPages()`, or make it before the key scan, and the front page of a
  marking scheme is on the home screen — the leak the whole 🔑 section exists
  to prevent, through a side door. Skip the white fill and every cover is a
  black rectangle, because a PDF page is transparent where nothing is drawn.
  Turn the size refusal into a cap and a big cover and a big body together
  write a document Firestore rejects — which is the student's work, not the
  picture. Fold it into `performSave` and every auto-save carries it again.
  And let the sheets behind stop being absolute and a four-page worksheet is
  a taller card than a one-page one, on a grid that then reads as broken.
- After touching **📈 student usage** (`USAGE_EVENTS`, `usageLabel`,
  `usageNote`, `usageAdd`, `usageFlush`, `usageStart`, `usageStop`,
  `usageDayKey`, `usageOf`, `usageAccuracy`, `usageRecent`, `openPersonUsage`,
  or any call site that raises an event), run `node tools/tutor-tests.mjs`.
  Every failure here is silent and the panel still fills. A second writer is a
  path whose work shows up in no total, and one that logs a detail bigger than
  a worksheet's name turns a usage record into a transcript of a child's
  answers. A counter written as a number rather than an increment is one tab
  overwriting the other's afternoon. A blank folded into the accuracy reports a
  child who ran out of time as a child who got it wrong. An event key that is
  not in `USAGE_EVENTS` prints its own internal name at a teacher. And
  recording the teacher puts them at the top of their own roster every day,
  which makes the list they opened it for useless.
- After touching **👥 the first sign-in or the roster** (`PEOPLE_COL`,
  `ONBOARD_VERSION`, `APP_FEE`, `onboardNeeds`, `onboardClean`, `onboardValid`,
  `onboardRequire`, `noteSignedIn`, `onboardSave`, `personRow`, `peopleSort`,
  `renderPeople`, or the Esc exemption), run `node tools/tutor-tests.mjs`.
  This one writes into a collection FOUR other apps read, and every way it
  goes wrong is quiet. A write that is not a merge, or a `name` written over
  one a teacher typed in Ans Key, corrupts their roster from over here. A read
  error treated as "already answered" is an account that skips the fee
  question for good; a write error treated as fatal traps a family behind a
  dialog they have already answered. And a second collection invented instead
  of reusing `studentProfiles` needs a rules deploy from another repository —
  which fails CLOSED, so the reads come back empty and nothing on any screen
  says why.
- After touching **✏️ practising the mistakes or the printed sheet**
  (`pracSel`, `mistakesShown`, `pracPruneSel`, `pracSelectedIds`, `pracStart`,
  `pracCheck`, `pracRender`, `pracWorth`, `PRAC_SYS`, `mwsLines`, `mwsBuild`,
  `mwsExport`, `printThis`, or the `.printMe` print rule), run
  `node tools/tutor-tests.mjs` **and print one sheet to PDF to look at it**.
  Every failure is silent and the button still works. A tick that survives a
  filter change puts a question on the sheet the student never chose; a
  selection that is not pruned practises a card that is no longer there. The
  answer revealed before the question has been attempted turns practice into
  reading. A blank marked wrong is the one mistake this whole app is built not
  to make. And the pictures not awaited is the quietest of them: the dialog
  opens, the sheet prints, and the questions are simply not on it.
- After touching **🧭 the diagnostic** (`SYLLABUS`, `syllabusEntries`,
  `diagChoices`, `markSyllabusBlock`, `diagPlace`, `diagItemPlace`,
  `reportDiagnostic`, `diagPct`, `diagResult`, `diagSummary`, `progressRows`,
  `progressFocus`, `diagAsText`, `diagGroupsOf`, the `ctx` on `_markNewItem` /
  `_markFoldRows`, or the `diagnostic` field in `performSave`), run
  `node tools/tutor-tests.mjs`. Every failure here is silent and lands in a
  record the student keeps for years. Snap an off-list reply into the nearest
  topic and a question is filed under the wrong objective for good, on a table
  that looks perfectly complete; drop the id check and a real objective from
  another year is thrown away for the level's first topic. Edit an id — or
  rebuild the catalogue from anything but cer's `SYLLABUS_LO_TOPICS` and the
  Maths app's `MOE_SYLLABUS` — and a weak line here stops naming the objective
  the question banks there are filed under. Stop narrowing to the level and a
  P5 paper is filed across four years' objectives; narrow a subject with no
  list and the marking is handed an empty list, which it fills in. Read the
  rate over the full marks rather than what was attempted and a child who ran
  out of time is reported as a child who got it wrong. Fold the fold's `ctx`
  away and every question is unlisted while the prompt still asks for the id.
  Stop writing `diagnostic` on the save and 📈 My progress is empty for ever
  with nothing to say why; write the items into it instead of the numbers and
  the document holds the marking twice. And add a second AI call anywhere in
  it and the same marked paper stops producing the same diagnostic twice.
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
