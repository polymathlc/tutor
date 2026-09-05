# Study Buddy — Polymath Learning Centre

A student uploads their own worksheet as a PDF, writes their answers on it, and works through it
with a buddy that **hints rather than answers**. When they are finished it marks the paper, and
every question they did not get right goes into a **mistake book** with a picture of the question.

One self-contained `index.html` on the shared `mathgen--app` Firebase project, with Google sign-in.
It is the fourth app in the family and it shares the teacher's notebook with the other three, so
everything it says is grounded in the way **Mr Chung** actually teaches.

Live at <https://polymathlc.github.io/tutor/> once GitHub Pages is switched on for the repo.

---

## v1.12.0 — ✍️ Writing on the page, properly

**The answers go on the page with a stylus, and until now that was the roughest part of the app.**
The annotation *shapes* were Ans Key's; the way a stroke got onto the page was not. Four faults,
every one of them silent — the ink appeared either way, just worse.

- **Your hand can rest on the screen now.** There was no palm rejection at all, so the heel of a
  hand made marks, and its contact was *merged into the pen's own stroke* — a line shooting across
  your working, in your own ink, on a page that is then marked from a picture of it. A palm-sized
  contact is refused, one pointer owns a stroke at a time, and **the first time a stylus touches
  the page, pencil-only mode switches itself on**: your stylus writes, your fingers move the page.
  ✍️ in the toolbar turns it off again, and the device remembers.
- **Your fingers can move the worksheet.** They could not — at all. The page refuses the browser's
  own scrolling so that writing on it works, and nothing had been put in its place, so the only way
  to get around was the +/− buttons and a 24-pixel strip down each side. Zoom in once and even that
  was gone. **Two fingers now pan and pinch-zoom**, a flick carries on, and in pencil-only mode one
  finger moves the page.
- **Undo is two fingers, double-tapped.** Redo is three. ↶ is most of a phone screen's worth of
  sideways scrolling away, and Ctrl+Z is not a thing on an iPad.
- **Fast handwriting is not angular any more.** A stylus samples far faster than the browser
  reports it, and every sample in between was being thrown away, so writing quickly came back as a
  chain of straight segments.
- **And it does not slow down as the page fills up.** Every movement of the pen used to rebuild
  every answer already on the page. Measured in a real browser, on a page holding thirty answers,
  one line of working cost **772 ms and built 18,631 nodes**; it now costs **32 ms and builds
  one** — [24× faster](tools/stylus-check.mjs).

**A typed answer can no longer be lost.** This one was not a matter of feel. The words in a text
box were only written into the worksheet when you tapped somewhere else on the page — so typing an
answer and then pressing **Save**, or ← Back, or simply closing the tab, saved an *empty box* over
it. The box now writes itself down the moment you touch anything else, every save path commits it
first, and **the box grows as you type** rather than staying one line tall and clipping the answer
out of the picture the marking reads. The box also stops losing the caret — and, on an iPad, the
keyboard — when something else on the page redraws underneath it, and **the auto-save no longer
closes it while you are still writing**: it saves the words and leaves you typing.

Smaller things that come with it: a tap leaves a visible dot rather than invisible ink; a gesture
iPadOS interrupts keeps what you had written instead of throwing it away; the pages stop
re-sharpening under your fingers mid-pinch; and double-tapping ▲ to make the pen bigger no longer
zooms the whole app.

**And 🎤 no longer appears on devices that cannot use it.** Buttons in this app are hidden by
setting `hidden` on them — which the stylesheet had been quietly overriding, so the microphone was
drawn on machines with no support for it and did nothing when tapped. Both mics and the new ✍️
button are properly hidden now.

**Two harnesses cover it.** `node tools/tutor-tests.mjs` grew a *Writing with a stylus* section
(78 checks). `node tools/stylus-check.mjs` is new and drives the **real** handlers in a **real**
browser with synthetic pointer events, printing the before-and-after timings above;
`--selftest` breaks the pipeline eight ways and requires every break to be caught.

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
