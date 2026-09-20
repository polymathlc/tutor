# Study Buddy — Polymath Learning Centre

A student uploads their own worksheet as a PDF, writes their answers on it, and works through it
with a buddy that **hints rather than answers**. When they are finished it marks the paper, and
every question they did not get right goes into a **mistake book** with a picture of the question.

One self-contained `index.html` on the shared `mathgen--app` Firebase project, with Google sign-in.
It is the fourth app in the family and it shares the teacher's notebook with the other three, so
everything it says is grounded in the way **Mr Chung** actually teaches.

Live at <https://polymathlc.github.io/tutor/> once GitHub Pages is switched on for the repo.

---

## v1.46.0 — 🅣 The text box works again, and three lost functions are back

**"Still cannot type with text box."** v1.42.0 took 🅣 out of the pencil-only tool list, which was
the right fix for the fault that had been reported — and the box still did nothing, because a
second, older fault was sitting underneath it.

**Three functions this file calls had gone missing in a branch squash**, and every one of them
failed in silence:

- **`bindTextEditNode`** is called from `annNode`, so the very first tap of the 🅣 tool threw a
  `ReferenceError` **inside `renderOverlay`**. The annotation was made and the box was never
  drawn — and because `editingId` stays set, every later rebuild of the overlay threw too. To a
  child: tap the page, nothing happens, ever.
- **`renderStylusBtn`** was called at the **top level** of the wiring, so the throw took every
  line *below* it with it: the one-letter tool shortcuts, Ctrl+Z, Ctrl+S, Escape, the save on
  the way out of the tab, and the eight opening render calls. **The app still painted**, because
  the sign-in callback re-runs the renders — which is exactly why nobody could see it.
- **`commitDrawing`** was called by a **second copy of the touch navigation engine**: v1.12.0's
  `attachTouchNavigation`, superseded by `navBind` and never taken out. Both were bound to the
  same element and both drove the same state. It is gone; there is one engine now.

And the ✍️ button was in the markup **twice**, with **two click handlers** on it — so pencil-only
mode was toggled twice per press and landed exactly where it started: a button that toasts at you
and changes nothing.

### The guard, which is the half worth keeping

v1.43.0 found the same class of fault on the save path (`syncTextEditValue`, a name that never
existed, which wrote nothing for forty-eight versions) and added a census: every name the save
path calls must be defined somewhere in the file. **That census passed this whole time**, because
the save path was fine — it was the other two paths that were broken.

- The census now covers **the text-edit path and the whole wiring block**, handler bodies
  included: a handler calling a name that is not there is a button that throws when it is pressed.
- **`tools/browser-check.mjs` is new**, and it is the only honest check of any of this. It opens
  the real page in a real Chromium, asserts nothing threw, then builds a page, dispatches a
  **touch** pointer with 🅣 in hand, and checks that a box appears, takes words, grows to hold
  them, commits on blur and survives a rebuild mid-word. It also presses ✍️ and asserts the mode
  really flips. On the broken build 13 of its 17 checks go red; reading the source, all of them
  pass.

Nothing about what the app *does* changed: this is v1.45.0 with the parts that were missing put
back.

---

## v1.45.0 — 👉 The tutor can mark TWO places at once

*"Can the AI be more like Brilliant's Koji — actually draw boxes to show where I should be
looking?"* It could draw one box. It could not draw the pair.

**"Compare the first input with the first output" is not a sentence about one spot.** A tutor
saying it boxes BOTH, because what is being taught is the relation between them — and a child
handed one box has to guess which half they are looking at. The tutor's finger was a SINGLETON,
so a second gesture silently REPLACED the first: on a hint, only the last one survived; in live
mode, a reply that opened with two pointer markers put up the second and the tutor's own words
then named a mark nobody could see.

- **The finger is a bounded LIST now**, on a hint and in live mode alike. Up to three marks stand
  together; more than that is a page under magenta, which says nothing at all about where to look.
- **They go up TOGETHER**, as one node with one fade-in. Two boxes that arrive a beat apart read
  as two separate statements rather than as the one comparison they are.
- **And where there is more than one they are NUMBERED ① ②**, so the tutor's own words can name
  them — *"compare ① with ②"*. There is deliberately **no line drawn between them**: a magenta
  rule from one box to the other is struck across whatever is printed in between.
- **A single gesture is byte-for-byte the drawing it has always been** — no number, same node,
  same fade — and a hint saved before this still puts its one finger back exactly as it did.
- Both prompts say what a second mark is FOR: a comparison the student cannot get past without,
  never a second thing that happens to be interesting.

## v1.44.0 — 📕 A question is in the mistake book as soon as it is MARKED

**A mistake reached the book only when the WHOLE paper had finished marking.** So a run that
stopped part way — the tab closed, the network gone, a student simply putting the iPad down —
filed **nothing at all**, however many questions the marking had already read and judged. The
marking cards were on the screen and the mistake book was empty.

- **Every wrong or partly-right answer is filed the moment its batch lands**, through the very
  same ⚡ rapid-add rebuild every other mistake goes through — so it is set out again as a
  question, ready to practise one at a time or to print as a worksheet, with no waiting for the
  last page.
- **🕳 A skipped blank still waits for the end of the paper, and that is deliberate.** A blank
  is only a mistake when a LATER question was answered — and mid-run there are no later
  questions, so every blank would read as the tail. Filing them then would be a book of
  questions nobody has failed at. They are picked up by the last pass, where the whole paper is
  in hand.
- **Still ONE message a paper.** The mid-run passes are quiet and the counts are added up, so a
  ten-page paper says what it filed once rather than four times over — and the skipped ones are
  still named separately in it.
- The mistake book and the teacher's copy of it are refreshed on every pass, so a half-marked
  paper's questions are really there rather than pending.

## v1.43.0 — 💾 Nothing was being saved, and 🕒 the mistake book sorts by newest

**The save has been dead for forty-eight versions, in complete silence.** Not slow, not
occasional — every single save threw before it wrote a byte: the auto-save timer, the flush on the
way out of the tab, and the Save button alike. No ink, no marking, no hints, no score reached the
server. The button simply sat on **Save** and never turned into **✓ Saved**, which is exactly what
it looks like when there is nothing to save.

The cause was one word. `performSave`'s first line called `syncTextEditValue()` — a function that
has never existed in this app; the real one is `syncActiveTextEditValue`. It reads the words out
of a text box that is still being typed in, so that a save cannot store an empty box over a
child's answer. A rename in v1.19.x moved the call and not the function.

**It stayed silent because nobody was holding the promise.** The save is asynchronous, so the
error became a rejected promise — and the timer, the flush and the button all start it without
waiting for it. An unhandled rejection is a line in a console no student ever opens.

Four things are fixed, not one:

- The call names the function that exists.
- **Reading the open text box can never cost the save again.** That box is one annotation; the
  worksheet is the whole lesson, and for forty-eight versions it cost all of it. It is now read
  inside its own guard, so a failure there costs that box and nothing else.
- **Every place that starts a save now catches.** A save that throws is reported exactly the way a
  refused write already was — ⚠ **Not saved** on the button, a copy of the work kept on the
  device, and the retry re-armed. To a student those are the same thing: their work is not on the
  server.
- **The one-write-at-a-time claim is released whatever happens**, so nothing can leave the app
  quietly refusing every later save.

And the harness gained the check that would have caught it: **every function the save path calls
must actually exist in the file.** Every pin that was already there passed the whole time, because
each of them asked what the source *says* rather than whether the names it says resolve.

The Save button also says what it does now — *"Saves by itself as you work — tap to save now"*.
A child pressing Save every few minutes is a child who does not know it is already happening.

**🕒 The mistake book can be read newest first.** It has always been ordered by the syllabus, which
is the right shape for revision — you read down the book rather than hopping about it. It is the
wrong shape entirely for *"what did I just get wrong?"*, because the paper marked a minute ago is
scattered across whichever headings its questions belong to. Two chips over the book now:
**📚 By topic** (unchanged, still the default) and **🕒 Newest first**, which is one flat list with
no headings at all — the question filed a moment ago is the first card. ✏️ Practise and 🖨 the
printed sheet read the same order, so practising the newest first is the same one tap.

It sorts on the time each mistake was **filed**, not on the order the read happened to arrive in,
and two questions from one marking run stay in paper order under it. It hides nothing, so ✕ Clear
the filters does not light up for it, and it is remembered nowhere — the rule the filters already
follow.

**Mistakes were already being added automatically** the moment a paper is marked, and still are;
nothing about that changed. What had been happening is that the marking itself was never saved, so
it was gone on the next reload.

---

## v1.42.0 — 🅣 The text box works with a finger, and 🧽 the eraser looks like an eraser

**Two things reported, and the first one is a real bug.**

**🅣 Tapping the page with the text tool did nothing** — on an iPad or a phone, with a finger.
Pencil-only mode is on by default (it is what keeps a resting palm from writing across the
worksheet), and the text tool had been filed with the tools that leave a *mark by dragging*. So a
finger with 🅣 in hand was handed to the pan engine and the tap never reached the tool at all: the
button simply did nothing, with nothing on screen to say why. It worked with an Apple Pencil and
with a mouse, which is why it looked so random.

Placing a text box is a **tap** — it drags nothing and makes no ink — so it now sits with 💡 Ask
for a hint, 🎤 Say your answer and 🖱️ Select, which a finger has always been allowed to make.
A resting palm still cannot abuse it: a palm-sized contact starts nothing at all, and a stray
empty box is thrown away the moment you tap elsewhere.

**🧽 The eraser was an adhesive bandage.** There is no eraser in the emoji set, so 🩹 had been
standing in for one — and that is exactly what it read as. It is now **drawn**: a classic pink
school eraser with its blue end and a couple of rubbed-out crumbs underneath. Drawn, it says
eraser on every device, and no phone's emoji font can re-draw it as something else.

---

## v1.41.0 — 📌 The set list folds away

**📌 Set for the class** was a wall of cover cards above the bookcase — every paper set for the
centre, at every level, at full size. A term's worth of papers was several screens of them before
the bookcase even began, and for the teacher every one of them was **the same paper twice**: their
own upload is standing on their own shelf below with a 📌 chip on it already.

**The section folds now, and it is folded by default.** What is left is one line:

> ▸ **📌 Set for the class**  ·  24 papers  ·  ⚠ 2 need attention

- **The header is the switch.** Tap it to open, tap it again to fold it away, and the choice is
  remembered on that device. There is no second control to find.
- **A folded section still shouts.** The count is on the header whether the list is drawn or not,
  and so is a ⚠ when a set paper has **lost its PDF** or **has no level or subject** — the two
  things only the teacher can put right, and the only reason to open the list at all. A paper no
  child can open can no longer sit set for a term with nothing anywhere saying so.
- **Nothing is taken away.** It is still every active assignment at every level, and it is still the
  one place a worksheet is taken off the class list — so it folds rather than being narrowed by the
  level and subject picker, which would hide the P6 paper you came to withdraw.
- **Open, it is a register rather than a shelf.** One line a paper: the name, the class it is for,
  the help level it goes out with, whether anybody has started it, and the same two buttons. The
  cover, “📌 Set by Mr Chung” (every line in it is), the topic and the school are dropped — they
  are all on the bookcase card below. Both warnings stay, in full.

---

## v1.40.0 — 🎓 A shelf belongs to ONE class

**A folder made under P6 · Mathematics stays there.** Shelves used to be plain labels with no class
of their own, so “2025 papers” stood on every bookcase at once — and an empty copy of every shelf
turned up under every level and subject, which is the reported fault: *“when I create P6 shelves,
empty shelves are linked to the other levels as well.”*

A shelf now carries the class it was made for, and stands on that bookcase and nowhere else.

- **Making a shelf asks which class it is for**, on two pickers in the ✎ dialog — a level and a
  subject. Making one while you are looking at P6 · Mathematics opens on P6 · Mathematics, so the
  obvious thing needs no thought; making one from a card's 🗂 button opens on **that paper's** class,
  because the paper is moved onto it the moment it is made.
- **Leave a box on “Every” and the shelf still stands on every class**, which is exactly what every
  shelf made before this carries — so **nothing on a live bookcase moves on the deploy**, and a
  shelf you want pinned to one class is pinned with ✎ Rename rather than deleted and made again.
- **The same name on two classes is two shelves.** “2025 papers” on P6 · Maths and “2025 papers” on
  P5 · Science are different piles; the same name on the *same* class is still refused.
- **A paper can only go on a shelf of its own class**, and the app refuses in words rather than
  letting a move land and quietly come undone. The drag does not light up a shelf it is going to
  refuse, the 🗂 picker offers only the shelves the move would accept — and **counts the ones it
  left out**, so a shelf you made is never just missing — and the upload's shelf picker narrows to
  the level and subject the pile is being uploaded to.
- **A paper is never lost by any of this.** A paper still carrying the id of a shelf that is not
  its class falls back onto *Not on a shelf yet*, exactly as it already did for a shelf that had
  been deleted. An upload whose level and subject were only settled by the paper read is taken off
  a shelf it does not belong on **and told so by name**, on its own and in a pile of ten alike.
- Moving a shelf to a different class says what happens to the papers that cannot follow it.

## v1.39.0 — ✎ Rename a paper, and the whole class reads the new name

A worksheet was called whatever it was called when it went up, and there was no way to change it.
A file name the teacher never typed, a title the paper read badly off its own cover, a paper that
turned out to be SA2 rather than SA1 — all of them stuck, on a shelf of thirty cards where the
name is the only thing anybody reads.

Every card on **the teacher's** bookcase now carries **✎ Rename**. Type the new name, press Enter,
and it is renamed **everywhere at once**: on the teacher's own shelf, on the class's, and on the
copy of every student who started it yesterday.

**Their work on it is untouched.** The rename writes one field and nothing else — the writing on
the page, the hints, the marking, the mistake book, the answer key, the score and the help level
are all exactly where they were. Nothing is written to a student's copy at all: the name is read
off the class's own record when the card is drawn, the way the shelf it stands on and the help
level it is locked to already are.

- The dialog opens on the name it already has, so a rename is an edit rather than a retype.
- Renaming is the teacher's — a student never sees the button, and pressing it another way is
  refused with a word rather than quietly ignored.
- A paper nobody has set for a class is renamed on your own bookcase, and the dialog says so.
- A worksheet open on screen while it is renamed follows at once, so the paper you are looking at
  and the card you renamed never disagree.

## v1.38.0 — 🗂 Drag a whole shelf up or down the bookcase

The papers could be moved between shelves and the **shelves themselves could
not be moved at all**: they stood in the order they were made, for ever. So the
shelf a class is working out of this term was wherever it happened to land, and
the only way to put it at the top was to delete the two above it and make them
again.

Now the teacher arranges the bookcase itself, and the arrangement is the
**catalogue every class reads** — so a bookcase put in order this morning is the
bookcase every student opens.

- **⣿ Grab a shelf by its grip.** Every shelf the teacher can arrange grows a
  handle at the left of its heading. Drag it up or down and drop it on another
  shelf: the dragged shelf **takes that shelf's place**, and the one it landed
  on moves aside. The shelf you are holding fades, and the shelf under the
  pointer nudges out of the way so you can see where it is going.
- **▲ ▼ on every shelf, because a touchscreen never drags.** `dragstart` is not
  a thing an iPad fires, so a bookcase you could only arrange with a mouse is a
  bookcase the teacher cannot arrange on the device they teach from. The two
  buttons sit beside ✎ and 🗑 on the shelf's heading and move it one place at a
  time; they go flat at the top and the foot rather than quietly doing nothing.
- **It is the same order for everybody.** The order lives on the shelf
  catalogue, not on anyone's copy of a paper, so it reaches the student who
  started a worksheet yesterday just as surely as one who has not opened it yet.
  The toast says so: *“Topical” now comes first — on every class's bookcase.*
- **The shelves move; the papers never do.** Nothing about which paper is on
  which shelf changes, and nothing is written to a single worksheet.
- 🕒 **Recently opened stays at the top** and cannot be dragged or dropped on —
  it is a view of what you were last working on, not a place. Neither can *Not
  on a shelf yet*, which is always last by rule.
- **Only the teacher.** A student never sees a grip or an arrow, and the app
  refuses the move itself rather than merely hiding the buttons.

---

## v1.37.1 — 🐛 Making a shelf works

*“The bookcase could not be saved: Resource id `__shelves__` is invalid because
it is reserved.”* **Firestore reserves every document id matching `__…__`**, so
the shelf catalogue v1.37.0 shipped could not be written — and could not be
READ either. The write said so out loud; the read is caught, so the bookcase
just stood there with no shelves on it, looking exactly like a centre that had
never made one.

The document is called `shelfCatalogue` now and nothing else about it moved: it
still sits in `tutorAssignments`, whose rules already exist, still carries
`active: false`, and is still dropped by name so it can never turn up as a
worksheet set for a class. **There is nothing to migrate** — that document could
never have been written, so no shelf was ever lost.

---

## v1.37.0 — 🗂 Shelves you make yourself, and a 🕒 Recently opened shelf

The bookcase had one shelf per level and subject, worked out from the paper's
own tags — right until a class has forty papers on one shelf. What a teacher
actually has is **piles**: this year's prelims, last year's, the topical
drills. So the teacher makes their own shelves, names them, and moves papers
between them — and **every student of that level and subject sees the same
papers on the same shelves**.

- **🔁 Toggle between every level and subject.** A bar over the bookcase with a
  **Level** and a **Subject** picker on it. Pick *P5 · Science* and the
  bookcase is that class's; pick *Every level* and it is all of them. It is
  remembered on the device, so it opens where you left it. A student never
  picks their level — their list is already theirs — and is offered a subject
  only if they really take more than one.
- **🗂 Make a shelf, and name it.** *2025 papers*, *Prelims*, *Heat revision*.
  A shelf is a **label**, not a class: the same shelf stands on every level and
  subject, and each student sees their own papers on it. Rename it with ✎ on
  the shelf and it is renamed on every bookcase in the centre. 🗑 takes it off —
  **and never takes a paper with it**: the papers on it go back to *Not on a
  shelf yet*, and the confirm says so before you press it.
- **⬆️ Upload straight onto a shelf.** The upload dialog has a **Shelf** picker
  when you have shelves. Pick several PDFs at once and the whole pile lands on
  it together.
- **🖐 Move a paper between shelves, two ways.** Drag a booklet onto another
  shelf with a mouse; the shelf you are over lights up. On an iPad — where a
  touchscreen never fires a drag at all — every card carries a **🗂 Shelf**
  button that offers the same shelves, plus *Make a new shelf for it…* so the
  shelf and the move are one gesture.
- **🕒 Recently opened.** A shelf at the top of the bookcase, in cooler timber,
  holding what was last worked on with **how long ago** on each card — *2 hours
  ago*, *yesterday*, *4 days ago*. It is a **view, not a move**: every paper on
  it is still standing on its own shelf further down, and each card says which
  shelf that is so you can go and find it. It counts a paper you opened and
  read without writing on, as well as one you worked on.
- **The students get exactly your arrangement.** Their own ink, hints, marking
  and mistake book stay theirs; the shelves are yours. A paper you move this
  morning moves on thirty bookcases at once — including the children who
  started it yesterday — because the shelf is read live off the set worksheet
  rather than off each copy.
- **It needed no Firestore rules change and no deploy.** The catalogue is one
  document in the collection the set worksheets already live in, whose rules
  already say *read by anybody signed in, written by the teacher*.
- **A centre that never makes a shelf sees no change at all.** With no shelves
  the bookcase is exactly the one it was: one shelf per level and subject.

---

## v1.36.0 — ✍️ A tap on your writing no longer moves it

The same stylus fix as Ans Key v1.101.0, so a pen behaves the same way in both
apps. Both failures are silent — the page goes on drawing and nothing on any
screen says what changed.

- **A tap selects without nudging the writing.** A stylus tip is never
  perfectly still: it wobbles a pixel or two as it touches down, and a graphics
  tablet reports absolute positions, so what the hand meant as a tap on a
  stroke arrived as a tap *and* a small drag — the act of selecting a stroke
  moved it. A grab becomes a *move* only once the pointer has really travelled,
  measured in screen pixels so it means the same distance at every zoom. A tap
  no longer costs an undo step that undoes nothing, and no longer marks the
  worksheet as having unsaved changes.
- **The pen's barrel button no longer breaks the stroke you are writing.** It
  sits exactly where the fingers grip, and squeezing it mid-word fired a second
  `pointerdown` carrying the same pointer id as the tip already down — so the
  one-pointer-at-a-time guard could not see it, and it abandoned the stroke in
  progress to start a fresh gesture. Only the primary button starts anything
  now, whatever the pointer is; the eraser end of a pen arrived the same way.

## v1.35.0 — 🖼 The question is redrawn, and 📕 the teacher can see the book

Three things, and the first two are one thing: a mistake in the book should look like a question
out of the Science portal's ⚡ **Rapid add**, not like a photograph of a photocopy.

### 🖼 Every picture is redrawn as black line work

The crop machinery here has always been the portal's, ported under the same names. What was
missing was the half that makes a rebuilt question **readable**: over there every figure is handed
to an image model and comes back as crisp black line-work on white before it is stored. Here a
student practised from a crop of their own photograph — grey paper, weak toner, a shadow down one
edge, speckle — and on a printed practice sheet, a grey smudge.

Now every figure inside a rebuilt question, and the whole-question crop itself, is redrawn before
it is stored.

- **It goes through Firebase AI Logic, App Check'd and server-keyed.** There is no API-key box in
  this app and there never will be — it is opened by children on shared iPads — so a student's
  phone gets the clean-up with nothing set up on it.
- **The prompt is most of the safety.** A model told only "clean this up" renders the scanning
  damage beautifully, or writes in the axis value the scan destroyed. It is told at length what is
  **damage** and what is the drawing, then told twice not to invent anything: a number added to a
  maths question on its way into the book is one the student then gets wrong a second time, for a
  reason nobody can see. It is also forbidden to answer, tick or fill in the question it redraws.
- **It never costs the question.** No image model, a model that refused, a reply with no picture
  in it, a worksheet closed mid-call — every one of them hands back the crop that came in.
- **🧻 And the weave comes straight back out.** An image model has no flat white: it paints the
  background, and its decoder leaves a faint texture a few units under the paper — invisible on a
  phone and a grey wash the moment the sheet is printed. A white-point clamp takes it out, refuses
  outright on anything that is not paper with line work on it, and never touches the drawing.
- The whole-page fallback is deliberately left alone: a whole page handed to an image model is
  where invention is likeliest and least checkable.

### 📕 The teacher can see what the class is getting wrong

The most useful thing this app makes lived in exactly one account — the student's own. The teacher
who set the paper, marked the class on it and is planning next week could not see a single
question anybody had got wrong. Now 👥 **Who has signed in** carries 📕 **What the class gets
wrong**, and each student's panel ends with their own book.

- **The student's book is still the truth.** Every mistake stays where it is, with its pictures.
  What travels is a compact text row onto the centre's roster document — the one this app already
  writes and the teacher already reads — so it needs no rules change and no deploy.
- **The class view groups by topic, biggest first**, which is the question a teacher opens it to
  ask. An unlabelled question keeps its own heading and is always last.
- **The pictures do not travel**, and both panels say so: those files live under the student's own
  account, and a teacher would get a grid of broken images rather than a book.
- It is the admin's and nobody else's — checked when the panel is drawn **and** again when it is
  opened — and a teacher's own practice papers are never mirrored.
- 🕳 A skipped question says **Skipped**, not "not quite", here too.

---

## v1.34.0 — 🕳 A question they skipped past is a mistake too

**A blank is never marked wrong. That rule has not moved, and it is not what this is about.**

Until now the mistake book took every `wrong` and every `partial` and nothing else, on the reasoning
that a question nobody attempted is not a question anybody failed. That is right about *some*
blanks and plainly wrong about the rest — and telling them apart needs nothing the marking did not
already know.

**A blank with answered questions AFTER it is not the same thing as a blank at the end of the
paper.** A student who reaches question 7, cannot do it, and goes on to answer 8 and 9 has said
something out loud: they do not know how. A student whose last four are blank has run out of time,
or put the pen down. The first belongs in the book more than most of what was in it; the second
does not belong there at all.

So `markLastAnswered` finds the last question the student really attempted, and every blank **before**
it is filed. Everything after it is the tail, however long it runs.

- **It is the LAST answered question, never the next one.** Asking *"is the question after this one
  answered?"* files only the final blank of a run and quietly loses every one before it — and a run
  of three skipped questions in a row is exactly the case worth catching.
- **A correct answer ends the tail just as a wrong one does.** The test is whether they carried on
  past the blank; how the questions after it went has nothing to do with it.
- **Nothing about the marking changed.** No verdict, no feedback, no red cross — the marks chip
  still says what was there to be had, the report still counts it blank, and the score is still out
  of what was attempted. A cross on an untouched question is still the one mistake this app must
  never make.
- **So the card is indigo, not red**, with a **⬜ Skipped** chip and a line saying *"You left this
  blank and answered questions after it, so it is here to try again."* — a skipped card has no
  answer of its own and no feedback, so without a word on it it is a bare question sitting among
  marked ones with nothing to say how it got there.
- **Below the top help level its explanation is labelled *Where to start*** rather than *Why*: a
  blank comes back with a nudge where its answer would be, and a skipped question meets that far
  more often than a wrong one ever did.
- **The practice marker is told there was no first attempt.** Left unsaid, *"a big improvement on
  last time"* is praise to a child who never wrote anything, for something that never happened.
- Searching **skipped** finds them, ✓ *I can do this now* clears them, and the ✂️ crop, the 🧩
  rebuild, the printed practice sheet and the syllabus filing all work exactly as they do for
  everything else in the book.

---

## v1.33.1 — 🚀 Merging is what deploys the server half

**The live card said *"Up to 1 hour"* and the tutor still answered *"You have used today's live
lessons."*** Both were telling the truth about a different half of the app.

`index.html` ships with GitHub Pages the instant a pull request merges. **`functions/` has never
shipped with anything** — it only ever reached students when somebody remembered to run
`firebase deploy`. So the page was v1.33.0, with the rations removed and the lesson an hour long,
while the endpoint it was talking to predated v1.32.0: still six lessons a day, still no refund for
a microphone the student refused, still no stale-slot sweep. Nothing threw, nothing was logged and
no screen anywhere could have said so.

**Merging now deploys both halves.** `.github/workflows/deploy-functions.yml` runs on a push to
`main` that touches `functions/`, `firebase.json` or `.firebaserc`, runs the functions' own tests,
and deploys.

### One secret, once — and until then it says so rather than failing

It needs **`FIREBASE_SERVICE_ACCOUNT`**: the whole JSON key of a service account on `mathgen--app`
with the *Firebase Admin* and *Cloud Functions Developer* roles, pasted into
**Settings → Secrets and variables → Actions**.

Until that exists the job **runs the tests, warns, and skips the deploy** — it does not fail. A red
tick on every single merge is a red tick people learn to scroll past, and the next real failure
would go with it.

### Scoped to this codebase, and never `--force`

`mathgen--app` is **shared**: the Maths repo's `askOpenAi` and `askKimi` functions live on the same
project. So the deploy names `functions:study-buddy-live` and nothing else, and it carries no
`--force` — a run that wants to DELETE something stops and says so instead of quietly taking
another app's function off the project. The harness pins both, reading the deploy STEP rather than
the file, because this section's own words name the flag it forbids.

### …and the functions' tests now run on every pull request

`node --test functions/test/*.test.js` had **never run in CI**. Forty-eight tests, covering the
limits, the refund, the lease and the locks — the half of the app that decides whether a child gets
a lesson — and every one of them only ever ran when somebody ran it by hand.

**The immediate fix for a live tutor still refusing lessons is one command:**
`firebase deploy --only functions`. After that, merging is enough.

---

## v1.33.0 — ⏱ The limits are off the live tutor

Four numbers stood between a child and the live tutor. **Three of them were rations and all three
are gone:**

| | was | now |
| --- | --- | --- |
| Lessons a student may start in a day | 6 | **no limit** |
| Lessons the whole centre may start in a day | 100 | **no limit** |
| Lessons that may run at the same time | 20 | **no limit** |
| How long ONE lesson lasts | 10 minutes | **1 hour** |

### The fourth is not a ration, and it is not removed

`durationSeconds` is how long a single lesson runs before its lease expires, and three separate
things are built on it: the lease's own expiry, the scheduled sweep that closes an abandoned paid
call, and the stale-slot rule that lets a dropped tab's reservation go. **Remove it and a tab left
open on a desk holds a lease that never expires and a call that never closes** — a bill that runs
all night with nobody in the room. So it is raised from ten minutes to an hour, and it is
**clamped** (60 seconds to 4 hours) rather than trusted: a junk value there is the one setting in
this file that would fail expensively rather than loudly.

The three rations are the opposite, so they fail the opposite way: `0` means off, and anything
that is not a real number is off too. The worst case is a bill the teacher can see; failing shut
is a child told to come back at midnight.

**The counts are still kept.** They are what the teacher can look at, and they are what v1.32.0's
refund takes back off — switching the counter off with the cap would leave that whole path as code
nothing ever runs.

### A lesson that was never open, blocking every later one

`currentLease` is the per-account lock that stops two live sessions billing at once. It is cleared
when a lesson is released — so a tab closed mid-lesson, a dropped network or a failed close left it
**set for ever**, and every later start on that account was refused with *"A live lesson is already
open on this account"* about a lesson that ended days ago. That was the one limit a student could
hit that would never come back on its own, and it is the per-account twin of the concurrency slot
v1.32.0 fixed for the whole school. A lock carries the moment it was taken now, and one older than
a whole lesson is let go.

### The clock on the card told the truth again

The live card read **`/ 10:00`** and *Up to 10 minutes* as literals typed into the page, while the
server decided the real length. The moment the lesson became an hour those two disagreed — and a
student watching the clock count past 10:00 reads a broken clock, not a longer lesson. The start
reply has carried `maxDurationSeconds` all along and the app threw it away; it is read now, so the
card is right whatever the server is set to, in words a child reads (*Up to 1 hour*, `1:04:22`)
rather than a four-figure count of minutes.

### And the two centre-wide ceilings answer differently

Both are off, but for the day somebody turns one back on: *"twenty lessons are already running,
try again in a few minutes"* and *"the centre has used today's allowance, it comes back at
midnight"* are different things to be told, and the old wording said *"busy or has reached today's
allowance"* and left the student to guess — the very fault v1.32.0 fixed at the other end of the
same wire.

> ⚠️ **This needs `firebase deploy --only functions`.** The limits live in
> `functions/live-service.js`, which does not ship with GitHub Pages. Until that runs, the card's
> clock is the only half that changes — and it would then be counting towards an hour on a server
> still ending lessons at ten minutes.

---

## v1.32.0 — 📕 The mistake book is FILED, 🧩 set out again, and the live tutor stops saying "busy"

### 📕 Every mistake under its subject, its topic and its objective

The mistake book was one long list, newest first, with a *Still to do / Sorted / All* chip above
it. That is fine at ten cards and useless at eighty: a student revising Heat had to scroll past
every fraction they have ever got wrong to find the four questions that were about heat.

It is **filed** now, using the very syllabus the report already files a marked paper under — cer's
own learning outcomes for science and the Maths app's MOE syllabus. Each card wears two new chips,
**📗 the topic** and **🎯 the objective**, and tapping either filters the book down to it. Above the
cards there is a row of subject chips, two pickers (topic, then objective) and a search box.

- **The sections are the syllabus's own order**, not the order the mistakes happened in — so
  revising goes down the book, Heat then Light, rather than hopping about it.
- **The two pickers are dependent.** Choosing Science narrows the topics to science topics;
  choosing a topic narrows the objectives to that topic's. A count on each says how many cards are
  behind it, and the count is of the book rather than of what is half-typed in the search box.
- **A picker never narrows its own options away.** With a topic chosen, the topic list still
  offers every other topic — a list you cannot change your mind in is a list that traps you.
- **A choice that no longer matches anything falls back to "all"** on every paint, so deleting the
  last card of a topic cannot leave the book showing nothing under a heading nobody is filed under.
- **The search reads everything the card can show** — the question (including one set out in
  blocks), what the student wrote, what the buddy said, the paper's name, the topic and the
  objective — and **every word has to appear**, so a second word narrows rather than widens.
- **An objective this build has never heard of is shown unplaced** rather than as a chip reading
  its own bare id. The syllabus catalogue has the last word.
- Nothing is remembered between visits: a topic filter set last Tuesday and never noticed again is
  a book that looks empty for no reason.

### 🧩 Set a mistake out again

A mistake is filed with the question **set out again** — the wording typeset, the paper's own
figures cut out and put back where they belong — exactly the way ⚡ Rapid add builds a question in
the Science portal. That happens once, inside the marking run, with a ration for the whole paper,
so a question that missed it landed on the whole-page tier and stayed there for ever: a photograph
of a page with two other questions on it, which is not a question anybody can practise.

**🧩 Set it out** on a card runs that same pipeline again, on demand. It reads the page off the
open worksheet's own PDF when the worksheet is open — so the crop is as sharp as the marking run's
— and off the mistake's own stored page when it is not. The tools bar above the book sets out
everything on screen that still wants it.

- **It is the same pipeline, not a second one.** One ask, one cleaner, one cropper.
- **A question already set out in blocks is skipped**, so the button can never cost a call and
  change nothing.
- **The old picture is deleted only after the new one is written**, and a refused delete is
  swallowed: a file left in the bucket is untidy, a card with no picture is unreadable.
- Bounded at eight in one press, one at a time, and it stops outright if the AI is off.

### 🎧 "Live tutoring is busy. Please try again in a little while."

It was not busy. **Every attempt to start a lesson spent one of the day's six before the provider
was ever asked**, and nothing ever gave it back — so a microphone the student did not allow, an
SDP the other end rejected, or a rate limit there each cost a lesson. After six of those the
endpoint refused with *"you have used today's lessons"* and the app showed *"busy, try again in a
little while"* about something that was not coming back until midnight.

Three fixes, and the first is the one that was reported:

- **A start that never became a call is given back.** A lesson that really ran and was stopped
  still counts — that is what the daily allowance is for — but an attempt that never connected is
  not a lesson used. It is given back once only, and never off the next day's count.
- **The server's own reason is shown.** The app was throwing the message away and substituting
  its own by status code, so *"you have used today's 6 live lessons, they come back at midnight"*
  was displayed as *"busy, try again in a little while"*. Two different things to be told.
- **A concurrency slot lets go of itself.** The twenty slots the whole school shares were released
  by a scheduled sweep that is a separate Cloud Function; without it a handful of closed tabs took
  live mode away from everybody permanently. A slot now carries the moment it was taken, and one
  older than a whole lesson is let go by the next start.

> **This half needs a Cloud Functions deploy** — `firebase deploy --only functions`. The rest of
> the app ships with GitHub Pages; `functions/live-repository.js` does not.

---

## v1.31.0 — ✍️ The tutor writes working on the page, and the pointing is put right

Three things, and all three came out of watching one hint go wrong on a real P5 paper.

### ① "I tapped question 12 and it gave me a hint about question 11"

The tap was recorded perfectly — the orange pin was sitting exactly on question 12 on screen. What
was wrong was what the app then **told the model about where the tap was**. The close-up picture a
hint is built from runs from a little **above** the tap to well **below** it, so the tap sits about
two fifths of the way down it — and the request said *"they tapped near the top of the close-up"*.
So the model read the question at the top of the picture, which is the question **before** the one
that was tapped, and answered that one instead.

The app no longer describes the tap in words at all. It **draws a magenta ring on the spot**, on
both the close-up and the whole page, and tells the model that ring is where the student tapped —
and that the question they need is the one the ring sits inside, or the one directly above it when
the ring is on a blank answer line. A mark is something to look at; a fraction was something to
take on trust, and it was not even true.

### ② "The underlining is not accurate"

Two causes, both fixed.

The first is that the tutor was being asked to give a position on a **photograph with no reference
marks on it at all** — *"tell me where this is, from 0 to 1000, down and across"* — which is
guesswork however carefully it is done, and a guess that is out by two per cent is an underline a
line or two away from the words it was meant to be under. The picture that goes to the tutor now
carries **the ruler it is being asked to measure in**: a faint teal grid every 100 units with the
numbers printed down the left-hand side and across the top. Estimating becomes reading.

The second was quieter. The instruction named the picture to measure on by its **position in the
list** — "the second picture" — and the app builds that list conditionally, so on any page whose
close-up could not be made, "the second picture" was **the page before**. The gesture was measured
against one page's layout and drawn onto another's, silently. Every picture is now named by what it
actually is, and the request states the number that picture really has.

**The grid never touches the worksheet.** It is drawn onto the copy that goes to the tutor and onto
nothing else — not the page on screen, not the marking run's picture, not the mistake book's, not
the printer's. Both prompts also say in as many words that the grid is the app's and is never part
of the question, so a grid number can never be copied into a question the tutor reads back.

### ③ "Human teachers can do working on the paper"

They do, and now the tutor does too. When a line or two of working would help more than another
sentence would, it **writes it on the paper** — in the blank space beside or below the question,
in the tutor's own magenta, on a little dashed note so it can never be mistaken for something the
worksheet printed:

> 3 units = 12
> 1 unit = 12 ÷ 3
> 5 units = ?

It happens on a 💡 **hint** and while the tutor is talking in 🎧 **live mode**, exactly as the
finger does — and the 👉 **Show me where to look** button on a hint card puts the working back up
with the gesture, so an explanation from last week comes back whole.

**It always stops one step short.** The last line always ends in a question mark: the working shows
the *shape* of the method and leaves the child the step to take. Working that runs all the way to
the answer is simply the answer with a pencil round it, so the app refuses to draw it rather than
trimming it back — refusing is the safe way to be wrong, because the hint's own words still say
everything they said before.

**It sits on the "How to do it" rung.** Working set out *is* the method, so it is offered at exactly
the help levels the drawn bar model is, and at *Nudges only* or *Concept & keywords* the tutor does
not write on the paper at all. That is checked where the working is drawn, not only in the prompt.

**And it is never ink.** Like the finger and like the marking's ticks, it lives outside the
student's own annotations entirely: it cannot be dragged, erased or undone, it is never saved into
the worksheet, it never prints, and the marking run never sees it. Working the tutor wrote that
ended up in the annotations would be read by the next marking as the student's own — the paper
would mark itself kindly and nothing on any screen would say why. It comes down when the tutor
moves on, through the very same clear the finger uses, so the two can never drift apart.

---

## v1.30.0 — 👉 The tutor points at the page

A human tutor does not only talk. They put a **finger on the page**: *"look at THIS number"* is a
sentence and a gesture together, and a child handed only the sentence has to find the number
first — which is most of what being stuck actually is.

So the tutor points now. While it is talking in 🎧 **live mode**, and on every 💡 **hint**, it
draws the gesture a teacher would draw on the spot it is talking about: a **circle** round a
number, an **underline** under the words that decide the question, an **arrow** at a part of a
diagram, a **box** round a row of a table. It appears as the tutor says it, in the magenta of the
centre's own logo, with a white halo underneath so it reads over printed text.

**It is never ink, and that is the part that matters.** The gesture is drawn into the page the
same way the marking's ticks are — outside the student's own annotations entirely. It cannot be
dragged, erased or undone, it is never saved into the worksheet, it never prints, and the marking
run never sees it. A tutor's circle that ended up in the annotations would be read by the next
marking run as the student's own work, and nothing on any screen would say why the paper had
suddenly marked itself so kindly.

**It is temporary, and nothing about it runs on a timer.** It goes up when the tutor says
something about a spot and comes down when the tutor **moves on** — the next spoken question, the
next hint, the session ending, a new worksheet, leaving the worksheet. That is exactly what a real
finger does: it stays while the explanation is being worked through, and it is gone the moment the
conversation is about something else. It never takes a stroke from the stylus either, so a gesture
left standing costs the child nothing at all.

**A hint keeps its gesture**, so a hint card that has one grows a 👉 **Show me where to look**
button — the pointing is something that can be asked for again rather than something that happened
once. The worksheet a child reopens next week still knows where its tutor was pointing.

**It refuses to guess.** A position that is off the page, malformed or only half-written is
dropped rather than nudged onto the page somewhere plausible, and both prompts say why in as many
words: *a finger on the wrong question is worse than no finger at all.* It reads a position
through exactly the same code the marking's ticks do, so the two can never disagree about where
the top-left of a page is.

It is drawn **under the student's own ink**, so it can never cover the answer it is helping with,
and it holds still while they write: it fades in once, breathes three times to catch the eye, and
then simply sits there. Under **Reduce Motion** it appears with neither.

---

## v1.29.1 — ✏️ The maths pad's symbol strip is one row, not four

The working line offered **thirty symbols over four rows** — Working, Compare, Number and Shape —
and a wall of symbols is a wall nobody reads. A child stuck on question 7 needs × and ÷ to write
the next line; they do not need ⊥, ⅔ or ≈, and every one of those was in the way of the four keys
they came for.

It is **one row now**: `+ − × ÷ = ( ) °`. The degree sign is kept and moved up into it — it is
genuinely unreachable on a school keyboard and it ends an ordinary P5 answer, which is the test
every key on that row has to pass: **hard to type, and part of a line of working.** Everything
dropped failed one half or the other — `<`, `>`, `%` and `:` are already on the keyboard, and a
comparison or a shape is not a step of arithmetic.

The keys are **smaller** to match, and the strip is tighter. On a phone, where the pad is a sheet
a child taps with a finger, they stay the size they were: shrinking a key on a touch sheet is how
a learning aid turns into one they keep mis-hitting.

---

## v1.29.0 — 📌 You can SEE which papers your class has, and give them the rest in one press

A shelf of P5 papers sat uploaded and set for nobody, and **nothing on any screen said so**. The
only signal a paper had reached the class was whether its button read *"📌 Set for my students"* or
*"📌 Set — take it off"* — two words apart, on a shelf of thirty cards, read as decoration rather
than as state. So a paper no child was ever given looked exactly like one every child has.

**Every card now says which it is.** 📌 *Set for the class* in green, *Not set for the class* in
grey, and ⚠ *Set — but on nobody's shelf* for the one case that used to be invisible: a paper that
really was set, with no level or no subject on it, so it went out to nobody at all. Drawn for the
teacher only — a student's shelf holds the papers they were given, so the ones they were not given
are exactly the ones that are not there to be marked.

**📌 Set N papers for my class** appears at the top of the home screen the moment any of them is
waiting, and says how many. One press, one confirm naming every paper and the shelf it will land
on, and they go out one at a time. It never touches a paper that is already set — the help level,
the lock and the answer key it went out with are the teacher's, not something a button labelled
"set the rest" quietly rewrites — and **every paper it could not set is named with the reason**:
no PDF, no level, no subject, or a write the Firestore rules refused.

Two quiet faults went with it:

- **A push that FAILED was counted as one that went out.** The upload set `pushed = true` the
  moment `pushWorksheet` had been *called*, so a refused write — the rules not allowing it yet,
  which is the commonest failure there is — was reported to the teacher as a paper the class had
  been given. A pile of ten could say *"9 set for the class"* over nine papers no child could see.
- **In a batch, a paper that could not be set was completely silent.** The explanation was shown
  only on a single upload, so in a pile of ten the count was the only clue that anything had been
  left behind, and it never said which one or why.

---

## v1.28.0 — 📚 A whole pile of worksheets at once

A teacher does not have one worksheet, they have a term's worth — and uploading them was one PDF,
wait for it to be read and filed, open the dialog again, one more PDF. **The picker now takes as
many as you like.** Hold Ctrl (⌘ on a Mac) in the file dialog, pick the lot, and they go up one
after another: each one read, its answer-key pages found and put away, its cover made, and — for
the teacher — set on the shelf of the level and subject it is for.

The bar at the bottom counts them off as it goes (**📚 3 of 12 · Uploading “P5 Heat revision”…**),
and when the last one lands you are back on the shelf with all of them on it, with a line saying
what went up and what was set for the class.

**Choosing several changes three small things, and each says so on the dialog.**

* **The name box is for a single paper.** With several PDFs chosen, each one takes its own file
  name — and Chung GPT still reads the cover and renames it properly. Ten worksheets sharing one
  typed name is a shelf nobody can search.
* **An answer key belongs to one paper**, so it goes on the first of them and the finishing line
  says which one got it. Attach the others from the 🔑 button on each worksheet.
* Everything else on the dialog — the level, the subject, how much help, and **📌 Put it on my
  students' shelves** — applies to the whole pile.

**Nothing in a pile is lost quietly.** A paper that could not be read is named at the end so it
can be tried again on its own, and the ones after it still go up. Anything that is not a PDF is
skipped and named rather than stopping the upload. Forty papers is the most in one go; past that
the rest are counted and left, never dropped in silence.

**A single upload is exactly what it always was** — it opens the worksheet, opens the buddy and
says *Ready — write your answers on it*.

---

## v1.27.0 — ✏️ The working line and 📐 the model, on a maths worksheet

A keyword check asks a student to fill in the words a science answer needs. On a **maths**
worksheet that is the wrong question: what a child is stuck on is not the word *evaporation*, it
is what to write on the next line. So on a maths worksheet the keyword check stands down and two
things take its place.

**✏️ Try the next step.** A line to write the next step of the working on, with the symbols a
school keyboard cannot easily reach printed above it — **× ÷ + − = ( )**, then **< > ≤ ≥ ≈ ≠**,
then **½ ⅓ ⅔ ¼ ¾ ² ³ √ π % :**, then **° ∠ △ ∥ ⊥ →**. Tap one and it goes in where the caret is.
Press Check and the step is marked as a STEP — *right*, *close*, or *not yet* — with a sentence
saying what to look at, never the answer. Get it right and the line is kept and the pad asks for
the one after it, so the working builds up a line at a time the way it is written on paper.

- **It costs nothing to open**, because the ask is already in hand: on a hint it is the rung the
  student has just been shown, and in live mode it is what the tutor has just said.
- **It is offered at EVERY help level.** Asking a child to attempt the next step tells them
  nothing they did not already have, so there is nothing for the ceiling to protect. Only the
  marking spends a call.
- **The app checks the sum itself where it can.** `12 × 4 = 46` is not marked right whatever the
  model says — a number that does not add up is a number that does not add up, and that check is
  free, instant and always the same. It can only ever overrule a *right*.
- **The tutor is told what the student wrote and how it went**, as context rather than speech, so
  the live lesson carries on from the step rather than repeating itself.

**📐 Draw the model.** On a worksheet where a bar model is the way in, the pad draws one — the
bars, the parts, the labels and the bracket showing what is being asked for — and then offers two
things: **Show me the model**, which puts it on the page as ordinary ink to copy and work from,
and **Label it yourself**, which prints the model with the numbers taken out and asks the student
to type what goes in each part.

- **It sits on the "how to do it" rung**, because a model of the question IS the method set out.
  Below that level it is shown 🔒 locked and says so — and the handler refuses as well as the
  button, because a hidden button has never been the lock in this app.
- **The unknown is never filled in below the top rung.** The part the question is asking for comes
  out as **?**, on the drawing and on the page, so the model shows the shape of the question and
  never its answer. The specification the model returns does not carry the final answer at all, so
  there is nothing sitting in the page for anybody curious enough to open the developer tools.
- **What lands on the page is ordinary ink** — rectangles, lines and text boxes, exactly the
  shapes the rest of the app already draws — so it moves, it is erased, it undoes, it saves, it is
  composited onto the page for the marking run, and it prints. It goes down as ONE undo step, so a
  model dropped in the wrong place is one Ctrl+Z away from gone.
- **Labelling is checked locally.** *"3 units"*, *"3units"* and *"3 UNITS"* are the same answer to
  a child who has understood it; a different number is not, and nothing is sent anywhere to decide
  that.

**The switch is a preference, per device**, on the Live card and the Hints tab, exactly where the
keyword check's was — and on a maths worksheet it is that switch. A subtitle bar is lifted clear of
whichever box is open, and only one of the two is ever on screen at a time.

---

## v1.26.0 — The live tutor answers sooner

Asking the tutor a question out loud took longer than it should have, and the wait was almost all
plumbing rather than thinking. Four changes, none of which alters a word of what is said.

**The reply is spoken as it is written.** The tutor used to wait for the last word of the last
sentence before saying the first. Now the first finished sentence goes out while the rest is still
being written, and the remainder follows as one more piece. Every word is still said exactly once,
and the "let me check the worksheet" opening is still removed — wherever it sits, so the reply is
the same whether it streams or not. A reply whose question the student has already moved on from
stops mid-answer rather than talking over the new one.

**One page goes up, not three, and a smaller picture.** A live question is nearly always about the
page under the student's eye, and every extra page was another quarter-megabyte uploaded and
another page of reading before a word was spoken. When the top page is most of what is on screen it
goes alone; when the student is straddling two, both still go. Nothing else in the app changed —
Ask and the hints read the same three pages they always did.

**The notes, the answer key and the picture are prepared side by side** rather than one after the
other. None of them needs anything the others produce, so waiting for them in turn was pure
waiting.

**The answer key is read while the microphone is still being granted.** Allowing the microphone and
opening the connection is several seconds the key could be transcribed in for free, instead of the
first question of every session wearing that whole pass with nothing on screen but "Thinking…". If
it cannot be read, nothing is shown — the check that actually needs it says so, properly, when it
is asked.

---

## v1.25.2 — A P5 account stops seeing the P6 and P4 papers

**The bug.** Signing in fired the worksheet list and the roster read **side by side**, with the
account's students freshly emptied. Both filters read "no active student" as "show everything", on
the reasoning that the onboarding gate is covering the screen and the answer is a second away — but
an account that has **already answered** never sees that gate, so the list was filtered against
nobody and then never filtered again: adopting the roster repainted the header alone. Every
worksheet the teacher had set, at every level, stood on a P5 child's shelves. Reloading raced the
same way, so it never came right.

**The fix.** The roster is now a promise the list waits on. The worksheets are not *repainted* once
who is working is known — they are not painted until then, so there is no flash of another class's
papers either. It is settled from every path that decides who is working (the profile read, the
gate being answered, a read that failed, the teacher who is never asked, and signing out), always
from a `finally`, and the wait is bounded so the home screen can never hang on it.

**And a set worksheet now fails closed.** An unknown student is shown **no** set worksheet at all.
A set worksheet belongs to a class, so "we do not know who this is" must never mean "show every
class's paper". A student's own uploads stay visible, which is the deliberate difference: your own
work is yours, and hiding it with no explanation is the worse fault.

---

## v1.25.1 — The stylus harness runs green again

No change to the app. The CI check `node --test tools/*-tests.mjs` had been red on five stylus
cases since before v1.25.0: the harness cut the overlay renderer out of `index.html` one line
below the rebuild counter it reads, so the vm threw `overlayRebuilding is not defined`. The cut now
starts at the counter and the sandbox carries a `setTimeout`, and all 21 cases pass.

---

## v1.25.0 — Wooden bookshelves, every paper on its shelf, and a posted PDF files itself

**📚 The bookshelves are wooden, and the papers are booklets.** Each shelf is now a plank of timber in
a wooden case — drawn from gradients, never a picture, so a school wifi that blocks images still
gets a shelf — with a brass plate naming its level and subject. Every paper stands on the plank as a
**stapled booklet**: a dark spine with two staples, the sheets fanning out at the right edge, its own
front page on the cover. A booklet the teacher set has the class's blue spine and says **✨ Not opened
yet** until you start it.

**📖 Every paper you have is on a shelf, opened or not.** A worksheet the teacher set used to wait in
its own *Set for you* list until you started it. It stands on the shelf now — the P5 Science shelf, the
P6 Maths shelf — beside the ones you have begun, filed by topic exactly as they are, with **Start it**
on its cover. Start one and it becomes your own copy on the same shelf. The *Set for you* list is gone
from a student's home screen; the teacher keeps a **📌 Set for the class** list of everything set, at
every level, which is where one is taken off.

**🎯 Each level and subject sees its own papers only.** A set worksheet reaches the shelves of students
at **its level, taking its subject**, and no others. One set with no level or subject reaches nobody —
it used to reach the whole school — and the teacher's own card says so, in words, so it can be set again
properly. Your own uploads are unchanged: an untagged one of your own is still yours.

**📌 A PDF the teacher posts files itself.** *Put it on my students' shelves* is ticked by default in the
teacher's upload dialog. Leave the level and subject pickers blank and Chung GPT reads them off the
paper's cover; the moment the upload, the read and the answer-key scan are done the worksheet is set
for that class, with its key hidden behind it, and it appears on every one of those students' shelves.
A paper whose level or subject could not be read is uploaded but **not** set, and the teacher is told
why — a paper set for no level would be on nobody's shelf while looking, to the teacher, exactly like
one that went out. The set record now carries the paper's **topic** and **school** too, so an unopened
paper is filed beside the opened ones on its topic.

**Fixed on the way:** on a phone the ‹ › shelf buttons were meant to give way to swiping and never did
(a later rule in the stylesheet outranked the one that hid them).

---

## v1.24.0 — All the apps under one roof, a worksheet sent from the Science portal, and the teacher's corrections reach the buddy

Two features that had shipped on a side branch and never reached the live app, now on it.

**🧭 All the apps under one roof.** **Apps** in the header lists every Polymath app — the four
subject portals and the two tools (Ans Key and this one) — from ONE table (`POLYMATH_APPS`) that
every app carries byte for byte. You stay signed in. Inside the Science portal this app is embedded
on a page of its own; a link followed from in there moves the whole portal, never a portal inside
a portal.

**📖 A worksheet sent from the Science portal.** `?ws=<id>` opens a worksheet the moment your list
has loaded: one of your own, or one the teacher has set (your copy is started, exactly as "Start it"
would). The Science portal's **Send to Study Buddy** files a printed worksheet here in this app's
own shape, with the answer key already read and its pages hidden, then opens this page on it. The
link is read once and taken off the address bar. A worksheet that came across wears a **🔬 From the
Science portal** chip.

**🧠 The teacher's corrections reach the buddy.**
- Every hint, every chat reply and every mark is written against the WHOLE of what Mr Chung has
  taught the apps, not the flat summary it used to read: one voice per level and subject, the
  corpus of the teacher's own answers, and every correction he has made to an answer an app wrote,
  with the lesson each one taught. The Science portal's own corrections are read beside them, live,
  so a correction made in either app is obeyed by the very next hint here.
- The voice is the worksheet's own: a P5 Science worksheet is hinted in the P5 Science voice once
  there are 30 answers behind it, then the Science-at-any-level one, then the overall one, and the
  hints tab says which.
- The example answers are chosen for the question in hand: the chat retrieves them for the
  student's own message, a hint for the question an earlier hint on the same spot already read.
- Marking is held to the teacher's TYPED standard and never to a guess. The profile's inferred
  marking standard, the example answers and the corrections never reach a mark.
- Two long standing notes both reach the buddy now. Every note is guaranteed its share of the
  budget; a long one is trimmed (and says so) rather than the next one vanishing.

## v1.23.1 — A set worksheet shows only on the accounts it was set for, and deleting your copy keeps the class's PDF

**Two bugs on the "📌 Set for you" list, one behind the other.**

**A P5 paper on a P6 account.** The set list painted **every** active set worksheet for **every**
student. A student's own list has always been filtered by their level and subject; the class list
never was. Pressing Start on one set for another level wrote the student a copy tagged with that
level, the list then filtered that copy straight back out, and opening it found nothing and gave
up in silence: the toast said *Getting it ready…* and nothing happened. Every press after that
wrote one more copy nobody could see.

- The set list goes through the **same rule** as the student's own list. The teacher still sees
  every one, which is how one is taken off the list.
- Start it asks the rule **again in the handler** and says, in words, which class the worksheet was
  set for and which student this is, instead of writing a copy.
- Opening a worksheet that is not in the list now **says so** instead of returning in silence.
- The blank duplicate copies the bug wrote are tidied on the next sign-in: only a **duplicate** of a
  blank starter copy is dropped — never the only copy, never one with a single stroke on it, and
  never the class's PDF.

**"Object 'tutor-worksheets/….pdf' does not exist" on every student's copy.** Every student's copy
of a set worksheet reads the **teacher's** PDF, and the guard that stops a student's tidy-up
deleting it only ever protected the *student's* copy. So the teacher deleting their own copy after
setting it deleted the one file the whole class read, and every Start / Carry on failed.

- Deleting your own copy of a set worksheet now asks the assignment, live, whether the class reads
  the file, and **keeps the PDF and the key file** when it does. Only your own marks and hints go;
  withdraw it from the class with "Take off the list".
- Start it checks the PDF exists **before** a copy is written, so a broken assignment never leaves
  a copy that can never be opened.
- A missing PDF is explained in words, and the work on the copy is said to be kept.
- The teacher's home screen checks each set worksheet against Storage once per sitting and flags
  one whose file has gone, with Start disabled. To repair one: take it off the list, upload the
  worksheet again and set it again.

## v1.23.0 — the school in the name, a bookshelf, and the whole answer key put away

- **An exam paper is named after the school that set it.** The read now takes the **school** off
  the cover as printed and, for an exam paper, puts it at the front of the name — *"Nan Hua
  Primary School — P5 Science SA2 2024"*. A topical worksheet keeps its own name; a name you typed
  is never touched. The school and the worksheet's **topic** are shown as chips on the card.
- **Your worksheets are on a bookshelf.** One shelf per level and subject — P3 · Science,
  P5 · Science, P5 · Maths… — and on each shelf the papers stand in a row you **swipe sideways
  like a wheel**, sorted by topic and then newest first. The paper in the middle faces you; the
  ones either side turn away. ‹ › nudge one paper at a time on a laptop.
- **The answer key is walked back one page at a time.** A marking scheme longer than four pages
  used to be only partly hidden. The buddy now reads from the last page backwards, one page per
  look, hiding each page that is a key and stopping at the **first page confirmed not to be one**
  — so a ten-page key is put away whole and the question page before it is left where it was.

## v1.22.0 — the paper is read when it is uploaded

Upload a PDF and Chung GPT reads its **first three and last four pages** once, as pictures, and
says what the paper is: the **subject**, the **level** printed on its heading, what it **calls
itself**, and **which pages are its answer key**. Whatever you left blank in the upload dialog is
filled in and named back in a toast; the key pages are **put away** — hidden from the worksheet and
never marked — and handed to the buddy, exactly as a key found by the old text scan was.

- The level and subject pickers both open on **✨ Let Chung GPT read it off the paper**; pick one
  yourself and the paper never changes it. A student's own level is never overridden, and a subject
  they do not take is never filed.
- A scanned or photographed paper has no text layer, so its marking scheme at the back used to be
  served as ordinary pages. It is found now.
- A long marking scheme is followed **backwards** from the last pages until it ends.
- The AI being off, or the read failing, is an upload exactly as before.

---

## v1.21.0 — the live tutor is the WHOLE logo, in a glass sphere

Chung GPT's orb is now the centre's logo **complete and solid** — one grain of sand per cell of
the artwork, two and a half thousand of them, each drawn wide enough to touch its neighbours, so at
rest there is no gap anywhere in the M. And it sits inside a **floating glass sphere**, Siri-style:
lit from the top left, a specular highlight over the sand, a hairline rim, a glow that comes on
while it works, and a soft shadow on the surface beneath it that shrinks as the sphere rises.

- **Idle and listening** — the whole logo stands, still and solid (listening breathes it gently
  and lets it drift in the glass). The idle gust of v1.20.0 is gone: nothing blows the logo apart
  unless the tutor is working.
- **Thinking** — the logo breaks apart into a **ring of sand that spins** under the word
  *Thinking*, and the glass glows teal.
- **Talking** — the logo breaks apart into a row that rises and falls with the tutor's voice, and
  the glass glows magenta.
- The moment either ends, the sand flies back and re-forms the logo **exactly, grain for grain**.

The small orb over the worksheet is the same glass sphere at half the size, frosting the page
behind it. Reduced motion stops the sphere's bob and its shadow's breath as well as the sand.

## v1.20.0 — the live tutor is the logo in sand, with physics

Sixteen spheres could not look like the logo, so Chung GPT in live mode is now drawn as the
centre's own logo in **a thousand grains of sand** — sampled from the real artwork, cell by cell,
so the teal block, its shadowed face and the magenta ribbon's fold come out exactly as printed.
The sand moves under **physics**: every grain is pulled to where the current state wants it and
pushed by that state's own field, so a change of state is a flow, never a jump.

- **Idle** — the M stands; every so often a gust of wind, a whirl or a puff blows the grains off
  it and they drift back into place.
- **Thinking** — the grains swirl out into a **ring of sand that spins**, Siri-style, under the
  word *Thinking*.
- **Talking** — a row of sand that rises and falls as a wave with the tutor's voice, measured
  off the audio the student is hearing.
- **Listening** — the M, breathing gently.

It is drawn on a canvas by one frame loop that runs only while an orb is on screen, sets no
timer, and stands still for *prefers-reduced-motion*. The floating orb over the worksheet is the
same sand at a smaller size.

## v1.19.0 — the live tutor is the logo, in tiny spheres, and never says "let me check"

Chung GPT in live mode is drawn as the centre's own logo — the teal block and the magenta
ribbon that make the **M** — in sixteen tiny spheres, in the live card and floating over the
worksheet while a session runs. What the spheres do is what the tutor is doing:

- **Thinking** — the spheres peel off one after another into a ring that **spins**, Siri-style,
  under the word *Thinking*. Nothing is spoken until the teaching result is ready.
- **Talking** — a row that rises and falls with the tutor's voice, measured off the audio the
  student is hearing, so there is feedback while it speaks.
- **Listening** — the M, breathing gently. **Idle** — every so often the spheres drift apart and
  settle back into the M.

The tutor also **never says “let me check”, “let me think”, “let me see”, “one moment” or “hmm”
any more.** The voice model is told, twice over, to stay silent while it waits and to begin with
the teaching itself; and the spoken reply is **scrubbed on the way to the speaker**, so a text
model that opens with “Let me check the worksheet…” has that cut before the student hears it.
Teaching is never touched — “let me *know* when you have tried it” stays exactly as written.
Everything that moves stops for *prefers-reduced-motion*.

## v1.18.0 — the diagnostic: every question filed under the syllabus, and kept for the long run

Marking a worksheet now files every question under the **MOE syllabus topic and learning objective**
it tests, and the report opens with a **diagnostic table** — one line per topic, its objectives
under it, with the **full marks** and the **marks obtained** on each, the rate over what was
attempted, and a result in words (Strong · Getting there · Revise · Untried). It is the table a
parent asks for and the one a student can keep an eye on over a term: the same objective on next
month's paper lands on the same line.

- **The lists are the teacher's own.** Science is filed under the Science Learning Portal's rapid-add
  topics (*Heat*, *Electrical Systems*, *Food Chains and Webs*…) and its learning-objective selector —
  the 79 Learning Outcomes of the MOE Primary Science Syllabus 2023 — and Mathematics under the
  Maths app's MOE Primary Mathematics syllabus for P3 to P6, all 171 objectives. The ids are those
  apps' own (`heat-flow`, `P5.FR.2.6`), so a weak objective here is the objective the question banks
  there are filed under.
- **The list is narrowed to the worksheet's level**, exactly as ⚡ Rapid add's batch level narrows the
  topics the AI may choose from: a P5 paper is filed under P5 objectives, and a worksheet with no
  level is offered the whole subject.
- **A question the marking cannot place is shown, never forced into the nearest topic.** It keeps the
  marking's own wording under *Not on the syllabus list*, where it can be seen. English, Chinese and
  Sec 1 papers have no list yet and are reported by topic as before.
- **📈 My progress**, on the home screen, adds the diagnostic up across every worksheet you have
  marked — per subject, in syllabus order, with each objective's marks over time (*40% → 60% →
  80%*) and a short *Work on* line naming the weakest. It is read straight off your worksheet list,
  so it opens instantly, and it copies and prints like the report.
- A worksheet marked before this existed is still placed where its topics happen to be syllabus
  names, so the old papers are not all "unlisted".

---

## v1.17.0 — 🧩 Keyword checks: fill in the blanks

A fill-in-the-blank box now pops up over the worksheet to remind you which
**concept** a question is testing and which **keywords** a full-mark answer
needs — by making you supply the words yourself. *"Water turns into [1] by
[2]."* Type the words, press **Check**, and see which you have.

- **In 💡 Hints:** the moment a hint arrives, a keyword check is built in the
  background from the question the hint read and pops up when it is ready.
  Every hint card also carries **🧩 Quiz me on the keywords**, which opens it
  again — or builds one for a hint that has none yet.
- **In 🎧 Live:** after Chung GPT answers you out loud, a check can pop up
  while it is still talking. The tutor is told it is on your screen, so you can
  ask about it — but it never reads the missing words out. At most one per
  answer, and never while you are still doing the last one.
- **Right words go green, wrong ones red.** ⓘ beside a blank gives a clue,
  Enter checks, and **Show me** appears once you have had an honest go. A
  plural or a different tense of the right word still counts.
- **It is built from three things, in order:** Mr Chung's own teaching notes
  (the keywords and the key facts), the paper's answer key, and the **MOE
  Primary Science Syllabus 2023** — the objectives the question matches, at or
  below the student's level. The notes win where the two differ.
- **It obeys the help level.** A keyword check is the *Concept & keywords*
  rung of the ladder asked as a question, so it is offered exactly when that
  rung is and shown 🔒 locked on *Nudges only*. Below full help, a check that
  would put the paper's own answer in a blank is refused outright.
- **Keyword quizzes: on / off** is a button on the Live card and a switch on
  the Hints tab, remembered on your device. Off, a hint still offers the quiz
  on its card; it just stops popping up by itself.
- It floats over the page with no backdrop, so you can keep writing round it;
  ✕ or Escape closes it, and a solved check is saved with its hint.

## v1.16.0 — Subtitles for what the tutor says

Live tutoring now repeats **what Chung GPT just said** as subtitles across the
bottom of the screen — translucent grey, black text, over the worksheet you are
working on. The transcript beside the page is for reading a conversation back;
this is for the sentence being spoken **right now**, while you are looking at
the question rather than at the panel.

- **Subtitles: on / off** is a button on the live tutoring card, next to Start.
  It is remembered on your device and can be switched at any time — including
  mid-answer, which catches the rest of the sentence.
- Only the **tutor's** replies are subtitled. You know what you just said, and
  captioning it back would cover the question you are reading; the panel still
  keeps both sides of the conversation.
- A reply clears itself a few seconds after it finishes, and a new reply
  replaces the last one — so the worksheet never ends up under a wall of text.
- They never swallow a pen stroke: the subtitle box cannot be tapped or drawn
  on, so writing on the page underneath it works exactly as it always did.

## v1.15.4 — See typed answers and think quietly

Live tutoring and Ask now read text that is still being edited on the worksheet,
without moving the caret or closing the keyboard. The tutor receives both the
annotated worksheet images and the exact typed answers, including which box is
active or selected. Visible pages are ranked by their actual area on screen;
adjacent visible pages can supply a diagram or the rest of an answer. Hidden
answer-key pages remain excluded from this view.

The voice tutor receives a silent, current view summary when the session starts
and when the visible pages or typed answers change. During a worksheet check the
status says **Thinking…**, and the tutor waits for the teaching result instead of
saying “I’ll check” or asking the pupil to repeat an answer already supplied.

Regression checks cover unfinished text, the annotated image, page visibility,
hidden key pages, bounded context, quiet updates and the final spoken answer.

## v1.15.3 — Faster checks, arithmetic teaching and answer-key readiness

Spoken worksheet checks now have a 35-second total limit, including preparation,
and try a backup after a 12-second provider wait. Slow teaching-note loads and
answer-key reads produce a clear retry message. Ending a live session cancels
the pending check; late replies cannot be spoken or start another fallback.
Normal answer checks and full-paper batches have their own longer limits.
Network failures no longer repeat the same high-thinking Gemini request.

Teaching uses step-by-step arithmetic and the unitary method. Units and parts
are reserved for questions that clearly call for them. The live tutor gives
one arithmetic step, asks the pupil to try it, and waits. It does not introduce
algebraic unknowns. These teaching preferences do not invalidate a pupil's
otherwise correct method or override the worksheet's help ceiling.

Hints, chat, marking and Live wait for the attached answer key before answering.
Concurrent requests share its existing read, and saved transcriptions are reused.
A linked key that cannot be read is reported rather than silently ignored.
Live and text chat prioritise the entry for an explicitly named question,
including its working, so later questions in a long key are not left out.
Missing key rows are prepared when the worksheet opens. The generated teaching
step uses the matching key's method and checks its result against the key.

Completed marks appear before mistake-book pictures are prepared. The app labels
that remaining work separately and prevents duplicate marking while it saves.

Writing now paints only the active annotation once per animation frame, keeping
the page's existing ink, text, hints and marks in place. Coalesced pen samples
and the final pen-up position are retained, including stationary decimal-point
taps in the saved ink and images sent for checking. A refreshed overlay during a stroke
does not lose its preview, and losing pointer capture or leaving the app closes
the stroke once without inventing extra points.

The pen stops finger navigation and momentum as soon as it touches down. Touches
present while writing, including contacts initially reported as tiny, remain
ignored until they lift; a short guard also covers the gaps between letters.
Growing palm contacts cancel their accidental gesture, and rejected palms cannot
trigger multi-touch undo. Deliberate finger pan, pinch and undo remain available.

Validation: deterministic tests cover provider stalls, total deadlines,
cancellation, late results, shared key reads, unreadable keys, long-key lookup,
and the teaching instructions sent by Live. Writing tests drive the real event
handlers and SVG renderer, including a page with 1,000 saved strokes. They cover
coalesced samples, pen/palm ordering, growing contacts, capture loss, cancellation
and overlay refresh. These tests simulate input, network and model responses;
they do not measure Apple Pencil hardware feel or a signed-in conversation.

---

## v1.15.2 — Protect Live session records and usage limits

The Live deployment tools now protect Study Buddy and Ans Key's server-managed
session records and usage counters from browser access. The focused rules update
starts from the current shared project rules, preserves unrelated permissions,
and checks both the existing permissions and the new protection before publishing.
It rechecks the active rules immediately before publication and verifies the result.
Both voice service codebases and this protection were deployed on 16 September
2026; all 166 server-side permission checks passed.
See [Live tutoring setup](docs/live-tutoring.md#shared-firestore-protection) for
read-only inspection, validation, and the explicit apply command.

---

## v1.15.1 — Live service deployment fix

The live service dependency lockfile now matches Firebase's Node 22 / npm 10
build environment. Clean installation and all 36 server tests pass. The Live
tab and tutoring behavior are unchanged; the voice service still requires an
authorized Firebase deployment using the existing server secret.

---

## v1.15.0 — Live tutoring that listens and speaks

Open a saved worksheet, choose **🎧 Live**, and select **Start live tutoring**. Chung GPT listens
and replies aloud, with natural interruptions, a live transcript, microphone mute, and **End
session**. The voice uses GPT-Live-1; worksheet reasoning uses the existing teaching engine,
including the current page, Mr Chung's notes, answer-key rules, and the worksheet's help ceiling.
Follow-up questions and corrections are queued while the tutor checks the worksheet.

Microphone access begins only when the student starts. Ending, hiding the app, leaving Live,
changing worksheets, or signing out silences the microphone and closes the session. A lesson
lasts up to 10 minutes. Captions stay in the current browser session and are not saved to the
worksheet. Existing dictation and written chat remain available.

The new authenticated Firebase backend keeps `OPENAI_API_KEY` on the server. It requires the
student's Google sign-in, App Check verification, and ownership of the worksheet. See
[Live tutoring setup](docs/live-tutoring.md) for deployment, usage limits, and verification.

---

## v1.14.0 — ⚙️ Three engines, and whichever one will answer

When the shared Firebase project hits its monthly spending cap, every hint, every mark and every
reply in this app came back as the same error — on every device, until the month turned over. One
engine was one thing standing between a child and a dead app.

**Gemini still answers first. ChatGPT and Kimi now stand behind it**, and a route that refuses is
skipped for a few minutes and then tried again rather than being written off. Nothing on the
student's side changes: the buddy is still **Chung GPT**, and it still hints rather than answers.

**There is still no key box here, and there never will be.** This app is opened by children on
shared iPads, so the two backups are reached through the centre's own server — their keys are
secrets the browser never sees, which is also what makes them work on a student's phone with
nothing set up on it.

**The teacher's ⚙️ AI panel now picks which engine leads, for the whole centre.** It is the same
switch as the one in the Learning Portal and Scan & Answer — changing it in any of them moves them
all — and the panel says which routes will be tried, in order, and what each one said the last time
it refused.

*(The two backups need their keys set on the server before they can answer. Until then the panel
says so in as many words, rather than reporting it as an AI error.)*

## v1.13.0 — ✍️ Write with the pencil, scroll with your fingers

The worksheet is now used the way a notebook app on an iPad is used.
**Pencil-only mode is on from the start**: the Apple Pencil draws, **your fingers scroll and
pinch the page**, and **a palm resting on the screen does nothing at all**. One tap on ✍️ (or the
`S` key) turns it off if you would rather draw with a finger, and the device remembers which way
you left it — but the first time a real pencil touches down it comes back on by itself, because
whoever has just picked a pencil up is about to rest a hand on the page.

- **One finger pans**, two fingers pan and **pinch-zoom**, and a flick carries on with momentum.
- **A second finger landing on a stroke you have only just begun** throws the accidental dot away
  and scrolls instead; landing on one you have been drawing for a moment **keeps the ink** and
  hands the two fingers the pinch. Your work is never the price of a gesture.
- **Two-finger double-tap is undo, three-finger is redo.**
- A palm cannot start a mark, cannot hijack the stroke the pencil is drawing, and — just as
  important — **cannot end it by lifting off**.
- The pages sharpen up again the moment the gesture is over.

The whole engine is the Ans Key annotator's, ported across, so a worksheet feels the same in both
apps and a fix to either belongs in both.

---

## v1.12.0 — 🧩 The mistake is the question, set out again

**A mistake used to be kept as a photograph of the whole page it was printed on** — with the two
questions either side of it, and the student's own wrong answer written across it. Printed on a
practice sheet that is a photocopy of the paper with one question somewhere in it, which is not a
question anybody can practise.

**So the question is read into ordered blocks instead.** The wording is typeset, and wherever a
figure belongs there is a picture of that figure, cut out of the page by its own rectangle. It is
the Science portal's ⚡ **Rapid add**, by way of the Scan app's port of it, and the identifiers are
deliberately the same ones so that a fix in any of the three copies straight across.

**Three tiers, best first**, and a question is shown at the best one it has:

1. **the question set out again** — typeset wording, the paper's own diagrams back in place;
2. **the whole question**, cut out of the page;
3. **the whole page**, which is where this started.

**Every tier is clean.** The page is re-rendered out of the PDF with no annotations on it, so
nothing here carries the student's own answer — a question handed back for practice with last
week's wrong answer written across it cannot be practised, and printed for a class it is worse.
What they wrote is kept as text and shown beside the question, which is where it can be read.

**The options travel with the question now.** A multiple-choice question was being filed with
nothing to choose between: the reproduction is told to leave word options out of its blocks
*because* they are printed underneath, so they had to be kept. When the four choices are pictures
— four shapes, four graphs — they travel as **one** rectangle round the lot, because cut out
separately they lose the row they were printed in and a student answering "(3)" cannot see which
one (3) was.

**One renderer.** The card, the ✏️ practice session and the 🖨 printed sheet all build the question
through the same function, so the sheet cannot print something the card never showed. Every
picture on the sheet — including every figure inside a rebuilt question — is fetched and awaited
before the print dialog opens.

Under the hood: the reproduction is its own AI call, on the handful of questions actually being
filed, budgeted at ten per marking run and spent before the call so a failure cannot buy another
try. Every failure returns nothing and the mistake is filed exactly as it would have been before
any of this existed. It needed no Firestore or Storage rules change.

---

## v1.11.0 — ↻ Practise again, and 🖨 Print

**The answers go back off the paper.** Marking a worksheet puts the answer to every question on
the screen, which is exactly what a student wants the moment it is marked and exactly what they do
not want the next time they sit down with the same paper — so until now there was only ever one
honest attempt at any worksheet. **↻ Practise again**, at the bottom of the ✅ Marking panel, starts
a fresh attempt: the marking goes, the hints go with it (a hint climbed to the top holds the answer
just as plainly), and everything written on the pages is cleared, so the paper is blank again.

- **Your mistake book keeps every question you got wrong**, with its picture. That is the record of
  the attempt being cleared, and it is why clearing the rest is safe.
- **The chat stays**, because it is a conversation rather than an answer sheet.
- **It asks first**, naming what goes and what stays — and **Ctrl+Z brings the whole attempt back**
  if you change your mind, because your work is pushed onto the undo stack before anything is
  cleared.
- The worksheet card and the marking panel say **↻ Attempt 2**, so a second go is visible rather
  than looking like a paper you never started.

**🖨 Print**, in the worksheet bar, prints the pages exactly as they are on screen with everything
you have written on them. Two buttons:

- **🖨 Print the worksheet** — the pages the student has, and **never a page marked as the answer
  key**.
- **🔑 Print with the answer key** — the whole thing, key pages included. On a worksheet the teacher
  set, this is **theirs**: the button is not drawn for a student and printing is refused if it is
  reached anyway, exactly as the 🔑 window is.

Want a clean copy to do again? ↻ Practise again first, then print.

## v1.10.1 — the answer key really does stay off the students' screens

Marking pages as the answer key and then setting the worksheet for a class **sent it out with no
key pages at all**, so every student could scroll straight through the marking scheme. It looked
like it had worked: you saw *"Set at…"*, and their copy still had the 🔑 chip saying it was your
answer key — sitting above every page of it.

Setting a worksheet was reading it from the list on the home screen, which holds the worksheet as
it was when the list was fetched — so pages marked since were simply not in what it read. It now
saves anything still pending and reads the worksheet itself before setting it, and if it cannot
read it, it refuses to set it rather than sending out a key it is unsure of.

**A key you mark after the class has started now reaches them too.** Their copy takes its key pages
from the assignment each time it is opened, the same way a locked help level does — so a page you
marked this morning is hidden for the students who began yesterday, not just for whoever has yet to
start.

## v1.10.0 — P6 is a level too

Students can be **P6** now, taking Mathematics, Science or both — the same as P4 and P5.

It was one entry in the list of levels and nothing else. **P3 is the only level with a special
case**, so every level added after it gets all three subjects without a second edit: the chips, the
upload dialog and the worksheet filter picked it up on their own. Ans Key has the same change, on
the same roster.

## v1.9.1 — set by Mr Chung

A worksheet set for a class said **"Set by Zhi Kai Chung"** — the name off the Google account it
was set from. It says **Set by Mr Chung** now, which is what the centre calls its teacher and what
the rest of the app has always said.

Worksheets already set say it too. The name is worked out when the card is drawn rather than only
when the worksheet is set, so the ones already on students' screens are right without being set
again. The same goes for the answer-key line and the note that says whose the help level is.

## v1.9.0 — every student says what they are doing

The first-sign-in questions now have a middle step: **what level each student is, and what subject
they take.** Everyone already signed up is asked again, once, because a student without a level is
a student the rest of this cannot work for.

- **P3, P4 or P5**, and **P3 is Science only** — there is no P3 maths class at the centre, so at P3
  the subject row holds a single chip and says why. Pick P5 Mathematics and then change your mind
  to P3 and the Mathematics choice goes with it, rather than being quietly saved.
- **Science, Mathematics, or Both** at P4 and P5.
- **You only ever see worksheets of your own level and subject.** A P4 Science student does not see
  the P5 papers, and a P4 Maths student does not see the Science ones.
- **An upload is tagged with your level automatically.** There is no level box to get wrong, because
  a worksheet tagged with someone else's level is one that disappears from your own list the moment
  you save it. The subject picker only appears if you take both.
- **One login, several children.** A parent who put two students on the account gets both, each with
  their own level and subject, and the header says whose worksheets are on screen — tap it to
  switch.
- **A student already set up in Ans Key does not type it twice.** It is the same roster row, so
  their level and subject come across, and what is answered here goes back so Ans Key and Scan &
  Answer see it too.

## v1.8.0 — a worksheet you set stays the way you set it

Two things on a worksheet the teacher has **set for the class** are the
teacher's, and this makes both of them true.

**The answer key.** The 🔑 window lists every page with a tick beside it — so
a student who could open it could untick a key page and read the marking
scheme, which is the one thing the whole feature exists to prevent, reached
through its own settings window. On a set worksheet that window does not
open, and marking a page, attaching a key and removing one all refuse. The
chip stays, because pages really are missing from the worksheet and a student
deserves to know why — it says *whose* key it is, and nothing else. Taking a
worksheet off the class list does **not** release it: that is not a decision
to hand out the marking scheme.

**The help level.** Setting a worksheet now asks two questions rather than
one: how much help the class may have, and whether they can change it.

- 🔒 **Locked** — everybody works at the level you chose. There is no 💡 Help
  level button on their card, and every other way to it refuses.
- ✏️ **Free** — that is where they start, and a student who is stuck can ask
  for more.

A locked level is read **live from the assignment**, so pressing 💡 **Level
for the class** changes it for everyone who started it yesterday too — not
just for whoever has yet to begin. And when a worksheet is taken off the
class list, its help level goes back to being the student's own: a copy
locked for ever at a level nobody could change would be the worse fault.

---

## v1.7.0 — you can see which paper it is

A list of file names is a list nobody can read at a glance: *Term 1 Paper 2*
and *Term 1 Paper 2 (1)* are the same row twice. So every worksheet card —
and every worksheet the teacher has set — now wears **its own first page**,
drawn as a **stack of sheets**, and how many sheets are behind it says how
much paper there is.

**It is made once, from the PDF already in hand**, and kept on the
worksheet's own record. Drawing it in the list instead would mean
downloading ten PDFs to show ten pictures every time the home screen opens.
A worksheet uploaded from now on gets one straight away; **everything
already in the library gets one the first time it is opened**, so it fills
itself in as it is used and nothing has to be migrated.

**It is never a page of the answer key.** The 🔑 pages are kept off the
student's screen, and putting page 1 of a marking scheme on the home screen
instead would be the same leak through a side door.

**A worksheet set for the class carries its cover to every copy**, so thirty
students cost one render — the same way the answer key travels already read.

---

## v1.6.0 — who did what

The roster said who had signed in. It could not say what any of them had
**done**, which is the question a teacher actually has when they open it — so
every row now carries the work as well as the name, and clicking a row opens
that one student on their own.

**On the roster**: worksheets, questions answered, how many of them were right,
hints and extra help taken, days used, and when they last signed in.

**On one student**: twelve counts — worksheets, marked papers, questions,
accuracy, hints, extra help, questions asked, mistakes practised, how many went
right on the retry, mistakes sorted, sheets printed, days used — the
correct / partly right / wrong / blank breakdown, the marks across everything
they have attempted, and **what they have been doing**, newest first.

**What leaves the device is counts and a worksheet's own name.** Never a
question, never an answer, never the mark on a particular question. The counts
go up by an *increment*, so two tabs on one account cannot overwrite each
other's work.

**Accuracy is over what was attempted.** A page left blank is not counted as a
page got wrong — the same rule the marking, the report and the practice retry
have carried since each of them shipped.

**The teacher is not in their own list.** Their use of the app is not usage to
report, and recording it would put them at the top of their own roster every
day.

**Nothing here needed a Firestore rules change** — it is more namespaced fields
on `studentProfiles`, which the app already writes.

---

## v1.5.0 — who is using this

On a **first sign-in** the app asks two things and then gets out of the way.

**Who you are.** The parent or guardian's name, and the student's name — with
**+ Add another student**, because one account is very often one family.

**Whether you are enrolled at Polymath.** Enrolled is **free**. Not enrolled is
**$100 a month**, agreed to by a parent or guardian. Neither route is
preselected and neither is louder than the other: an agreement to pay something
has to be *chosen*, never arrived at by pressing whichever button happened to be
highlighted. Nothing is charged through the app and it says so — what is
recorded is the agreement.

### 👥 Who has signed in

An admin-only list: the students and their parent, the email, whether they are
enrolled or on the fee, and when they were last in — newest first, because a
list you open to see who has been in is a list about *now*. It says how many
accounts have agreed to the fee and will need invoicing, and it copies out.

An account that signed in and **closed the dialog is shown**, saying it has not
answered — that is exactly the person worth chasing, and dropping the row would
hide the one case that matters.

### The things that make it safe

- **The roster is the one the centre already has.** `studentProfiles` is the Ans
  Key annotator's collection, which the Scan app already reads too. A second
  roster would be a second list to keep in step, and the first thing anybody
  would notice is a student who exists in one app and not the other.
- **It needed no Firestore rules change** — those rules are shared with four
  other apps and live in another repository, so a feature that needs one is a
  feature that waits.
- This app writes **one namespaced field** and merges. `name` is the single
  exception and is written **only when empty**: a name a teacher typed in Ans
  Key must not be replaced by whatever a parent typed here.
- **A failed read asks.** Letting somebody through on a read error is an account
  that silently skips the fee question for good.
- **A failed write lets them through and asks next time.** Trapping a family
  behind a dialog they have already answered — on a dropped connection, of all
  things — is far worse than asking twice.
- Bump `ONBOARD_VERSION` to ask the whole roster again.

## v1.4.0 — the mistake book can be practised, and printed

A mistake book that can only be **read** is a list of everything a student has ever
got wrong, which is a list nobody opens twice. What empties it is doing the
questions again.

### ✏️ Practise

Every card now has a **Practise this** tick, and above them: **Practise all**,
**Practise the ones you picked**, and a worksheet button.

A session takes them one at a time — the question and its picture, a box to write
in, and **the answer stays hidden until it has been answered**. It is right there
on the card in the book, which is fine for looking something up and useless for
practice: a question shown next to its own answer is a question nobody attempts.

Chung GPT marks the retry and says what has **improved** as well as what is still
missing. A **correct** retry files the mistake under Sorted then and there — that
is what the book is for — and the card's own ↩︎ puts it straight back.

- **"All" means every card you can SEE.** The filter chips decide it and the
  buttons say which. Practising questions hidden behind a filter is the one
  outcome nobody could predict from the button they pressed.
- **A blank retry is never marked wrong**, the same rule the marking has carried
  since it shipped.
- The chip shows what the question is **worth**, not what it scored last time —
  "0 out of 2" hanging over a retry is the one thing that could put a child off
  starting.

### 🖨 A worksheet to print

The picked questions (or all of them) come out as a printed sheet: name, date and
score fields, each question with **its own picture from the paper it came from**,
and ruled writing space **sized by what the question was worth**. The answers
break to their own page, so the sheet can be handed over without them.

"Export as a PDF" is the browser's own **Save as PDF**, reached through print —
there is no PDF *writer* in this app, and adding one would be a third of a
megabyte of library for a button every browser and every phone already has.

**Every picture is awaited before the dialog opens.** `window.print()` does not
wait for an image, so a sheet printed the instant it is built comes out with the
questions missing and a student holding a page of ruled lines.

## v1.3.0 — a report, marks on the paper, and a face for Chung GPT

### 📊 The report

Marking finishes and there is now a **📊 My report** button. Every question in
one table — its topic, what it was testing, what you wrote, what it earned and
whether it was right — **green, amber or red**, and then a **what to revise**
list underneath.

- **The topic comes from the marking read itself.** This app has no question
  bank and no syllabus list: it is handed a PDF nobody has ever seen before, so
  the topic and the learning objective are asked for in the same call that
  marks the question. No second pass, no extra cost.
- **The one instruction that makes them worth having is about consistency.**
  The report groups by topic, so a model naming one topic five slightly
  different ways would report five topics with one question each and tell the
  student nothing at all.
- **Everything in the report is plain code.** No second AI call, ever — the
  same marked paper has to give the same report every time it is opened.
- **Ranked by what was LOST, then by the rate**, because three wrong out of six
  is more work than one out of one; a partial counts half. Both numbers are
  printed on the row, so the order can be checked rather than trusted.
- A topic **nobody attempted** is untried, not weak, and says so. A topic that
  went **perfectly** is named as a strength. A question the marking could not
  place is shown under its own heading and always last — *"go and revise Not
  labelled"* is not advice anybody can act on.
- It **prints** (a report is a thing a parent reads) and **copies** as text.
  The colours are forced through on paper, and every row carries the word as
  well as the colour, so a mono printer and a colour-blind reader both still
  get the answer.

### ✓ Ticks and crosses on the worksheet itself

The marking used to live only in a side panel. Now the paper comes back with
**red and green on it**: a tick, a half-tick or a cross at the point where each
answer was written, **with the marks beside it**.

- **They are not annotations.** They cannot be dragged, erased or undone, and —
  the one that matters — they are never drawn into the picture the marker
  re-reads. A tick in with the student's own ink would have the next marking
  run agree with it, and no screen anywhere would say why the second marking
  was so much kinder than the first.
- A **blank gets no cross**, with or without a position — the rule this app has
  had since it shipped.
- The position is refused rather than guessed when the marking cannot place it:
  a tick against the wrong question is worse than no tick.
- ✓ **Ticks on the page** turns them off.

### 🔢 Real marks

Every question now gets an allocation. **What the paper prints always wins** —
`[2]`, `(2 marks)`, a figure in the margin. Where it prints nothing, a
**science MCQ is 2 marks** (this centre's convention) and an open question is
worth one mark per marking point.

A correct answer earns the lot, a wrong one earns nothing, a partial earns
something that is neither, and all of that is settled once when the marking
arrives rather than at each of the places that show it. The marks survive a
blank — "0 out of 2" is the allocation the paper printed, not a judgement on an
answer nobody wrote.

### 🤖 Chung GPT has a face

The assistant had a name and no face, so every hint arrived as a paragraph of
grey text. Now there is a friendly avatar — **drawn in code as inline SVG**, so
it costs no request at all, stays sharp at every size and works on a school
network and on an iPad in Lockdown Mode. It blinks, it breathes, it tilts while
it is thinking, and **the hints and answers come out of it in speech bubbles**.

One face, drawn in one place, on four surfaces: the panel head, the head of a
hint, beside a chat reply and on a marked question's feedback. It appears once
per run of messages rather than once per bubble — a column of five identical
faces is a sheet of stickers, not somebody talking.

The **product** is still Study Buddy; the **assistant** in it is Chung GPT.

## v1.2.1 — the caret check, audited

Nothing on the screen changed. The harness that decides whether the caret is on the pointer was
audited and hardened, and two things it turned up are now written down.

- **The verdict is read off a reference that shares no mechanism with the code.** `textCaretRect`
  answers with a zero-width space and a `Range`; the harness asked the same question the same way,
  so the two agreed because they were the same trick. It now measures a **real glyph's inline box**
  with `getBoundingClientRect` — different probe, different API — and asserts the two agree on every
  placement. That is the exact shape of the fault this file had once already.
- **The spoken answer is swept too** (72 placements). Everything else places an *empty* box, so
  nothing was exercising the one path that puts a box on a div that already has words in it — and
  a probe appended rather than put first is invisible on an empty box and a whole line out on that
  one.
- **A probe left in the box would be saved into the answer**, marked, and filed in the mistake
  book, invisibly. The harness now asserts the box is empty again after every placement.
- Twelve mutants (was eight), sizes 8 and 96 added — the real ends of the size control.
- **Two corrections.** The fallback's refusal to guess at `line-height: normal` was described as
  being better than guessing; measured, guessing lands in the *same place*. It is kept because it
  stops the app pretending to have corrected, which is the half that matters. And U+200B is a
  **break opportunity**, so while the probe is in a box whose first word is longer than the box the
  div is a line taller — harmless today, and now written on the function.

392 + 72 placements, worst **0.003 across / −0.014 down**, every mutant caught.

## v1.2.0 — a size you can set, work you cannot lose, and the centre's own logo

### 📏 Change the size of the pen and of the typing

The thickness was a slider that only ever moved the **pen**, and the text size
was a constant nobody could reach — so a student who wanted bigger handwriting
had no control at all.

Now there is **▼ 3 ▲** in the toolbar: tap the arrows, or **type the number
you want**. It means the pen's thickness with a drawing tool in hand and the
text size with 🅣 or 🎤, and it says which. `[` and `]` step it from the
keyboard.

It follows what you have **selected**, so tapping a text box you wrote earlier
and typing 24 makes that box 24 — you never have to delete something and draw
it again to resize it. A text box grows with its size rather than clipping the
words in it.

### 💾 Your work saves itself, and keeps trying when it can't

It always auto-saved. What it did not do was **cope with a save that failed**:
the button went back to saying "Save" and that was that, so one dropped
connection mid-lesson meant no auto-save for the rest of it — silently.

- A failed save **keeps trying**, waiting a little longer each time.
- What could not be sent is **kept on this device**, and put back when you
  next open the worksheet: *"There is work on this device from about 4 minutes
  ago that never reached the server. Put it back?"* It asks rather than
  assuming, because your work on another device might be newer.
- It saves on the way out of the tab on a phone as well as on a laptop.
- The button now says **three** different things instead of one — ✓ Saved,
  Save, and **⚠ Not saved** — because you would do something different about
  each.

### 🎨 The Polymath logo, top left

The centre's own logo in the corner of every screen, and as the icon on the
browser tab and on a home screen — there was none of either before, so a
worksheet pinned to an iPad wore a screenshot of itself. It falls back to a
drawn mark when a school network blocks the image, rather than to a broken
picture icon.

---

## v1.1.2 — the caret really lands where you click

v1.1.1 put the box in the right place by **working out** where the caret would
be: content-box top plus half the line-height. That is wrong on every
placement by the same small amount, always upwards — Blink does not split the
half-leading, it **floors** it. At 16px the caret sat 0.3 of a pixel high, at
34px nearly a whole one.

Worse, the check could not have told you. `Range` on an **empty** editable box
returns no rectangle at all in Chromium, so the harness quietly fell back to
computing the caret with *the same formula the app used* — 168 green ticks for
a measurement that never happened.

The caret is now **asked of the browser** (a zero-width space, measured and
removed before the box is focused), the harness measures the real thing and
FAILS if it ever cannot, and `--selftest` grew from four mutants to eight —
including one that puts the old modelling back, so this cannot return under a
page of ticks.

```
336 placements · 7 zooms · 6 font sizes · every page edge · dpr 1 and 2
worst 0.003 across / -0.014 down   (was 0.000 / -0.953)
```

Also: the box for a **spoken** answer is measured for its height at the width
it will actually have, and `line-height: normal` now refuses to correct rather
than correcting by a wrong multiplier.

---

## v1.1.1 — the caret lands where you click

The 🅣 text tool put the box's **top-left** on the pointer, so the first letter
appeared a few pixels right and about half a line **below** the I-beam. An I-beam
points at its middle, not its top.

The box is now placed so the **caret** is on the pointer — and the offset is
**measured** off the rendered box rather than worked out from numbers copied out
of the stylesheet, so it stays right if the styling ever changes. A spoken answer
(🎤) lands by the same rule.

The flattened picture the marking reads was fixed with it: it was drawing the
text without its padding, at a guessed baseline, wrapping at the wrong width and
in the wrong font — so what the AI marked was never quite what the student saw.

`node tools/text-caret-check.mjs` measures the real caret in a real browser
across seven zooms, four font sizes and all four page edges, and
`--selftest` breaks the placement four ways and requires each break to be
caught.

---

## v1.1.0 — say your answer, and the answer key the buddy keeps to itself

### 🎤 Speak your answer

A P3 child who can explain evaporation out loud in one breath will spend four minutes writing the
same sentence badly. Tap **🎤**, tap the spot on the page, speak — and what you said is written into
a text box exactly where you tapped, as ordinary ink you can move, rub out and edit.

It becomes a normal annotation, so it is marked like anything else you wrote. There is a mic on the
💬 **Ask** box too, which fills the box rather than sending, so you can fix anything it misheard.

It writes down what you said and **stops**. It does not answer the question, it does not correct
your science, and it never looks at the page while it is listening.

Speech is read by **`gemini-3.5-transcribe`**, a model whose whole job is listening, with the
ordinary model behind it so the mic never simply stops working. It is told what language the paper
is in — a 华文 answer transcribed as English phonetics comes back as nonsense.

### 🔑 The answer key — hidden from you, read by your buddy

Half the worksheets people bring in have the answers printed at the back. Those pages used to be
rendered like any other, which is the whole worksheet given away by scrolling, and then *marked*,
so the score counted questions nobody attempted.

Now they are **put away**: taken out of your worksheet, never marked, never in a mistake picture —
and read once, so your buddy can mark you against the real thing. The 🔑 chip in the worksheet bar
says how many pages went and puts any of them back in one tap.

You can also attach a **marking scheme as its own PDF** — for maths especially, where the working
matters as much as the answer. It is never shown on screen at all.

The key is the authority on **what** the answer is, not on **how** it must be worded: a key that
says "24 g" is satisfied by "24 grams", and what counts as a full-mark answer is still the
teacher's own marking standard from the shared notebook. **And having the key changes nothing about
how much help you get** — the help level still decides that, exactly as before.

### 📌 Worksheets your teacher sets

Mr Chung can upload a worksheet with its answer key and push it to the class. It appears under
**📌 Set for you** on your home screen; start it and you get **your own copy** to write on — your
ink, your hints, your marking, your mistake book. The key comes with it, already read.

**This needs one line in the Firestore rules**, because a collection the rules do not know about
fails closed — the write is denied, the read comes back empty, and nothing on screen explains why:

```
match /tutorAssignments/{id} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}
```

Until it is there, pushing says so and names the rule; students simply see no set worksheets.

---

## v1.0.0 — the first build

### 💡 The help ladder, and the ceiling on it

The whole app turns on one idea: **a student handed the answer has learned nothing.**

Tap 💡, then tap the question you are stuck on. The buddy reads the worksheet and builds a ladder,
and it always starts on the bottom rung:

| Rung | What you get |
| --- | --- |
| **A nudge** | What the question is really asking, in one line. No method, no answer. |
| **Concept & keywords** | The idea being tested, and the exact words a full-mark answer needs. |
| **How to do it** | The steps to follow — the working stays yours. |
| **The answer** | The full worked answer. |

Press **"Still stuck — show me…"** to climb one rung. Nothing is ever skipped.

**The parent or student picks how far it may go**, when the worksheet is uploaded and any time
afterwards. That level is a real ceiling, not a screen that hides things:

- The rungs above it are **never asked for**, so on *Nudges only* the answer never came back and is
  not sitting in the page for anyone curious enough to open the developer tools.
- The **chat** is held to the same ceiling — *"just tell me the answer"* gets a step closer and a
  kind explanation of why not, rather than the answer.
- **Marking** is held to it too: a question you attempted is marked and answered in full, because
  you did the work and a mark you cannot learn from is a red pen and nothing more — but a question
  you left **blank** comes back with a place to start instead of its answer.
- The locked rungs are **shown, locked**, with a button to change the level. A ladder that just
  stops reads as a broken app.

### ✏️ Write on the worksheet

The annotation engine is Ans Key's, ported whole: pen, highlighter, typed text boxes, lines,
arrows, boxes, circles, a stroke eraser you drag across your ink, select-and-move, undo/redo, zoom
and fit-to-width. Six ink colours and a thickness slider. Everything auto-saves a few seconds after
you stop, and again the moment the tab is hidden.

### ✅ Marking, and it never crosses a blank

Press **Mark my work** and the buddy reads every page *with your own writing on it* and goes
question by question:

- Where you wrote something it **marks it** — ✅ correct, 🟡 almost, ❌ not quite — with the marks out
  of what the paper prints, what you wrote, and one to three sentences on exactly where it went
  wrong and what to do instead.
- Where the question is **blank** it is not marked at all. A red cross on a question nobody
  attempted is the one mistake this feature could make, so it cannot: the verdict, the marks and
  the feedback are all dropped when nothing was written.
- The correct answer is always worked out **first, from the printed question alone** — before it so
  much as looks at what you wrote. A marker that reads your "1.4" first agrees with it far too
  often.

The pages go up three at a time as one run, so a question that runs over a page break comes back as
one question rather than two halves with half an answer each.

### 📕 The mistake book

Every ❌ and 🟡 is filed automatically — a mistake book you have to remember to fill is an empty
mistake book. Each entry keeps the question, what you wrote, why it was wrong, the answer, and **a
picture of the page it came from**, so it still makes sense a fortnight later when the worksheet has
been handed in.

Press **✂️ Crop** and drag a box around just the question to cut the rest of the page away.

Filter by *still to redo*, *sorted* or *everything*, and mark one **"I can do this now"** when you
can.

### 💬 Ask your buddy

A thread beside the worksheet, which can see the page you are looking at. Ask what a word means,
whether your working is right so far, or for another question like question 4. Held to the same
help ceiling as the ladder.

### 📚 Grounded in the teacher's own notes

Every hint, every mark and every reply is grounded through **one function**, in the teacher's own
notebook at `users/{adminUid}/teachingNotes` — the same notebook **Ans Key**, **Scan & Answer** and
the **Science Learning Portal** read and write. A rule Mr Chung types in any of the four is obeyed
in all of them, live, without a reload.

The hints tab says what it is grounded in, because an ungrounded hint looks exactly like a grounded
one.

The assistant is called **Chung GPT** on every screen a student sees. Which company is actually
answering is the teacher's business, and it is on the teacher's own AI Engine dialog.

---

## Setting it up

The app is a static file. GitHub Pages serves it; everything else is the shared Firebase project.

### Firestore

| Path | What is in it |
| --- | --- |
| `tutorWorksheets/{id}` | One worksheet: its name, level, subject, help level, score, and everything written about it (ink, hints, marking, chat, and its answer key) |
| `tutorAssignments/{id}` | A worksheet the teacher has set for the class — readable by any signed-in student, writable only by the admin |
| `users/{uid}/mistakes/{id}` | The student's own mistake book |
| `users/{adminUid}/teachingNotes/{id}` | The shared notebook — read here, written only by the admin |
| `users/{adminUid}/aiTraining/answerStyle` | The style profile Ans Key distils — read here, never written |
| `config/admin` | The Portal's pointer to the teacher's uid, so a student's device knows whose notes to read |

Suggested rules: a student may read and write `tutorWorksheets` documents whose `ownerUid` is their
own, and their own `users/{uid}/mistakes`. `teachingNotes` and `aiTraining` are readable by any
signed-in user and writable only by the admin. **`tutorAssignments` needs its own line** — readable
by any signed-in user, writable only by the admin — or 📌 setting a worksheet fails closed: the
write is denied, the student's read comes back empty, and nothing on screen explains why.

### Storage

| Path | What is in it |
| --- | --- |
| `tutor-worksheets/{id}.pdf` | The uploaded worksheet |
| `tutor-worksheets/{id}.key.pdf` | Its answer key, when one was attached as its own PDF — never rendered on screen |
| `tutor-worksheets/{id}.body.json` | The ink, hints and marking, when they outgrow a Firestore document (~1 MB) |
| `tutor-mistakes/{uid}/{id}.jpg` | The picture kept with a mistake |

**The bucket needs its one-time CORS setup**, the same as the other apps: the browser has to be able
to fetch a worksheet's PDF and read a mistake picture back into a canvas to crop it. Without it,
opening a worksheet fails and ✂️ Crop reports that the bucket still needs the setup.

`cors.json` in this repo is the same file the other apps use:

```
gcloud storage buckets update gs://mathgen--app.firebasestorage.app --cors-file=cors.json
```

It only ever has to be run once for the whole bucket, so if Ans Key already downloads its PDFs
there is nothing to do here.

### Tests

```
node tools/tutor-tests.mjs
```

It loads the real sections out of `index.html` and runs them against stubs. Every failure it catches
is one the app would otherwise carry on looking perfectly right through.

```
npm i playwright-core && node tools/text-caret-check.mjs --selftest
```

Where a text caret lands cannot be checked by reading the source — the padding, the line height, the
font's own metrics and the page's zoom all decide it, and only a browser knows all four. This one
loads the real `.annText` rule and the real placement functions, clicks at a known point in headless
Chromium and measures the caret's own rectangle, across seven zooms × four font sizes × six points
including every edge. `--selftest` breaks the placement four ways and requires each break to be
caught, because a check that cannot fail is not a check. Like Scan & Answer's `mobile-check`, it is a
tool you reach for rather than a gate.
