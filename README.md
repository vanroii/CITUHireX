# CITUHireX

OJT matching platform for CIT-U's College of Engineering and Architecture —
connecting Students, Partner Companies, and OJT Coordinators. Built as plain
**HTML, CSS, and JavaScript** (ES modules, no build step, no framework),
wired to a live Supabase backend.

## Running it

No build step, no `npm install`. Just serve the folder over HTTP (ES modules
don't work over `file://`):

```bash
# Option 1: VS Code Live Server extension — right-click index.html → "Open with Live Server"

# Option 2: Python
python3 -m http.server 8000

# Option 3: Node
npx serve .
```

Then open `http://localhost:8000` (or whatever port).

Supabase connection details are already filled in at
`js/supabase-client.js` — it runs against the live project immediately.

## Structure

```
index.html            — Landing page
login.html             — Role-tabbed login (Student / Company / Coordinator)
signup.html             — Role-tabbed signup (Coordinator is admin-provisioned only)

css/styles.css          — Design tokens + every shared component style

js/
  supabase-client.js    — Supabase client (ESM CDN import, no npm needed)
  auth.js                — Session/profile helpers, route guards (requireRole, requireAuth)
  sidebar.js              — Renders the sidebar nav for whichever role is signed in
  login.js, signup.js     — Page logic for the two auth pages
  student-*.js            — Student dashboard / jobs / applications / profile
  company-*.js            — Company dashboard / jobs / applicants / profile
  coordinator-*.js         — Coordinator dashboard / approvals / students / companies / analytics
  messages-common.js       — Shared by all 3 roles' messages.html (conversation list + thread + Realtime)

student/    — dashboard.html, jobs.html, applications.html, profile.html, messages.html
company/    — dashboard.html, jobs.html, applicants.html, profile.html, messages.html
coordinator/ — dashboard.html, approvals.html, students.html, companies.html, analytics.html, messages.html

supabase/migrations/    — Full schema, RLS, storage, Realtime, auth triggers (already applied to the live project)
```

## What's built and working

- **Auth**: signup (Student/Company self-service, Coordinator blocked by design —
  see `supabase/migrations/0008`), login with role verification, session-based
  route guarding on every dashboard page
- **Student**: dashboard with stats + open postings, Browse Jobs with a working
  Apply button, My Applications with live status + coordinator remarks,
  editable Profile
- **Company**: dashboard with stats + applicants table, Job Postings page with
  a working "create new posting" form (goes to `pending_approval`), full
  Applicants list with a status-update dropdown, editable Company Profile with
  verification badge
- **Coordinator**: dashboard with quick-approve actions, a fuller Approval
  Queue with a remarks field for endorsement decisions, searchable Students
  list, Companies list with a Verify button, Analytics page with Chart.js bar
  charts (applications by status, students by program)
- **Messaging**: real conversation list + thread view + send, live-updating
  via Supabase Realtime (`postgres_changes` on the `messages` table) — shared
  across all three roles by the same script

## Design

Colors and fonts are CSS custom properties in `css/styles.css` (`:root`),
matching the original Figma file exactly:

| Token | Hex |
|---|---|
| `--maroon` | `#7A0C1E` |
| `--maroon-deep` | `#4A0812` |
| `--gold` | `#D4A72C` |
| `--ink` | `#14100F` |
| `--offwhite` | `#FAF7F2` |

Font is Inter, loaded via Google Fonts. No CSS framework — every component
class (`.card`, `.btn`, `.badge`, `.row-card`, `.data-table`, `.sidebar`, etc.)
is hand-written in `styles.css`.

## Known gaps / natural next steps

- **Resume/referral-letter upload** — the `documents` Storage bucket and its
  RLS policies exist (migration 0007), but no page has a file `<input>` wired
  to it yet
- **Messages can't start a new conversation** — the contact list is built
  from *existing* messages only (by design, to keep the profiles-visibility
  RLS policy tight — see migration 0009). Starting a first message to someone
  you haven't talked to yet isn't wired up.
- **No pagination** anywhere — fine at capstone scale, would need it for real
  production volume
- **Coordinator "assigned_programs" scoping isn't enforced** — any coordinator
  currently sees all pending approvals/applications, not just ones in their
  assigned programs (the column exists in `coordinators.assigned_programs`,
  just not filtered on yet)

## Team

- **Jovan Pogoy** — Project Manager, DBA, Full-stack
- **Batiller** — UI/UX, Frontend
- **Arcayan** — QA, Backend
