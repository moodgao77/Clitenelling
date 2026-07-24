# Retail Clienteling Tool — Prototype Build Plan

## Context

The retail team of a Dubai-based luxury fashion brand sells through showroom relationships that
currently live inside associates' private WhatsApp chats — invisible, uncountable, unmanageable.
This prototype is the **ledger WhatsApp can't provide**: a trackable record of who each associate
contacted, when, what stage the relationship is at, and what follow-up is due.

Two goals, in order: (1) **help an associate sell** — remember their clients, surface due
follow-ups, make them look good; (2) produce a **trustworthy funnel** — Contacted → Visit booked →
Visited → Purchased, per associate, per month. It exists to test one hypothesis: *does disciplined,
tracked follow-up bring luxury clients back to the showroom?* A professional engineer reviews this
before any real users touch it, so clarity and sound security foundations beat feature count.

## Decisions locked with the user

| Fork | Decision |
|---|---|
| Managed auth + database | **Supabase** (managed Postgres + Auth + Row-Level Security) |
| Shopify sync | Connect a **real, live** Shopify store, **read-only** |
| Which Shopify store | **Live production store** (see Deviation Flag below) |
| Hosting | **Deploy to a live URL** (Vercel + Supabase cloud, free tier) |
| Seed data | **Generate a realistic dummy dataset** (fake people, Arabic notes, orders) |

## ⚠️ DEVIATION FROM BRIEF — SECURITY REVIEW REQUIRED

The brief states, in bold: *"Dummy or anonymized data only. No real client records until the
engineer signs off on security."* The user has, after being warned twice, chosen to connect the
**live production Shopify store**, which pulls **real customers' names and phone numbers** into the
prototype. **This directly contradicts that rule.**

Mitigations baked into this plan so the reviewer can assess before real data flows:
- The Shopify connection is **strictly read-only** (`read_customers`, `read_orders` scopes only) and
  **never writes back** to Shopify.
- The Shopify access token is a **server-side secret**, never shipped to the browser.
- The live production sync is the **deliberate final build step (Phase 8)** — switched on only after
  login, Row-Level Security, and deployment are all verified. Everything before it runs on the dummy
  dataset. Pointing at the live store is a one-line credential change and should be treated as a
  go/no-go gate the reviewer signs off on.

## (a) Data model — Supabase / Postgres

One central **Person** record, plus the supporting tables that make the funnel measurable. All text
columns are Unicode (Postgres default) so Arabic is preserved.

**`profiles`** (one row per associate; linked 1:1 to Supabase Auth's `auth.users`)
- `id` (= auth user id), `full_name`, `role` (`associate` | `manager`), `created_at`
- `role` gates the manager funnel view.

**`people`** — the central Person record
- `id`, `full_name`
- `phone_e164` (text, **UNIQUE**) — normalized phone; the identity key for all matching/merging
- `phone_raw` (text) — as originally entered, for reference
- `source` (`whatsapp` | `instagram` | `walk_in` | `shopify` | `import`)
- `owner_id` (→ `profiles.id`, **nullable** = Unassigned)
- `stage` (`uncontacted` | `contacted` | `visit_booked` | `visited` | `purchased`)
- `stage_changed_at` (timestamp of the current stage)
- `notes` (free text; Arabic-capable)
- `shopify_customer_id` (nullable) — link back to Shopify
- `created_at`, `updated_at`
- *"Prospect vs. client" is **not** a column* — it's derived: has orders / reached `purchased`.

**`stage_history`** — every stage change, timestamped (this is what makes the funnel real)
- `id`, `person_id`, `from_stage` (nullable), `to_stage`, `changed_by` (→ profiles), `changed_at`
- The append-only ledger the manager funnel reads from.

**`activities`** — the single flexible object (appointment / follow-up / note are **one** table)
- `id`, `person_id`
- `type` (`appointment` | `follow_up` | `note`)
- `title`, `body` (Arabic-capable)
- `due_at` (nullable — the date for an appointment or follow-up)
- `status` (`due` | `done`)
- `trigger_kind` (nullable: `post_purchase_48h` | `interested_lead` | `post_purchase_90d` | `manual`)
  — records *why* an auto follow-up exists
- `created_by`, `created_at`, `completed_at` (nullable)

**`orders`** — read-only mirror pulled from Shopify (never written back)
- `id`, `person_id`, `shopify_order_id`, `order_number`, `total`, `currency`, `ordered_at`,
  `line_items` (JSON summary)

**`shopify_sync_log`** — one row per sync run (customers pulled, orders pulled, status, timestamps);
demonstrates the sync working and aids debugging.

**Phone normalization & identity (Gulf rule):** normalize every phone to E.164 on entry using
`libphonenumber-js` with default region **AE (+971)**, so `+971...`, `0...`, and bare numbers resolve
to one identity. The `UNIQUE` constraint on `phone_e164` enforces "one person, one record."

**Merge / dedup:** on any insert (Quick-add, Excel import, Shopify), match on `phone_e164`. If a match
exists, **merge into the existing record** (fill blanks, keep an existing owner, append the new source,
keep the earliest `created_at`, attach any new orders) — **never create a duplicate.**

**Row-Level Security (RLS) — the core access control the reviewer must verify:**
- Associates can read/write people they **own** plus the **Unassigned** pool (so they can claim
  prospects). They cannot see other associates' owned clients.
- Managers can read all (for the funnel view).
- `activities`, `orders`, `stage_history` inherit visibility through their parent person.

## Stage engine & follow-up triggers — automatic vs manual

- **Auto-log "Contacted"** *(automatic)* — when the associate taps the WhatsApp click-to-chat link on
  a person who is `uncontacted`, the tool advances them to `contacted`, writes `stage_history`, and
  timestamps it. The contact count is a byproduct of the action, not a chore.
- **Post-purchase check-in — +48h** *(automatic)* — created when a person enters `purchased`.
- **Post-purchase re-engagement — +90 days** *(automatic)* — created when a person enters `purchased`.
- **Interested lead — +5 days (3–7 range)** *(semi-manual)* — created when the associate taps a
  one-tap "Interested / wants to visit" action on a person who's shown interest but has no fixed date.
- **Manual follow-up** *(manual)* — the associate can add a follow-up with any due date on any person.
- **Outcome updates** (booked? visited?) are a **manual one-tap stage change** by the associate.

## (b) Screen list

Non-negotiables from the brief are marked ★.

1. **Login** — Supabase Auth (email + password). Individual login per associate.
2. **★ My Day / Home** — the associate's landing screen: follow-ups **due now/overdue** first, plus
   their **Uncontacted prospecting pool** (owned + unassigned) as a work queue.
3. **Client list / search** — searchable, stage-filterable list of the associate's people; tap → profile.
4. **★ Client profile — the heart** — one view: contact details, owner, stage with **one-tap stage
   change**, preferences/notes (editable, Arabic), **read-only Shopify purchase history**, an
   **activity timeline** (past contacts + upcoming follow-ups), the **WhatsApp click-to-chat** button
   (opens `wa.me/<number>` with a pre-written message and auto-logs Contacted), add
   follow-up/appointment/note, and "assign to me" when Unassigned.
5. **★ Quick-add** — a thumb-friendly "+ New contact" form: name, phone (required), source, optional
   note. Normalizes the phone and dedup-checks/merges on save.
6. **Excel import (one-time setup)** — upload `.xlsx`/`.csv` → **column mapping** → validation (flag
   missing phone, normalize formats, flag obvious duplicates) → import. Default stage `uncontacted`.
7. **★ Manager funnel view** *(manager role only)* — per associate, per month: stage counts **and the
   conversion ratios between stages** (contacted→booked→visited→purchased). Framed as a coaching aid,
   not surveillance. Also surfaces the **adoption signal** (are associates logging consistently?).
8. **Settings (thin)** — manage associates (manager), trigger/view Shopify sync status.

## (c) Tech stack (plain-language rationale)

- **Next.js (React) + Tailwind CSS** — a responsive, mobile-first web app used in the phone browser.
  Standard, well-documented, easy for a reviewer to read. No native app, no app store.
- **Supabase** — managed Postgres database + managed login/passwords/sessions + Row-Level Security.
  We do **not** hand-roll authentication, password storage, or sessions (the brief's key rule). SQL
  makes the per-associate funnel maths straightforward and auditable.
- **libphonenumber-js** (region AE) — correct phone normalization for the identity/dedup rule.
- **SheetJS (xlsx)** — parse the one-time Excel import and drive column mapping.
- **Shopify Admin API**, read-only scopes (`read_customers`, `read_orders`), server-side only —
  one-directional pull; never writes back.
- **WhatsApp**: plain `wa.me/<e164>?text=<message>` links. **No** WhatsApp Business API, no template
  approval, no DM capture (all v2 / out of scope).
- **Hosting**: Vercel (frontend + serverless API routes) + Supabase cloud. Free tier, live URL for
  real phone testing.

## Security points the reviewer should scrutinize

1. **RLS policies** — verify an associate cannot read another associate's owned clients, and only
   `manager` role reaches the funnel view. This is the primary access control.
2. **The Deviation Flag above** — real production PII entering an unreviewed prototype; assess before
   Phase 8 is switched on.
3. **Shopify token** — stored as a server-side secret, read-only scopes, never in the browser bundle,
   never writes back.
4. **Phone normalization correctness** — the identity/dedup/merge rule hinges on it; review edge cases
   (missing country code, leading 0, non-UAE numbers, malformed input).
5. **Auth hardening** — email confirmation and password policy via Supabase; the anon/public key must
   be powerless without RLS.
6. **Deployment exposure** — no public/anon read access to `people`/`orders`; confirm RLS is enforced
   in the deployed environment, not just locally.

## Skills & methodology (how it gets built, QA'd, and tested)

**Design & build**
- `superpowers:writing-plans` → `superpowers:executing-plans` — convert this into a step-by-step
  implementation plan and work it phase by phase.
- `superpowers:test-driven-development` — write the failing test first for the risky logic: phone
  normalization, dedup/merge, timestamped stage history, and funnel-ratio maths.
- `frontend-design` + `web-design-guidelines` + `shadcn-ui` — mobile-first, thumb-friendly UI on a
  clean, accessible component system.
- `dataviz` — the manager funnel view (stage counts + conversion ratios) as honest, readable charts.

**QA (looks and behaves right on a phone)**
- `webapp-testing` + `agent-browser` — drive the deployed app in a real browser through the core
  flows (login → add contact → WhatsApp tap → stage change).
- `full-page-screenshot` / `screenshot` — capture each key screen at phone width for review.

**Test & review (correct and safe)**
- `superpowers:verification-before-completion` — every phase's verification steps are actually run,
  not assumed.
- `security-review` — dedicated pass on RLS access control, the read-only Shopify token, and the
  live-production-data deviation gate.
- `superpowers:requesting-code-review` + `simplify` — structured review then cleanup before the
  human engineer reviews.

## (d) Build order (incremental — demoable at each phase)

- **Phase 0 — Foundation**: Next.js + Tailwind scaffold; Supabase project; schema + RLS migrations;
  login; associate/manager roles.
- **Phase 1 — Person core**: people list, profile, Quick-add, phone normalization, dedup/merge.
  Load the **dummy dataset** (fake clients, Arabic notes, orders, associates).
- **Phase 2 — Stage engine + Activities**: timestamped stage changes + `stage_history`; activity
  timeline; add follow-up / appointment / note.
- **Phase 3 — WhatsApp + triggers**: click-to-chat with pre-written message; auto-log Contacted; the
  48h, 90d, interested-lead, and manual follow-up triggers.
- **Phase 4 — My Day**: due-follow-up queue + prospecting pool.
- **Phase 5 — Excel import**: upload → column mapping → validation → merge.
- **Phase 6 — Manager funnel view**: per associate, per month, with conversion ratios + adoption signal.
- **Phase 7 — Deploy**: Vercel + Supabase cloud; verify login + RLS work on real phones (dummy data).
- **Phase 8 — Shopify sync (GATED)**: build against the real Admin API. Verify on a dev/test store,
  then **switch to the live production store only as a deliberate, reviewer-acknowledged go/no-go step**
  (per the Deviation Flag).
- **Phase 9 — Success tracking**: make the 60-day gate (are associates logging consistently?) and
  signal (does follow-up move Contacted → Visited?) both visible in the reporting from day one.

## Verification (how we'll know each piece works)

- **Identity/dedup**: add the same number as `+9715...`, `05...`, and `5...` via Quick-add and import;
  confirm they resolve to one record and never duplicate.
- **Stage ledger**: change a stage and confirm a timestamped `stage_history` row is written.
- **Auto-log Contacted**: tap the WhatsApp link on an `uncontacted` person; confirm they move to
  `contacted` with a timestamp and the funnel count reflects it.
- **Triggers**: enter `purchased`; confirm the +48h and +90d follow-ups appear in that owner's My Day.
- **RLS**: log in as associate A and confirm associate B's owned clients are invisible; log in as a
  manager and confirm the funnel view loads.
- **Arabic**: save Arabic notes; confirm they persist and display unchanged.
- **Shopify (dev store first)**: run a sync; confirm buyers land as `purchased`, non-buyers as
  `uncontacted`, all `unassigned`, orders read-only, nothing written back to Shopify.
- **Reporting**: confirm per-associate, per-month counts **and** stage-to-stage ratios compute correctly.
