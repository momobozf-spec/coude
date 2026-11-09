# Learn — short Islamic lessons

Short lessons (3–5 minutes) on what Muslims need to know today, in Dutch, French and
English. Built for people who can give five minutes every two or three days.

## How it works

| Piece | Where |
| --- | --- |
| Lesson files (content, sources, review status) | `src/content/learn/*.json` + `index.ts` |
| Lesson format (zod) | `src/lib/learn/lesson-schema.ts` |
| Grading, XP, levels | `src/lib/learn/grading.ts` |
| Learning rhythm (forgiving streak) | `src/lib/learn/rhythm.ts` |
| Service (overview, play, complete) | `src/server/modules/learn/learn.service.ts` |
| Pages | `/app/learn`, `/app/learn/[slug]` |
| Stored per member | `LessonCompletion` (one row per lesson per local day) |

- **Content lives in the repository**, not the database. A lesson is reviewed text with
  sources; it is versioned with the code and signed off in a pull request.
- **The server grades.** The player gives instant feedback, but XP is computed from the
  raw answers against the lesson file.
- **XP only on the first completion** of a lesson (10 + 2 per correct answer). Replays
  earn nothing but count for the rhythm.
- **Rhythm**: holds as long as no more than 3 days pass between learning days.
- **Free plan**: 2 new lessons per local day. Replays are always free. Premium: unlimited.
- **Arabic**: no lesson text yet — Arabic readers are served English with a notice.

## Review — nothing unreviewed goes live

Every lesson starts as `"review": { "status": "draft", "reviewedBy": "", "reviewedAt": "" }`.

- In production, drafts are **hidden**. On a test deployment set `LEARN_SHOW_DRAFTS=1`
  to show them, each with a "draft, not yet reviewed" notice. In development they show.
- A lesson only counts as reviewed with `"status": "reviewed"` **and** a named reviewer
  (`reviewedBy`) and date (`reviewedAt`). "reviewed" without a name stays a draft.
- The reviewer checks the Arabic, every reference and every explanation, in all three
  languages. The unit test `ships today's lessons as drafts` must then be updated
  deliberately.

## Age groups, levels and profiles

- Every lesson has an `audience` (`kids` 6–9, `teens` 10–15, `adults`) and a `level`
  (1 Starter, 2 Gevorderd, 3 Verdiept).
- Each account has its own profile (adults, the holder is 16+) and up to four child
  profiles: a nickname and an age group, nothing else — no birth date, no e-mail, no login.
  Children learn on the parent's device; the active profile is a cookie (`ml_learner`)
  that is checked against the account on every request.
- A five-question level test (`placement-<audience>.json`) sets the starting level; it can
  be skipped. A profile moves up automatically once every lesson of its level is done.
  Lessons above the profile's level are locked.
- The free daily limit (2 new lessons) is per account, not per profile.
- Wrong answers are kept on the attempt (`missed`) and come back under **Oefenen**
  (practice). Practice is graded on the server and crosses mistakes off; it earns no XP.
- Child profiles are exported, cleared with "clear activity" and erased with the account
  (see `RETENTION_POLICY`).

## Games

| type | what the member does | answer sent |
| --- | --- | --- |
| `match` | pair left and right (teens/adults); memory cards for kids | right index per left item |
| `wordbuild` | tap letter tiles to spell `word` (A–Z, 3–10) | tile indices; graded on the word spelled |
| `quickfire` | true/false statements against a timer | booleans; passes from 80% right |
| `order` | tap items into order | item indices |

## Adding a lesson

1. Copy an existing file in `src/content/learn/`, give it a new `slug`, an `audience`,
   a `level` and a free `theme` + `order` position.
2. Write `nl`, `fr` and `en` text: `title`, `intro`, 1–6 `body` paragraphs, `takeaway`.
3. Add every Qur'an / hadith reference you rely on to `sources`. No claim without a source.
4. Add 2–6 exercises: `choice` (index of the right option), `truefalse`, `order`
   (items in the correct order — the player shuffles them), `match`, `wordbuild` or
   `quickfire` (see Games).
5. Import the file in `src/content/learn/index.ts` and add it to `RAW_LESSONS`.
6. `npm test` — a broken file fails the build and the tests.

## Not built yet

- Coins that turn into real charity (needs a partner organisation and a legal check).
- Arabic lesson text, audio, push reminders.
- An editor for lessons outside the code.
