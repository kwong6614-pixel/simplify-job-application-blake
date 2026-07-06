# Job Application Autofill

Simplify-style US job application autofill:

- **Web app (`apps/web`)**: signup with full profile + resume parse, settings (OpenAI key, Google Sheet OAuth), extension token
- **Chrome extension (`apps/extension`)**: per-tab JD match, text-field detection, one Fill button per tab
- **Google Sheet**: `For Resume` tab (columns A–J)

## Prerequisites

- Node.js 20+
- PostgreSQL
- Google Cloud OAuth client (personal OAuth)
- OpenAI API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

3. Configure `apps/web/.env.local`:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL=http://localhost:3000`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_REFRESH_TOKEN`
- `OPENAI_API_KEY` (optional fallback for resume parsing at signup)

4. Initialize database:

```bash
npm run db:push
```

5. Start web app:

```bash
npm run dev
```

6. Build extension:

```bash
npm run extension:build
```

7. Load `apps/extension/dist` in Chrome → Extensions → Load unpacked.

## User flow

1. Sign up at `/signup` with all required US application fields + **resume PDF upload** (text is extracted and parsed into work/edu/skills).
2. Log in and open `/settings`:
   - Save OpenAI API key (stored server-side on profile)
   - Ensure Google Sheet env vars are set (see `.env.example`)
   - Click **Sync sheet tabs** (default: `For Resume`)
3. Open `/extension` and create an extension token.
4. Paste token + API URL into extension popup.
5. Open ATS application tabs → popup shows JD match + field count → click **Fill this tab**.

## Architecture

```text
Chrome extension
  └─ content script: detect text fields, apply fill
  └─ background worker: tab state, /api/fill/generate
  └─ popup: connection settings + Fill button

Next.js API
  └─ /api/jobs/match      → sheet row by URL
  └─ /api/fill/generate   → rule fill + OpenAI for remaining fields
  └─ /api/jobs/sync       → Google Sheet OAuth sync
  └─ /api/extension/token → extension auth

PostgreSQL
  └─ users, profiles, work/education/skills
  └─ sheet_jobs cache, url_mappings, google oauth tokens
```

## Sheet columns (`For Resume`)

| Column | Field |
|--------|--------|
| A | Date |
| B | Company |
| C | Role |
| D | Tech Stack |
| E | URL |
| F | Responsibilities |
| G | Qualifications (Required) |
| H | Qualifications (Preferred) |
| I | Token Usage (ignored) |
| J | Submitted By |

## Current v1 limits

- Chrome only
- Text fields, textareas, native `<select>`, and custom comboboxes on Workday/Ashby (click-to-open option pick)
- No auto-submit
- OpenAI key stored server-side only
- Token usage is not written back to the sheet
- Resume PDFs stored locally in `apps/web/uploads/resumes/` (max 5 MB, text-based PDFs only)

## Vercel + Supabase

Set `DATABASE_URL` in Vercel to Supabase's **transaction pooler** (port **6543**) with `pgbouncer=true`:

```text
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

The app also auto-appends `pgbouncer=true` when it detects a Supabase pooler URL without it. Without this, Prisma can fail with `prepared statement "s0" already exists`.

## Password reset email (Resend)

Forgot-password requires Resend in production (Vercel).

1. Create a [Resend](https://resend.com) account and API key.
2. Add and verify your sending domain in Resend → **Domains**.
3. Set these Vercel environment variables:

| Variable | Example |
|----------|---------|
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `JobApply <noreply@yourdomain.com>` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `APP_NAME` | `JobApply` (optional) |
| `EMAIL_REPLY_TO` | `support@yourdomain.com` (optional) |

`EMAIL_FROM` must use an address on a domain verified in Resend.

For local testing before your domain is verified, Resend provides a sandbox sender:

```text
EMAIL_FROM="JobApply <onboarding@resend.dev>"
```

Sandbox mode only delivers to the email address on your Resend account.

After deploy, test at `/forgot-password` and confirm the reset email arrives with a link to `/reset-password?token=...`.
