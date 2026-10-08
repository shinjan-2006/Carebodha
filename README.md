# CareBodha

**Understand your care. Follow it with confidence.**

A working Next.js application with patient, clinician, and family workspaces, PostgreSQL persistence, email/password sign-in without OTP, private document storage, and a separate PostgreSQL-backed worker. The default normal environment starts with empty accounts and supports clinician-led processing of real source documents without a paid AI key. Optional AI credentials enable automated drafting and comparison.

On Vercel, the app uses hosted PostgreSQL, private Vercel Blob storage, and durable Workflow jobs instead of local disk and a separate worker. Authenticated direct uploads retain the 10 MB file limit. Document extraction only creates drafts; clinician review and approval are still required. Scheduled reminder workflows check cancellation and the current approved plan before creating notifications.

The Vercel build applies database migrations and initializes a normal environment guard. Configure `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `APP_MODE=normal`, `AI_PROVIDER=manual`, `OCR_ENABLED=false`, `STORAGE_DRIVER=vercel-blob`, and the connected private Blob store credential. An optional sensitive `HOSTED_TEST_CLINICIANS` value provisions up to three operator-controlled, explicitly fictional `TEST —` accounts; it cannot grant roles through registration. Never commit environment files, credentials, uploaded medical documents, or database exports.

English, Hindi, Bengali, Odia, Telugu, Punjabi, and Tamil are available in the visible language selector. Navigation and sign-in labels change language; approved care text uses reviewed translations. When a selected translation is unavailable, the app explicitly shows the approved English text rather than presenting it as a translation.

The UI follows Matter Immersive's pearl surfaces, oversized Archivo headings, blue italic Instrument Serif, thin editorial rules, and segmented glass ribbon. See [design notes](docs/DESIGN.md) and [verification evidence](docs/VERIFICATION.md) for the redesign's source, screen coverage, and checks.

## Run locally

Use Node.js 22.16+ (24 LTS recommended), pnpm, and either Docker or the included local PostgreSQL helper. The committed `pnpm-lock.yaml` and exact package versions make installs repeatable. Chrome is used by the Playwright suite.

From this project directory:

```powershell
pnpm install --frozen-lockfile
pnpm setup:env
pnpm db:generate
```

In the Codex Windows desktop environment, replace `pnpm` with `.\scripts\pnpm.ps1` in each command; the wrapper finds the bundled pnpm automatically. For example:

```powershell
.\scripts\pnpm.ps1 install --frozen-lockfile
.\scripts\pnpm.ps1 setup:env
```

`setup:env` creates `.env` with a random authentication secret and preserves an existing `.env`. Provider credentials are empty. The default database URL is a local development credential and must be replaced for deployment.

Choose one database startup method:

```powershell
# Recommended: PostgreSQL 17 with a durable Docker volume
docker compose up -d postgres
```

Or, when Docker is unavailable, run this in a terminal and leave it running:

```powershell
pnpm db:local
```

The optional helper runs a real loopback-only PostgreSQL server and retains data in `.local-postgres`. Its npm distribution is `embedded-postgres@18.4.0-beta.17`; Docker is the stable deployment-independent option. The normal local database is `carebodha_normal`; historical demo data remains in a separate database. The helper creates databases using UTF-8 for all seven languages.

Then:

```powershell
pnpm setup:normal
```

Run the web application and worker in separate terminals:

```powershell
# Terminal 1
pnpm dev
```

```powershell
# Terminal 2
pnpm worker
```

Open [CareBodha](http://localhost:3000). `BETTER_AUTH_URL` must match the browser origin exactly; use `localhost`, as configured, for sign-in and invitations. The server binds to loopback by default.

Create a patient account with your email and a CareBodha password (at least 12 characters). Your Gmail password is not requested. A server operator must provision a clinician using the controlled `clinician:provision` command below; public registration cannot grant clinician permissions. The expert can then sign in at `/expert/signin`, open **Connect patient**, and connect a registered patient by their email address or username. Connection is immediate and does not require patient acceptance. Upload source instructions, review the extracted fields and explanations, and approve the version to publish it to the patient.

With `AI_PROVIDER=manual`, uploads produce exact source paragraphs with empty clinical fields. Clinicians choose the instruction type, enter source-grounded fields, prepare explanation drafts, supply and review English/Hindi translations, and optionally review additional languages. Only reviewed translations are published. Teach-back answers are persisted as **care-team review needed**, with an actual clarification request and clinician notification; no automated match is inferred. Configured `openai-compatible` processing remains available.

`pnpm verify:normal` verifies this complete path against the separate `carebodha_normal_test` database on port 3001 after `pnpm build`. It never seeds the active normal database. Historical demo acceptance checks require the isolated demo environment.

## Optional isolated fictional demo accounts

| Workspace | Email |
| --- | --- |
| Patient: Asha Sharma | `patient@carebodha.demo` |
| Clinician: Dr. Ananya Sen | `clinician@carebodha.demo` |
| Family: Priya Sharma | `family@carebodha.demo` |
| Additional patient: Ravi Kumar | `ravi@carebodha.demo` |
| Additional patient: Meera Patel | `meera@carebodha.demo` |

The password is `DEMO_SEED_PASSWORD` from `.env` (the example uses `CareBodha-demo-2026!`). Demo account buttons fill those fictional credentials and still perform real authenticated sign-in. They are only shown when `APP_MODE=demo`. Never reuse this password for real accounts or expose a demo database containing real medical information.

The seed provides three synthetic documents, approved English/Hindi explanations, a prepared draft for Asha, clinician assignments, a consent fixture for Priya to assist Ravi, and a welcome notification. Asha can invite Priya separately and revoke that grant. Seeding preserves existing records and does not reset attempts or re-enable revoked access. `demo-documents/` contains text and PDF copies. PDFs are parsed by the same private upload/worker path as normal documents. Paste a text file's content into **Document upload**; `.txt` files themselves are not accepted as file uploads.

Demo extraction only recognizes these exact fictional sources (whitespace may vary). Other input reports `DEMO_UNSUPPORTED_SOURCE`. Demo teach-back checks recognized English/Hindi medication phrases. Unsupported medication answers return `UNCLEAR` with a limitation; non-medication demo comparisons report `DEMO_COMPARISON_UNSUPPORTED` instead of fabricating findings. A configured live adapter can compare source-grounded non-medication instructions. A match concerns the checked details only. It never claims adherence or clinical safety.

## Approval and care boundaries

The source is the doctor's existing plan. Extraction fields must appear in the source passage; empty fields remain empty. Explicit follow-up dates/times must be verifiable in the source. Unclear sources cannot be approved. Clinicians review each extraction and both language explanations before publication.

Approved versions are immutable. **Create new draft version** copies the current content into a new version; the previous version remains published until the replacement is approved. Changing an extraction invalidates its explanation reviews. Approval locks the plan/version and publishes instructions, explanations, and an approval record atomically. Historical attempts retain their original instruction and version references.

Teach-back output is schema-validated, restricted to known IDs and approved values, and grounded in exact transcript quotes. The server creates explanations and clarifications from validated fields and the approved source, rather than displaying freeform model medical advice. Explicit dose/unit checks take precedence over semantic results. Missing details are `INCOMPLETE`, ambiguous answers are `UNCLEAR`, conflicts are `MISMATCH`, and unclear sources require clinician review. There are no confidence percentages.

Caregiver and assisted-patient attempts have separate person types. A caregiver match never changes a patient-understanding flag; no such global flag is maintained.

Family invitations contain random single-use tokens. Only their SHA-256 hashes are stored. Invitations expire after 48 hours, are bound to the invited email, and require authenticated acceptance. Server checks read active grants on every request. Revocation blocks subsequent access immediately; open family screens refresh every five seconds and on focus. A browser cannot erase information someone already read before revocation.

Missing instruction details show: “This information is not included in your approved care plan. Please ask your care team.” Contradictory or unclear sources show: “Doctor clarification required.” No diagnosis, prescription changes, missed-dose advice, side effects, interactions, or urgency scores are generated.

## Documents, jobs, reminders, and notifications

PDF, PNG, and JPEG uploads are capped at 10 MB and checked by signature. The local adapter stores random keys outside `public/`. Downloads require an assigned clinician session. `STORAGE_DRIVER=s3` enables the private S3 adapter; set the `S3_*` values in `.env`, use a private bucket, and provide durable storage for the separate worker.

`pdf-parse` extracts text from actual PDFs and records page references. Image OCR uses Tesseract with English/Hindi when `OCR_ENABLED=true`; language-model downloads/cache access must be available. When OCR is disabled or cannot process a document, the job reports failure and the UI offers manual text entry. Scanned PDFs without usable text also request manual entry; they are not presented as successful text extraction.

The worker uses `FOR UPDATE SKIP LOCKED` claims, 90-second leases renewed every 15 seconds, at most three attempts, delayed retries, and unique idempotency keys. Draft creation and job completion commit together. Expired leases can be reclaimed; exhausted leases report failure. Permanent unsupported-demo/OCR/configuration errors fail without fabricated results.

Reminders originate from an approved instruction and an explicit user-selected timestamp. A preference is not a prescribed schedule. Times are stored in UTC and displayed in the patient's selected timezone. Local time entry clearly uses the device timezone. A reminder for a superseded version is not delivered as a current-plan reminder.

The worker creates in-app notifications exactly once per reminder/recipient. Scheduled, notification-created, read, and reported-completed timestamps remain separate. This application does not claim email, SMS, or push delivery.

## Normal environment and optional live AI

Use a **separate PostgreSQL database** and set `APP_MODE=normal`. An environment-guard record prevents mixing normal and demo data. Public registration always produces a patient account, regardless of requested role. Clinicians must be provisioned by an operator who controls the server environment.

Set `CLINICIAN_EMAIL`, `CLINICIAN_NAME`, and a 12+ character `CLINICIAN_PASSWORD` securely in the process environment. Optionally set `CLINICIAN_USERNAME` (3–30 letters, numbers, or underscores). Both email and username support password sign-in, without OTP. Then:

```powershell
pnpm db:migrate
pnpm clinician:provision
```

After a patient registers, the expert can connect them directly in **Connect patient**. Patients can pick an optional username during registration, or choose one in **Language & access** later. Usernames are case-insensitive and cannot be changed once chosen. Existing email-only accounts continue to work.

For operator-managed assignments, set `PATIENT_EMAIL` and `CLINICIAN_EMAIL` and run:

```powershell
pnpm patient:assign
```

For live AI, configure `AI_PROVIDER=openai-compatible`, `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. Use a model/provider that supports Chat Completions JSON output, `temperature: 0`, and `store: false`. The default URL targets OpenAI's compatible API, but no live provider was called during verification. Extraction, draft simplification, draft Hindi translation, and teach-back comparison are separate operations. Calls have 15-second timeouts and at most two attempts. Application validators still run after provider JSON output; JSON mode alone does not enforce this schema. See the official [JSON output documentation](https://developers.openai.com/api/docs/guides/structured-outputs) and [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

Missing credentials, refusals, malformed/unverifiable output, and timeouts produce clear failure states. They never fall back to a fabricated success. Translation drafts require clinician review; live medical accuracy and language equivalence have not been independently validated.

Provider secrets remain on the server. Application logging excludes source text, transcripts, audio, tokens, passwords, and request bodies. Next development request/query logging and browser forwarding are disabled to avoid leaking invitation URLs. Configure any deployment proxy/logging layer to preserve the same rule.

## Verification

Keep the web app, database, and worker running:

```powershell
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm build
```

Playwright uses installed Chrome, real authentication cookies, HTTP endpoints, and PostgreSQL assertions. Acceptance tests use uniquely named fictional test accounts; they are retained for persistence evidence. Never point these tests at a real patient database. The suite requires demo mode and blocks execution when the test process has `NODE_ENV=production`.

To verify restart persistence after the acceptance suite: stop and restart the web app and worker, retain the database/storage, then run `pnpm verify:restart`. It signs in through the real API and checks persisted versions, attempts, and resolved questions against database counts. PostgreSQL persistence was verified after an actual web/worker restart.

For a build preview, stop the development web server before:

```powershell
pnpm build
pnpm start
```

Leave the worker and database running. On Windows, stop web/worker processes before regenerating Prisma if its query-engine DLL is locked. The development watcher excludes database, private-storage, and test-output directories.

Results, limitations, and observed visual checks are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md). The API is documented in [docs/API.md](docs/API.md), with a [hackathon walkthrough](docs/DEMO.md).

## Visual reference and deployment limits

The public [AI Studio preview](https://www.getlayers.ai/layer/ai-studio) was inspected before implementation. Its source/prompt is locked. CareBodha uses the visible violet card composition and the public description's chrome star, dark space, drifting particles, and camera motion. No unlocked template code or premium assets were obtained. Exact source proportions, typography, scroll sequence, and full interaction fidelity could not be inspected or verified.

The design tokens in `src/app/globals.css` apply across all roles. Landing motion uses Three.js, passive scrolling, reduced-motion support, and a static star fallback. Application screens use stable layouts, approved-source text, keyboard focus, labeled controls, and larger patient-facing copy.

This deliverable is a local, functional application. Public deployment was not performed. Deploy the web app and a separate worker against PostgreSQL and private storage with appropriate infrastructure configuration and independent security/clinical/privacy review. It is not described as production-ready, clinically validated, or healthcare-regulation compliant.


### Local dummy medical experts

`pnpm exec tsx scripts/provision-test-doctors.ts` creates three explicitly labeled TEST clinician accounts only in the local normal database. Their generated passwords are retained in the ignored `.local-test-doctors.json` file and displayed by the command. Sign in at `/expert/signin`; these are local testing accounts. The command verifies existing fixtures and never overwrites a different account.
# Local fictional prescriptions

After provisioning the local test doctors, run `pnpm exec tsx scripts/provision-test-prescriptions.ts`. This adds three clearly marked fictional patients, assigns one to each test doctor, and creates a published training care plan plus a separate draft through the existing approval guard. It only runs against the local `carebodha_normal` database and never replaces existing accounts or care plans.

Prescription sources and teach-back exercises are in `docs/sample-prescriptions/README.md`. Patient passwords are generated locally and stored in ignored `.local-test-patients.json`. Training medicine names are fictional and these records are not for actual patient care.
