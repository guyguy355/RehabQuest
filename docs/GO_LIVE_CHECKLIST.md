# Go-live checklist: what the owner must do

Everything in the code is ready for a single-clinic launch. The items below need accounts,
money, a domain or a clinician, so they cannot be done from the repository. Work top to bottom.

## 1. Accounts and hosting (about one hour)

- [ ] **Resend account** at https://resend.com (free tier: 3,000 emails/month).
  Add your sending domain (e.g. `rehabquest.co.il`), add the DNS records Resend shows (SPF, DKIM, DMARC),
  wait for "Verified", then create an API key. Keep it secret.
- [ ] **Render account** at https://render.com with a payment method. Smallest paid plans
  (`starter` web + `basic-256mb` Postgres, Frankfurt) are about US$13/month. Free plans sleep and lose data; not for patients.
- [ ] **Deploy**: Render → New → Blueprint → repo `guyguy355/RehabQuest`, branch `main`.
  Fill in `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `RehabQuest <no-reply@rehabquest.co.il>`), `EMAIL_REPLY_TO`.
  Follow docs/DEPLOYMENT.md. The service refuses to start if something required is missing and tells you what.
- [ ] **Domain** (optional at first): buy one, add it in Render → Custom Domains, then set `APP_BASE_URL` to it.
- [ ] **Create the first therapist account** from the Render shell (command in docs/DEPLOYMENT.md). Therapists are never
  created through the public registration page.
- [ ] **Smoke test on the live URL**: open the app, register a test patient with a mailbox you control, sign out,
  use "Forgot password" and confirm the email arrives and the link works, delete the test patient's link afterwards.
- [ ] **Backups**: in Render → database → Backups, confirm daily backups are on and do one restore to a new
  instance to be sure you know how.
- [ ] **Uptime alert**: point a free monitor (e.g. UptimeRobot, Better Stack) at `https://<your-app>/health`.

## 2. Clinical content (needs a physiotherapist)

- [ ] **Review the exercise catalog** in `server/src/data/exercise-catalog.ts` (names, instructions, safety notes, default
  sets/reps). The starter content was written as general material and has not been reviewed by a clinician.
- [ ] **Review the 3D exercise demonstrations**: approve each in the therapist UI; unapproved ones stay hidden from patients
  while `EXERCISE_DEMO_PREVIEW=false` (docs/EXERCISE_DEMOS.md).
- [ ] **Write or review education cards** before assigning them to patients.
- [ ] **Decide the review rules** (pain threshold, missed-activity days) in the therapist review settings.

## 3. Privacy and legal (Israel: חוק הגנת הפרטיות and medical-record rules)

- [ ] **Privacy policy and terms of use** shown to patients at registration. The app has no consent screen yet; a short page
  linked from the registration form is the minimum. Have a lawyer check it; health data is "sensitive information".
- [ ] **Database registration**: a database holding health data of patients generally has to be registered with the
  Privacy Protection Authority (רשם מאגרי מידע). Check whether your size and use require it.
- [ ] **Data-processing agreements** with the processors: Render (hosting, Frankfurt), Resend (emails; they only see
  names and email addresses). Both offer standard DPAs on request.
- [ ] **Decide retention**: how long records are kept after care ends, and who can delete an account. Medical records
  normally must be retained for years, so patient self-deletion is intentionally not implemented; patients can
  download their data (Profile → "Download my data").
- [ ] **AI summaries**: leave `AI_SUMMARY_PROVIDER=none` unless you have a DPA with Anthropic and patients were told.

## 4. Before the first real patient

- [ ] Use the app for one week with yourself as both therapist and patient on the live URL.
- [ ] Install it on a phone (Add to Home Screen in Chrome/Safari) and check reminders and the Hebrew layout.
- [ ] Agree with your clinic on who answers patient messages and how fast.
- [ ] Keep the demo seed off production (it refuses to run with `NODE_ENV=production`, but do not try).

## 5. Later, as usage grows

- [ ] A second API instance needs a shared rate-limit store (Redis). One instance is fine for a clinic.
- [ ] Web Push (browser notifications): generate keys with `npm run push:keys` and set `WEB_PUSH_*` in Render.
- [ ] Android app (Capacitor) if patients want a store app; the web app already installs as a PWA.
- [ ] Offline exercise recording (Stage 4J in IMPLEMENTATION_STATUS.md).
