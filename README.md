# NAITA Project Evaluation Tool

Web application for evaluating apprentice capstone projects: coordinators schedule
sessions and run the clock, two examiners score against a fixed ten-criterion
rubric, and the final mark is calculated automatically.

Built to the NAITA SRS v1.0 (React · Node.js · Express · MongoDB · JWT).

---

## Running it locally

You need Node 20+ and a MongoDB database. MongoDB Atlas has a free tier that
works fine; a local `mongod` works too.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # then edit .env
npm run seed                # creates the starter accounts and a demo session
npm run dev                 # http://localhost:4000
```

Set at minimum `MONGODB_URI` and `JWT_SECRET` in `.env`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api
npm run dev                 # http://localhost:5173
```

### 3. Sign in

The seed script creates one account per role, all sharing the password from
`SEED_ADMIN_PASSWORD`. Every account is flagged to change its password at first
sign-in.

| Role | Email |
| --- | --- |
| Administrator | `admin@naita.lk` |
| Coordinator | `coordinator@naita.lk` |
| Chief Examiner | `chief@naita.lk` |
| Support Examiner | `support@naita.lk` |

To see the whole flow: sign in as the coordinator, start the demo session's
clock, then sign in as each examiner in a separate browser profile and submit
marks. The final mark appears on the coordinator's session page as soon as the
second sheet is in.

---

## How the pieces fit

```
client/                     React 18 + Vite, React Router, plain CSS
  src/api/client.js         single fetch wrapper; attaches the JWT
  src/context/AuthContext   session restore, sign in/out
  src/hooks/useCountdown    server-synced session timer
  src/components/           shell, live session bar, shared UI
  src/pages/                one file per screen

server/                     Express 4 + Mongoose 8
  src/config/rubric.js      the ten criteria, weights and band descriptors
  src/models/               User, Apprentice, EvaluationSession, Evaluation, AuditLog
  src/middleware/           authenticate, authorize, zod validation, error handling
  src/controllers/          request handling and business rules
  src/utils/scoring.js      weighted totals and the final average
  src/scripts/seed.js       starter data
```

---

## Decisions the SRS left open

The specification had a few gaps and one direct contradiction. Here is what was
decided and why, so it can be reviewed or overruled.

**FR8 contradicted Business Rule 3.** FR8 said the coordinator can edit
submitted marks; Business Rule 3 said submitted marks cannot be edited unless
reopened by an administrator. Business Rule 3 wins. Examiners are locked out
after submitting, coordinators get read-only visibility, and only an
administrator can reopen a sheet — with a written reason that goes into the
activity log. Letting a coordinator quietly rewrite an examiner's marks would
undermine the point of having two examiners.

**The timer does not use WebSockets.** The SRS specifies Vercel for the backend,
and serverless functions do not hold long-lived connections. Instead the server
stores `startedAt` and `endsAt`; each client reads those once, measures its own
clock offset against the server's, then counts down locally and re-syncs every
ten seconds. Every screen shows the same number even if the machines' clocks
disagree, and the deployment target stays viable.

**Apprentices became a first-class record.** The SRS refers to apprentices
throughout but never defines them as something the system manages. Without a
record there is nothing for a session to point at and no way to assemble a
history, so `Apprentice` is a collection with its own admin screen.

**Scoring was underspecified.** FR9 says "sum of all weighted criterion marks"
without stating the input scale. Each criterion is scored 0–100 against its band
descriptors, and the total is `Σ(score × weight) / 100`, which lands back on a
0–100 scale. A uniform 80 across all criteria produces exactly 80.

**Nothing happens until both examiners submit.** The final mark is the mean of
two totals, so a single submission leaves the session incomplete rather than
producing a half-formed result. If a sheet is later reopened, the session drops
out of "completed" and the final mark is cleared until it is resubmitted.

**Wide examiner disagreement is surfaced, not enforced.** When the two totals
differ by 15 marks or more, the coordinator's result page flags it. The SRS
defines no third-assessor rule, so the system does not invent one — it just
makes the gap visible to a human.

**An audit log was added.** The SRS gives administrators the power to unlock
submitted marks but does not ask for any record of it. Account changes, timer
starts, submissions and reopenings are all logged, otherwise a result cannot be
defended after the fact.

---

## Requirements traceability

| SRS | Where it lives |
| --- | --- |
| FR1 Authentication | `authController.login`, `middleware/auth.js` |
| FR2 Role-based dashboard | `App.jsx` → `RoleHome`, `AppShell` nav |
| FR3 Profile management | `pages/Profile.jsx`, `PATCH /auth/me` |
| FR4 Schedule session | `pages/ScheduleSession.jsx`, `sessionController.createSession` |
| FR5 View schedule | `pages/ExaminerHome.jsx`, `pages/Sessions.jsx` |
| FR6 Live timer | `hooks/useCountdown.js`, `GET /sessions/:id/timer` |
| FR7 Enter marks | `pages/MarkingSheet.jsx`, `config/rubric.js` |
| FR8 Submit evaluation | `evaluationController.submitMyEvaluation` |
| FR9 Total marks | `utils/scoring.js → calculateTotal` |
| FR10 Final student mark | `utils/scoring.js → calculateFinalMark` |
| FR11 View results | `pages/SessionResults.jsx`, `pages/Results.jsx` |
| FR12 User management | `pages/People.jsx`, `userController` |
| BR1 Two distinct examiners | `EvaluationSession` pre-validate hook, `assertExaminersValid` |
| BR2 One submission each | unique index on `{session, examiner}` |
| BR3 Locked after submit | `submitMyEvaluation`, `reopenEvaluation` (admin only) |
| BR4 Coordinator starts timer | `authorize('admin','coordinator')` on `/start` |
| BR5 Average of two totals | `refreshFinalMark` |
| BR6 All criteria required | `findMissingCriteria` |

---

## Deploying

**Backend → Vercel.** `vercel.json` is included. Set `MONGODB_URI`,
`JWT_SECRET` and `CLIENT_ORIGIN` (your Netlify URL) as environment variables in
the Vercel project. Allow Vercel's egress in your Atlas network access list.

**Frontend → Netlify.** `netlify.toml` is included with the SPA redirect. Set
`VITE_API_URL` to your Vercel URL plus `/api`. Vite inlines env vars at build
time, so redeploy after changing it.

---

## What isn't built yet

Honest list, in rough priority order:

1. **Pagination.** List endpoints cap at 200–500 records, which is fine for one
   evaluation cycle and not for several years of history.
2. **Rubric versioning UI.** Evaluations record the rubric version they were
   scored under, but changing the rubric is still a code edit.
