# Study Buddy — Polymath Learning Centre

A student uploads their own worksheet as a PDF, writes their answers on it, and works through it
with a buddy that **hints rather than answers**. When they are finished it marks the paper, and
every question they did not get right goes into a **mistake book** with a picture of the question.

One self-contained `index.html` on the shared `mathgen--app` Firebase project, with Google sign-in.
It is the fourth app in the family and it shares the teacher's notebook with the other three, so
everything it says is grounded in the way **Mr Chung** actually teaches.

Live at <https://polymathlc.github.io/tutor/> once GitHub Pages is switched on for the repo.

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
| `tutorWorksheets/{id}` | One worksheet: its name, level, subject, help level, score, and everything written about it (ink, hints, marking, chat) |
| `users/{uid}/mistakes/{id}` | The student's own mistake book |
| `users/{adminUid}/teachingNotes/{id}` | The shared notebook — read here, written only by the admin |
| `users/{adminUid}/aiTraining/answerStyle` | The style profile Ans Key distils — read here, never written |
| `config/admin` | The Portal's pointer to the teacher's uid, so a student's device knows whose notes to read |

Suggested rules: a student may read and write `tutorWorksheets` documents whose `ownerUid` is their
own, and their own `users/{uid}/mistakes`. `teachingNotes` and `aiTraining` are readable by any
signed-in user and writable only by the admin.

### Storage

| Path | What is in it |
| --- | --- |
| `tutor-worksheets/{id}.pdf` | The uploaded worksheet |
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
