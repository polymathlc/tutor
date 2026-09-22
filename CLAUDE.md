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

## 👉 THE TUTOR POINTS AT THE PAGE (v1.30.0, a PAIR of marks since v1.45.0)

`POINT_SHAPES` / `POINT_DEFAULT_SHAPE` / `POINT_SPAN` / `POINT_R` / `POINT_TAIL` / `POINT_INK` /
**`POINT_MAX`** / `POINT_BADGE_R` / `POINT_BADGE_TEXT` /
**`tutorPoints`** / `tutorPointShape` / **`tutorPointMake`** / **`tutorPointsMake`** /
**`tutorPointGeom`** / `tutorPointPaths` / **`tutorPointBadgeAt`** / **`tutorPointShow`** /
**`tutorPointClear`** / `syncTutorPoint` /
**`renderTutorPointOn`** (search `THE TUTOR POINTS AT THE PAGE`), the live half —
**`LIVE_MARK_RE`** / **`livePointSpec`** / **`livePointStrip`** and the `pointPage` / marker LOOP
of `liveFlush` (search `THE POINTER MARKER`) — the `point` field of `HINT_SYS` / `hintLadderFor` /
`askHintAt` and the 👉 button on `hintCard`, plus `.tutorPoint` / `.tpInk` in the stylesheet and
`renderTutorPointOn(p)` inside `renderOverlay`. **Since v1.31.0 it comes down through the shared
`tutorMarksClear()` and is placed with the help of 📐 THE RULER AND THE CROSSHAIR — read both.**

A human tutor does not only talk: they put a FINGER on the page. *"Look at THIS number"* is a
sentence AND a gesture, and a child handed only the sentence has to find the number first — which
is most of what being stuck is. So the tutor circles, underlines, boxes or points an arrow at the
spot it is talking about, in live mode and on a hint alike.

- **IT IS NEVER INK, and that is the load-bearing part.** The gesture is a `g[data-point]` inside
  the page's own SVG, exactly like the marking's ticks — NOT in `annotations`. So it cannot be
  dragged, erased or undone, it is not saved into the body, it never prints, and `drawAnnsOnCtx`
  never draws it. **Put a tutor's circle in `annotations` and the next marking run reads it as the
  student's own work**, agrees with a page the tutor wrote on, and no screen anywhere says why the
  paper marked itself so kindly — the same fault the ticks' own section documents.
- **IT IS TEMPORARY AND NOTHING HERE SETS A TIMER.** It goes up when the tutor says something
  about a spot and comes down when the tutor MOVES ON, through the shared `tutorMarksClear()`: a
  new spoken question (`runLiveDelegation`, at `Thinking…` rather than when the reply lands), a
  new hint (`askHintAt`, BEFORE the pin is pushed), the session ending (beside `liveSubsClear`,
  where the phase becomes `closing`), a new worksheet (`loadPdf`), leaving the worksheet
  (`showView`) and ↻ Practise again. That is what a real finger does,
  it is what the harness's `timers.size === 0` rule requires, and it is why a gesture left
  standing costs nothing: **`pointer-events: none` is load-bearing**, the rule `#liveSubs`
  already carries — this sits over a page a child writes on with a stylus.
- **`_markAt` IS THE ONE READER OF A POSITION** and `tutorPointMake` reuses it rather than parsing
  `[y, x]` a second time: a point the marking would refuse is a point this refuses, and neither is
  ever CLAMPED into the page. A clamped point is a guess, and **a finger on the wrong question is
  worse than no finger at all** — which both prompts say in those words, and the harness counts.
- **THE MAKER CARRIES NO EPOCH; `tutorPointShow` STAMPS IT.** That split is what lets a hint keep
  its own gesture on `h.point`, saved into the body with the hints, and put the same finger back
  months later through the card's 👉 button — a gesture with the epoch baked in would be stale
  the next time the worksheet opened. `renderTutorPointOn` checks the epoch, the rule every
  floating box here carries.
- **ONLY THE 👉 BUTTON SCROLLS** (`tutorPointReveal`, one declaration and exactly one caller). A
  live reply points at the page the student is ALREADY looking at — `worksheetContextPages` orders
  by visible area — and a hint is about the spot they just tapped, so neither needs it; a
  worksheet that scrolled itself while a child was writing on it would be the app taking the page
  away from them. Somebody pressing *show me where to look* has asked for exactly that.
- **ONE POINT STILL HAS TO LOOK DELIBERATE** (`tutorPointGeom`, pure). A model that names a spot
  and no second point is the ORDINARY case — it knows where the question is, not how wide the
  words are — so every shape has a fallback size. An arrow's HEAD is always the spot (a tail that
  had to be supplied would make every one-point arrow useless); an underline always runs LEVEL on
  the first point's line even when handed the far corner of a box, or a rule that sloped down the
  page reads as a line struck THROUGH the words; a box given its corners backwards still has
  positive sides; and the circle is an ELLIPSE, because what it goes round is a line of words.
- **AN UNKNOWN SHAPE BECOMES THE CIRCLE**, which claims the least: it says *here*, where every
  other shape also says what KIND of thing is here and can be wrong about it.
- **A GESTURE ALREADY ON THE PAGE IS LEFT ALONE, AND IT IS NEVER DETACHED.** `renderOverlay`
  rebuilds the whole layer on EVERY committed stroke, so a node rebuilt with it restarts its
  fade-in and the finger FLASHES each time the child writes a word. Two things stop that and both
  are needed: `want` (the node's own `data-point`, which is the gesture's identity AND the zoom,
  because the stroke width is baked into the path) makes `renderTutorPointOn` leave a node that is
  still right; and the WIPE STEPS OVER IT (`tutorNodes`, which since v1.31.0 matches
  `g[data-point], g[data-work]`) rather than removing it, because taking a
  node out of the document CANCELS its CSS animation — lifting it out and putting it back, the way
  the box being typed in is handled, flashes exactly as a rebuild does. That is why the finger is
  `insertBefore`d as the FIRST child: it sits UNDER the student's own ink, so their work is never
  covered and the z-order is the same whether it was just drawn or has survived a wipe. The stroke
  width is screen pixels over the zoom, like the pins, so the finger is the same weight at
  fit-width and at 400%.
- **THE BREATHE SETTLES** (`3 both`, never `infinite`). A shape pulsing for ever beside the
  question a child is working on is one they stop being able to ignore, and it needed an iteration
  count rather than a timer to stop. `prefers-reduced-motion` drops both animations.
- **A WHITE HALO UNDER THE INK, NOT A DROP-SHADOW.** This is drawn over printed text, and magenta
  on black serifs is a line nobody can see. It costs one more path and no filter.

### ① ② TWO PLACES AT ONCE — the comparison (v1.45.0)

*"Can the AI be more like Brilliant's Koji — actually draw boxes to show where I should be
looking?"* It could draw one box. **It could not draw the PAIR**, and the pair is the interesting
half: *"compare the first input with the first output"* is not a sentence about one spot, so a
tutor saying it boxes BOTH. `tutorPoint` was a SINGLETON, so a second gesture silently REPLACED
the first — on a hint only the last survived, and in live mode a reply opening with two pointer
markers put up the second while the tutor's words named a mark nobody could see.

- **`tutorPoints` IS A BOUNDED LIST, AND THE BOUND IS THE POINT OF IT.** `POINT_MAX` (3) is what
  a comparison needs; past it the words are doing the work, and **a page under six boxes says
  nothing at all about where to look** — which is worse than the singleton ever was. It is capped
  in `tutorPointsMake` AND again in `tutorPointShow`, because a caller that reached past the maker
  must not be able to flood the page.
- **`tutorPointShow` TAKES ONE GESTURE OR A LIST, and that is the whole migration.** Called with
  one object it is byte-for-byte what it always was — so every call site written before v1.45.0 is
  untouched, and **a hint saved before it still puts its one finger back**, because `h.point` is a
  single object on every hint in every body written until now. The rule `shelfGroups(opts)` and
  `fileMistakes(opts)` already carry, applied to the one writer.
- **ONE `made` FOR THE WHOLE GROUP, from ONE reading of the clock.** The node's identity is built
  from it, so every mark of one group is ONE `g` with ONE fade-in: **two boxes that arrive a beat
  apart read as two separate statements rather than as the one comparison they are.** Pinned in
  the SOURCE rather than on the clock, because two `Date.now()` calls in the same millisecond
  agree by luck and a model-level check would pass on the very build that broke it.
- **ONE NODE FOR EVERY MARK ON THE PAGE**, and that is load-bearing twice: `renderOverlay`'s wipe
  steps over `g[data-point]` rather than detaching it (a detached node loses its animation), so a
  node per mark would be a fade-in per mark and the whole "left alone when the overlay rebuilds"
  rule would have to hold for several nodes at once instead of one.
- **THE NUMBERS COUNT THE WHOLE GROUP, never this page's share of it.** A pair split over a page
  break must still be ① and ②, or the tutor's own words name the wrong one — on a page that looks
  perfectly convincing. The badge is drawn ONLY where the group holds more than one, so **a lone
  gesture is byte-for-byte the drawing it has always been**, and it carries no `tpInk`: a digit
  breathing in and out is a digit nobody can read.
- **THERE IS DELIBERATELY NO LINE BETWEEN THEM.** A magenta rule from one box to the other is
  struck across whatever is printed in between — precisely the fault the underline's own "always
  level" rule exists to prevent — and it gets worse the further apart the two marks are, which is
  exactly when a reader most wants the link. The NUMBERS do the linking and the tutor's own words
  name them; the badge sits BESIDE its mark (an arrow's on its TAIL, because its head IS the spot).
- **ONE UNREADABLE SPEC IS DROPPED AND ITS PARTNER STILL GOES UP.** One half of a comparison is a
  poorer answer than both halves and a better one than neither, and a gesture that landed nowhere
  was never one of the halves. **Nothing readable at all comes back NULL, never an empty list** —
  an empty array is truthy, so the hint card would grow a *show me where to look* button with
  nothing behind it.
- **A RUN OF LIVE MARKERS IS ONE GROUP, AND THE GROUP LIVES FOR THE WHOLE REPLY.** `liveMarkApply`
  gained a `batch`: given one a gesture is PUSHED and the caller shows the whole group, and called
  without one it shows straight away exactly as before. The array is declared beside `pointPage`,
  in `runLiveDelegation`'s own scope, because **the stream can cut a run of markers in half** — the
  first flush consumes one, meets an unclosed `[[` and waits — so a group collected per FLUSH shows
  the second marker alone and the pair is silently half a pair. `grew` is what stops a flush that
  read no marker re-stamping the group and blinking the marks all the way through the reply.
  Working is never batched: two blocks of working beside one question is a lecture.
- **BOTH PROMPTS SAY WHAT A SECOND MARK IS FOR, and both must also ASK for one.** A comparison the
  student cannot get past without — never a second thing that happens to be interesting. A prompt
  carrying every rule about a pair and nothing that says to write one is this half quietly not
  existing, on a build whose every other pin is green.

### The two producers

- **A HINT CARRIES ITS GESTURE IN THE JSON IT ALREADY ASKS FOR** — one more field on `HINT_SYS`'s
  shape, read back through `tutorPointsMake(res.point, p.num)` and nowhere else (it was
  `tutorPointMake`; the field is a LIST since v1.45.0 and the maker takes either shape). It is measured on
  the WHOLE-PAGE picture `hintImagesFor` builds, which is why the page number is this page's. The
  prompt says **point at the QUESTION, never at the answer**: a finger on where the answer goes is
  the ladder's own hole through a side door.
- **A SPOKEN REPLY IS TEXT, STREAMED, so there is no second field to put a gesture in** — a reply
  asked for as `json` is never streamed at all, and the tolerant parser is the one thing that
  makes a truncated one survivable. So the tutor opens with a marker, `[[point p3 412,300
  underline]]` (or two of them, for a comparison), and **it is consumed off the FRONT through the
  very same `cursor` the opening filler is**: dealt with without being spoken, and unable to come
  back as part of the remainder.
- **AN OPEN `[[` WITH NO CLOSE YET WAITS**, before a single character is taken. Without it a
  half-written marker that happens to contain what reads as a sentence end is CONSUMED, the rest
  of it is then no longer at the front, and the closing brackets are read aloud to a child while
  the gesture never goes up at all. Both halves of that are silent in the source.
- **THE PARSE IS FORGIVING AND THE STRIP IS NOT.** `livePointSpec` takes the numbers and the shape
  however they were written — and takes the `p3` OUT of the string first, or its own digits are
  read as the first coordinate and the finger lands at the top of the page. `livePointStrip` then
  removes ANY `[[…]]` anywhere in a chunk, and an unclosed one at the end, before the speaker sees
  it: **"open bracket open bracket point four one two" read to a child is the one thing this must
  never do.** A single `[` is prose and survives — a child reading "[3]" out of a question would
  lose it otherwise.
- **A MARKER THAT NAMES NO PAGE MEANS THE DOMINANT ONE.** `pointPage` is `imagePages[0]`, and
  `worksheetContextPages` orders by VISIBLE AREA, so that is the page the student is looking at.
  It is assigned before the request starts, which is the only moment `onStream` could fire. With
  no page to fall back on the marker is REFUSED rather than drawn on page one.
- **THE MARKER IS MEASURED ON A PICTURE CARRYING THE GRID** (`pageJpegForModel`), and the hint's
  own is measured on the picture the request NAMES BY NUMBER rather than by ordinal — see 📐 THE
  RULER AND THE CROSSHAIR, which is where both of v1.30.0's placement faults were.
- Run **`node tools/tutor-tests.mjs`**, **`node --test tools/live-tutor-tests.mjs`** and
  **`node --test tools/writing-tests.mjs`** after touching any of it — **and watch one live
  session**: where a finger lands on a real page is the one thing reading the source cannot check.

## 📐 THE RULER AND THE CROSSHAIR — how a model is told WHERE (v1.31.0)

`GRID_STEP` / `GRID_LINE` / `GRID_TEXT` / `TAP_R` / **`drawPageGrid`** / `gridLabel` /
**`tapMarkSpot`** / `drawTapMark` / **`pageJpegForModel`**, the `mark` argument on `bandDataUrl` /
`bandJpeg`, the `role` on every entry of **`hintImagesFor`**, and the two lines
`hintLadderFor` pushes about the ring and the image number (search `THE RULER AND THE
CROSSHAIR`).

👉 v1.30.0 shipped the finger and it landed in the wrong place, twice over. **Both faults were in
what the app TOLD the model about the picture, not in anything it drew.**

- **A CHILD TAPPED QUESTION 12 AND WAS HANDED A HINT ABOUT QUESTION 11**, with the hint pin sitting
  perfectly correctly on question 12 the whole time. `hintImagesFor` builds the close-up from 220
  page units ABOVE the tap to 320 BELOW it, so the tap sits about two fifths of the way down —
  and `hintLadderFor` said *"They tapped near the top of the close-up image."* The model read the
  question at the top of the band, which is the question BEFORE the one that was tapped. **Saying
  "two fifths down" instead would be no better**: nobody measures two fifths by eye. So the tap is
  DRAWN — a magenta ring on the close-up and on the whole page — and the request says that ring is
  the spot, which question that makes it (*the one the ring sits inside, or the one DIRECTLY ABOVE
  it when the ring is on a blank answer line*) and, in as many words, **never the question above
  that one**.
- **THE UNDERLINE LANDED A LINE OR TWO OUT**, because `[y, x]` from 0 to 1000 was being ESTIMATED
  on a photograph carrying no reference marks at all. The picture the model measures on now
  carries **the grid it is being asked to measure in** — a faint teal line every 100 units, the
  numbers printed down the left margin and across the top — and the estimate becomes a READING.
  The ends are deliberately NOT labelled: 0 and 1000 are the picture's own edges and both prompts
  say so, while two "0"s in one corner is either a collision or a calibration mark nudged a few
  per cent off the line it names.
- **AND `HINT_SYS` NAMED THE PICTURE BY ORDINAL** — *"the second picture, not the close-up"* —
  while `hintImagesFor` builds its list CONDITIONALLY. On a page whose close-up could not be made,
  the second picture is **the page before**: the gesture was then measured against one page's
  layout and drawn onto another's, in silence. Every image carries a `role` now, and
  `hintLadderFor` states the number that picture really has.

- **`compositeJpeg` IS DELIBERATELY LEFT ALONE, and `pageJpegForModel` is a function of its own
  for exactly that reason.** The marking run, the mistake book, the cover and the printer all read
  that one, and a ruler drawn across a child's printed worksheet is the same leak through a side
  door the whole 🔑 section exists to shut. The `mark` on `bandDataUrl` is OPTIONAL, so every
  older caller gets byte-for-byte the band it always got.
- **NOTHING HERE TOUCHES THE PAGE THE STUDENT SEES.** It is painted onto a canvas copy inside
  these functions — never into `annotations`, never onto `p.canvas`, never into the SVG — the rule
  the marking's ticks and the tutor's finger already carry.
- **BOTH PROMPTS SAY THE GRID IS THE APP'S AND NOT THE PAPER'S.** A model that reads "300" off the
  margin and into the question it transcribes has invented a number in a maths question — and that
  question then travels into the hint, the 🧩 keyword check and the mistake book. Hence the teal: a
  worksheet is black on white, so the one colour on the page no printer put there is the one the
  labels are written in.
- **THE PREVIOUS PAGE GETS NEITHER.** Nothing is measured on it, and a ruler drawn there is an
  invitation to measure.
- **THE LIVE PAGES GO THROUGH THE RULER TOO** (`pageJpegForModel(p, LIVE_PAGE_PX, …, null)`) —
  there is no tap in live mode, so no crosshair.
- **`tapMarkSpot` IS PURE**, and it is the half worth pinning: a crosshair that forgets the BAND's
  own top is a crosshair on the question above, on a picture that still looks perfectly
  convincing.
- Run **`node tools/tutor-tests.mjs`** and **`node --test tools/live-tutor-tests.mjs`** after
  touching any of it — **and ask for one hint on a real page**: whether the ring lands on the
  question that was tapped is the one thing reading the source cannot check.

## ✍️ THE TUTOR WRITES WORKING ON THE PAGE (v1.31.0)

`WORK_RUNG` / `WORK_LINES_MAX` / `WORK_CHARS_MAX` / `WORK_SIZE` / `WORK_LEAD` / `WORK_CHAR_W` /
`WORK_PAD` / **`WORK_MAX_W`** / `tutorWork` / **`tutorWorkAllowed`** / **`tutorWorkLines`** /
**`tutorWorkMake`** / **`tutorWorkSteps`** / `tutorWorkMore` / **`tutorWorkNext`** /
`tutorWorkRestart` / **`tutorWorkGeom`** / **`tutorWorkShow`** / `tutorWorkClear` /
`syncTutorWork` / **`renderWorkStep`** /
**`tutorMarksClear`** / **`renderTutorWorkOn`** (search `THE TUTOR WRITES WORKING ON THE PAGE`),
the live half — **`LIVE_MARK_RE`** / **`liveWorkSpec`** / **`liveMarkApply`** and the marker LOOP
at the head of `liveFlush` — the `work` field of `HINT_SYS` / `hintLadderFor` / `askHintAt`, the
button on `hintCard`, `.tutorWork` and **`#workStep`** in the stylesheet, the **`#workStep`** chip
beside `#mthPad`, the step arm of **`floatBoxLayout`**, and `renderTutorWorkOn(p)` inside
`renderOverlay`.

*"Human teachers can do working on the paper to help the students."* They do — two or three lines
in the margin, *"3 units = 12, so 1 unit = ?"* — and a child can SEE the shape of the method and
finish it themselves. So the tutor writes it, on a hint and while it is talking in live mode.

- **IT IS NEVER INK**, exactly like 👉 the finger and for exactly the same reason: a
  `g[data-work]` inside the page's own SVG, never in `annotations`. **Put the tutor's working into
  `annotations` and the next marking run reads it as the STUDENT'S own work**, agrees with a page
  the tutor half-solved, and no screen anywhere says why the paper marked itself so kindly.
  `drawAnnsOnCtx` never draws it, it never saves, it never prints.
- **IT SITS ON THE METHOD RUNG**, the very rung `MTH_MODEL_RUNG` puts the drawn bar model on —
  working set out IS the method. `tutorWorkAllowed()` asks the LADDER, and **`tutorWorkShow` asks
  it AGAIN** in the ONE door every producer goes through: a prompt is not a lock, and a model that
  writes working nobody asked for must not be able to hand over a rung the parent switched off.
- **IT ALWAYS STOPS ONE STEP SHORT.** Below the answer rung the last line must carry a `?` or the
  whole block is **REFUSED** (`tutorWorkLines`). Working that runs to the answer is the answer with
  a pencil round it — the hole `mthModelBlanks` and `kwQuizGivesAnswer` exist to shut — and
  refusing is the safe way to be wrong: nothing is drawn and the hint's own words still say
  everything they said before. **Trimming the last line instead would be worse than either**,
  because a chain cut short still ends one step further on than it should and nobody wrote what is
  left. Past `WORK_LINES_MAX` the FIRST lines and the LAST one are kept, never simply the first N:
  the last line carries the `?`, and dropping it turns an invitation into a lecture.
- **IT SHARES THE FINGER'S ONE CLEAR.** `tutorMarksClear()` takes both marks down, so the six
  places the tutor MOVES ON stay six rather than twelve — a new spoken question, a new hint, the
  session ending, a new worksheet, leaving the worksheet, and ↻ Practise again. **Miss one of
  twelve and working about a question nobody is on any more sits on the paper**, which is exactly
  the failure the finger's own section warns about, kept from doubling. Nothing but that one
  function calls either half, and the harness counts.
- **THE ANCHOR IS NEVER CLAMPED AND THE BOX ALWAYS IS**, and the difference is the point. The
  anchor goes through `_markAt` like every other position here, so a block the marking would
  refuse is refused — working beside the wrong question is worse than no working at all. The BOX
  is then nudged back onto the paper when it would hang off the right-hand or bottom edge, because
  a note half off the page is unreadable and a centimetre cannot change which question it is
  beside.
- **A NOTE ALREADY ON THE PAGE IS LEFT ALONE, AND IT IS NEVER DETACHED.** Same two halves the
  finger needs: `want` (`data-work` + the zoom) makes `renderTutorWorkOn` leave a node that is
  still right, and `renderOverlay`'s wipe STEPS OVER it — `tutorNodes` now matches
  `g[data-point], g[data-work]` — because taking a node out of the document cancels its CSS
  animation. It is `insertBefore`d as the FIRST child, so it sits UNDER the student's own ink.
- **IT FADES IN AND NEVER BREATHES.** A gesture has to be FOUND; a note is read once and referred
  back to, and a block of text pulsing beside the question a child is working on is the one thing
  on the page they could not ignore.
- **MODEL OUTPUT IS PAINTED AS TEXT** (`textContent`), and **`pointer-events: none` is
  load-bearing** — this sits over a page written on with a stylus.
- **The maker carries NO epoch**, the split `tutorPointMake` makes: a hint keeps its own on
  `h.work`, saved into the body, and the card's button puts it back months later. The button is
  drawn when EITHER mark exists and says which — a hint can carry working and no gesture, and a
  button drawn only for the finger would leave that working with no way back onto the page.
- **`tutorWorkMake`'s `answerOk` defaults to STRICT**, so a caller that forgets it gets the answer
  that cannot hand over the answer. Every call site passes `mthAnswerAllowed()` — the ladder is
  read in the ONE place that reads it, never tested a second time here.

### ▸ ONE STEP AT A TIME, IN A SMALLER NOTE (v1.49.0)

The block was drawn WHOLE — six lines at 44 characters, which at the old text height was a note
most of the way across the paper AND the entire method handed over in one go. **A tutor does not
write the method out and walk away**: they write a line, the child works, and the next line goes
down when it is asked for. So the block is still MADE whole and is REVEALED one line at a time.

- **`tutorWorkSteps(w)` IS THE ONE PLACE HOW MANY ARE SHOWING IS DECIDED**, and the renderer, the
  chip and both advancers read it rather than each doing the arithmetic. **A step that is not a
  number shows EVERYTHING**, which is the safe way to be wrong here: a note one line too long is
  still the method, and one showing none is an empty box drawn on a child's paper.
- **THE MAKER STAYS STEP-FREE AND `tutorWorkShow` STAMPS THE 1**, exactly as it stamps the epoch
  and `made` — the split `tutorPointMake` already makes. That is what lets a hint keep the WHOLE
  method on `h.work`, save it into the body, and put it back months later **at line one**; a block
  with the step baked in comes back already half read. It is also why a block that has never been
  SHOWN draws all of its lines: nothing has begun revealing it, so there is nothing to hold back.
- **NEITHER ADVANCER SETS A TIMER**, the whole section's rule. The next line goes down when the
  student asks for it and not a moment sooner, because the pause between two steps is the part
  they are meant to be doing the work in. Each returns whether it really MOVED, so a caller never
  leaves a control up that would do nothing.
- **THE WIDTH IS MEASURED ON THE WHOLE BLOCK AND THE HEIGHT ON WHAT SHOWS.** Sized to the revealed
  lines alone the note would change width on every step and shuffle sideways under a child reading
  it; growing only DOWNWARDS is what makes the stepping read as one note filling in rather than as
  a new note each time.
- **…AND THE CORNER IS CLAMPED AGAINST THE BLOCK'S FULL HEIGHT**, never against the part showing.
  Clamped against what is drawn, a note near the foot of the page is pushed UPWARDS a line at a
  time as it fills in — the note crawling up the paper while it is read. Room for every line is
  reserved from the first, so the top-left never moves.
- **THE STEP IS PART OF THE DRAWN NODE'S IDENTITY** (`w.made + ':' + tutorWorkSteps(w) + ':' +
  zoom`). The rule above leaves a node alone while its `data-work` still matches, so a `want`
  built from the stamp and the zoom alone leaves the note showing one line for ever while the
  chip counts up beside it.
- **THE NOTE SAYS THERE IS MORE**, and that is not decoration. It takes no pointer, so the thing
  that ADVANCES it is elsewhere on the screen — and a child who has read one line and been shown
  nothing to say a second exists has been handed a method that stops in the middle, which reads
  as the tutor having finished.
- **`#workStep` IS THE ONE CONTROL THAT FILLS IT IN, AND IT IS BOTH SURFACES' AT ONCE.** A button
  on the hint card would leave live mode with no way to ask for the next line; this is drawn from
  `syncTutorWork`, so a step moved anywhere repaints it — a step moved without the chip repainted
  is a chip counting a line that is not there. **`pointer-events: none` on the BAR and `auto` on
  the button** is the split the picture tools carry and is load-bearing for the same reason: the
  bar is wider than the button in it. **A one-line note gets no chip at all** — there is nothing
  to reveal — and at the last step it offers the note AGAIN rather than vanishing, because a
  control that disappears at the moment it finished is one nobody can find a second time.
- **IT STANDS BOTTOM-RIGHT**, the one corner the other floating things leave free: the orb, the
  🧩 keyword check and the ✏️ maths pad are all bottom-left, and the subtitles and the mic bar are
  bottom-centre. On a phone those boxes go full width, so **`floatBoxLayout` lifts the chip clear
  of whichever one is open** exactly as it lifts the subtitles — that function already reads both
  boxes, and a chip buried under the maths pad is the one control that fills the working in,
  unreachable.
- **BOTH PROMPTS ARE TOLD THE LINES ARE REVEALED ONE AT A TIME**, and that is not a nicety: a
  model that does not know it writes half a step per line, or two steps on one, and the note then
  reads as nonsense until the last line is down. They ask for at most FOUR lines of at most 34
  characters, and say fewer and shorter is better.

### The live marker, and why it is a RUN

- **`LIVE_MARK_RE` replaced `LIVE_POINT_RE`**, which knew only the finger, and `liveFlush` consumes
  a **RUN** of markers off the front rather than one. **A reply from a route with NO STREAM behind
  it — either backup engine — is spoken through `liveFlush(true)` ONCE**, so a loop that took one
  marker left the second to be scrubbed away by `livePointStrip` and the note never went up at
  all, in silence. That is the case the harness tests on its own, because streaming hides it: a
  second flush takes the second marker.
- **AN OPEN `[[` WITH NO CLOSE YET STILL WAITS**, before a single character is taken.
- **`liveWorkSpec` reads the position from the segment BEFORE the first `|`**, so the digits inside
  *"3 units = 12"* can never be read as a coordinate — and it takes the `p3` out first, the rule
  `livePointSpec` already carries. A marker with no lines is refused: an empty note is a rectangle
  drawn on a child's worksheet saying nothing.
- **`liveMarkApply` is the ONE dispatcher**, so the two kinds are told apart in exactly one place
  and a third added later is one branch rather than a second copy of the loop.
- **`livePointStrip` already removes ANY `[[…]]`**, so it covers the working marker too:
  *"open bracket open bracket work p three"* read to a child is the one thing this must never do.
- Run **`node tools/tutor-tests.mjs`**, **`node --test tools/live-tutor-tests.mjs`** and
  **`node --test tools/writing-tests.mjs`** after touching any of it — **and watch one live
  session**: where a note lands on a real page is the one thing reading the source cannot check.

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

### The symbol strip is ONE row, and a key has to earn its place (v1.29.1)

- **IT WAS FOUR ROWS AND THIRTY KEYS** — Working, Compare, Number, Shape —
  and a wall of symbols is a wall nobody reads: a child stuck on question 7
  needs × and ÷ to write the next line, and ⊥, ⅔ and ≈ were in the way of
  the four keys they came for. `MTH_SYMBOLS` is one row now.
- **THE TEST A KEY HAS TO PASS IS BOTH HALVES: hard to type on a school
  keyboard, AND part of a line of working.** `<`, `>`, `%` and `:` fail the
  first; a comparison, a shape and a number form fail the second. **The
  degree sign is the one exception and is KEPT**, moved into the working
  row: unreachable on a school keyboard, and it ends an ordinary P5 answer.
  **Adding a row back is adding the wall back**, and the harness pins the
  whole row against that rule rather than only its length.
- **THE KEYS ARE SMALL, WITH THE PHONE AS THE FLOOR.** `.mthKey` shrank with
  the rows, and the `max-width: 900px` block puts the old size back: the pad
  is a SHEET a child taps with a finger there, while a desktop and an iPad
  are a mouse or a pencil. Shrink the touch sheet too and a learning aid
  becomes one they keep mis-hitting.

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
  `wrong` and `partial` lands in `users/{uid}/mistakes/{id}` with a picture — and since v1.34.0 so
  does every blank the student went PAST (🕳 below).
- **🕳 A BLANK WITH ANSWERED QUESTIONS AFTER IT IS THE ONE BLANK THAT IS A MISTAKE** (v1.34.0 —
  `markLastAnswered` / **`markSkipped`** beside `_markFields`, the `due` walk and the `skipped`
  field in `fileMistakes`, **`mistSkipped`** beside `mistPlace`, and the `.mSkip` CSS). A student
  who reaches question 7, cannot do it, and goes on to answer 8 and 9 has said plainly that they do
  not know how; a student whose LAST four are blank has run out of time or put the pen down. Filing
  the tail would be a book of questions nobody has failed at; filing NEITHER — which is what this
  app did until v1.34.0 — loses the questions a child is most stuck on, on a screen saying the book
  is up to date.
  - **`markLastAnswered` IS THE WHOLE TEST, and it is the LAST answered question rather than the
    next.** Everything after it is the tail however long; every blank before it was gone past,
    including a RUN of them — *"is the question after this one answered?"* files only the last of a
    run and silently loses the rest. A **correct** answer ends the tail exactly as a wrong one
    does: the test is whether they CARRIED ON, not how what came after went.
  - **IT READS THE ORDER OF `marking.items`, WHICH IS PAPER ORDER** — the batches are read in page
    order and `_markFoldRows` appends, so an index IS a position on the paper. Sort by question
    number instead and 10 comes before 2 on any paper numbered as papers are, filing the wrong half
    of it on cards that each look perfectly ordinary.
  - **NOTHING ABOUT THE MARKING MOVES.** `_markFields` still drops the verdict, the feedback and
    the cross on a blank; the marks chip still says what was there to be had; the report still
    counts it blank and the diagnostic still rates over what was ATTEMPTED. **A red cross on an
    untouched question is still the one mistake this app must never make** — which is why the card
    is INDIGO with a *⬜ Skipped* chip rather than the red of a wrong answer, and why the whole
    thing is a field on the mistake rather than a fourth verdict.
  - **`skipped` IS A FLAG ON THE DOCUMENT AND `mistSkipped` IS ITS ONE READER.** The row carries no
    verdict and no feedback to infer it from, so a surface left to guess would read an unjudged
    ANSWER as a skip the day one is ever filed. A mistake written before v1.34.0 carries no flag and
    is exactly what it always was.
  - **A SKIPPED CARD SAYS HOW IT GOT THERE.** It has nothing in the two boxes a marked card fills,
    so without a word on it it is a bare question sitting among marked ones. Its explanation is
    labelled *Where to start* rather than *Why* when there is no answer beside it — below the top
    help level a blank comes back with a nudge where its answer would be (`markBlankRule`), and a
    skipped question meets that case far more often than a wrong one ever did.
  - **THE PRACTICE MARKER IS TOLD THERE WAS NO FIRST ATTEMPT.** `PRAC_SYS` opens *"after getting it
    wrong"*; unqualified, *"a big improvement on last time"* is praise to a child who left it blank
    for something that never happened.
  - **They come out of the SAME rebuild ration** (`MB_BUILD_MAX`, 10 a paper), so a paper with a
    dozen unanswered questions spends it sooner and the rest land on tier ③ — which is what
    🧩 Set it out again is for.
- **🖼 THE PICTURE IS REDRAWN, THE WAY ⚡ RAPID ADD DOES IT** (v1.35.0 —
  `AI_IMAGE_MODELS` / `window.askGeminiImage` / `window.imageAiReady` in the module,
  `SCAN_SOURCE_PROMPT` / `MB_ENHANCE_PROMPT` / `MB_ENHANCE_MAX` / **`mbEnhance`** /
  `_paperWhitePoint` / **`_paperCleanPixels`** / `_paperCleanDataUrl` / **`_mbQuestionCrop`**
  beside the rebuild). A crop of a child's photograph is grey paper, weak toner and a shadow
  down one edge; redrawn as black line work on white it is a question they can read on a phone
  and a teacher can print. The crop machinery here was already the Science portal's, ported
  under the same identifiers — this is the half that was missing.
  - **THERE IS NO KEY BOX IN THIS APP AND THERE NEVER WILL BE.** It goes through Firebase AI
    Logic exactly as `askGemini` does, App Check'd and server-keyed, so a student's phone gets
    it with nothing set up on it. The browser-key ChatGPT Images route the sibling apps carry is
    deliberately NOT here — see 🤖 above.
  - **`mbEnhance` IS THE ONE DOOR AND IT NEVER THROWS.** The picture IS the question and the
    clean-up is a luxury on top of it, so no budget, no model, a reply with no picture in it and
    a worksheet closed mid-call all hand back the crop that came in. A rebuild that died because
    an image model was busy would cost the student the question itself.
  - **`SCAN_SOURCE_PROMPT` IS THE SAFETY HALF AND IS PORTED WHOLE.** A model told only "clean
    this up" renders the scanning damage beautifully or invents the axis value the scan
    destroyed. It says at length what is DAMAGE and what is the drawing, then says twice not to
    invent — **a number added to a maths question on its way into the book is one the student
    then gets wrong a second time, for a reason nobody can see** — and it forbids answering,
    ticking or writing on the question it is redrawing.
  - **🧻 THE WEAVE COMES STRAIGHT BACK OUT** (`_paperCleanDataUrl`). An image model has no flat
    white: it PAINTS the background and its decoder leaves a faint texture a few units under the
    paper — invisible at 300px and a grey wash the moment a practice sheet is printed. The pass
    is a white-point clamp, it is ALL-OR-NOTHING (half-cleaned is worse than left alone), and
    its three refusals are three pictures it must not touch. **Nothing at or below
    `PAPER_INK_MAX` is ever written to, by construction** — "the pass ate the diagram" is the one
    failure that looks like a beautifully clean picture. Ported from `polymathlc/cer`; ship a
    change to both.
  - **③ THE WHOLE-PAGE TIER IS DELIBERATELY LEFT ALONE.** A whole page handed to an image model
    is where invention is likeliest and least checkable, and it is the tier nobody chose.
  - **THE RATION IS PER RUN** (`MB_ENHANCE_MAX`, 14), spent BEFORE the call so a failure cannot
    buy another, and refilled at the two doors that start a batch (`fileMistakes` and `mbRedo`)
    and nowhere else. They cannot overlap — one runs inside a marking run, the other behind
    `_mbRedoBusy`.
  - **`_mbUpload` NAMES THE PICTURE FOR WHAT IT IS.** A redrawn crop is a PNG (line work
    re-encoded as JPEG rings along every edge), so a path that always said `.jpg` would name a
    PNG as a JPEG for ever. Every caller handing over a JPEG is byte-for-byte unaffected.
- **📕 THE TEACHER SEES WHAT THE CLASS IS GETTING WRONG** (v1.35.0 — `MIST_MIRROR_MAX` /
  **`mistakeMirrorRow`** / **`mistakeMirrorSync`** / `mistakesOf` beside `mistakeImageUrl`, and
  `mistMirrorRowNode` / `mistMirrorGroups` / **`openClassMistakes`** beside `peopleAsText`).
  The most useful thing this app makes lived in ONE account: the student's own.
  - **IT IS A MIRROR AND THE STUDENT'S OWN BOOK IS STILL THE TRUTH.** Every mistake stays under
    their own uid with its pictures; what travels is a compact TEXT row onto
    `studentProfiles/{uid}` — the roster document this app already writes and the admin already
    reads. **SO IT NEEDS NO FIRESTORE RULES CHANGE AND NO DEPLOY**, which is the whole reason it
    is shaped this way: those rules live in `polymathlc/math`, are shared with five apps, and a
    collection nobody has written a rule for fails CLOSED — the write is denied, the read comes
    back empty, and nothing on any screen says why.
  - **⚠️ IT IS A DELIBERATE REVERSAL of 📈 WHO DID WHAT's "never a question, never an answer".**
    Reversed for the TEACHER and nobody else: the collection is readable by the admin and by the
    account it belongs to, every panel is behind `isAdmin(currentUser)` **and refuses in its own
    handler**, and the mirror is never written by the teacher's own device. **Anything added to
    `mistakeMirrorRow` is added to what leaves a child's device** — the harness pins its key list
    by name, so a field nobody decided to send fails the run.
  - **🖼 THE PICTURES TRAVEL AS LINKS, NEVER AS PATHS** (v1.50.0 — `mistakePathUrl` /
    `mistakeFigUrls` / **`mistakeMirrorFill`** / `mistakeMirrorNeedsLinks` / `mistakeMirrorCatchUp`
    / `_mkUrl`, the `img` / `sh` / `figs` on the row, and the `imageUrl` / `figUrls` `fileMistakes`
    writes). A PATH is a Storage object under the student's own uid that the admin cannot read
    without a rule this app is not going to ask for, so one in the row is a grid of broken images
    — which is why for three versions the row was text alone and both panels said so. A
    **download URL** is a different thing: `getDownloadURL()` mints a link whose TOKEN is what
    grants the read, so the student's own device mints it and the link is what travels. **No
    Storage rules change and no deploy**, which is the constraint this whole mirror is shaped by.
    - **IT IS MINTED ONCE AND KEPT ON THE MISTAKE** (`imageUrl`, `figUrls`) — at creation for a
      new one, and by a bounded backfill for a book filed before this existed. The mirror rewrites
      the WHOLE book on every change, so resolving as it went would be a hundred and fifty network
      calls each time a student ticked one question off.
    - **A RESOLVE THAT FAILED IS NOT WRITTEN AS DONE.** The file may be gone (it fails for ever,
      which `MIST_MIRROR_FILL` bounds) or the network may have blinked (it works next time), and
      writing `''` to mark it done turns the second case into the first. `_urlTried` stops it being
      retried again within the one session.
    - **`mistakeMirrorCatchUp` ASKS FIRST.** The mirror is written when the book CHANGES, and
      none of those happens to a student who merely opens the app — so without it the pictures of
      everything already filed would arrive only on the next marking run, which for a class at
      the end of term is never. A sync on every sign-in whether or not it had anything to do is a
      write a hundred students make every morning for nothing.
    - **🧩 SETTING A QUESTION OUT AGAIN RE-MINTS THEM** (`mbRedoOne`). It writes a new
      `imagePath` and new `blocks` and then **DELETES the old file**, so a stored `imageUrl` left
      alone points at a picture that is gone — and the panel quietly drops it, showing the teacher
      NO picture on the one question somebody has just taken the trouble to redo. A stale
      `figUrls` is worse: those links still resolve for a while and show the picture the rebuild
      REPLACED. They are cleared with a `delete()` sentinel FIRST and set only on success, the
      sentinel is kept off the in-memory mistake (it would go straight into the next row as the
      picture), and `_urlTried` is released so the catch-up tries again on the next visit.
    - **`_mkUrl` TAKES AN `https` LINK AND NOTHING ELSE.** What comes back goes into an `<img src>`
      on the teacher's screen, and a roster row is a document another app could write to.
    - **THE PANEL FOLLOWS `mistakeTier`'s OWN RULE**: a rebuilt question shows its FIGURES and not
      the whole-question crop as well, because the crop IS the same question and the teacher would
      be reading it twice looking for a difference that is not there. A whole PAGE is CAPTIONED as
      one, or a teacher is pointed at the wrong question.
    - **THE BYTE BUDGET IS NOT OPTIONAL** (`MIST_MIRROR_BYTES`). A row carries links now and a
      Firestore document dies at a megabyte **by refusing the whole write**, so one long book would
      stop the mirror dead with nothing on any screen saying why. The newest are what a teacher
      opens this for, so the tail is what goes — and the COUNT still says how many there really are.
  - **🕒 AND EVERY ROW SAYS WHEN** (`mistWhenText`, pure). The stamp was carried from the first
    version and was never DRAWN, so the panel was a pile of questions with no way to tell last
    night's paper from last term's. Today and yesterday are named, the last week is its weekday,
    anything older takes its date — **with the year on it once it is not this one**, or a paper
    from last September reads as one from this September. A stamp that will not parse comes back
    EMPTY rather than as 1 Jan 1970, which is a date a teacher would act on.
  - **IT MIRRORS THE WHOLE (capped) BOOK rather than appending**, which is what makes it
    SELF-HEALING: a question sorted, deleted or set out again drops out or updates on the next
    write with nothing to remember. Last-writer-wins on purpose, exactly like `tutorRecent`.
    Written AFTER `loadMistakes` reloads, or a paper's worth of mistakes is invisible until the
    next paper is marked.
  - **THE WRITE IS A MERGE, ALWAYS.** That document is the centre's roster and four apps write
    namespaced fields on it; a plain set takes the level, the subject and the onboarding answers
    off it — which is how a student disappears from every list in every app at once.
  - **🕳 A SKIPPED BLANK SAYS SO** rather than arriving with an empty verdict the panel would
    have to read as "wrong": "they went past this" and "they tried and missed" are different
    lessons, and the class view uses the student's own three words for them.
  - **THE CLASS VIEW GROUPS BY TOPIC, BIGGEST FIRST**, because that IS the question a teacher
    opens it to ask — and an unlabelled question keeps its own heading and is always last,
    the rule 📊 the report already follows.
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

## 📎 A PICTURE PASTED ONTO THE PAGE — AND NO WINDOW ROUND IT (v1.48.0)

`PASTE_IMG_MAX_PX` / `PASTE_IMG_QUALITY` / `PASTE_CASCADE` / `PASTE_MIN_PX` / `PIC_HANDLE_PX` /
`PIC_HIT_PX` / `PIC_BTN_PX` / **`annPastePic`** / **`annLocked`** / `annLockedId` / `PIC_CACHE_MAX`
/ `annPicWarm` / `annPicFor` / **`annPicsReady`** / `shrinkImageDataUrl` / `imageRatio` /
**`pastePicBox`** / **`pasteGoesToWorksheet`** / **`pasteImageOntoPage`** /
`pasteImagesFromClipboard` / **`pastePicNode`** / **`drawPastePicOn`** / **`renderPicChromeOn`** /
**`applyPicHandle`** / **`picFitRatio`** / `togglePictureLock` / `removePictureAnn` /
`resizingPic` (search
`📎 A PICTURE PASTED ONTO THE PAGE`), plus the `.pastePic` / `.picTools` / `.picTool` CSS, the
`image` branch of `annNode` and of `drawAnnsOnCtx`, the chrome at the foot of `renderOverlay`, the
handle / lock guards in `pointerdown`, `pointermove`, `endStroke`, `cancelStaleGesture` and
`eraseAlong`, the `await annPicsReady()` in `printWorksheet`, and the `#viewerArea` drop handler.

Ctrl+V puts a picture on the page you are looking at; dropping one does the same. It is **the
picture and nothing else** — no heading, no border, no background, no buttons — because a window
round a picture is a window over the printed question beside it, and it reads as a screenshot
dropped on top of the page rather than as part of it. **`polymathlc/anskey` carries the same
feature under the same names — ship a change to the shape to both.**

- **IT IS A NEW ANNOTATION TYPE, AND THAT IS THE ONE THING HERE WORTH BEING CAREFUL ABOUT.** This
  file's own rule is that a type must be taught to every renderer and every reader, and the one
  that gets missed is silent. All of them: `annNode` (the screen), `drawAnnsOnCtx` (**the picture
  the AI marks from, the mistake book and the printer**), `annBounds` / `annFrame` (x/y/w/h, so the
  marking measures it where it is), `translateAnn`'s `else` branch, the hit test and the eraser
  (both find `g[data-id]`), the handles below, and `annSizeTarget` — which stands DOWN for a
  picture, because the size control writes a stroke width and a picture has no stroke.
- **EVERYTHING IT WEARS IS DRAWN ONLY WHILE IT IS SELECTED** (`renderPicChromeOn`, called at the
  FOOT of `renderOverlay` so a hint pin or a tick cannot sit over the handle being aimed at). That
  is what makes "no window" and "it has controls" both true at once: a frameless picture with a
  permanent 🔒 badge on it is a frame with one button in it.
- **THE HANDLES AND THE ROW ARE SIZED IN SCREEN PIXELS** (`÷ scale`, the trick `renderPinsOn`
  already uses), so they are the same size to aim at at fit-width and at 400%. Each handle has a
  finger-sized invisible twin, the rule Ans Key's own handles carry.
- **THE ROW IS TRANSPARENT TO TAPS AND THE BUTTONS ARE NOT** (`pointer-events` on the
  foreignObject AND on `.picTools`, `auto` on `.picTool`). The strip is wider than the two buttons
  in it, and both a foreignObject and a transparent div still swallow a tap — so without this a
  band above every selected picture catches the stylus and the page cannot be written on there.
- **THE HANDLE CHECK COMES BEFORE EVERY TOOL** in `pointerdown`. The handles live in a
  `g[data-picchrome]` of their own rather than inside the picture's `g[data-id]`, so a tap on one
  would otherwise `closest` to nothing and DESELECT the very picture being resized.
- **A PICTURE KEEPS ITS SHAPE ON A CORNER DRAG** (`applyPicHandle`, from the `ratio` stored the
  moment it lands), and the box is built from the ANCHOR — the corner opposite the one being
  dragged — rather than from the pointer: clamped up to the floor, `Math.min(anchor, pt)` puts the
  box's own edge past the pointer and the picture creeps away under the drag.
- **`picFitRatio` IS THE ONE PLACE THAT ARITHMETIC LIVES, AND THE SCALE IS THE DRAG PROJECTED ONTO
  THE SHAPE'S OWN DIAGONAL** (v1.48.1) — never whichever axis happens to have travelled further.
  Taking the LARGER refuses to shrink a wide picture pulled straight in along its long edge: its
  height never changed, so the scale never changes and **the corner appears dead**. Taking the
  SMALLER does the same to one pulled straight out. Both read as a handle that does nothing, which
  is worse than no handle at all — and it is the shipped fault v1.48.0's own browser check caught.
  The projection answers to either axis, is EXACT on a true diagonal drag, and is IDEMPOTENT,
  which is what lets it run on every pointermove with no start snapshot kept. **THE FLOOR KEEPS
  THE SHAPE TOO** (whichever of `minW` / `minH` bites harder decides), or a picture dragged down
  to nothing comes back a square. It is pure, so the harness pins it without a DOM, and it is
  shared byte for byte with `polymathlc/anskey`.
- **`annLocked` IS ONE FLAG READ IN ONE PLACE, and four surfaces ask it.** A locked picture is part
  of the page: the eraser steps over it (**rubbing out a stroke drawn ON a picture must not take
  the picture with it** — that is the accident locking exists to prevent, and by the time it is
  noticed the picture has gone), the select tool does not pick it up, `applyPicHandle` refuses it,
  and no handles are drawn on it at all.
- **A LOCKED PICTURE IS STILL SELECTABLE AND STILL REMOVABLE.** Selectable, or the 🔓 that unlocks
  it could never be reached; removable from its own ✕, because that is a deliberate act aimed at
  exactly this picture. **A lock nothing can undo is a picture nobody can take off the page.** The
  flag is DELETED rather than written false — every annotation is written out on every auto-save.
- **THE DECODED PICTURE IS CACHED, AND IT HAS TO BE.** `drawAnnsOnCtx` is SYNCHRONOUS (nine
  callers, several of them sync themselves), so it can only draw a picture that is already decoded.
  `annPicWarm` is called from `annNode` — the overlay renders every picture on every page it draws
  — and awaited at the paste, so the cache is warm long before any composite is taken. **KNOWN
  LIMIT, and it is why `printWorksheet` awaits `annPicsReady()`**: a composite taken in the first
  milliseconds after a page is rendered would be missing a picture that had not finished decoding,
  and on paper that is a gap nobody notices until the sheet is in front of them.
- **THE PICTURE IS FITTED, NEVER STRETCHED, IN BOTH RENDERERS** — `object-fit: contain` on screen
  and `Math.min(bw / w, bh / h)` in the flatten. Stretched on paper and contained on screen is a
  difference nobody sees until the sheet is in front of a class.
- **`pasteGoesToWorksheet` IS THE ONE PLACE A PASTE IS CLAIMED**, and it is the difference between
  this feature and one that is worse than not having it: typing is the commonest thing anybody is
  doing when they press Ctrl+V, so a text annotation being written, an input, a dialog, the buddy
  and the two floating boxes all keep their own paste. **Text on the clipboard is never claimed at
  all.** A picture DROPPED on the page goes through the same door, and its `dragover` must
  `preventDefault` or the browser refuses the drop outright.
- **EVERY DOM CALL IS DEFENSIVE**, the rule the live block already carries: the drop wiring runs at
  the top level and the harnesses run slices of this file in a vm with a mock document, so a
  `getElementById` that is not there would take the whole slice down.
- **`tools/tutor-tests.mjs` CUTS THE REAL PREDICATES** rather than stubbing them, so a guard that
  changes meaning changes there too.
- Run **`node tools/tutor-tests.mjs`**, **`node --test tools/writing-tests.mjs`** and
  **`node tools/browser-check.mjs`** after touching any of it. **The browser one is not optional**:
  whether the picture really lands, really picks up, really resizes by a corner and really refuses
  to move once it is locked is the one thing reading the source cannot check.

## The annotation engine is Ans Key's
**The SHAPES are, and for a long time only the shapes were** — the input
pipeline was this app's own until v1.12.0, and that is the half a child
feels. See **✍️ WRITING ON THE PAGE WITH A STYLUS** below for the pipeline;
this section is the data.

The annotation SHAPES are that app's exactly, so ink written here means the same thing there:
`pen` / `highlight` / `rect` / `ellipse` / `line` / `arrow` / `text` — and, since v1.48.0,
**`image`**: a pasted picture (see 📎 below). Ans Key carries that one as a kind of its own
`ainote` rather than as a type, because it already had the machinery; the SHAPE of the record and
everything it can do are the same in both, and a change to either belongs in both.

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
- **NO TEMPERATURE IS SENT TO A SERVER ROUTE.** A reasoning model runs only at
  its own default and one sent is a **400** — not a worse answer, no answer at
  all. `thinkingLevel` is deliberately not translated either.
- **⚡ NO MODEL IS SENT TO EITHER SERVER ROUTE, AND WHICH ONE ANSWERED IS READ
  BACK.** The centre teaches on ChatGPT **`gpt-6-astra`**, and the ONE place
  that is decided is the `askOpenAi` Cloud Function in `polymathlc/math`, which
  picks it **server-side on purpose** — *"a client that could name a model could
  name an expensive one, and the bill is the centre's"*, in that file's own
  words. So a model named here is ignored on the way out, and **a constant
  mirroring the server's would go stale in silence on the way back**, leaving
  the admin's panel confidently naming a model nothing had used for months.
  Both callables **return** the model they really used, so `_aiModel` records it
  and the panel reports a FACT rather than an intention — and corrects itself the
  moment that function moves. **A reply carrying no model leaves the last one
  alone**: "the server stopped saying" and "nothing has answered yet" are
  different things, and only one is worth printing as a gap. The harness pins
  that **no model id is a VALUE anywhere in this file**.
- **⚡ WHICH ENGINE LEADS CAN DEPEND ON THE TASK, AND EXACTLY ONE TASK ASKS**
  (`AI_TASK_ENGINE`, `aiEngineOrder(task)`, `askGemini(…, { task: 'teach' })`).
  **TEACHING** — the 💡 hint ladder, the 🎧 live reply and the ✏️ maths pad's two
  calls, the ones that write the working and the steps a child reads — leads
  with ChatGPT whatever `config/admin.aiEngine` says, because that is the model
  this teaching was written and checked against. **THE OTHER ENGINES STAY
  BEHIND IT** rather than being taken away, which is the whole shape of this
  loop: an OpenAI account out of credit is a slower hint from Gemini, never no
  hint at all. **An unknown task falls back to the centre's own setting**, so a
  typo can never take the AI off every device at once. Everything else — the
  marking run, the chat, the mistake reader, the key read — is untouched.
  **The CENSUS in `tools/tutor-tests.mjs` is the half that matters**: it reads
  the call sites out of the file and fails BOTH ways — a teaching call that
  stops naming the task goes quietly back to the shared engine while every
  screen still says ChatGPT, and a marking call that STARTS naming it puts
  thirty students' papers on a bill nobody asked for. It resolves the enclosing
  function at **column 0 only**, because the live reply declares `liveFlush`
  inside itself and above its own call.
- **THE PANEL SAYS BOTH ORDERS AND NAMES THE MODEL.** An app whose hints and
  working come from one engine while its marking comes from another looks, from
  every other screen, exactly like one that does not — which is how a whole term
  goes by on the engine nobody chose.
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

## 📌 THE SET LIST IS FOLDED AWAY (v1.41.0)

`ASSIGN_OPEN_KEY` / `assignOpen` / `setAssignOpen` / `toggleAssignOpen` / **`assignAttention`**,
the `opts.row` branch of **`setCardNode`** and the header half of **`renderAssignments`** (search
`THE SET LIST IS FOLDED AWAY`), plus `#assignToggle` / `#assignCaret` / `#assignCount` /
`#assignFlag` / `#assignBody` in the markup and the `.assignToggle` / `.setRows` /
`.wsCard.setRow` CSS.

📌 **Set for the class** was a wall of cover cards ABOVE the bookcase — every paper set for the
centre, at every level, at full size — and for the TEACHER every one of them is **the same paper
twice**: their own upload stands on their own shelf below wearing the 📌 chip that says the class
has it. A term's worth of papers was several screens of duplicates before the bookcase began,
which is the reported fault in the teacher's own words — *“the assigned files appearing like this
makes everything so unsightly, make a way to shelf them so they can't be seen while I can still
access them.”* **That bullet in the 📚 WOODEN SHELVES section is extended by this one**: the list
is still the teacher's alone and still the one place a paper is taken off, it simply starts folded.

- **THE HEADER IS THE SWITCH, and it is FOLDED BY DEFAULT.** One control, on the thing it opens —
  a second control elsewhere is one nobody finds. The choice is remembered PER DEVICE
  (`localStorage`, like every other preference here), and **a device that refuses storage gets the
  DEFAULT, which is folded**: the tidy screen is the one an iPad in Lockdown Mode gets too, which
  is the opposite of the usual direction and deliberate — the default here IS what was asked for.
- **A FOLDED SECTION MUST STILL SHOUT, and that is the whole thing that makes hiding it safe.**
  The header carries the COUNT, and a ⚠ naming how many papers have **lost their PDF** or reach
  **no shelf** — the two faults only the teacher can put right and the only reason to open the
  list at all. So `checkAssignmentPdfs()` runs whether the body is drawn or not, and the count is
  painted BEFORE the fold returns. Fold them out of sight silently and a paper no child can open
  sits set for a term with nothing on any screen saying so, which is strictly worse than the wall
  of cards this replaced.
- **`assignAttention` READS `assignmentUntaggedNote` RATHER THAN ASKING ABOUT THE LEVEL AND THE
  SUBJECT ITSELF.** The header's ⚠ and the row's own warning then cannot disagree about what an
  untagged paper is — a header reading *“1 needs attention”* over a list where nothing is flagged
  is worse than no count. A paper is counted ONCE however many ways it is broken.
- **NOTHING IS TAKEN AWAY.** It is still every active assignment at EVERY level, so it FOLDS
  rather than being narrowed by the 🗂 shelf scope — narrowed, it would hide the P6 paper the
  teacher came to withdraw, and this is the ONE place `unpushWorksheet` is reached.
- **OPEN, IT IS A REGISTER RATHER THAN A SHELF — and that is ONE BRANCH inside the ONE node**
  (`setCardNode(a, { row: true })`), never a second renderer. The row and the card can never
  disagree about what a set paper DOES, because both end at the same two buttons and the same two
  warnings. **Called with nothing it is byte-for-byte the card the student's shelf has always
  drawn**, which is what made this safe to ship over a live home screen — the property
  `shelfGroups(opts)` already carries, and the harness pins it.
- **THE ROW DROPS ONLY WHAT SAYS NOTHING HERE** — the cover (a register is read by name), “📌 Set
  by Mr Chung” (every line in it is), and the topic and the school, which are on the bookcase card
  below. It keeps the level, the subject, the help level and whether it has been started, because
  those are what a register is read FOR — **and it keeps BOTH WARNINGS**, which a tidier row would
  have been the first to drop and which are the reason the section exists.
- **A flagged row is TALLER on purpose.** `.assignWarn` is `flex: 1 1 100%` inside the row, so the
  warning wraps to a line of its own and the buttons to another; a warning squeezed into the line
  with the chips is one nobody reads.
- **A teacher with nothing set still sees no section at all**, folded or not — the rule
  `renderAssignments` has always followed.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 📅 A SHELF STANDS IN A YEAR'S RACK (v1.51.0)

`SHELF_YEAR_RE` / `SHELF_YEAR_BACK` / `SHELF_YEAR_ON` / `SHELF_UNDATED_TITLE` / **`shelfYearOf`** /
`shelfYearRank` / **`shelfYearsIn`** / **`shelfRacked`** / `shelfRackTitle` / `shelfRackId` /
`shelfWhereLabel` / `shelfYearOptions`, the `year` kept by `shelfNorm` and **written by
`shelfSave`**, the year arm of **`shelfGroupCompare`**, the `g.year` resolved in **`shelfGroups`**,
the `year` on `shelfSections`' sections and on its empty-shelf sweep, the rack loop in
`renderWorksheets` with **`shelfRackNode`** / **`shelfYearChips`** / `shelfScrollToRack`, the
`year` argument on `shelfCreate` / `shelfRename`, `#shelfNameYear` in the ✎ dialog, and the
`.shelfRack` / `.shelfYears` / `.shelfYearChip` CSS (search `A SHELF STANDS IN A YEAR'S RACK`).

🗂 The year was a **WORD ON THE PLATE** and nothing else — “2025 WA1”, “2025 WA2”, “2025 EOY” — so
adding 2024 and 2026 made one flat run of a dozen shelves with nothing to tell one year from the
next and nothing to scroll between, which is the reported fault in the teacher's own words:
*“i want to be able to add 2026 and 2024 and so on and scroll to them, they should have their
individual vertical racks of papers.”* A shelf names its year now and the bookcase is stacked into
one rack per year.

- **AN EMPTY YEAR MEANS *EVERY* YEAR, and that direction is the whole migration** — the rule
  🎓 `shelfFitsClass` already carries. Every shelf on a live bookcase has no year, so reading `''`
  as “nowhere” empties a centre's entire bookcase into a rack nothing draws, on the deploy, with
  nothing to migrate it back. A year this build does not accept reads as every year for the same
  reason: a shelf on the undated rack is one a teacher can see and re-file, where one filed under a
  year nothing draws has quietly left the bookcase.
- **⚠️ THE YEAR IS A RACK, NOT A RULE ABOUT PAPERS, and that is what keeps this small enough to be
  safe.** A paper has no year, so nothing here narrows what may go ON a shelf: `shelfFitsClass`,
  `shelfDropOk` and `moveWorksheetToShelf` are untouched, and the harness pins that they never
  learn the word. The CLASS axis decides what a shelf may hold; the YEAR axis only decides where
  the shelf itself stands. **A year that could refuse a paper would be a second way to lose one**,
  which is the thing the whole shelf section is built not to do.
- **`shelfYearOf` IS THE ONE PLACE A SHELF'S YEAR IS READ**, the way `shelfFitsClass` is the one
  place its class is decided — and every reader asks it: the normaliser, the grouping, the sections,
  the renderer, the chips, both dialogs and both pickers.
- **THE YEAR IS THE OUTERMOST THING A GROUP IS ORDERED BY** (`shelfGroupCompare`), or the same year
  turns up again under every level and there is no “individual vertical rack” to scroll to at all.
  Newest first, because that is the year being taught, and the undated rack is **always last** —
  the rule the unsorted shelf already follows. The ranks are compared with `<` rather than `a - b`
  for `shelfRank`'s reason: both are `Infinity` for an undated shelf, `Infinity − Infinity` is NaN,
  and a NaN comparator leaves the whole bookcase in whatever order the engine's sort produced.
- **A GROUP'S YEAR IS ITS SHELF'S, resolved after the grouping rather than made part of the key.** A
  shelf has ONE year, so the year can never split a group — and with no catalogue every group is
  undated, which is what keeps **`shelfGroups()` called with nothing byte-for-byte the grouping it
  has always been**. It is set BEFORE the sort, which is what reads it.
- **NOTHING IS RACKED UNTIL SOMETHING IS FILED** (`shelfRacked`). With every shelf undated — which
  is every bookcase in the centre until somebody files one — a heading reading “Undated” over the
  whole page says nothing at all, so none is drawn and the home screen is byte-for-byte the
  bookcase this app had before years existed. Same property that made 🗂 the shelves and 🎓 the
  class axis safe to ship over a live one.
- **THE PLATES ARE PLACED BY THE SAME LOOP THAT DRAWS THE SHELVES**, off the order `shelfSections`
  has already put them in. A second walk to place the racks is a second ordering, and the two would
  disagree the first time a shelf moved — a 2026 plate over a 2025 shelf, on a page that otherwise
  looks perfectly arranged.
- **THE CHIPS ARE A WAY *DOWN*, NEVER A FILTER, and they are stateless on purpose.** Every year is
  still on the one page, which is the point: a filter would hide the papers a teacher is comparing
  this year's against, and a remembered year is one somebody set last Tuesday that comes back and
  empties the screen. They are built from the **SECTIONS** rather than from the catalogue, so a chip
  can never offer to jump to a rack that is not drawn — a shelf of another class, or one the scope
  narrowed away, is not a rack. Under two racks none is drawn: one chip that scrolls to the top of
  the page is furniture.
- **THE PLATE IS DRAWN IN THE APP'S OWN INK, NOT THE TIMBER'S.** It is the label on the front of the
  bookcase rather than part of it, and a heading in the same wood as the shelves under it reads as
  another shelf.
- **A SHELF'S OWN TITLE NEVER REPEATS ITS YEAR.** It is written once on the plate above, and
  repeating it down every shelf under it is exactly the noise the `scoped` rule already drops the
  class prefix to avoid.
- **AN EMPTY SHELF WEARS ITS OWN YEAR**, or the same shelf stands on the undated rack while empty
  and on 2026 the moment a paper lands on it — the bookcase disagreeing with itself about where a
  shelf is.
- **`undefined` KEEPS THE YEAR** (`shelfRename`), the rule the class beside it carries: a caller that
  only wants to rename must not be able to un-date a shelf in silence, and every shelf made before
  this has none, so a careless `|| ''` is indistinguishable from a deliberate “every year”. **A
  re-rack moves no paper** and the toast says so — unlike a class change, there is nothing to fall
  off.
- **“WA1” ON THE 2025 RACK AND “WA1” ON THE 2026 RACK ARE TWO SHELVES.** The duplicate check is per
  class AND per year; refusing the second would refuse the very thing this exists for.
- **A NEW SHELF OPENS ON “Every year”, deliberately.** The racks are a VIEW rather than a scope, so
  nothing on the screen says which year the teacher is working in and there is nothing to guess
  from — and the calendar year is a guess, not an answer: pinned to it by default, a shelf meant for
  every year disappears under one rack nobody chose. Blank is also what every shelf already carries,
  so the default is the status quo and choosing a year is the deliberate act it should be.
- **THE PICKER OFFERS A WINDOW ROUND THIS YEAR *PLUS* EVERY YEAR ALREADY ON THE BOOKCASE.** Without
  the second half, opening ✎ on a 2019 shelf offers every year but its own and silently un-dates it
  on save.
- **`shelfClassLabel` IS DELIBERATELY LEFT ALONE** and `shelfWhereLabel` is the year-and-class one.
  That function is what the “belongs to a different class” sentences read, and a year in those would
  be saying something they do not mean.

### 🐛 …and the class a shelf was pinned to never reached Firestore

Found while adding the year to the same record. 🎓 v1.40.0 gave every shelf a class, and
**`shelfSave` wrote `{ id, name, order, createdAt }`** — so the class lived in memory behind
`shelves = clean` and was thrown away on the wire. A shelf pinned to P6 · Mathematics stood there
perfectly until the page was reloaded and then belonged to every class again, with nothing on any
screen saying so.

- **EVERY FIELD `shelfNorm` READS HAS TO BE WRITTEN, or it is a field that only exists until the
  next refresh.** The harness pins that literally — it takes the KEYS off a normalised shelf and
  fails on any one the writer does not name — so the next field added to the catalogue cannot come
  back as this bug wearing a different word.
- Run **`node tools/tutor-tests.mjs`** and **`node tools/browser-check.mjs`** after touching any of
  it **and look at the home screen** — whether the plate really stands over its own rack, and
  whether a chip really moves the page, is the one thing reading the source cannot check.

## 🎓 A SHELF BELONGS TO ONE CLASS (v1.40.0)

**`shelfFitsClass`** / `shelfClassLabel` / **`shelfPaperOf`** / **`shelfDropOk`** /
`shelfClassOptions` / **`fillUploadShelves`**, the `level` / `subject` kept by `shelfNorm`, the
narrowing line in **`shelfGroups`** and the one in `shelfSections`' empty-shelf sweep, the class
arguments on `shelfCreate` / `shelfRename`, the refusal in `moveWorksheetToShelf`, the filter and
the hidden count in `openShelfPick`, `shelfDropOk` in the `dragover`, the two class pickers in
`openShelfNameModal` / `shelfNameConfirm`, and the `shelfSkip` on `uploadOne`'s answer with the
`offShelf` list in `handleUpload` (search `A SHELF BELONGS TO ONE CLASS`).

🗂 v1.37.0 made a shelf **a LABEL with no class of its own** — “2025 papers” was ONE shelf and a
P5 Science child saw their P5 Science papers on it while a P6 Maths child saw theirs. That reads
well and is not how the centre files: a folder made under P6 · Mathematics is a P6 Maths folder,
and **an empty copy of it stood on every other class's bookcase**, which is the reported fault in
the teacher's own words — *“when i create p6 shelves, empty shelves are linked to the other levels
as well… a folder created under p6 math stays there only and does not appear anywhere else.”*
**That bullet in the 🗂 section is superseded by this one**; the scope picker is still the other
axis, and a section is still a (level, subject, shelf) triple.

- **`shelfFitsClass(s, level, subject)` IS THE ONE PLACE A SHELF'S CLASS IS DECIDED**, and every
  reader asks it: the grouping, the empty shelves, the 🗂 picker, the mover, the drag and the
  upload. A second test is a shelf offered by the picker and refused by the mover, or drawn on a
  bookcase the grouping will not put a paper on — and nothing on any screen would say which.
- **AN EMPTY LEVEL OR SUBJECT MEANS *EVERY* CLASS, and that direction is the whole migration.**
  Every shelf already on a live bookcase carries no class at all, so reading `''` as “nowhere”
  empties a centre's entire bookcase on the deploy, with every paper on those shelves falling back
  to *Not on a shelf yet*. Nothing is migrated and nothing is rewritten; a shelf that should be
  pinned to one class is pinned with ✎ Rename. **The two halves are asked SEPARATELY**, so “every
  P6 shelf” and “every Maths shelf” are both sayable and a shelf is never forced to name both.
- **A CLASS THIS BUILD HAS NEVER HEARD OF IS *EVERY* CLASS, never a shelf nothing can draw.**
  `shelfNorm` validates against `LEVELS` and `SUBJECT_OK`, so a record from a later version is a
  shared shelf rather than one that has silently fallen off the bookcase.
- **A PAPER CAN NEVER BE LOST BY SHELF BOOKKEEPING**, which is the 🗂 section's own rule extended
  one step: `shelfGroups` already read an UNKNOWN shelf id as unsorted, and it now reads a shelf of
  ANOTHER CLASS the same way. So a paper carrying a P6 Maths shelf id onto the P5 bookcase falls
  back onto *Not on a shelf yet* rather than dragging that shelf onto a class it was never made
  for. Same one line, same reason.
- **CALLED WITH NO CATALOGUE, `shelfGroups` IS STILL BYTE-FOR-BYTE WHAT IT WAS**, the property
  that made v1.37.0 safe to ship over a live bookcase and the one that makes this safe too.
- **IT IS REFUSED IN THE MOVER AS WELL AS NARROWED IN THE PICKER.** Narrowed alone, a move made
  from anywhere else — a drag, a stale button, the console — lands, the toast says the paper moved,
  and `shelfGroups` reads the id as unsorted on the very next paint: the paper back where it
  started with nothing on any screen saying why. `shelfDropOk` is the **`dragover`'s** own copy of
  that question, so a shelf never lights up for a drop it is going to refuse — a target that
  highlights and then says no is worse than one that never highlighted.
- **`shelfPaperOf(id)` IS THE ONE RESOLVER.** The mover, the ✎ rename, the 🗂 picker and the drag
  each need “which paper is this id, and what class is it” — four copies of that walk is four
  chances to read a `set:` entry's class off the wrong object. A copy's OWN fields win over the
  assignment's, because the copy IS the paper being moved.
- **THE SAME NAME ON TWO CLASSES IS TWO SHELVES.** `shelfCreate`'s duplicate check is per class:
  refusing the second would refuse the very thing this narrowing is for. The same name on the SAME
  class is still one shelf twice.
- **`undefined` KEEPS A SHELF'S CLASS** (`shelfRename`). Every shelf made before this has none, so
  a careless `|| ''` is indistinguishable from a deliberate “every class” — and a caller that only
  wanted to rename would take a shelf's class off it in silence. Moving a shelf to another class
  SAYS what becomes of the papers that cannot follow it.
- **A SHELF MADE *FOR* A PAPER OPENS ON THAT PAPER'S CLASS**, never on the class in view, because
  `shelfNameConfirm` moves the paper onto it the instant it is made. On the scope's class instead,
  a teacher looking at P5 · Science who makes a shelf for a P6 Maths paper gets a P5 shelf the move
  is then refused by — and the shelf they just made stands empty on somebody else's bookcase.
- **THE UPLOAD'S PICKER IS NARROWED BY THE CLASS BEING UPLOADED TO**, and the class is chosen AFTER
  the dialog was built — so it is refilled on every change, from ONE listener **bound once** beside
  `fillPickers` rather than inside `openUploadModal`, which runs on every upload and would stack a
  listener per opening. With NO class chosen (the ✨ read-it-off-the-paper rows) every shelf is
  offered with its own class printed beside it: nobody has said what these papers are yet, so
  narrowing would be guessing. A shelf that has fallen out of the list is never left SELECTED — the
  picker would read as unsorted while holding a shelf id nobody can see.
- **AND THE SHELF IS CHECKED AGAIN WHEN THE READ HAS SETTLED THE CLASS** (`uploadOne`'s
  `shelfSkip`). It is written at creation, BEFORE the read — which is right, so the paper stands on
  the right shelf from its first paint — but the level and the subject may only have been settled a
  moment ago, so a shelf that is not this paper's class is CLEARED **and NAMED**, on its own and
  through `handleUpload`'s `offShelf` list in a pile of ten. A shelf the teacher chose and the
  bookcase silently ignored is the shape of fault this whole narrowing exists to end.
- **THE 🗂 PICKER COUNTS WHAT IT LEFT OUT.** A teacher who cannot see the shelf they made needs to
  be told it belongs to another class, not left wondering whether it saved.
- Run **`node tools/tutor-tests.mjs`** after touching any of it **and look at the home screen** —
  which shelves stand on which bookcase is the one thing reading the source cannot check.

## ✎ RENAMING A PAPER — the class reads the new name, and nothing they wrote moves (v1.39.0)

**`worksheetName`** / `WS_NAME_MAX` / **`wsNameClean`** (beside `worksheetShelfId` — search
`WHAT A PAPER IS CALLED`), **`renameWorksheet`** (beside `moveWorksheetToShelf` — search
`THE ONE RENAME`), **`setWsTitle`** (just above `openWorksheet`), `openRenameModal` /
`wsNameConfirm` / `wsNameTarget`, the ✎ button on `wsCardNode`, and `#wsNameModal`.

A worksheet was called whatever it was called at upload, for ever. A file name nobody typed, a
title the paper read badly off its own cover, a paper that turns out to be SA2 rather than SA1 —
all stuck, on a shelf of thirty cards where the name is the only thing anybody reads.

- **`worksheetName(w, list, loaded)` IS THE ONE PLACE A NAME IS DECIDED, and it reads the
  ASSIGNMENT over the copy** — exactly as `worksheetShelfId` reads the shelf and `guidanceRule`
  reads the locked help level, and for exactly the same reason: a name kept per copy would only
  ever govern the students who had not started yet, and it would look like it worked right up
  until the teacher renamed a paper the class had already begun. `loaded` tells “the list has not
  arrived yet” from “it is not set”, so a cold start is not a bookcase of blank cards.
- **AN EMPTY LIVE NAME IS NOT AN ANSWER, and that is the one deliberate difference from the
  shelf.** There `''` is a real answer meaning *not on a shelf*; here it can only be a paper set
  before it was named, and blanking a perfectly good title is the worse way to be wrong.
- **NOTHING IS WRITTEN TO A STUDENT'S COPY, because nothing needs to be.** The teacher cannot
  write another account's documents at all, so “the student's version also updates” has exactly
  one honest implementation: the name is READ live. Their ink, hints, marking, mistake book,
  answer key, score and help level are untouched by construction — the rename is ONE merged field
  on each of two documents and the harness counts them.
- **THE ASSIGNMENT IS WRITTEN FIRST**, because it is the record the whole class reads. A
  teacher's own row renamed while the class's was not is the one outcome worth refusing to report
  as a success, so both writes are named on failure and `assignRulesHint()` goes with a refusal.
  A copy of somebody else's assignment never writes its own row — that field would quietly
  outrank the assignment the next time the list had not arrived, the rule `moveWorksheetToShelf`
  already carries.
- **⚠️ `performSave` WRITES `name: docName` ON EVERY AUTO-SAVE, AND THAT IS THE TRAP.** A rename
  made while that paper is open and not carried into `docName` is undone by the paper's own next
  save a few seconds later, with nothing on any screen saying so. **`setWsTitle` is the ONE
  writer** of `docName` and the bar together: a bar changed alone is a label, and a `docName`
  changed alone is a rename nobody can see until the next save writes it. `renameWorksheet` calls
  it when the renamed paper is the open one.
- **THE NAME IS RE-READ AFTER THE CLASS LIST IS IN HAND.** `openWorksheet` names the paper at
  `loadPdf` and again beside `guidanceRule`, because the list may not have arrived until the
  await above — reading it only at `loadPdf` is a whole session spent under the name the copy
  happens to carry. And because the save writes `docName` back, a student's own stale field
  CONVERGES on the live name at their very next save.
- **IT IS THE TEACHER'S, REFUSED IN THE HANDLER.** `openRenameModal` and `renameWorksheet` both
  ask `isAdmin` — hiding a button has never been the lock in this app, and this one writes a
  collection every student reads.
- **`wsNameClean` NEVER INVENTS A NAME.** Whitespace is folded (a title pasted out of a PDF
  arrives with newlines in it, and a card is one line) and the length is capped at `WS_NAME_MAX`,
  which the input's own `maxlength` matches; an empty answer comes back EMPTY and the rename
  refuses it rather than writing “Untitled” over a paper that had a title.
- The dialog opens on the name it already has, so a rename is an edit rather than a retype, and
  Enter confirms it — renaming is one word and one key.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🗂 SHELVES THE TEACHER MAKES — “2025 papers”, in the teacher’s own order (v1.38.0)

`SHELF_DOC_ID` / `SHELF_MAX` / `SHELF_RECENT_*` / `SHELF_UNSORTED_TITLE` / `shelves` /
`shelvesLoaded` / **`shelfNorm`** / `shelfFind` / `shelfLabel` / `shelfRank` /
**`shelfReorder`** / `shelfStampOf` / **`worksheetShelfId`** / `shelfRecentStamp` / `shelfAgo` /
**`shelfRecentItems`** / **`shelfInScope`** / `shelfGroupCompare` / **`shelfGroups`** (takes
`opts`) / `shelfTitle` (takes `opts`) / **`shelfSections`** / `loadShelves` / **`shelfSave`** /
`shelfCreate` / `shelfRename` / `shelfDelete` / **`moveWorksheetToShelf`** / **`moveShelfTo`** /
`shelfScope` / `SHELF_SCOPE_KEY` / `setShelfScope` / **`shelfScopeNow`** / `openShelfNameModal` /
`shelfNameConfirm` / `openShelfPick` / `_shelfDragId` / **`SHELF_DRAG_PREFIX`** /
**`_shelfOrderDragId`** / **`shelfOrderSlot`** / `shelfDropClear` / `renderShelfBar` (search
`SHELVES THE TEACHER MAKES`), plus the `shelf` field on a worksheet and on an assignment,
`lastOpenedAt` written in `openWorksheet`, `#shelfBar` / `#shelfNameModal` / `#shelfPickModal`, the `#upShelf`
picker, and the `.shelfBar` / `.shelfPick` / `.shelfRecent` / `.shelfDrop` / `.shelfDragging` /
`.shelfEmpty` / `.shelfHead .shelfTool` / `.shelfHead .shelfGrip` / `.shelfMoving` /
`.shelfOrderBefore` / `.shelfOrderAfter` / `.chipWhen` / `.chipShelf` CSS.

📚 The bookcase (v1.23.0) filed a paper by its level and subject and that was the only shelf it
could ever be on — right until a class has forty papers on one. What a teacher HAS is piles: this
year's prelims, last year's, the topical drills. So they make their own shelves, name them, and
move papers between them — and **every student of that level and subject reads the same
arrangement**, because it is not a thing each copy carries.

- **⚠️ A SHELF WAS A LABEL, NOT A CLASS — SUPERSEDED BY 🎓 v1.40.0, above.** It carried no level
  and no subject, so “2025 papers” was ONE shelf and a P5 Science child saw their P5 Science
  papers on it while a P6 Maths child saw theirs. That is not how the centre files, and an EMPTY
  copy of every shelf stood on every other class's bookcase. A shelf names the class it was made
  for now (`shelfFitsClass`), and an empty class on it still means every class, which is what
  keeps every shelf made before v1.40.0 standing exactly where it stands. **The scope picker is
  still the other axis** and the two still compose: a section is a (level, subject, shelf) triple,
  which is `shelfGroups` doing exactly what it already did with one more dimension.
- **`worksheetShelfId` IS THE ONE PLACE A PAPER'S SHELF IS DECIDED, and it reads the ASSIGNMENT
  over the copy.** That is the whole of “the same papers on the same shelves”: a shelf read off
  each copy would only ever govern the students who had not started yet — the exact fault
  `guidanceRule` documents about the locked help level — and it would look like it worked right
  up until the teacher moved a paper. `assignmentsLoaded` tells “the list has not arrived yet”
  from “it is not set”, which want opposite answers, so on a cold start the copy's own field
  stands rather than the whole bookcase emptying for a second.
- **THE CATALOGUE IS ONE DOCUMENT IN A COLLECTION WHOSE RULES ALREADY EXIST**, and that is why
  this shipped with no deploy. A `tutorShelves` collection would need a line in the Firestore
  rules — which live in `polymathlc/math`, are shared with five apps, and **fail CLOSED** when
  they do not know a name: the write is denied, the read comes back empty, and nothing on any
  screen says why. `tutorAssignments` is already *read by anybody signed in, written by the
  admin*, which is exactly what a shelf catalogue wants, so it is one reserved document in it,
  `tutorAssignments/shelfCatalogue`. It carries **`active: false`** — `loadAssignments` asks for
  `active == true` — **and is dropped by NAME there as well**, because a catalogue read as a
  worksheet set for a class is a card nobody can open on every student's home screen.
- **🐛 ITS ID IS AN ORDINARY ONE, AND HAS TO BE** (v1.37.1). **Firestore RESERVES every
  document id matching `__.*__`** and refuses it outright, so v1.37.0's `__shelves__` was
  rejected on every read and every write: making a shelf toasted *“Resource id "__shelves__" is
  invalid because it is reserved”*, which at least SAID so — and the READ failed with the same
  refusal and is CAUGHT, so the bookcase simply stood there with no shelves on it, looking
  exactly like a centre that had never made one. The name is the only thing that changed:
  `active: false` and the by-name guard in `loadAssignments` are still what keep the catalogue
  out of the class's set list, and **there is nothing to migrate**, because that document could
  never have been written in the first place. `SHELF_RECENT_ID` was renamed with it although it
  is only ever a SECTION key — a name shaped like a document id is one somebody later writes —
  and the harness pins the SHAPE of both rather than their spelling, because this is a value
  typed into the source that Firestore will not take.
- **AN UNKNOWN SHELF ID READS AS UNSORTED** (`shelfGroups`), and that one line is what makes
  taking a shelf off safe: its papers fall back onto *Not on a shelf yet* rather than into a
  section nothing draws. Nothing is migrated, nothing is rewritten, and **a paper can never be
  lost by shelf bookkeeping** — which is the one thing this feature must never do. The confirm
  says so too, because “delete the shelf” reads as “delete the papers” to anybody not told
  otherwise.
- **CALLED WITH NOTHING, `shelfGroups` AND `shelfTitle` ARE BYTE-FOR-BYTE WHAT THEY WERE.** A
  centre that never makes a shelf is completely unaffected — one shelf per level and subject,
  same order, same heading. That is the property that made this safe to ship over a live
  bookcase, and the harness pins it.
- **THE ASSIGNMENT IS WRITTEN FIRST** (`moveWorksheetToShelf`), because it is the record the
  whole class reads. A teacher's own row that moved while the class's did not is the one outcome
  worth refusing to report as a success, so both writes are named on failure and the rules hint
  goes with a refusal. It refuses a non-admin **in the handler** and a shelf that is no longer on
  the bookcase; a copy of somebody else's assignment never writes its own row, or that field
  would quietly outrank the assignment the next time the list had not arrived.
- **THERE ARE TWO WAYS TO MOVE A PAPER AND ONE MOVER.** `dragstart` is never fired by a
  touchscreen, so a shelf reachable only by dragging is a shelf the teacher cannot use on the
  iPad these worksheets are written on: every card carries a **🗂 Shelf** button that offers the
  same shelves and *Make a new shelf for it…*. Both end at `moveWorksheetToShelf`.
  **`_shelfDragId` is held in a global rather than read off the drop**, because
  `dataTransfer.getData` is deliberately blocked during `dragover` in every browser — a shelf
  cannot ask what is coming and must be told when the drag starts. It is cleared on `dragend`,
  always, or a drag abandoned over the page leaves the next drop moving whatever was picked up a
  minute ago.
- **🗂 AND THE SHELVES THEMSELVES ARE PUT IN ORDER THE SAME TWO WAYS** (v1.38.0). They stood in
  the order they were made, for ever, so the shelf a class works out of this term was wherever
  it happened to land. **`shelfReorder` is the ONE place the arithmetic lives** — pure, so the
  harness pins it — and `moveShelfTo` is the ONE mover both the grip's drop and the ▲ ▼ buttons
  end at, exactly as a dragged booklet and a card's 🗂 button both end at `moveWorksheetToShelf`.
  - **IT RENUMBERS `order`, AND THAT IS NOT TIDINESS — IT IS THE WHOLE THING.** `shelfSave` runs
    `shelfNorm` before it writes and `shelfNorm` sorts by `order` FIRST, so a list whose ARRAY
    order was changed and whose `order` fields were not is **sorted straight back into the
    arrangement it started in**: the write lands, the toast says the shelf moved, the bookcase
    repaints exactly as it was, and nothing on any screen says why.
  - **AN INDEX IS CLAMPED WHERE A POSITION ON A PAGE IS NOT.** `to` is worked out from a RANK,
    so the ends are the honest answer to “further than the bookcase goes”; `_markAt` refuses an
    out-of-range point instead, because there a clamp is a guess about which question on a
    child's paper was meant. A shelf the catalogue no longer has moves nothing and is never put
    back — that would be a reorder resurrecting a shelf somebody deleted.
  - **THE ORDER IS THE CATALOGUE'S, so it reaches the class.** It is not a field on anybody's
    copy of a paper, which is the same reason `worksheetShelfId` reads the assignment: an order
    kept per copy would govern only the students who had not started, and would look like it
    worked right up until the teacher moved a shelf.
  - **▲ ▼ ARE THE TOUCH HALF AND ARE NEVER AN AFTERTHOUGHT**, for the reason the 🗂 button on a
    card is: `dragstart` is never fired by a touchscreen, so a bookcase arrangeable only by
    dragging is one the teacher cannot arrange on the iPad they teach from. They are
    `shelfTool`, never `shelfBtn` — that class is hidden under 640px — they are **disabled at
    the ends** rather than silently doing nothing, and each **re-reads the rank at the click**,
    because the button outlives the catalogue it was drawn from.
  - **THE GRIP IS THE DRAG SOURCE AND THE HEAD IS NOT.** The heading carries ✎ 🗑 ▲ ▼ ‹ ›, and a
    button pressed with a hair of movement on a draggable parent starts a drag rather than a
    click. It is drawn in CSS rather than as a glyph, the rule the wood already follows.
  - **THE TWO DRAGS ARE HELD APART THREE WAYS AND DISPATCHED IN ONE PLACE**: `_shelfOrderDragId`
    is its own global (a shelf and a paper are different moves), the payload is namespaced
    `SHELF_DRAG_PREFIX` so the paper path's `getData` fallback REFUSES it, and one `dragover` /
    `drop` pair asks which move it is before it does anything — two sets of handlers on one
    shelf would both fire and hand a shelf id to `moveWorksheetToShelf` as a worksheet's. It is
    cleared on `dragend`, always, the rule `_shelfDragId` already carries.
  - **A SHELF IS NEVER DROPPED ON ITSELF OR ON THE UNSORTED SHELF.** `shelfOrderSlot` returning
    `''` is what withholds the `preventDefault` that would make either a drop target — the
    unsorted shelf is always last by rule, and 🕒 Recently opened gets no handler at all.
  - **THE INDICATOR IS AN OUTLINE AND A NUDGE, never a third pseudo element**: `.shelf::before`
    and `::after` are the bookcase's own uprights. Both it and the fade stand down under
    `prefers-reduced-motion`.
- **🕒 RECENTLY OPENED IS A VIEW, NEVER A MOVE.** A paper on it is still standing on its own
  shelf further down and is still drawn there; nothing is written when it is shown, and it is
  **not a drop target** — “move it to Recently opened” is not a thing that can be true, and a
  shelf that lit up and then did nothing would be worse than one that never lit up. Each card on
  it says how long ago (`shelfAgo`) **and which shelf it really lives on**, because without that
  the same booklet is on one screen twice with nothing to say why.
  - **`shelfRecentStamp` is the LATER of `lastOpenedAt` and `updatedAt`.** Either alone is a
    shelf that quietly misses half of what belongs on it: `updatedAt` is written by every
    auto-save and so already means “last worked on” for anything written on, and `lastOpenedAt`
    is what adds the paper opened, read and closed without a mark — which is most of what “what
    was I doing yesterday” asks about. A SET worksheet nobody has started has never been opened,
    whatever its set date says, so it is worth 0 and never stands there.
  - **`lastOpenedAt` IS FIRE AND FORGET**, one merged field, caught: a shelf is a convenience and
    must never be the reason a worksheet does not open. It is written locally too, so the shelf
    is right without waiting for a reload.
  - **THE CEILING IS NOT DECORATION.** A device with a clock a day fast writes a stamp in the
    future, and without `now + 1 day` that paper is pinned to the front of the shelf for ever.
- **A SCOPE NEVER HIDES WORK.** `shelfInScope` lets a paper with no level or no subject through
  EVERY scope, so picking a class can never make somebody's own untagged upload disappear — it
  stands on its own *Any level · Any subject* shelf instead, which is `canSeeWorksheet`'s rule
  applied to the picker. A class with nothing on its shelves is SAID, never left as a blank page
  under a picker: a scope that quietly empties the screen reads as an app that has lost the
  worksheets.
- **THE EMPTY SHELVES ARE THE TEACHER'S OWN, AND ONLY WITH ONE CLASS IN VIEW.** A shelf is a
  label with no class of its own, so on “every level” there is no heading it could honestly stand
  under; with a class chosen there is, and that is where arranging happens — a shelf you cannot
  see is a shelf you cannot drag onto, and one made a moment ago that does not appear reads as a
  creation that failed. A student is never shown one.
- **THE SCOPE IS READ AT LOAD, NEVER FROM A SIGN-IN HOOK.** It is a per-device preference, and
  `adoptStudents` — the obvious place, beside the active student — **runs for a STUDENT only**,
  so the teacher, who uses the picker most, would find it reset on every single reload. A stored
  level or subject this app does not know reads as “every”, so a record from a later version can
  never empty the bookcase.
- **✎ AND 🗑 ARE DELIBERATELY NOT `.shelfBtn`.** That class is hidden under 640px to give the ‹ ›
  buttons up to swiping (`.shelfHead .shelfBtn`, at two classes, for the `.iconBtn` reason that
  rule already documents) — and a teacher who loses rename and delete on the device they teach
  from has lost the feature. They are `.shelfTool`, styled at `.shelfHead .shelfTool` so the
  later `.iconBtn` rule cannot take their size back.
- **🕒 The recent shelf is the same bookcase in a COOLER TIMBER**, which is four custom
  properties rather than a second copy of the gradients — the reason `--wood*` are properties on
  `.shelf` at all. It has to read as a different shelf, because every paper on it is also
  standing on one of the shelves below.
- **THE SHELF TRAVELS WITH THE PAPER**: `uploadOne` writes it at creation, `pushWorksheet` carries
  it onto the assignment, and `startAssignment` puts it on the fresh copy for the moment before
  the list arrives. The upload dialog reads its shelf ONCE with the rest of the settings, before
  the loop — the rule 📚 UPLOADING already carries, and for the same reason: a shelf read per file
  is paper 2 landing wherever the cleared form happens to point.
- Run **`node tools/tutor-tests.mjs`** after touching any of it **and look at the home screen** —
  the wood, the drag highlight and the cooler timber are the one thing reading the source cannot
  check.

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
- **THE "📌 SET FOR THE CLASS" SECTION IS THE TEACHER'S ALONE — and since v1.41.0 it is FOLDED
  AWAY by default (📌 above).** A student's set papers stand on their shelves, opened or not, so a
  second list of the same papers above the shelves is the same paper twice. `renderAssignments`
  paints an empty list for anyone but the admin; the teacher's list is every active assignment at
  every level, which is where one is taken off — so it folds rather than being narrowed, and its
  header goes on carrying the count and the ⚠ while it is shut.
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

## 📕 A QUESTION IS IN THE BOOK AS SOON AS IT IS MARKED (v1.44.0)

**`fileMistakes(opts)`** and its `{ filed, wentPast }` answer, **`markRation`** beside it, and the
per-batch `await fileMistakes({ marked: true, quiet: true })` at the foot of `runMarking`'s batch
loop with the accumulated `mistFiled` / `mistPast` toast after it (search `A QUESTION IS IN THE
BOOK AS SOON AS IT IS MARKED` and `THE ONE PLACE A MARKING RUN'S REBUILD RATION IS FILLED`).

`fileMistakes` ran ONCE, after the last batch of the whole paper. So a run that was interrupted —
the tab closed, the network gone, a worksheet left half marked, a student simply stopping — filed
**NOTHING**, however many questions had already been read and judged. The marking cards were on
the screen and the book was empty, with nothing on any screen saying the two were about to
disagree.

- **EVERY BATCH FILES WHAT IT JUST JUDGED**, through the very same 🧩 rebuild every other mistake
  goes through — so the questions are SET OUT AGAIN, practisable and printable, the moment their
  page has been read. **Called with nothing `fileMistakes` is byte-for-byte the end-of-run pass it
  always was**, which is what made this safe over a live book.
- **🕳 A SKIPPED BLANK CANNOT BE JUDGED MID-RUN, and that is the one thing this split must keep
  straight.** `markSkipped` asks whether a LATER question was answered, and mid-run there are
  none — so every blank looks like the tail and filing one is a book of questions nobody has
  failed at, which is exactly what the 🕳 rule refuses. `markedOnly` is what holds them back; the
  LAST pass is the one that can see the whole paper, and it is where they are judged.
- **THE RATION MOVED OUT, AND THAT IS THE EXPENSIVE HALF.** `MB_BUILD_MAX` was refilled at the top
  of `fileMistakes` — right while it ran once a paper, and a **ten-fold overspend** now that it
  runs once a BATCH: a ten-page paper would refill ten times and quietly buy a hundred vision
  calls. `markRation()` fills it at the door that STARTS the run, so a paper's worth of rebuilds is
  still `MB_BUILD_MAX` however many batches it arrives in. **It has exactly ONE caller** — 🧩
  `mbRedo` is deliberately not one, because its own bound is `MB_REDO_MAX` and one counter for two
  limits is a button that silently does nothing once a paper has been marked.
- **THE PER-BATCH CALL IS AWAITED, never fired and forgotten.** It writes documents, uploads
  pictures and reloads the book, so two passes in flight would race over `have`, the ration and
  `mistakes` itself. The next batch's reading is the wait, which is time the run would have spent
  anyway — and the run **re-checks it is still the run** afterwards, or a worksheet closed mid-
  filing carries on being marked. A batch whose filing FAILED never sinks the marking.
- **ONE TOAST A PAPER, NEVER ONE A BATCH.** The mid-run passes are `quiet`, `fileMistakes` hands
  its counts BACK (`{ filed, wentPast }`) and the caller adds them up — so a ten-page paper says
  what it filed once rather than four times over, and 🕳 the skipped ones are still named
  separately in it.
- **THE RELOAD AND THE MIRROR RUN ON EVERY PASS**, mid-run included: they are what make a
  half-marked paper's book REAL rather than pending. The mirror is a whole-book, last-writer-wins
  write (📕 above), so running it more than once a paper is a few extra writes and never a wrong
  answer — and it is still written AFTER the reload, never before it.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🐛 THE SAVE THREW BEFORE IT WROTE A BYTE (v1.43.0)

**`saveCrashed`** beside `performSave` (search `THE SAVE THREW BEFORE IT WROTE A BYTE`), the
wrapped `syncActiveTextEditValue()` at the top of `performSave`, its `finally`, and the
`.catch(saveCrashed)` on all three fire-and-forget call sites — the auto-save timer, `flushSave`
and `$('saveBtn')`.

`performSave`'s first statement was **`syncTextEditValue()`**, a name that has never existed in
this file: the function is `syncActiveTextEditValue`. So **every save threw a ReferenceError on
its very first line** — the timer, the flush on the way out of the tab and the Save button alike —
and **nothing was written for forty-eight versions**. No ink, no marking, no hints, no score. The
button sat on *Save* and never became *✓ Saved*, which is precisely what it reads when there is
nothing to save.

- **IT WAS SILENT BECAUSE NOBODY HELD THE PROMISE.** `performSave` is `async`, so the throw was a
  rejected promise — and `setTimeout(function () { performSave(true); })`, `flushSave` and the
  button all start it without awaiting. An unhandled rejection is a line in a console no student
  opens. **That is the fault worth remembering, not the typo**: a rename that misses one call site
  is ordinary, and forty-eight versions of silence is not.
- **READING THE OPEN BOX MAY NEVER COST THE SAVE**, and it is wrapped on its own for exactly that.
  The box being typed in is ONE annotation; the worksheet is the whole lesson — and it cost all of
  it. `syncActiveTextEditValue` and **NEVER `commitActiveTextEdit`**: this runs on a timer armed
  the moment a box is made, and committing here closes the box under a child still typing into it
  (which is the regression v1.19.x's own commit was written to fix).
- **`saveCrashed` REPORTS A THROW EXACTLY AS A REFUSED WRITE IS REPORTED** — `saveFails++`, the
  copy kept on the device, ⚠ on the button, the retry re-armed. To a student the two are the same
  thing: their work is not on the server. A fire-and-forget call site with no `.catch` is this bug
  again, wearing whatever the next missing name is.
- **THE CLAIM IS RELEASED IN A `finally`.** `savingNow` left true is a SECOND way for this app to
  stop saving and say nothing: every later save returns `false` at the gate. For the same reason a
  missing toolbar cannot strand it — `btn.disabled` on a null is a throw between the claim and the
  release.
- **THE CENSUS IS THE GUARD, AND IT IS THE HALF WORTH KEEPING.** Every pin the auto-save section
  already had passed the whole time, because each asked what the source *says* rather than whether
  the names it says RESOLVE. `tools/tutor-tests.mjs` now reads every bare `name(` on the save path
  and fails on one that is defined nowhere in the file, against a deliberately SHORT list of
  browser globals — **a name added to that list to make a red tick go away is the guard being
  switched off**.
- **THE BUTTON SAYS IT SAVES BY ITSELF**, in BOTH places: the markup's first paint and
  `setSaveState`'s repaint. One alone is a button that says it until the first save and then stops.
- Run **`node tools/tutor-tests.mjs`** after touching any of it — **and watch the button go from
  Save to ✓ Saved on a real worksheet**, which is the one thing reading the source could not check
  and is exactly how this shipped.

## 🕒 THE MISTAKE BOOK READS NEWEST FIRST (v1.43.0)

`MIST_SORTS` / `mistSort` beside the filter state, the `mistSort === 'new'` arm of **`mistCompare`**,
the `flat` argument on **`mistGroups`**, the sort row in `renderMistFilters` and the
`mistGroups(show, mistSort === 'new')` in `renderMistList` (search `HOW THE BOOK IS ORDERED`).

📕 the book is ordered by the SYLLABUS, which is right for revising — you read DOWN it rather than
hopping about — and is the wrong shape entirely for *"what did I just get wrong?"*: the paper
marked a minute ago is scattered across whichever headings its questions belong to.

- **IT IS A SORT, NEVER A FILTER**, so `mistFiltered` must not count it: ✕ Clear the filters is
  about work that is out of sight, and a sort has put none of it there. It is remembered NOWHERE,
  the rule the filters already follow — one rule for the whole bar rather than two.
- **NEWEST FIRST READS THE STAMP, not the order the read arrived in.** `loadMistakes` asks
  Firestore for `createdAt` descending, so `_i` already IS that order today — and a sort leaning on
  it would silently become something else the day that query changed, under a chip still reading
  *Newest first*. The stamp is the fact; `_i` is only the tie-break, which is what keeps two
  questions filed in ONE marking run in paper order under it. An unreadable stamp is 0 and files
  LAST rather than throwing the render, the rule `shelfStamp` already follows.
- **ONE LIST, NEVER GROUPED.** Cut into subjects and topics, the card the student opened the book
  to see is buried under whichever heading it belongs to — the whole thing this sort exists to
  avoid. `mistGroups(list, true)` returns ONE nameless section holding ONE nameless group, which is
  what `renderMistList` already draws with no headings at all (`manySubjects` and `manyTopics` are
  both false), **so the flat list costs no second renderer**. It still FILTERS NOTHING: same list
  in, same list out — and **called without the flag it is byte-for-byte the grouped book it was**.
- **THE CHIPS ARE THEIR OWN ROW.** On the status row *Sorted* means a question since got right, and
  *Newest first* beside it is two kinds of answer wearing one shape. Drawn only when there is more
  than one card: one card has no order.
- ✏️ Practise and 🖨 the printed sheet read `mistakesShown()`, so they follow the sort for free —
  which is the point, not a side effect.
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

## 📈 WHO DID WHAT — student usage (v1.6.0, and the two faults that made it read 0 — v1.50.0)

`USAGE_EVENTS` / `usageLabel` / `USAGE_RECENT_MAX` / **`usageNote`** /
`usageAdd` / **`usageFlush`** / `usageStart` / **`usageSeedRecent`** /
`usageStop` / `usageDayKey` / **`usageOf`** / `usageAccuracy` / `usageRecent` /
`openPersonUsage` (search `WHO DID WHAT`), plus the extra columns on 👥 and
the `#personModal`.

The roster said who had signed in. It could not say what any of them had
**done** — which is the question a teacher opens that list with.

### 🐛 A DOTTED KEY IN A `set()` IS A LITERAL FIELD NAME (v1.50.0)

Every counter on the panel read **0** — worksheets, marked, questions, hints,
days used — on an account with fifty-seven questions in its mistake book. The
call sites were all there and every write LANDED. They landed where nothing
reads them.

- **`set()` AND `update()` READ A KEY TWO OPPOSITE WAYS.** `update()` splits a
  key on its dots and walks into the map, so `tutorUsage.hints` means the
  `hints` field INSIDE `tutorUsage`. `set()` does not: it takes each key as ONE
  literal field name. So `patch['tutorUsage.' + k]` under `set(…, {merge:true})`
  wrote a **top-level field whose own name contains a full stop**, and
  `p.tutorUsage` — which is what `usageOf` reads — stayed undefined for ever.
- **IT WAS SILENT IN THE WORST WAY.** Nothing threw, nothing was denied, and
  the FEED beside it (`tutorRecent`, a plain key with no dot in it) worked
  perfectly — so the panel showed a student's last two actions above a grid of
  zeros, which reads as a child who has not started rather than as a broken
  write. **The one screen that could have shown the fault is the screen the
  fault blanked.**
- **THE COUNTERS ARE A NESTED MAP NOW**, `patch.tutorUsage = usage`, because
  `{ merge: true }` is a DEEP merge for maps — so the increments land where
  `usageOf` reads them and still touch only the counters in hand.
- **AND WHAT THE BROKEN WRITE RECORDED IS STILL READ, AND ADDED** (`usageOf`'s
  `n(k)`). A whole term of work is on those flat keys. Falling BACK to them
  would report a child with four hundred questions behind them as having done
  the three they have done since the deploy, which is the same data loss
  wearing a tidier face; adding them is what makes the panel right on the very
  first render, with nothing to migrate and no script to run.
- **THE PIN THAT WOULD HAVE CAUGHT IT ASKS WHAT THE WRITE WOULD DO**, not what
  the source says — the old one counted the string `'tutorUsage.'` and was
  green for the whole life of the bug. `tools/tutor-tests.mjs` now asserts no
  key of the patch carries a dot **at any level**, and a **file-wide census**
  fails on the next quoted dotted key written anywhere. It can afford to be
  whole-file because the pattern is narrow (a QUOTED dotted literal in key
  position) rather than an attempt to strip comments — the trap this repo
  documents about hand-rolled JS strippers. **A dotted key that is really
  wanted belongs on an `update()`, and the exemption belongs in that census in
  writing.**

### 🐛 …AND THE FEED WAS WIPED ON EVERY SIGN-IN (v1.50.0)

`tutorRecent` is written WHOLE — last-writer-wins, deliberately — and what was
written was `_usage.recent`, which starts **empty every session**. So the first
flush after a sign-in replaced the entire history with the two or three events
since, and a teacher opening a student who had marked four papers last week saw
*Signed in* and nothing else.

- **`usageSeedRecent` READS THE ROW BACK FIRST** and the session's events are
  appended to it. The student can read their own profile — `onboardRequire`
  already does, on every sign-in — so it needs no rules change.
- **⚠️ A READ THAT FAILED MUST NOT WRITE THE FEED AT ALL.** `seeded` is set
  only by a read that really came back. Losing a few lines out of a log is a
  lost line; a log REPLACED by a fragment because a network blip made the
  history look empty is this very bug arriving through its own fix. The
  counters are unaffected either way — an increment never needs to know what
  was there before.
- **THE SEED IS CHECKED AGAINST `_usage` ITSELF**, not against a uid: a
  different account signing in while the read is in flight must not have the
  previous student's history seeded onto it.
- `USAGE_RECENT_MAX` went from 40 to **150**. It was 40 while the feed was
  (accidentally) one session long; it spans sessions now, and a teacher asking
  what a student has been doing wants more than an afternoon.

- **`usageNote(key, detail)` IS THE ONE DOOR**, and `usageAdd` is its only
  sibling (for the counts that are not one-per-event: a marking run is ONE
  `mark` and eighteen questions). A second writer is a second place to forget
  the two rules below, and a path added later that logs its own way is a piece
  of work that shows up in no total.
- **WHAT LEAVES THE DEVICE THROUGH *THIS* DOOR IS COUNTS AND A WORKSHEET'S OWN
  NAME.** Never a question, never an answer, never the mark on a particular
  question. The detail is folded to one line and cut to 80 characters, so a
  caller that hands it something bigger cannot turn the feed into a transcript.
  **Since v1.35.0 the MISTAKE BOOK is the one deliberate exception** and it has
  its own door (📕 below) — `usageNote` is not it, and widening this one to
  carry a child's words would put them in a feed with none of that door's
  guards on it.
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
- **🕒 THE MISTAKE PANEL IS NEWEST FIRST, BY THE STAMP** rather than by the
  order the rows happened to be written in. A book read for "what went wrong
  last night" is useless in any other order, and a row from an older version
  that carries no stamp sorts LAST rather than jumping to the top.
- **It needed no Firestore rules change**: more namespaced fields
  (`tutorUsage`, `tutorRecent`) on a document this app already writes, merged.
  Those rules live in another repository and are shared with four apps, so a
  feature that needs one is a feature that waits.
- **The panel is a READ.** Nothing in `openPersonUsage` writes anything
  anywhere.
- Run **`node tools/tutor-tests.mjs`** after touching any of it — **and
  `node tools/browser-check.mjs`, and open one student on a real roster.**
  Every pin here asked what the source SAID and all of them were green over a
  build whose every counter read 0; a browser is the only thing that can tell a
  number that is recorded from a number that is SHOWN.

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

## 📕 THE MISTAKE BOOK IS FILED — subject, topic, objective, searchable (v1.32.0)

`MIST_NO_SUBJECT` / `MIST_NO_TOPIC` / `MIST_SEARCH_MAX` / `mistFilter` / `mistSubject` /
`mistTopic` / `mistLo` / `mistQuery` / **`mistPlace`** / `mistSubjectKey` / `mistSubjectLabel` /
`mistTopicKey` / `mistTopicLabel` / `mistHaystack` / `mistSearchTerms` / `mistSearchHit` /
**`mistMatches`** / `mistSubjectRank` / `mistCompare` / `mistakesShown` / **`mistGroups`** /
**`mistFacet`** / `mistSubjectFacet` / `mistTopicFacet` / `mistLoFacet` / `mistPruneFilters` /
`mistFiltered` / `mistClearFilters` / `mistFilterTopic` / `mistFilterLo` / `renderMistakes` /
`renderMistFilters` / `renderMistList` / `mistChip` / `mistSelect` / `syncMistClear` (search
`THE MISTAKE BOOK, FILED`), the `.mistTags` row on `mistakeCard`, and the `.mistFilters` /
`.mistChipRow` / `.mistPickRow` / `.mistPickBox` / `.mistSearch` / `.mistGroup` / `.mistGroupHead`
/ `.mistTopicHead` / `.mistTags` / `.mTag` CSS.

The book was ONE list, newest first, with a *Still to do / Sorted / All* chip over it. That is
fine at ten cards and useless at eighty — a student revising Heat scrolled past every fraction
they have ever got wrong to reach the four questions that were about heat, which is a book nobody
opens twice. It is filed now, under the SAME syllabus 🧭 the diagnostic already files a marked
paper under.

- **`mistPlace(m)` IS THE ONE PLACE A MISTAKE'S PLACEMENT IS DECIDED**, and every reader goes
  through it — the chips, the sections, the sort, the search, all three facets. A second
  placement is a card filed under one heading and counted under another, with nothing on any
  screen saying so. It is memoised on `m._place`, which is why `mbRedoOne` clears it.
- **THE CATALOGUE HAS THE LAST WORD, and that is the difference from `diagItemPlace`.** That
  function trusts a placement the marking already made — right for a report about one paper, and
  not enough for a book that is FILED under headings: **an id the syllabus no longer has would
  give a card a chip reading its own bare `heat-flow` and a section nothing else is ever in.** So
  an id that does not resolve through `syllabusLo` / `syllabusTopic` is DROPPED, and what is left
  is the topic if that resolves and the model's own wording if it does not — `diagPlace`'s own
  rule, applied one step later.
- **`mistGroups` FILTERS NOTHING.** It is handed the list `mistakesShown` has already narrowed and
  it groups it; a group builder that filtered as well would be a second filter to keep in step,
  and a card lost from a section looks exactly like a card that was never there.
- **THE SECTIONS ARE THE SYLLABUS'S OWN ORDER** (`place.order`, `Infinity` for an unplaced one),
  never the order the mistakes happened in — so revising goes DOWN the book rather than hopping
  about it, and *Not on the syllabus list* is always last.
- **`mistMatches(m, terms, upTo)` IS THE ONE PREDICATE, and `upTo` is what makes the pickers
  usable.** A facet counts what it WOULD offer by stopping at its own axis, so choosing a topic
  does not hide every other topic out of the very list it was chosen from. It is narrowed by the
  axes ABOVE it (a subject narrows the topics), which is the half that has to keep working.
- **NO FACET COUNT READS THE QUERY.** The search is applied after all three axes, so a chip
  reading *Science (12)* means twelve in the book rather than twelve matching what is half-typed.
- **A CHOICE THAT NO LONGER MATCHES ANYTHING FALLS BACK, ON EVERY PAINT** (`mistPruneFilters`,
  called from `renderMistakes` BEFORE the bar is drawn). Deleting the last card of a topic is the
  ordinary way a filter goes stale, and it goes stale in the one place nobody is looking — a prune
  that is only ever called by hand is one that never runs.
- **EVERY SEARCH TERM HAS TO APPEAR** (`mistSearchHit`), so a second word NARROWS: typing
  "heat metal" and getting every card about heat is a search box that stops being used after the
  first time. `mistHaystack` reads everything the card can SHOW — and **a question set out in
  BLOCKS keeps its wording there rather than in `question`**, so the blocks are read too or every
  rebuilt question is unsearchable. It is memoised on `m._hay`.
- **TYPING REPAINTS THE LIST AND NOT THE BAR.** `renderMistakes` is `prune → filters → list`, and
  the search handler calls `renderMistList()` + `syncMistClear()` alone: the input is never
  destroyed, so the caret stays put and forty cards' worth of pictures are not torn down on every
  letter. ✕ Clear is shown and hidden in place for the same reason.
- **MODEL OUTPUT IS PAINTED AS TEXT** — `op.textContent`, never `innerHTML`. A topic is a word a
  model wrote.
- **THE FILTERS ARE REMEMBERED NOWHERE.** A topic filter that survived a reload is one somebody
  set last Tuesday and never noticed again, and the book then looks empty for no reason.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## 🧩 SETTING A MISTAKE OUT AGAIN (v1.32.0)

`MB_REDO_MAX` / **`_mbBuildFrom`** / `mbStoredPage` / **`mbRedoShots`** / **`mbRedoOne`** /
`mbRedoWanted` / `_mbRedoBusy` / `mbRedo` (search `SETTING A MISTAKE OUT AGAIN`), the 🧩 button
on `mistakeCard`, the one in `renderMistTools`, and the `redo` row of `USAGE_EVENTS`.

The rebuild (🧩 THE MISTAKE IS THE QUESTION, above) runs ONCE, inside the marking run, with
`MB_BUILD_MAX` for the whole paper — so a question that missed the ration lands on the whole-page
tier and **stays there for ever**: a photograph of a page with two other questions on it, which is
not a question anybody can practise. This is that pipeline on demand.

- **IT IS THE SAME PIPELINE, NOT A SECOND ONE.** `_mbBuildFrom` is the ask — `MB_BUILD_SYS`,
  `_mbCleanBuild`, the same shots — lifted out of `_mbBuildBlocks` so both callers share it, and
  `_mbBuildFigures` / `_mbCropBox` / `_mbUpload` do the cutting. A second prompt here would be a
  second prompt to improve and the drift would be silent: one door sets a question out properly
  and the other hands back a photograph.
- **THE RATION IS STILL SPENT BY THE CALLER**, in `_mbBuildBlocks`, BEFORE the call — so a failure
  cannot buy another try. `_mbBuildFrom` spends nothing, because this button's bound is
  `MB_REDO_MAX` and the marking run's is `MB_BUILD_MAX`; one counter for two different limits is
  a press that silently does nothing once a paper has been marked.
- **`mbRedoShots` IS THE ONE PLACE THE PICTURES COME FROM, best first**: the open worksheet's own
  PDF (`rbCleanPage`, which re-renders at `RB_PAGE_MAX_SIDE`, so the crop is as sharp as the
  marking run's and carries none of the student's ink), then the mistake's own stored page, which
  is the only source the book has when the worksheet is shut.
- **`crossOrigin` IS SET BEFORE `src`** in `mbStoredPage`. Set afterwards it does nothing, the
  picture loads tainted, and the crop then dies on a `SecurityError` when it is SAVED rather than
  when it is opened — the trap `openCrop` already documents.
- **A QUESTION ALREADY SET OUT IN BLOCKS IS SKIPPED** (`mbRedoWanted`, asked by the card's own
  button and by the tools bar). Redoing work that is done is the one way this button can cost a
  call and change nothing.
- **THE OLD PICTURE IS DELETED ONLY AFTER THE NEW ROW IS WRITTEN**, and a refused delete is
  swallowed: a file left in the bucket is untidy, a card with no picture is unreadable. A build
  that produced neither blocks nor a crop returns `'failed'` and writes NOTHING — a patch of
  nothing saved as a success is a card that lost its picture to a call that did nothing.
- **IT RETURNS A WORD, NOT A BOOLEAN** (`done` / `no` / `ai` / `source` / `failed`): "there was
  nothing to read it off" and "the model could not set it out" are different things to tell
  somebody, and the caller is what says them.
- **ONE AT A TIME, BOUNDED, AND IT STOPS ON `ai`.** `_mbRedoBusy` is the lock; `MB_REDO_MAX`
  bounds one press; the engine being off means every remaining card would say the same thing, so
  the loop breaks rather than spending the wait. `Promise.all` in that loop is the change that
  must never be made — `_mbUpload`, `mistakesCollRef` and the module's own globals interleave
  exactly as two uploads do.
- **`m._place` AND `m._hay` ARE CLEARED** with the patch. Both are memoised on the mistake, and a
  question set out again with new wording that is still searched and filed under the old one is
  the filing quietly lying.
- Run **`node tools/tutor-tests.mjs`** after touching any of it.

## ⏱ THE LIMITS ARE OFF THE LIVE TUTOR (v1.33.0)

`LIMITS` / `DURATION_MIN` / `DURATION_MAX` / **`capOn`** / **`liveDuration`** in
`functions/live-service.js`, the three `capOn(policy.…)` guards and the `leaseAt` lock in
`reserve` (`functions/live-repository.js`), and the card's half —
`LIVE_MAX_SECONDS_DEFAULT` / **`liveMaxSeconds`** / `liveClockText` / `liveLengthWords`, the
`liveTutor.maxSeconds` written from the start reply, and the `#liveClock` line in
`renderLiveCard` (search `HOW LONG A LESSON MAY RUN IS THE SERVER'S ANSWER`).

Four numbers stood between a child and the live tutor. **Three were RATIONS and are off**
(`startsPerDay`, `globalStartsPerDay`, `concurrent`, all `0`). The fourth is not a ration and is
deliberately NOT removed.

- **`0` IS HOW "NO CAP" IS WRITTEN, AND `capOn` IS THE ONE PLACE THAT IS READ.** All three
  refusals ask it, and the harness counts THREE `capOn(policy.` guards in `reserve` — one left
  unguarded is the whole change quietly not happening, on a screen that still says the limits
  are off.
- **THE RATIONS FAIL OPEN AND THE DURATION FAILS SHUT, and that asymmetry is the design.** For a
  ration, anything that is not a finite number ≥ 1 is off: the worst case is a bill the teacher
  can SEE, where failing shut is a child told to come back at midnight. `durationSeconds` is the
  opposite — the lease's `expiresAt`, the scheduled sweep and the stale-slot rule are all built
  on it, so an endless one is a paid call nothing ever closes and a bill that runs all night with
  nobody in the room. It is CLAMPED (`liveDuration`, 60s–13600s) rather than trusted, and **`0`
  does NOT mean "off" there**.
- **`typeof`, NEVER `Number()`, in `liveDuration`.** `Number(null)` is 0 and `Number('')` is 0, so
  coercing a MISSING field hands every child a one-minute lesson — quietly, from a deploy nobody
  would think to check. Something that is not a number at all is the bounded CEILING; a real
  number out of range is pulled to the nearer end.
- **THE LEASE CARRIES THE CLAMPED NUMBER, never `policy.durationSeconds`.** The two look identical
  while the shipped value is in range; on a junk one the raw form is `NaN`, which is an expiry
  that is never past, on a lease the sweep can therefore never find.
- **THE COUNTS ARE STILL KEPT.** `starts` is what the teacher can look at and what v1.32.0's
  refund takes back off — switch the counter off with the cap and that whole path rots into code
  nothing runs, so the refund's own tests stop meaning anything.
- **THE ACCOUNT'S OWN LOCK LETS GO OF ITSELF NOW.** `currentLease` is cleared by `release`, so a
  tab closed mid-lesson, a dropped network or a failed close left it set and **every later start
  on that account was refused for ever** with *"a live lesson is already open"* — the one limit a
  student could hit that would never come back, and the per-account twin of the concurrency slot
  v1.32.0 fixed for the whole school. `leaseAt` is the moment it was taken and ONE `staleBefore`
  serves both locks. **A lock with no `leaseAt` is one written before this shipped and is let
  go**, exactly as a legacy `active[key] = true` is: the alternative strands those accounts
  permanently, where this costs at most one double-billed lesson, once, at the deploy.
  `release` still clears it outright — the stale rule is the net under that, never the way out.
- **THE TWO CENTRE-WIDE CEILINGS ANSWER DIFFERENTLY.** *"Twenty are running right now"* comes back
  in minutes and *"the centre has used today's allowance"* comes back at midnight; the old single
  sentence said *"busy or has reached today's allowance"* and left the student to guess, which is
  the very fault v1.32.0 fixed at the other end of the same wire. Both are off; each is worded for
  the day somebody turns it back on.
- **HOW LONG A LESSON MAY RUN IS THE SERVER'S ANSWER, NOT A NUMBER TYPED IN THE CARD.**
  `#liveClock` read `/ 10:00` and *Up to 10 minutes* as literals while the endpoint decided the
  real length, so the two were one deploy apart from disagreeing — and here they did. A student
  watching the clock go PAST its own ceiling reads a broken clock rather than a longer lesson.
  `maxDurationSeconds` has been in the start reply all along and was thrown away; it is read now,
  so there is no second place to keep in step. **A junk value can never SHRINK the clock**
  (`liveMaxSeconds` falls back rather than flooring), because a caption counting towards a number
  the session does not end at is worse than no caption. `liveClockText` is `m:ss` under an hour
  and `h:mm:ss` at or over it — "60:00" is a number nobody reads as an hour — and
  `liveLengthWords` is the before-it-starts caption in words.
- **IT NEEDS A FUNCTIONS DEPLOY, AND SINCE v1.33.1 MERGING IS ONE** (🚀 below). Pages carries
  `index.html` and not `functions/`, so shipping one half leaves the rations in force with the
  card's clock counting towards an hour on a server still ending lessons at ten minutes — which
  is exactly what happened between v1.32.0 and v1.33.1.
- Run **`cd functions && node --test test/*.test.js`**, **`node tools/tutor-tests.mjs`** and
  **`node --test tools/live-tutor-tests.mjs`** after touching any of it.

## 🚀 MERGING IS WHAT DEPLOYS THE SERVER HALF (v1.33.1)

`.github/workflows/deploy-functions.yml`, and the `node --test functions/test/*.test.js` step in
`.github/workflows/checks.yml`. The harness pins both (search `AND MERGING IS WHAT DEPLOYS THE
OTHER HALF` in `tools/tutor-tests.mjs`).

**The live card said *"Up to 1 hour"* and the tutor still refused a lesson.** Both were true about
a different half of the app: the page was v1.33.0 and the endpoint it was talking to predated
v1.32.0. Pages ships `index.html` on merge; **nothing shipped `functions/`** — it moved only when
somebody remembered `firebase deploy`. So ⏱ and 🎧 above were both live on the screen and neither
was live on the server, for two versions, with nothing anywhere able to say so.

- **THE DRIFT IS THE FAULT, NOT THE FORGETTING.** Two halves of one app on two deploy paths, one
  of them automatic and one of them a person's memory, will come apart — and come apart SILENTLY,
  because each half is internally consistent and only their conversation is wrong. Merging is now
  the deploy for both.
- **THE SCOPE IS THE ONE THING THAT COULD DO REAL DAMAGE.** `mathgen--app` is SHARED: the Maths
  repo's `askOpenAi` / `askKimi` run on the same project, so `--only 'functions:study-buddy-live'`
  is what keeps a deploy from this repository to the two functions it owns. **And never
  `--force`** — a run that wants to DELETE something stops and says so rather than quietly taking
  another app's function off the project, which no screen in either app would ever report.
- **A MISSING KEY WARNS AND SKIPS; IT NEVER FAILS THE RUN.** `FIREBASE_SERVICE_ACCOUNT` is one
  secret set once, and until it is there the job runs the tests and says in words what is missing.
  A red tick on every merge is a red tick people learn to scroll past, and the next REAL failure
  would go past with it.
- **THE KEY IS SHREDDED ON `if: always()`.** A service-account JSON left on a runner is a key left
  on a runner, and a failed deploy is exactly when a step gets skipped.
- **THE TESTS RUN TWICE, ON PURPOSE.** In the workflow before the deploy machinery is started, and
  again through `firebase.json`'s own `predeploy`. The second is what protects a deploy run by
  hand from a laptop.
- **THE HARNESS READS THE DEPLOY STEP, NEVER THE WHOLE FILE**, the rule `LIVE_THROWS` and
  `CLOCK_SRC` already carry — this section names the flag it forbids, so a check matching its own
  documentation would go green on the fault and red on the fix. **It is the WHOLE step and not
  `npx …--non-interactive`**: a slice that stops at whichever flag happens to be last is a slice
  the next flag falls outside of, and the `--force` mutant went straight through exactly that.
- **`functions/test/*.test.js` HAD NEVER RUN IN CI AT ALL** — forty-eight tests over the limits,
  the refund, the lease and the two locks, and every one of them only ever ran when somebody ran
  it by hand. It needs **no `npm ci`**: the three suites touch only `live-service` /
  `live-repository` / `live-provider`, which are pure, so the check has no lockfile to rot and no
  registry to be unavailable. **The DEPLOY does need it** — firebase-tools loads `index.js` to
  discover the exports, and that line requires `firebase-admin`.
- Run **`node tools/tutor-tests.mjs`** and **`node --test functions/test/*.test.js`** after
  touching any of it.

## 🎧 WHY LIVE TUTORING SAID "BUSY" (v1.32.0)

`liveErrorText` and the `throw` in `startLiveTutor` (search `WHY LIVE TUTORING SAID NO`), plus
`reserve`'s stale sweep and `release`'s refund in **`functions/live-repository.js`**.

The live card said **"Live tutoring is busy. Please try again in a little while."** and it was not
busy, and it was not going to come back in a little while. Three faults, and each is silent.

- **THE DAY'S ALLOWANCE IS SPENT IN `reserve`, BEFORE THE PROVIDER IS EVER ASKED.** That is the
  right order — the reservation is what stops two tabs racing — but `release` never gave it back,
  so a microphone the student refused, an SDP the other end rejected and a rate limit there each
  cost one of `startsPerDay` (6). After six the endpoint answered 429 `daily_limit`, honestly, and
  the student had had no lesson at all. **`refund` is `!lease.sessionId && current.exists &&
  ownerData.day === dayKey(lease.createdAt)`**, and all three clauses are load-bearing: a lesson
  that really ran and was stopped still counts (that is what the allowance is FOR), the session
  document must still exist or a retried stop refunds the same start twice, and the day must be
  the lease's own or a refund at midnight takes one off tomorrow.
- **THE SERVER'S OWN REASON WAS THROWN AWAY.** The client read `response.status` and substituted
  its own wording, so *"you have used today's 6 live lessons, they come back at midnight"* was
  shown as *"busy, try again in a little while"* — two different things to be told, and only one
  of them true. `liveErrorText` takes the message, folds its whitespace and clips it to 240; the
  status map is the FALLBACK behind it, not the answer.
- **A CONCURRENCY SLOT NOW LETS GO OF ITSELF.** `active` holds the twenty slots the whole school
  shares and was written as `true`, released only by a scheduled sweep that is a SEPARATE Cloud
  Function — deploy the endpoint without it and a handful of closed tabs takes live mode away from
  everybody PERMANENTLY, with every screen saying "try again in a little while" about something
  that is never coming back. Each entry carries the moment it was taken (`active[id] = now`) and
  `reserve` drops anything older than a whole lesson plus a minute. **A legacy `true` reads as `1`
  through `Number` and is let go for the same reason**, which is what makes the change safe to
  deploy over live data — and also why the slot must be written as a NUMBER: written as a flag,
  the very next start sweeps a lesson that is really running and the shared ceiling stops holding
  at all, which looks exactly like live mode working.
- **IT NEEDS A FUNCTIONS DEPLOY, AND SINCE v1.33.1 MERGING IS ONE** (🚀 below). The
  `index.html` half ships with GitHub Pages and `functions/live-repository.js` does not, so
  shipping one without the other leaves the reported fault in place with the release notes saying
  it is fixed — **and that is not hypothetical: this very fix sat undeployed for two versions.**
- Run **`cd functions && node --test test/*.test.js`** and **`node tools/tutor-tests.mjs`** after
  touching any of it.

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
- **`isDrawTool` deliberately excludes 💡 hint, 🎤 speak, 🖱️ select and — since
  v1.42.0 — 🅣 text (🅣 above).** Those are a tap and a drag of something already
  on the page; a finger doing either is not a palm about to ruin the worksheet,
  and handing them to the pan engine would make them unusable without a pencil.
  **The test is whether the tool leaves a MARK BY DRAGGING**, which is what 🅣
  was mis-filed against.
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

## 👉 A PROMPT THAT ONLY RULES ON A MARK NEVER DRAWS ONE (v1.47.0)

The `POINTING AT THE PAGE` / `MARKING TWO PLACES AT ONCE` / `WRITING WORKING ON THE PAGE`
paragraphs of **`HINT_SYS`**, the two `Include "point"` / `Include "work"` lines
**`hintLadderFor`** pushes, and the 👉 / ✍️ paragraphs of `runLiveDelegation`'s system
prompt (search `ALMOST EVERY HINT IS ABOUT SOMETHING PRINTED` and `ALMOST EVERY REPLY IS ABOUT
SOMETHING PRINTED`).

*“You say my tutor can draw boxes, but it doesn't really annotate when helping students.”* It
could. It almost never did — **and nothing was wrong with the drawing.** 👉 v1.30.0 built the
finger, ✍️ v1.31.0 the working, ① ② v1.45.0 the pair, and every pin over all three was green.

- **THE FAULT WAS THAT NEITHER PROMPT EVER ASKED.** Both RULED at length — the four shapes, the
  0–1000 grid, the pair and its numbering, the cap of three, the refusal to guess — and this
  file's own 👉 section had already named exactly that failure about the SECOND mark
  (*“A prompt carrying every rule about a pair and nothing that says to write one is this half
  quietly not existing”*). **The same hole was under the FIRST mark and nobody looked**, because
  every check here reads what the prompts rule. `HINT_SYS`'s pointing paragraph opened by
  DESCRIBING a field, its working paragraph ENDED on a reason to leave it out, and
  **`hintLadderFor` — the message that asks for each rung by name — never mentioned `point` at
  all**. A model read three opt-outs and no instruction.
- **THE DEFAULT IS STATED FIRST, AND WITH ITS REASON.** *Almost every reply is about something
  printed on the page, so a mark belongs on almost every one of them.* A child who is stuck
  usually cannot FIND the thing being talked about — which is most of what being stuck is, the
  framing 👉's own section has always used — so the sentence without the finger is half the help.
- **AN EXAMPLE IS A TRIGGER; A CONDITION IS NOT.** *“When your reply is about one spot”* is read as
  rarely true. The number that was missed, the word that decides the question (*total*, *each*,
  *difference*, *not*), the units, the row of the table, the label on the diagram, the part read
  past — those are met on nearly every question, and both prompts now list them.
- **THE OPT-OUT IS THE HALF THAT HAD TO BE NARROWED, NOT REMOVED.** *“If you cannot place it
  exactly”* and *“if you are not sure”* are doors a model that is never quite sure walks through
  every time. The ONE reason is that the position cannot be **read off the teal grid**; a short
  reply is not a reason and neither is the spot seeming obvious. **Removing it instead would be
  the other fault**: a finger on the wrong question is worse than no finger at all, and that
  sentence stays in both prompts.
- **ASKING HARDER CANNOT PUT A FINGER ANYWHERE UNSAFE, and that is why this is a prompt change
  and nothing else.** `tutorPointsMake` → `_markAt` still REFUSES a position it cannot place
  rather than clamping it, `tutorPointShow` still caps at `POINT_MAX`, `tutorWorkShow` still asks
  the LADDER again, and `tutorWorkLines` still refuses a block whose last line carries no `?`.
  Every guard is downstream of the prompt, so the worst a keener model can do is be refused.
- **THE METHOD RUNG IS STILL THE GATE ON WORKING, IN THE PROMPT AS WELL AS THE CODE.**
  `Include "work" ONLY when the request says the method rung was asked for` stays word for word:
  a prompt is not a lock, but one that stops mentioning the lock invites the field on a worksheet
  whose parent switched that rung off.
- **THE TYPED CHAT IS DELIBERATELY UNTOUCHED.** `livePointStrip` is called from `liveFlush` and
  nowhere else, so the chat panel has NO marker consumer: marker syntax in `CHAT_SYS` would print
  *“[[point p3 412,300 underline]]”* to the student as part of the answer. The harness pins that
  neither `CHAT_SYS` nor the shared `worksheetContextRule` carries a `[[`.
- **FIVE OF THE NEW PINS GO RED ON v1.46.0 AND GREEN HERE**, which is what makes them checks
  rather than ticks. The three that are green on both are INVARIANTS — the ladder gate, the
  method-rung wording and the untouched chat — and are there for the next change, not for this
  one.
- Run **`node tools/tutor-tests.mjs`**, **`node --test tools/live-tutor-tests.mjs`** and
  **`cd functions && node --test test/*.test.js`** after touching any of it — **and watch one
  live session and ask for one hint**: whether a mark is really drawn, and where it lands, is the
  one thing reading the source cannot check.

## 🐛 THREE NAMES THE FILE CALLED AND DID NOT HAVE (v1.46.0)

**`bindTextEditNode`** (beside `commitActiveTextEdit` — search `A NODE ALREADY OUT OF THE
DOCUMENT`), **`renderStylusBtn`** (beside `setStylusOnly`), the comment standing where
`attachTouchNavigation` used to be, the single `#stylusBtn` and its single click handler, and
the widened census in `tools/tutor-tests.mjs` with the new **`tools/browser-check.mjs`**.

*"Still cannot type with text box."* 🅣 v1.42.0 was right and was not enough: underneath it, three
functions this file CALLS had gone missing in a branch squash. **This is the same class of fault
💾 v1.43.0 documents — a name the source says and that does not RESOLVE — and it is the third
time.**

- **`bindTextEditNode` IS CALLED FROM `annNode`, so the FIRST TAP THREW INSIDE `renderOverlay`.**
  The annotation was pushed and `editingId` set, and then the render died before the box was
  drawn or focused — so **every later `renderOverlay` threw too**, because `editingId` stays set.
  To a child: tap the page, nothing happens, ever.
- **`renderStylusBtn` WAS CALLED AT THE TOP LEVEL, WHICH IS THE WORST PLACE FOR IT.** A throw
  there takes **every line below it**: the one-letter tool shortcuts, Ctrl+Z, Ctrl+S, Escape, the
  `beforeunload` save and the eight opening render calls. **The page still painted**, because the
  sign-in callback re-runs the renders — the same reason 💾 the dead save was invisible for
  forty-eight versions, and the reason nothing on any screen could report it.
- **`commitDrawing` WAS CALLED BY A SECOND COPY OF THE NAVIGATION ENGINE.** v1.12.0's
  `attachTouchNavigation` was superseded by `navBind` and never taken out: both bound
  `#viewerArea`, both drove the global `nav`, and the stale one called a name the current
  pipeline no longer has. **It was DELETED rather than repaired** — its v1.12.0 body no longer
  matches the pipeline (the current code pushes the annotation at creation and uses
  `drawing.node`), so "fixing" it would have been writing a second engine. One engine, one `nav`,
  one place a gesture is decided.
- **`overlayRebuilding` HAD NO READER, WHICH IS WHAT THAT MEANT.** It is written by
  `renderOverlay` and read by exactly one thing — `bindTextEditNode`'s `blur` handler, which is
  how a rebuild's own blur is told from a child moving on. A counter written and never read is
  not dead code here; it is the missing half announcing itself.
- **THE ✍️ BUTTON WAS IN THE MARKUP TWICE, WITH TWO HANDLERS.**
  `document.getElementById` hands back the FIRST match, so the stale twin was dead markup nobody
  could find — but **`$('stylusBtn')` resolves to that same element for BOTH wirings**, so the
  toggle ran twice per press and landed exactly where it started: a ✍️ that toasts at you and
  changes nothing.
- **IT SHIPS VISIBLE AND `renderStylusBtn` HIDES IT, never the other way round.** Pencil-only
  mode is ON by default, so a painter that fails leaving the button hidden is a touchscreen
  nobody can draw on with a finger and no control anywhere to say so; one that fails leaving it
  shown is one spare button on a laptop. The harness pins the direction.

### The guard, and why the old one was green the whole time

- **💾 v1.43.0's census asked about the SAVE PATH, and the save path was fine.** It was the text
  box and the wiring that were broken, so 1,600 checks passed over a build whose 🅣 tool could
  not be used at all. The census now covers **the text-edit path** and **the whole wiring block,
  handler bodies included** — a handler calling a name that is not there is a button that throws
  when it is pressed, which is this fault wearing a different hat.
- **A WHOLE-FILE census was TRIED AND ABANDONED, and that is worth writing down.** A hand-rolled
  JS stripper desynchronises on an apostrophe inside a double-quoted string and, fatally, on a
  **regex literal containing a quote** (`/[^'\\]/`) — after which real names read as missing.
  Slices whose boundaries are known are honest; a whole-file sweep is a check that cries wolf.
- **THE PIN READS THE DECLARATION, NEVER THE PROSE.** `function attachTouchNavigation\b`, not the
  bare word — the comment standing where that IIFE used to be names it on purpose, so a check
  matching its own documentation would go GREEN on the fault and RED on the fix. That is the rule
  `LIVE_THROWS` and 🚀 the deploy step already carry, and it fired here on the first run.
- **`tools/browser-check.mjs` IS THE ONLY HONEST CHECK OF ANY OF IT.** It opens the real page in
  a real Chromium, asserts nothing threw at load, builds a page the way `loadPdf` does,
  dispatches a **`pointerType: 'touch'`** pointerdown with 🅣 in hand, and then asserts the box
  appears, is focused, takes words, GROWS over three lines, commits on blur, survives a
  `renderOverlay` mid-word, and that a one-letter shortcut still reaches the page — plus one ✍️
  button that really flips the mode when pressed. **On the broken build 13 of its 17 checks go
  red and every source-level pin was green**, which is the whole argument for it. It needs a real
  Chromium, so it skips cleanly when Playwright is absent and is a tool you reach for rather than
  a gate — like `tools/text-caret-check.mjs`.
- **EVERY STEP OF IT REPORTS RATHER THAN THROWING.** A harness that crashes on a broken build
  reads as a broken harness, and the fault then looks like it is in the check.

## 🅣 A TAP IS NOT A MARK — the text tool, and 🧽 the drawn eraser (v1.42.0)

**`isDrawTool`** (search `WHICH TOOLS A FINGER MUST NOT DRIVE`), and the eraser button's inline
SVG with its `.toolIco` rule.

*“The text box on the tutor app does not work.”* It did not — **with a finger**. It worked
perfectly with an Apple Pencil and with a mouse, which is what made it read as random rather than
as anything reportable.

- **PENCIL-ONLY MODE IS ON BY DEFAULT, AND `isDrawTool` IS WHAT IT READS.** A finger on a tool in
  that list is handed to the pan engine and never reaches the overlay at all. 🅣 was in the list,
  so on the iPads these worksheets are written on the button did NOTHING, silently.
- **THE RULE THIS BROKE WAS ALREADY WRITTEN, one section up**: *“`isDrawTool` deliberately
  excludes 💡 hint, 🎤 speak and 🖱️ select… handing them to the pan engine would make them
  unusable without a pencil.”* 🅣 belongs with them and was simply left out: it captures no
  pointer, drags nothing and makes no ink — `startTextBox` runs and returns. **The test is whether
  the tool leaves a MARK BY DRAGGING**, not whether it puts something on the page.
- **A PALM STILL CANNOT ABUSE IT, and that is what makes this safe.** A palm-sized contact patch
  starts nothing at all (`isPalmTouch`, at the very top of `pointerdown`), a rejected contact is
  kept out until it lifts, and a stray empty box is swept by `commitActiveTextEdit` — *“a tap that
  changed its mind”*. There is nothing a palm can do here that survives the next tap.
- **THE COST IS ONE-FINGER PAN WHILE 🅣 IS IN HAND**, which is the same price 💡, 🎤 and 🖱️ have
  always paid, and it was already being paid *while a box was being typed in* (the nav engine's
  own `&& !editingId`). Two fingers still pan and pinch, and the margins either side of the page
  still scroll.
- **🧽 THE ERASER IS DRAWN, and that is not decoration.** There is no eraser in the emoji set, so
  🩹 — an adhesive BANDAGE — was standing in for one and read as one on every device. An emoji is
  a vendor's picture of a word; **an SVG is the picture**, and no phone's font can re-draw it as
  something else. It follows 🤖 CHUNG GPT'S FACE's rule — **flat fills, no `id`, no gradient, no
  filter** — and is sized by `.toolIco` rather than by the button's `font-size`, so it carries the
  same weight beside the emoji everywhere and sits readably on the pale `--accent` of the lit
  state as well as on white.
- Run **`node tools/tutor-tests.mjs`** and **`node --test tools/writing-tests.mjs`** after touching
  any of it — **and tap the page with a finger**, which is the one thing reading the source could
  not check and is exactly how this shipped.

## ✍️ A TABLET PEN MUST NOT PICK THE WRITING UP (v1.36.0)

`DRAG_SLOP_PX` / **`dragStarted`** (beside `PALM_CONTACT` — search `A GRAB IS
NOT YET A MOVE`), the `e.button > 0` line at the top of the overlay's
`pointerdown`, and the `cx` / `cy` / `dragged` fields on `moving`.
**`polymathlc/anskey` carries the same fixes — ship a change to both.**

Reported on a Wacom against Ans Key: *"when I'm writing it's very easy to
suddenly select strokes and move them instead of continuing writing."* Two of
the three causes are here too, and both are silent — the page goes on drawing
and nothing on any screen says what changed.

- **A GRAB IS NOT YET A MOVE.** A stylus tip is never perfectly still: it
  wobbles a pixel or two as it touches down, and a graphics tablet reports
  absolute positions, so what the hand meant as a tap on a stroke arrived as a
  tap AND a small drag — the act of SELECTING a stroke moved it. `moving` used
  to translate on any non-zero delta at all. `dragStarted` holds it until the
  pointer has really travelled.
- **THE THRESHOLD IS SCREEN PIXELS, NEVER PAGE UNITS**, and that is the whole
  point of it: page units are a hair at 400% and most of a centimetre at
  fit-width, so the same tremor would be swallowed on one worksheet and move the
  ink on the next.
- **`moved` AND `dragged` ARE DIFFERENT THINGS.** `moved` says the threshold was
  crossed (it is `dragStarted`'s own flag); `dragged` says the ink really went
  somewhere, and it is that one the undo push, `setDirty` and the redo-stack
  sweep read — a threshold crossed with nothing translated must not cost a
  Ctrl+Z that undoes nothing.
- **ONLY THE PRIMARY BUTTON STARTS ANYTHING, WHATEVER THE POINTER IS.** A
  tablet pen's barrel button sits where the fingers grip, and squeezing it
  mid-word fires a second `pointerdown` with the **SAME pointerId** as the tip
  already down — so the one-pointer-at-a-time guard cannot see it, and it
  abandoned the stroke in progress to start a fresh gesture. The old test asked
  `e.button !== 0` for a MOUSE only. The eraser end of a pen (button 5) arrives
  the same way.
- **THE THIRD CAUSE IS NOT HERE, AND MUST NOT ARRIVE.** Ans Key carried a
  `dblclick` fallback on the overlay that called `setTool('select')`, so two
  quick marks landing on existing ink silently turned the pen into the select
  tool. This app has no `dblclick` handler at all and the harness pins that it
  stays that way: a double-tap while a drawing tool is in hand is two marks.
- Run **`node --test tools/writing-tests.mjs`** after touching any of it.

## House rules
- After touching **📅 a shelf's year** (`SHELF_YEAR_RE`, `shelfYearOf`,
  `shelfYearRank`, `shelfYearsIn`, `shelfRacked`, `shelfRackTitle`,
  `shelfRackId`, `shelfWhereLabel`, `shelfYearOptions`, `shelfRackNode`,
  `shelfYearChips`, `shelfScrollToRack`, the `year` in `shelfNorm` /
  `shelfSave` / `shelfCreate` / `shelfRename`, the year arm of
  `shelfGroupCompare`, the `g.year` in `shelfGroups`, the `year` on
  `shelfSections`' sections, the rack loop in `renderWorksheets`,
  `#shelfNameYear`, or the `.shelfRack` / `.shelfYears` CSS), run
  `node tools/tutor-tests.mjs` **and** `node tools/browser-check.mjs`
  **and look at the home screen**. Every failure here is silent and the
  bookcase still paints. **Read an empty year as “nowhere” rather than as
  EVERY year and a centre's whole bookcase empties itself into a rack
  nothing draws on the deploy** — every shelf already made has no year —
  and a junk one read as a real rack does the same to one shelf at a time.
  Let a year decide whether a paper may go ON a shelf — in
  `shelfFitsClass`, in `shelfDropOk`, in the mover — and it is a second
  way to lose a paper, which is the thing the whole shelf section exists
  not to do. Stop ordering by the year FIRST and the same year turns up
  again under every level, so there is no rack to scroll to at all;
  compare the ranks with `a - b` and two undated shelves are
  `Infinity − Infinity`, which is NaN, which leaves the bookcase in
  whatever order the engine's sort produced. Make the year part of the
  GROUP KEY and a shelf is split in two; resolve it after the sort rather
  than before and nothing reads it. Draw the plates from a second walk and
  they disagree with the sections' own order the first time a shelf moves
  — a 2026 plate over a 2025 shelf, on a page that looks perfectly
  arranged. Let `shelfRacked` go and a bookcase nobody has filed grows an
  “Undated” heading over the whole page. Build the chips from the
  CATALOGUE instead of the SECTIONS and one offers to jump to a rack that
  is not drawn. Let `shelfRename`'s `undefined` stop KEEPING the year and
  a plain rename un-dates a shelf in silence. Drop the year from the
  duplicate check and “WA1” can exist on one rack only, which is the very
  thing this is for. Default a new shelf to the calendar year and a shelf
  meant for every year disappears under a rack nobody chose; drop the
  catalogue's own years from the picker and opening ✎ on a 2019 shelf
  silently un-dates it on save. And put the year into `shelfClassLabel`
  and the “belongs to a different class” sentences start saying something
  they do not mean — a year never refuses a paper.
- **Every field `shelfNorm` reads, `shelfSave` must write.** A field kept
  by the one reader and dropped by the one writer lives in memory behind
  `shelves = clean` and is thrown away on the wire — so it works
  perfectly until the page is reloaded and then is simply not there, with
  nothing on any screen saying so. That is exactly what happened to 🎓 the
  class axis for eleven versions: a shelf pinned to P6 · Mathematics stood
  there until a refresh and then belonged to every class again. The
  harness takes the KEYS off a normalised shelf and fails on any one the
  writer does not name, so the next field added to the catalogue cannot
  come back as this bug wearing a different word — do not answer a red
  tick there by narrowing what the reader keeps.
- After touching **📈 the usage record** (`usageFlush`'s `patch.tutorUsage`,
  `usageOf`'s `n(k)`, `usageStart`, `usageSeedRecent`, `usageNote`, `usageAdd`,
  `USAGE_RECENT_MAX`, `USAGE_EVENTS`, or any counter a call site raises), run
  `node tools/tutor-tests.mjs` **and** `node tools/browser-check.mjs` **and
  open one student on a real roster**. That last one is not ceremony: every pin
  in this section was green over a build where **every counter on the panel
  read 0**, because each asked what the source SAID rather than what the write
  would DO. **Write a counter under a dotted key again and it is that fault
  exactly** — `set()` takes the key as a literal field NAME while `update()`
  takes it as a PATH, so the write lands, nothing throws, the feed beside it
  goes on working, and the panel reports a child with a term of work behind
  them as having done nothing. Stop ADDING the legacy flat keys in `usageOf`
  and every number recorded before v1.50.0 disappears from the panel on the day
  this deploys, which is data loss dressed as a tidy-up. Go back to writing
  `tutorRecent` from the session's own list and the feed is wiped on every
  sign-in — the second fault, and the one that made "I cannot see their
  activity" true. Write it when the seed read FAILED and that is the same wipe
  from the other direction, so `seeded` must stay the only thing that lets the
  feed be written. Seed it against a uid rather than against `_usage` itself
  and one student's history is grafted onto whoever signs in next on a shared
  iPad. And add a name to the dotted-key census to quiet it and the one check
  that can see this class of fault is switched off.
- After touching **📕 what the teacher can see of a student's book**
  (`mistakeMirrorRow`, `_mkUrl`, `mistWhenText`, `mistakePathUrl`,
  `mistakeFigUrls`, `mistakeMirrorFill`, `mistakeMirrorNeedsLinks`,
  `mistakeMirrorCatchUp`, `mistakeMirrorSync` / `_mistakeMirrorWrite`,
  `MIST_MIRROR_FIGS` / `MIST_MIRROR_FILL` / `MIST_MIRROR_BYTES`, the `imageUrl`
  / `figUrls` `fileMistakes` writes, `mistMirrorRowNode`, or the `.mmPic` /
  `.mmWhen` CSS), run `node tools/tutor-tests.mjs` **and**
  `node tools/browser-check.mjs`. **This is the one path in the app that
  carries a child's own work off their own device**, so the harness pins the
  row's key list BY NAME: add a field and the run fails until somebody has
  decided to send it. Send a Storage PATH instead of a download link and the
  teacher gets a grid of broken images, because the admin cannot read a file
  under a student's uid; take the `https` test off `_mkUrl` and a roster row
  another app writes becomes a `javascript:` url in the teacher's page. Resolve
  the links per sync rather than keeping them on the mistake and one tick of a
  book is a hundred and fifty network calls; write an empty string to mark a
  failed resolve as done and a network blip costs that picture for ever. Drop
  the byte budget and a long book stops the mirror dead — a Firestore document
  dies at a megabyte **by refusing the whole write**, with nothing on any screen
  saying why. Leave `mbRedoOne`'s links alone and 🧩 setting a question out again
  points the teacher at a file it has just deleted — no picture at all on the
  one question somebody redid — or, through `figUrls`, at the very picture the
  rebuild replaced. Show the figures AND the whole-question crop together and the
  teacher reads the same question twice looking for a difference that is not
  there; stop captioning a whole PAGE and they are pointed at the wrong
  question on it. Let `mistakeMirrorSync` REJECT — it is `async` and all four
  callers fire and forget — and it is an unhandled rejection in a console no
  student opens, which is how 💾 the dead save went unnoticed for forty-eight
  versions. Drop `mistakeMirrorCatchUp`, or let it write when there is nothing
  to mint, and either the pictures of everything already filed never arrive or
  a hundred students write to the roster every morning for nothing. And stop
  drawing `at` and the panel is a pile of questions with no way to tell last
  night's paper from last term's — which it was, for three versions, while
  every row carried the stamp all along.
- After touching **▸ the working's steps or its size** (`WORK_SIZE`, `WORK_LEAD`, `WORK_PAD`,
  `WORK_LINES_MAX`, `WORK_CHARS_MAX`, `WORK_MAX_W`, `tutorWorkSteps`, `tutorWorkMore`,
  `tutorWorkNext`, `tutorWorkRestart`, `tutorWorkGeom`'s width / height / clamp split,
  `tutorWorkShow`'s `step: 1`, the `tutorWorkSteps(w)` in `renderTutorWorkOn`'s `want`, the
  `g0.more` row, `renderWorkStep`, `syncTutorWork`, the step arm of `floatBoxLayout`, `#workStep`
  or its CSS), run `node tools/tutor-tests.mjs`, `node --test tools/live-tutor-tests.mjs` **and**
  `node tools/browser-check.mjs`. **The browser one is not optional**: whether the note really
  appears, whether pressing the chip really puts the next line down, and whether the chip is over
  the page without swallowing what a child writes through it are the three things reading the
  source cannot check. Every failure here is silent and the note still draws. Put the size, the
  line cap or the width cap back up and it is a panel across the child's paper again, which is
  the reported fault; drop `WORK_MAX_W` and a generous character width and a long line between
  them draw a note nearly the width of the page. Stop stamping `step: 1` in the door and the
  whole method is handed over in one go — the OTHER half of what was reported — while every
  geometry check stays green; bake the step into the MAKER instead and a hint's saved block comes
  back months later already half read. Size the WIDTH from the revealed lines and the note
  shuffles sideways under a child reading it; clamp against the DRAWN height rather than the full
  one and a note near the foot of the page crawls upwards a line at a time. Leave the step out of
  the node's identity and the note sits on line one for ever while the chip counts up beside it —
  the overlay leaves a node alone while its `data-work` matches. Drop the "▾ step 2 of 3" row and
  a child reads a method that stops in the middle, which reads as the tutor having finished. Give
  the chip `pointer-events: auto` on the BAR and a strip over the worksheet eats a stylus stroke;
  take it off the BUTTON and the one control that fills the working in cannot be pressed at all.
  Paint it from anywhere but `syncTutorWork` and a step moves with the chip still counting the
  line before it; drop it from `floatBoxLayout` and a phone buries it under the maths pad. And
  let either prompt stop saying the lines are REVEALED ONE AT A TIME and a model writes half a
  step per line, so the note reads as nonsense until the last line is down.
- After touching **⚡ which engine the TEACHING runs on** (`OPENAI_MODEL`, `AI_TASK_ENGINE`,
  `aiEngineOrder`'s `task`, `askOpenAiServer`'s `{ model: OPENAI_MODEL }`, `askKimiServer`,
  `askGemini`'s `opts.task`, the `task: 'teach'` on any call site, `teachOrder` / `openAiModel` in
  `window.aiEngines`, or `renderEngineBody`'s teaching lines), run
  `node tools/tutor-tests.mjs`. Both directions are silent and both cost real money. A teaching
  call that stops naming the task goes quietly back to whatever the centre's shared setting says,
  while the panel and this file both still promise ChatGPT — that is the reported fault arriving
  through its own fix. A marking, chat or key-reading call that STARTS naming it puts thirty
  students' papers on the paid engine with nothing on any screen saying it happened. That is what
  the census exists to catch on the NEXT call site rather than the last one, and a name added to
  its list is a decision about the bill — so resolve the enclosing function at column 0 only, or
  the live reply files itself under the `liveFlush` declared inside it and the census goes green
  over a call it never checked. Take the other engines out from behind ChatGPT and an OpenAI
  account out of credit is no hint at all rather than a slower one; let an unknown task fall
  through to an empty order and a typo takes the AI off every device at once. Name a model to
  EITHER server route and it is a page deciding what the centre is billed for — both functions
  choose server-side on purpose and ignore it anyway. And mirror the server's id into a constant
  here and the panel goes on naming it for months after that shared function was redeployed, with
  nothing anywhere able to say so: read it back off the reply, which is what both callables
  return it for.
- After touching **📎 the pasted picture** (`annPastePic`, `annLocked`, `annLockedId`,
  `annPicWarm`, `annPicFor`, `annPicsReady`, `shrinkImageDataUrl`, `imageRatio`, `pastePicBox`,
  `pasteGoesToWorksheet`, `pasteImageOntoPage`, `pasteImagesFromClipboard`, `pastePicNode`,
  `drawPastePicOn`, `renderPicChromeOn`, `applyPicHandle`, `picFitRatio`, `togglePictureLock`,
  `removePictureAnn`, `resizingPic`, the `image` branch of `annNode` or `drawAnnsOnCtx`, the
  chrome at the foot of `renderOverlay`, the handle / lock guards in `pointerdown` /
  `pointermove` / `endStroke` / `cancelStaleGesture` / `eraseAlong`, the `annPicsReady()` in
  `printWorksheet`, the `#viewerArea` drop handler, or the `.pastePic` / `.picTools` / `.picTool`
  CSS), run `node tools/tutor-tests.mjs`, `node --test tools/writing-tests.mjs` **and**
  `node tools/browser-check.mjs`. **The browser one is not optional and it is not ceremony**:
  every source-level pin here passes on a build where the picture never appears, never picks up
  or never resizes, because each of them asks what the source SAYS. Miss the `image` branch of
  `annNode` and there is no picture on screen at all; miss it in `drawAnnsOnCtx` and the picture
  is on the screen and missing from the page the AI marks, from the mistake book and from the
  printer — the app then marks a page the student is not looking at, silently. Let
  `drawAnnsOnCtx` STRETCH it rather than fit it and screen and paper disagree about a picture
  nobody looks at twice. Drop the `annPicsReady()` from the printer and a picture still decoding
  prints as a gap. Put the handle check after the tool branches and a tap on a corner `closest`es
  to nothing and DESELECTS the picture being resized. Build the resize from the pointer rather
  than the anchor and the picture creeps away under a drag that hits the floor. Drop `a.ratio`
  from it and a corner stretches the picture, which there is no frame left to hide. Take the
  projection out of `picFitRatio` and go back to whichever axis travelled further, and a wide
  picture pulled straight in along its long edge does not move at all: the height never changed,
  so the scale never changes and **the corner reads as a handle that does nothing** — which is
  exactly how v1.48.0 shipped. Take the SMALLER instead and the same corner refuses to grow it.
  Drop the floor's own ratio and a picture dragged down to nothing comes back a square. And write
  that arithmetic a second time at either call site and the two apps — which share it byte for
  byte — drift apart on the one thing a teacher can see happening under their hand. Let the row
  swallow taps — `pointer-events` on the foreignObject or on `.picTools` — and a band above every
  selected picture catches the stylus. Miss any one of the four `annLocked` guards and the lock
  is a button that does nothing on that surface alone; the eraser's is the one that costs the
  picture. Make a locked picture unselectable and the 🔓 can never be reached; make it
  undeletable and it can never come off the page. And let `pasteGoesToWorksheet` claim a paste
  while a text box is being typed into and the picture lands on the worksheet instead of in the
  box — the one way this feature is worse than not having it.
- After touching **📕 when a mistake is filed** (`fileMistakes`'s `opts` /
  `markedOnly` / `quiet` / its returned counts, `markRation`, the per-batch
  `await fileMistakes({ marked: true, quiet: true })` in `runMarking`, its
  `catch` and the cancellation re-check after it, the end-of-run
  `fileMistakes({ quiet: true })`, or the `mistFiled` / `mistPast` toast), run
  `node tools/tutor-tests.mjs`. **Both directions are silent and the marking
  still finishes.** Stop filing per batch and an interrupted run files NOTHING
  — the marking cards on screen and the book empty, which is the reported
  fault; file a BLANK per batch and the book fills with questions nobody has
  failed at, because mid-run `markSkipped` has no later questions to read and
  every blank is the tail. Run the LAST pass in marked-only mode and the
  skipped blanks are never judged at all. **Refill the ration inside
  `fileMistakes` and a ten-page paper buys a hundred vision calls**, silently,
  because it runs once a batch now; give `markRation` a second caller and 🧩
  Set it out again spends the marking run's budget instead of its own, so the
  button quietly does nothing on a paper that has been marked; drop it from
  the door that starts the run and every rebuild after the first ten is
  refused. Fire the batch pass and forget it and two passes race over `have`,
  the ration and `mistakes` itself; drop its `catch` and one refused write
  sinks a paper that was marking perfectly; drop the re-check after it and a
  worksheet closed mid-filing carries on being marked. Let the mid-run passes
  toast and a ten-page paper says the same sentence four times; drop the
  paper-wide one and a book that quietly grew is one nobody trusts. And write
  the mirror before the reload and the teacher cannot see a paper's mistakes
  until the next one is marked.
- After touching **💾 the save** (`performSave`, `saveCrashed`, the wrapped
  `syncActiveTextEditValue()`, its `finally`, the `.catch(saveCrashed)` on the
  timer / `flushSave` / the Save button, `scheduleAutoSave`, `setSaveState`, or
  the census in `tools/tutor-tests.mjs`), run `node tools/tutor-tests.mjs`
  **and watch the button go from Save to ✓ Saved on a real worksheet**. That
  last one is not optional and it is not ceremony: this app wrote NOTHING for
  forty-eight versions and every check in the file was green, because each of
  them asked what the source says rather than whether it runs. **Let the save
  call a name that is not there and it throws on its first line, in complete
  silence** — the button sits on "Save", which is exactly what it reads when
  there is nothing to save, and a student loses a lesson's work. Drop a
  `.catch` from any of the three fire-and-forget call sites and that silence is
  back whatever the next missing name is; drop `saveCrashed`'s local backup and
  the work is not even kept on the device. Wrap the whole sync inside the write's
  own `try` instead of its own and a box being typed in costs the entire
  worksheet again. Release `savingNow` after the catch rather than in a
  `finally` — or let a missing toolbar throw between the claim and the release
  — and every later save returns false at the gate with nothing on any screen.
  And widen the census's browser list to quiet a red tick and you have switched
  the one check that can see this class of fault off.
- After touching **🕒 how the mistake book is ordered** (`MIST_SORTS`,
  `mistSort`, the `mistSort === 'new'` arm of `mistCompare`, `mistGroups`'s
  `flat` argument, the sort row in `renderMistFilters`, or the
  `mistGroups(show, mistSort === 'new')` in `renderMistList`), run
  `node tools/tutor-tests.mjs`. Every failure is silent and the book still
  paints. Sort on `_i` rather than the stamp and the chip goes on reading
  "Newest first" while it quietly means "whatever order the read arrived in",
  the day `loadMistakes`'s query changes. Drop the tie-break and two questions
  from one marking run come back in whatever order the read handed them, rather
  than in paper order. GROUP the chronological list and the card the student
  opened the book to see is buried under whichever heading it belongs to, which
  is the whole thing the sort exists to avoid; NAME its section and the headings
  come back with it. Let `mistGroups` called without the flag stop being
  byte-for-byte the grouped book and every centre that never touches the chip
  has its book rearranged. Count the sort as a filter and ✕ Clear lights up for
  something that is hiding nothing. And remember it between visits and the book
  comes back in an order somebody chose last Tuesday — the rule the filters
  already follow, broken on the one axis that sits beside them.
- After touching **🐛 the three recovered names** (`bindTextEditNode`,
  `renderStylusBtn`, `setStylusOnly`, `overlayRebuilding`, the `#stylusBtn`
  markup or its one click handler, `navBind`, the census slices `TEXT_EDIT` /
  `WIRING` in `tools/tutor-tests.mjs`, or `tools/browser-check.mjs`), run
  `node tools/tutor-tests.mjs` **and** `node tools/browser-check.mjs`. **The
  browser one is not optional and it is not ceremony**: 1,600 source-level
  checks were green over a build whose text box could not be used at all,
  because each of them asked what the source SAYS rather than whether the
  names it says RESOLVE. Let a name the file calls go missing again and the
  cost depends only on where it is called from — from `annNode` the first tap
  of 🅣 throws inside `renderOverlay` and no box is ever drawn, from the top
  level it takes the shortcuts, Ctrl+Z, Ctrl+S, Escape, the `beforeunload`
  save and the opening renders with it, and in BOTH cases the app still paints
  because the sign-in callback re-runs the renders. Narrow the census back to
  the save path and it goes green on exactly this fault again. Match
  `attachTouchNavigation` as a bare word rather than as a declaration and the
  pin reads its own comment, so it is red on the fix and green on the fault.
  Let a second engine, a second `#stylusBtn` or a second click handler back in
  and pencil-only mode toggles twice per press and changes nothing — a button
  that plainly works and plainly does not. Ship ✍️ `hidden` and trust the
  painter to unhide it and a painter that throws leaves a touchscreen nobody
  can draw on with a finger. And let any step of `browser-check` THROW instead
  of reporting and a broken build reads as a broken harness.
- After touching **🅣 which tools a finger may drive, or 🧽 the drawn eraser**
  (`isDrawTool`, the two `stylusOnly && … isDrawTool(tool)` gates, the
  `tool === 'text'` branch of the overlay's `pointerdown`, the eraser button's
  SVG or the `.toolIco` rule), run `node tools/tutor-tests.mjs` and
  `node --test tools/writing-tests.mjs` **and tap the page with a FINGER**.
  That last one is not optional: this shipped broken because every check —
  source, harness and a mouse — passes on a tool a touchscreen cannot reach.
  **Put 🅣 back in `isDrawTool` and the text box silently stops working on
  every iPad in the centre**, which is the reported fault; take the ERASER or
  the pen out and a resting palm rubs a worksheet out or writes across it,
  which is far worse. Let the text branch capture a pointer or drag anything
  and it is a mark after all and belongs back in the list. Stop sweeping the
  empty box, or let a palm-sized patch through, and a hand resting on the page
  leaves boxes on it. And go back to an emoji for the eraser and there is
  still no eraser in that set, so whatever is chosen reads as a bandage, a
  sponge or a bin — while an `id`, a gradient or a filter in the drawing is
  the rule 🤖 Chung GPT's face already documents, broken on a second surface.
- After touching **📌 the folded set list** (`ASSIGN_OPEN_KEY`, `assignOpen`,
  `setAssignOpen`, `toggleAssignOpen`, `assignAttention`, the `opts.row` branch of
  `setCardNode`, the header half of `renderAssignments`, `#assignToggle` /
  `#assignCaret` / `#assignCount` / `#assignFlag` / `#assignBody`, or the
  `.assignToggle` / `.setRows` / `.wsCard.setRow` CSS), run
  `node tools/tutor-tests.mjs` **and look at the home screen**. Every failure
  here is silent and the screen still paints. **Drop the count or the ⚠ from
  the header and a paper no child can open sits set for a term behind a folded
  section with nothing anywhere saying so** — which is strictly worse than the
  wall of cards this replaced; move `checkAssignmentPdfs()` below the fold's
  early return and the ⚠ never learns a file has gone at all. Let
  `assignAttention` stop reading `assignmentUntaggedNote` and the header starts
  counting papers the rows do not flag. Open it by default — or let a refused
  `localStorage` fall to OPEN — and the wall of cover cards the teacher asked
  to be rid of is back on exactly the devices that cannot turn it off. Narrow
  the list by the shelf scope instead of folding it and the P6 paper somebody
  came to withdraw is not on the screen they came to withdraw it from. Write a
  second renderer beside `setCardNode` and the register quietly stops offering
  “Take off the list”, which is the one thing this section is for; let
  `setCardNode(a)` with no opts stop being byte-for-byte the card it was and
  every student's shelf changes with it. And drop either warning from the row —
  the first thing a tidier row would do — and the two faults only the teacher
  can fix are invisible in the one list that reports them.
- After touching **🎓 a shelf's class** (`shelfFitsClass`, `shelfClassLabel`,
  `shelfPaperOf`, `shelfDropOk`, `shelfClassOptions`, `fillUploadShelves`, the
  `level` / `subject` `shelfNorm` keeps, the narrowing in `shelfGroups` or in
  `shelfSections`' empty-shelf sweep, `shelfCreate` / `shelfRename`'s class
  arguments, the refusal in `moveWorksheetToShelf`, the filter or the hidden
  count in `openShelfPick`, the `shelfDropOk` in the `dragover`, the two class
  pickers in `openShelfNameModal` / `shelfNameConfirm`, or `uploadOne`'s
  `shelfSkip` and `handleUpload`'s `offShelf`), run
  `node tools/tutor-tests.mjs` **and look at the home screen**. Every failure
  here is silent and the bookcase still paints. **Read `''` as “nowhere” rather
  than as “every class” and a centre's whole bookcase empties itself on the
  deploy** — every shelf made before v1.40.0 has no class, so every paper on
  every one of them falls back to “Not on a shelf yet”, which is a migration
  nobody asked for and nothing on any screen explains. Stop narrowing
  `shelfGroups` and a P6 Maths shelf lands on the P5 bookcase carrying a paper
  the mover would never have put there; stop narrowing `shelfSections`' empty
  sweep and the reported bug is back exactly as it was — an empty copy of every
  shelf under every level. Let `shelfNorm` keep a class this build has never
  heard of and that shelf is one nothing can ever draw, rather than a shared
  one. Narrow the picker and NOT the mover and a drag, a stale button or the
  console lands a write, the toast says the paper moved, and `shelfGroups`
  reads the id as unsorted on the very next paint — the paper back where it
  started with nothing saying why; narrow the mover and not the DRAG and a
  shelf lights up for a drop it is about to refuse. Write a second resolver
  beside `shelfPaperOf` and a `set:` entry's class is read off the wrong
  object. Make the duplicate check bookcase-wide again and “2025 papers” can
  exist on one class only, which is the very thing this narrowing is for; let
  `shelfRename`'s `undefined` stop KEEPING the class and a plain rename takes a
  shelf's class off it in silence. Open a shelf made FOR a paper on the SCOPE
  rather than on that paper's class and the create succeeds, the move it was
  made for is refused, and the new shelf stands empty on somebody else's
  bookcase. Bind `fillUploadShelves` inside `openUploadModal` and a listener is
  stacked per opening; narrow it with no class chosen yet and the teacher is
  offered nothing while nobody has said what the papers are. And let
  `uploadOne` leave a paper wearing a shelf of the wrong class — or stop NAMING
  it — and a shelf the teacher chose is silently ignored by the bookcase, which
  is the shape of fault the whole narrowing exists to end.
- After touching **✎ the rename** (`worksheetName`, `wsNameClean`, `WS_NAME_MAX`,
  `renameWorksheet`, `setWsTitle`, `openRenameModal`, `wsNameConfirm`, the ✎ button
  on `wsCardNode`, `#wsNameModal`, or any surface that shows a paper's name), run
  `node tools/tutor-tests.mjs`. Every failure here is silent and the card still
  paints. **Read the name off the COPY instead of the assignment and a paper the
  teacher renames this morning keeps its old name for everybody who started it
  yesterday** — the whole feature quietly not happening, on a shelf that looks
  perfectly right. Let an EMPTY live name through and a paper set before it was
  named blanks every card it is on; drop `assignmentsLoaded` and a cold start is a
  bookcase of “Untitled”. Write the teacher's own row before the assignment and a
  refused second write leaves the class reading a name the teacher believes they
  changed. Write ANYTHING but the name — a field slipped into either `set` — and a
  rename reaches into a child's own work, which is the one thing this promised not
  to do. **Drop `setWsTitle(nm)` from the rename and the paper's own next auto-save
  writes the OLD name straight back**, because `performSave` writes `name: docName`
  every time; split `docName` and the bar into two writers and the same thing
  happens through the other door. Read the name only at `loadPdf` and a copy opened
  before the class list arrives runs the whole session under the name it happens to
  carry. Let `wsNameClean` invent “Untitled” for an empty answer and a mis-tap
  renames a paper that had a perfectly good title. And gate it on the button rather
  than in the handler and a student can rename the class's paper.
- After touching **🗂 the shelves** (`SHELF_DOC_ID`, `shelfNorm`, `shelfFind`,
  `shelfRank`, `shelfReorder`, `shelfStampOf`, `worksheetShelfId`,
  `shelfRecentStamp`, `shelfAgo`, `shelfRecentItems`, `shelfInScope`,
  `shelfGroupCompare`, `shelfGroups`, `shelfTitle`, `shelfSections`,
  `loadShelves`, `shelfSave`, `shelfCreate`, `shelfRename`, `shelfDelete`,
  `moveWorksheetToShelf`, `moveShelfTo`, `shelfScope`, `shelfScopeNow`,
  `renderShelfBar`, `shelfNode`'s grip / ▲ ▼ / drag handlers,
  `SHELF_DRAG_PREFIX`, `_shelfOrderDragId`, `shelfOrderSlot`,
  `shelfDropClear`, `openShelfPick`, `openShelfNameModal`, the `shelf` field
  on an upload / a push / a fresh copy, `lastOpenedAt` in `openWorksheet`, or
  the `.shelf*` / `.chipWhen` / `.chipShelf` CSS), run
  `node tools/tutor-tests.mjs` **and look at the home screen**. Every failure
  here is silent and the bookcase still paints. **Read the shelf off the COPY
  instead of the assignment and a paper the teacher moves this morning moves
  for nobody who started it yesterday** — which is the whole feature quietly
  not happening, on a screen that looks perfectly arranged. Drop the
  unknown-id fallback and taking a shelf off strands every paper on it in a
  section nothing draws; drop `assignmentsLoaded` and a cold start empties the
  bookcase onto the unsorted shelf for a second. Give the catalogue a
  collection of its own and it needs a rules deploy from another repository
  and fails CLOSED until somebody makes it, with nothing on any screen saying
  why; let it lose `active: false` or the by-name guard in `loadAssignments`
  and it is a card nobody can open on every student's home screen. **Name it
  `__anything__` and Firestore refuses it outright** — that is what v1.37.0
  did, and the write at least said so while the caught READ left the bookcase
  silently shelf-less, which is the half nobody could have reported. Let
  `shelfGroups` or `shelfTitle` called with no `opts` stop being what they
  were and every centre that has never made a shelf has its bookcase
  rearranged under it. Write the teacher's own row before the assignment and a
  refused second write leaves the class on an arrangement the teacher believes
  they gave them. Make 🕒 Recently opened a drop target and it offers a move
  that cannot happen; read only `updatedAt` and it misses every paper opened
  and read without a mark, while only `lastOpenedAt` misses everything written
  on before this shipped; drop the future-stamp ceiling and one fast clock
  pins a paper to the front of it for ever; let `lastOpenedAt` throw and a
  convenience is the reason a worksheet will not open. Let `shelfInScope`
  filter an UNTAGGED paper and picking a class hides somebody's own upload
  with nothing to say where it went. Read the scope from `adoptStudents` and
  the teacher — who adopts nobody — gets it reset on every reload. Give ✎ and
  🗑 the `.shelfBtn` class and a phone hides the two buttons that arrange the
  bookcase. And drop the 🗂 button from the card and the only way to move a
  paper is a drag, which a touchscreen never fires at all — on the iPads these
  worksheets are written on. **And on the SHELVES' OWN ORDER: stop renumbering
  `order` in `shelfReorder` and the whole thing quietly does not happen** —
  `shelfSave` runs `shelfNorm`, which sorts by `order` FIRST, so the write
  lands, the toast says the shelf moved, and the bookcase repaints exactly as
  it was. Read the order off a COPY rather than the catalogue and the teacher
  arranges a bookcase nobody else is looking at. Drop the ▲ ▼ buttons, or give
  them `.shelfBtn`, and the bookcase can only be arranged by dragging — on the
  one device that never drags. Capture the rank instead of re-reading it at the
  click and the second press of ▲ moves the wrong shelf, because the button
  outlives the catalogue it was drawn from. Let the two drags share a global —
  or drop the namespaced payload, or ask about the PAPER first — and a shelf id
  is handed to `moveWorksheetToShelf` as a worksheet's. Put a shelf back that
  the catalogue no longer has and a reorder resurrects a shelf somebody
  deleted. And let a shelf be dropped on itself or on the unsorted shelf and
  the bookcase offers a move that cannot happen, which is worse than one that
  never lit up.
- After touching **🚀 the deploy workflow or the CI checks**
  (`.github/workflows/deploy-functions.yml`, the `node --test
  functions/test/*.test.js` step in `.github/workflows/checks.yml`, or the
  pins that read them), run `node tools/tutor-tests.mjs`. **This is the one
  file in the repository that can damage another app**: `mathgen--app` is
  shared, so a deploy that stops naming `functions:study-buddy-live` — or
  that gains `--force` — takes the Maths repo's `askOpenAi` / `askKimi` off
  the project, from a workflow in a repository that has never heard of them,
  with nothing in either app to say why. Read the whole deploy STEP when you
  check for a flag, never the file (this section names the flag it forbids)
  and never a slice ending at whichever flag is last today — that is how the
  `--force` mutant got through the first time. Make a missing
  `FIREBASE_SERVICE_ACCOUNT` FAIL the run rather than warn and every merge
  goes red until somebody sets a secret, which trains the whole team to
  ignore a red tick. Drop the `if: always()` shred and a service-account JSON
  is left on the runner precisely when the deploy failed. And take the
  functions' tests back out of CI and the half of the app that decides
  whether a child gets a lesson is unchecked again — which is how ⏱ and 🎧
  both shipped green and neither reached a student.
- After touching **⏱ the live tutor's limits** (`LIMITS`, `capOn`,
  `liveDuration`, `DURATION_MIN` / `DURATION_MAX`, the `capOn(policy.…)`
  guards or the `leaseAt` lock in `reserve`, `release`'s `currentLease` /
  `leaseAt` clear, `liveTutor.maxSeconds`, `liveMaxSeconds`, `liveClockText`,
  `liveLengthWords`, `LIVE_MAX_SECONDS_DEFAULT`, or the `#liveClock` line),
  run `cd functions && node --test test/*.test.js`,
  `node tools/tutor-tests.mjs` **and**
  `node --test tools/live-tutor-tests.mjs` — **and deploy the functions**
  (`firebase deploy --only functions`), because Pages carries `index.html`
  and not `functions/`. Every failure here is silent and lands either on a
  child or on the bill. Put a ration back — or let one refusal stop asking
  `capOn` — and a student is told to come back at midnight again while
  every screen says the limits are off. Let `capOn` coerce, or accept `0`,
  and the rations switch themselves back on from a typo. Take the clamp off
  `durationSeconds`, or coerce it with `Number()`, and the two ends fail
  opposite ways: `Number(null)` is 0, so a missing field hands every child a
  one-minute lesson, while an unbounded one is a lease that never expires,
  a sweep that never finds it and a paid call billing all night with nobody
  in the room. Build the lease from `policy.durationSeconds` rather than the
  clamped number and a junk value is an expiry of `NaN`, which is never
  past. Switch the starts counter off with its cap and v1.32.0's refund has
  nothing left to take back. Stop stamping `leaseAt`, or stop reading it
  against `staleBefore`, and a tab closed mid-lesson locks that account out
  of live mode for ever; treat a MISSING `leaseAt` as live instead and every
  account stranded before the deploy stays stranded. Give the two
  centre-wide ceilings one sentence again and "try in a few minutes" and
  "comes back at midnight" are the same message. And type a ceiling into
  the card again — or throw `maxDurationSeconds` away, or let a junk one
  SHRINK the clock — and a student watches the timer run past its own
  limit, which reads as the app being broken rather than as a longer
  lesson.
- After touching **🖼 the picture clean-up** (`AI_IMAGE_MODELS`, `window.askGeminiImage`,
  `window.imageAiReady`, `_inlineImage`, `SCAN_SOURCE_PROMPT`, `MB_ENHANCE_PROMPT`,
  `MB_ENHANCE_MAX`, `mbEnhance`, `_paperWhitePoint`, `_paperCleanPixels`, `_paperCleanDataUrl`,
  `_mbQuestionCrop`, `_mbUpload`'s extension, or the `mbEnhance` call in `_mbBuildFigures`), run
  `node tools/tutor-tests.mjs`. **Let `mbEnhance` THROW and a busy image model costs the student
  the question itself** — the crop is already in hand, and everything about this is a luxury on
  top of it. Spend the budget after the call and a failure buys another try, so a paper of
  unreadable crops is paid for twice; refill it anywhere but the two doors and one press of 🧩
  quietly takes the next paper's clean-ups away. Drop `SCAN_SOURCE_PROMPT`, or its two
  do-not-invent paragraphs, and the model renders the scanning damage beautifully or writes in
  the axis value the scan destroyed — a number in a maths question that the paper never printed,
  which the student then gets wrong a second time. Let it answer, tick or fill anything in and
  the question comes back already done. Run the clean-up on the whole-PAGE tier and invention is
  at its likeliest on the picture nobody chose. Let `_paperCleanPixels` write at or below
  `PAPER_INK_MAX` and it eats the diagram, which looks like a beautifully clean picture; drop
  the chroma test and the blue of water in a beaker is bleached out; drop any of its three
  refusals and a photograph of an experiment has its highlights flattened into a plate. And name
  a redrawn PNG `.jpg` again and every enhanced picture is stored under a lie.
- After touching **📕 the teacher's copy of the book** (`MIST_MIRROR_MAX`, `MIST_MIRROR_Q`,
  `MIST_MIRROR_A`, `MIST_PANEL_MAX`, `mistakeMirrorRow`, `mistakeMirrorSync`, `mistakesOf`,
  `mistMirrorRowNode`, `mistMirrorTopicKey`, `mistMirrorGroups`, `openClassMistakes`, the 📕
  section in `openPersonUsage`, `personRow`'s `mistakes` field, or `#peopleMist`), run
  `node tools/tutor-tests.mjs`. **This is the ONE path in the app that carries a child's own
  words off their own device**, so the harness pins the row's key list BY NAME: add a field and
  the run fails until somebody has decided to send it. Send a picture PATH and the teacher gets
  a grid of broken images, because those files are under the student's own uid and no Storage
  rule lets the admin read them. Drop `isAdmin(currentUser)` from the mirror and the teacher's
  own practice papers are filed as a student's book, at the top of their own roster; drop it
  from `openClassMistakes` and a student's device can read the class's — hiding a button has
  never been the lock here. Write the mirror before `loadMistakes` reloads and a whole paper is
  invisible until the next one is marked; append instead of mirroring the whole book and a
  question sorted or deleted stays on the teacher's screen for ever. **Make the write anything
  but a MERGE and it takes the level, the subject and the onboarding answers off the centre's
  shared roster**, which is how a student disappears from every list in every app at once. Let a
  skipped blank arrive with an empty verdict and the panel shows it as a wrong answer, which is
  the cross the whole marking path refuses to put on a blank. Paint a row with `innerHTML` and a
  child's own words are markup in the teacher's page. And put this into `usageNote` instead and
  a transcript of a child's answers is in a feed with none of these guards on it.
- After touching **🕳 which blanks are mistakes** (`markLastAnswered`, `markSkipped`, the `due`
  walk or the `skipped` field in `fileMistakes`, `mistSkipped`, the card's `mSkip` class or chip,
  the *You went past this one* note, the `m.answer ? 'Why' : 'Where to start'` label, the
  `mistSkipped` line in `mistHaystack` or `pracCheck`, `PRAC_SYS`'s blank clause, or the `.mSkip`
  CSS), run `node tools/tutor-tests.mjs`. **Both directions are silent and the book still paints.**
  Stop filing skipped blanks and the questions a child is most stuck on are lost again, on a screen
  saying the book is up to date; file the TAIL as well and it fills with questions nobody has
  failed at, which is a book nobody opens twice. Measure the tail from the NEXT question rather than
  the LAST answered one and a run of blanks files only its final question, losing every one before
  it. Sort by question number instead of reading `marking.items` in order and 10 comes before 2,
  filing the wrong half of the paper. Let a skipped card wear `mWrong` and it is the red cross on an
  untouched question that the whole marking path is built not to make. Infer the skip from the
  absence of a verdict rather than reading the flag and an unjudged ANSWER becomes a skip the day
  one is filed. Drop the note on the card and it is a bare question with nothing saying how it got
  into the book; drop the line in `pracCheck` and the marker congratulates a child on improving on
  an attempt they never made. And touch `_markFields`, the report's counts or the diagnostic while
  you are here and a blank is marked wrong after all — none of them moves.
- After touching **📕 the filed mistake book** (`mistPlace`, `mistSubjectKey`,
  `mistTopicKey`, `mistHaystack`, `mistSearchTerms`, `mistSearchHit`,
  `mistMatches`, `mistCompare`, `mistakesShown`, `mistGroups`, `mistFacet`,
  `mistPruneFilters`, `mistFiltered`, `mistClearFilters`, `mistFilterTopic`,
  `mistFilterLo`, `renderMistakes`, `renderMistFilters`, `renderMistList`,
  `mistChip`, `mistSelect`, `syncMistClear`, the `.mistTags` row on
  `mistakeCard`, or the `.mist*` / `.mTag` CSS), run
  `node tools/tutor-tests.mjs`. Every failure here is silent and the book
  still paints. Let `mistGroups` FILTER and a card vanishes from a section
  that looks complete — which is exactly what a card that was never there
  looks like. Let `mistPlace` trust a stored objective id the syllabus no
  longer has and a card wears a chip reading its own bare `heat-flow`, under
  a heading nothing else is ever in. Ignore `upTo` and choosing a topic hides
  every other topic out of the list it was chosen from, so nobody can change
  their mind; let a facet count read the query and a chip saying *Science (12)*
  means twelve matching half a word. Drop `mistPruneFilters` from the paint
  and deleting the last card of a topic leaves the book showing nothing and
  saying only "try another filter". Make the search ANY term instead of every
  one and a second word widens, which is a search box nobody uses twice; stop
  reading a rebuilt question's blocks and every question set out properly is
  unsearchable. Rebuild the whole bar on a keystroke and the caret jumps to
  the end on every letter. Remember a filter between visits and a book looks
  empty for a reason nobody can see. And paint a picker option with
  `innerHTML` and model output is markup on the page.
- After touching **🧩 setting a mistake out again** (`MB_REDO_MAX`,
  `_mbBuildFrom`, `mbStoredPage`, `mbRedoShots`, `mbRedoOne`, `mbRedoWanted`,
  `_mbRedoBusy`, `mbRedo`, the 🧩 button on `mistakeCard` or in
  `renderMistTools`, or the `redo` row of `USAGE_EVENTS`), run
  `node tools/tutor-tests.mjs`. This one spends AI calls and overwrites the
  picture a student practises from, and every way it goes wrong is quiet.
  Delete the old picture before the new row is written — or write a patch of
  nothing as a success — and the card loses its picture to a call that did
  nothing. Spend the ration inside `_mbBuildFrom` and the shared ask charges
  the marking run's budget, so the button silently stops working on a paper
  that has been marked. Set `crossOrigin` after `src` and the crop dies on a
  `SecurityError` when it is SAVED, which reads as "setting it out is broken"
  rather than "that bucket has no CORS rule". Stop asking `mbRedoWanted` and
  every press redoes work that is done; drop `MB_REDO_MAX` and one tap is a
  call per card; drop `_mbRedoBusy`, or `Promise.all` that loop, and two runs
  interleave through the module globals exactly as two uploads do. Stop
  preferring the open PDF and a sharp re-render is thrown away for the
  book's own stored page. Carry on past an `ai` result and every remaining
  card pays the same wait to be told the same thing. And leave `m._place` /
  `m._hay` set and a question set out again is filed and searched under the
  wording it no longer has.
- After touching **🎧 why live tutoring said "busy"** (`liveErrorText`, the
  `throw` in `startLiveTutor`, or `reserve`'s stale sweep / `release`'s
  `refund` in `functions/live-repository.js`), run
  `cd functions && node --test test/*.test.js` **and**
  `node tools/tutor-tests.mjs` — **and deploy the functions**
  (`firebase deploy --only functions`), because Pages carries `index.html`
  and not `functions/`, so shipping one half leaves the reported fault in
  place with the release notes saying it is fixed. Every failure is silent
  and the card just says "busy". Stop refunding a start that never became a
  call and six refused microphones take live mode away until midnight, which
  is the reported bug; refund one that really ran and the daily allowance
  stops meaning anything; drop the `current.exists` clause and a retried stop
  buys a second lesson; drop the day clause and a refund at midnight takes
  one off tomorrow. Swallow the server's own message again and *"you have
  used today's 6 lessons"* is shown as *"busy, try again in a little while"*.
  And write a concurrency slot as a flag rather than a time and the next
  start sweeps a lesson that is really running, so the ceiling the whole
  school shares stops holding at all — while dropping the sweep entirely puts
  the other failure back, where a handful of closed tabs shuts live mode for
  everybody permanently.
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
- After touching **📐 the ruler or the crosshair** (`GRID_STEP`, `GRID_LINE`, `GRID_TEXT`,
  `TAP_R`, `drawPageGrid`, `gridLabel`, `tapMarkSpot`, `drawTapMark`, `pageJpegForModel`, the
  `mark` on `bandDataUrl` / `bandJpeg`, the `role` on `hintImagesFor`'s entries, or the two lines
  `hintLadderFor` pushes about the ring and the image number), run
  `node tools/tutor-tests.mjs` **and** `node --test tools/live-tutor-tests.mjs` **and ask for one
  hint on a real page**. This is where BOTH of v1.30.0's placement faults lived, and both were
  silent — the finger was drawn perfectly, on the wrong thing. Tell the model in WORDS where the
  tap was and it is being told something untrue, because the band puts the tap two fifths down and
  "near the top" is the question BEFORE it: a child tapping question 12 gets a hint about question
  11 with the pin sitting correctly on 12. Take the grid off and the position is estimated on a
  bare photograph again, so the underline lands a line or two from the words it was meant to be
  under. Name the picture to measure on by ORDINAL and it is the PREVIOUS PAGE on every worksheet
  whose close-up could not be built, so the gesture is measured on one page's layout and drawn on
  another's. Let the grid into `compositeJpeg` and it is on the marking run's picture, the mistake
  book's, the cover and the printer — a ruler across a child's printed worksheet. Drop the
  not-part-of-the-paper warning and a model reads "300" out of the margin into the question it
  transcribes, which then travels into the hint, the keyword check and the mistake book. Let
  `tapMarkSpot` forget the BAND's own top and the crosshair is on the question above. And label
  the grid's ENDS and there are two "0"s in one corner, or one of them is nudged a few per cent
  off the line it names.
- After touching **✍️ the tutor's working** (`WORK_RUNG`, `WORK_LINES_MAX`, `WORK_CHARS_MAX`,
  `tutorWork`, `tutorWorkAllowed`, `tutorWorkLines`, `tutorWorkMake`, `tutorWorkGeom`,
  `tutorWorkShow`, `tutorWorkClear`, `syncTutorWork`, `tutorMarksClear`, `renderTutorWorkOn`, the
  `renderTutorWorkOn(p)` line and `tutorNodes` in `renderOverlay`, `LIVE_MARK_RE`, `liveWorkSpec`,
  `liveMarkApply`, the marker LOOP in `liveFlush`, the `work` field of `HINT_SYS` /
  `hintLadderFor` / `askHintAt`, the button on `hintCard`, or the `.tutorWork` CSS), run
  `node tools/tutor-tests.mjs`, `node --test tools/live-tutor-tests.mjs` and
  `node --test tools/writing-tests.mjs` **and watch one live session**. **The worst failure here
  is loud and it is heard by a child**: a marker that stops being consumed is read aloud as "open
  bracket open bracket work p three", and `liveFlush` taking ONE marker instead of a RUN loses the
  second one entirely on a reply that never streams — the note simply never goes up, in silence,
  and streaming hides it because a second flush takes it. The rest are quiet. Let the working into
  `annotations` and the next marking run reads the tutor's own half-solution as the student's
  work, on a paper that marks itself kinder. Take the ladder off `tutorWorkShow` — or ask it only
  in the prompt — and a child on *Nudges only* is handed the method written out on their paper.
  Drop the `?` rule, or TRIM the last line instead of refusing the block, and the working runs to
  the answer, which is the answer with a pencil round it; cap the lines with a plain `slice` and
  the `?` line is what gets dropped, turning an invitation into a lecture. CLAMP the anchor
  instead of refusing it and the note is beside the wrong question; stop NUDGING the box and it
  hangs off the edge of the paper. Split the clear into two and the five places the tutor moves on
  become ten chances to forget one. Detach the node in the wipe, or `appendChild` it, and it
  flashes on every word the child writes or covers the answer it is helping with. Read
  `liveWorkSpec`'s position from the whole marker and the digits in "3 units = 12" become a
  coordinate. And paint a line with `innerHTML` and model output is markup on a child's page.
- After touching **👉 whether the tutor ASKS for a mark at all** (the `POINTING AT THE PAGE`,
  `MARKING TWO PLACES AT ONCE` or `WRITING WORKING ON THE PAGE` paragraphs of `HINT_SYS`, the
  `Include "point"` / `Include "work"` lines `hintLadderFor` pushes, or the 👉 / ✍️ paragraphs of
  `runLiveDelegation`'s system prompt), run `node tools/tutor-tests.mjs` **and ask for one hint on
  a real page and watch one live session**. Every failure here is silent and the app answers
  perfectly: **go back to only RULING on a mark and the tutor stops drawing one**, which is the
  reported fault and which every source-level pin was green over for seventeen versions — the
  shapes, the grid, the pair, the cap and the refusal were all pinned, and nothing pinned that
  either prompt said to DRAW. Let the opt-out widen back to *“if you are not sure”* and a model
  that is never quite sure takes it on every reply; remove the opt-out instead and a finger lands
  on the wrong question, which is worse than no finger at all. Stop naming the everyday things
  worth marking and the condition reads as rarely true again. Drop `Include "point"` from the
  hint REQUEST and the field is described by the system prompt and asked for by nobody, which is
  how it was. Let the working's `ONLY when the request says the method rung was asked for` go and
  a child on *Nudges only* is handed the method written on their paper. And put marker syntax
  into `CHAT_SYS` or `worksheetContextRule` and *“open bracket open bracket point p three”* is
  printed into the typed chat, where nothing strips it.
- After touching **① ② the PAIR of marks** (`POINT_MAX`, `POINT_BADGE_R`, `POINT_BADGE_TEXT`,
  `tutorPoints`, `tutorPointsMake`, `tutorPointBadgeAt`, `tutorPointShow`'s list arm, the `group` /
  `mine` split or the badge in `renderTutorPointOn`, `liveMarkApply`'s `batch`, the `pointMarks`
  accumulator or the `grew` flag in `liveFlush`, or the two prompts' paragraphs about a second
  mark), run `node tools/tutor-tests.mjs` **and** `node --test tools/live-tutor-tests.mjs` — **and
  ask for one hint that compares two things on a real page**. Every failure here is silent and a
  mark still goes up. **Make `tutorPoints` a singleton again — anywhere: the writer, the maker, the
  live batch — and the second half of every comparison is silently thrown away**, which is the
  reported fault, and the tutor's own words then name a mark nobody can see. Let a flush collect
  the group instead of the reply and a pair the stream cut in half comes out as the second marker
  alone; drop `grew` and the marks blink their way through the whole reply. Give each mark its own
  `made` and they fade in one at a time, which reads as two statements rather than one comparison;
  draw them as a node each and the wipe that must never detach them has several to step over.
  Number them off THIS PAGE rather than the group and a pair split over a page break is ① twice,
  on a page that looks perfectly convincing. Take the cap off and a model that liked four things
  puts the page under magenta, which says less about where to look than one box did. Return an
  empty LIST where nothing was readable and the hint card grows a *show me where to look* button
  with nothing behind it; throw the whole list away when ONE spec fails and half a comparison
  becomes none of it. Draw a LINE between two marks and it is a magenta rule struck across
  whatever is printed in between — the fault the underline's own rule exists to prevent, and it is
  worst exactly where the link is most wanted. And let either prompt stop ASKING for a second mark
  — not merely stop ruling on it — and this half quietly does not exist, with every other pin green.
- After touching **👉 the tutor's finger** (`POINT_SHAPES`, `POINT_INK`, `tutorPoints`,
  `tutorPointShape`, `tutorPointMake`, `tutorPointGeom`, `tutorPointPaths`, `tutorPointShow`,
  `tutorPointClear`, `syncTutorPoint`, `renderTutorPointOn`, the `renderTutorPointOn(p)` line in
  `renderOverlay`, `LIVE_POINT_RE`, `livePointSpec`, `livePointStrip`, `pointPage`, the marker arm
  of `liveFlush`, the `point` field of `HINT_SYS` / `hintLadderFor` / `askHintAt`, the 👉 button on
  `hintCard`, or the `.tutorPoint` / `.tpInk` CSS), run `node tools/tutor-tests.mjs`,
  `node --test tools/live-tutor-tests.mjs` and `node --test tools/writing-tests.mjs` **and watch
  one live session** — where a finger lands on a real page is the one thing reading the source
  cannot check. **The worst failure here is loud and it is heard by a child**: a marker that stops
  being consumed is read aloud as "open bracket open bracket point four one two", and one that is
  half-consumed leaves the closing brackets in the middle of a sentence while the gesture never
  goes up. The rest are silent. Let the gesture into `annotations` and the next marking run reads
  the tutor's circle as the student's own work, on a paper that simply marks itself kinder.
  Take `pointer-events: none` off and it swallows a stroke from the stylus, which reads as the pen
  having stopped working. Clamp a point into the page instead of refusing it and the finger lands
  on the wrong question, confidently. Drop the epoch check and a gesture about the last worksheet
  stands over this one. Miss ONE of the five clears — a new spoken question, a new hint, the
  session ending, a new worksheet, leaving the worksheet — and a finger points at a question
  nobody is on any more. Rebuild the node on every overlay pass and the finger flashes each time
  the child writes a word — and note that lifting it OUT of the wipe and putting it back is the
  same flash, because detaching a node cancels its animation; let the breathe run `infinite` and
  it pulses beside the question for ever; `appendChild` it instead of `insertBefore` and it is
  drawn over the answer it is meant to be helping with. And stop taking the `p3` out of the marker before the numbers are read and its own digits
  become the first coordinate, so every gesture lands at the top of the page.
- After touching **✏️ the maths pad** (`MTH_SYMBOLS` or the `.mthKey` size,
  `mathWorksheet`, `mthAllowed`,
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
  box and a spoken answer is captioned underneath the box it just set. Put a
  Compare, Number or Shape row back into `MTH_SYMBOLS` and the strip is a
  wall of thirty symbols again, with the four keys a child came for buried in
  it; drop the degree sign and the one symbol that is both unreachable and
  part of a real P5 answer goes with them. And shrink `.mthKey` without
  leaving the phone override alone and a child tapping a sheet with a finger
  mis-hits the key beside the one they wanted.
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
- After touching **✍️ the stylus guards** (`DRAG_SLOP_PX`, `dragStarted`, the
  `e.button > 0` line in `pointerdown`, or the `cx` / `cy` / `dragged` fields on
  `moving`), run `node --test tools/writing-tests.mjs` **and write on a page
  with a stylus**. Every failure is silent and the page goes on drawing. Drop
  the drag threshold and the act of SELECTING a stroke nudges the child's
  writing out of place, because no pen taps perfectly still. Measure it in PAGE
  units and it is a hair when zoomed in and most of a centimetre when zoomed
  out, so a tremor moves the ink on one worksheet and a deliberate drag does
  nothing on the next. Hang the undo push on `moved` rather than on `dragged`
  and every tap costs a Ctrl+Z that undoes nothing and a save that saves
  nothing. Go back to testing `e.button` for a MOUSE only and the pen's barrel
  button — which sits exactly where the fingers grip — abandons the stroke being
  written and starts a fresh gesture under the hand, carrying the same
  pointerId, so the one-pointer guard never sees it. And add a `dblclick`
  handler to the overlay that can reach `setTool` and this app grows Ans Key's
  old fault: two quick marks on existing ink turn the pen into the select tool,
  with the toolbar still showing the pen.
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
