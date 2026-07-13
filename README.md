# CITUHireX

OJT matching platform for CIT-U's College of Engineering and Architecture —
connecting Students, Partner Companies, and OJT Coordinators. Built as plain
**HTML, CSS, and JavaScript** (ES modules, no build step, no framework),
wired to a live Supabase backend.

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

## Team

- **Jovan Pogoy** — Project Manager, DBA, Full-stack
- **Batiller** — UI/UX, Frontend
- **Arcayan** — QA, Backend
