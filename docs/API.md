# CareBodha API

All business endpoints are under `/api/v1`. Responses use `{ "data": ... }` or `{ "error": { "code": "...", "message": "..." } }`. Failures use appropriate 401, 403, 404, 409, 410, 413, 422, 429, 500, or 503 statuses and sanitized messages. Medical and identity responses use `Cache-Control: private, no-store`.

## Authentication

Better Auth handles `/api/auth/*` with signed session cookies, scrypt password hashing, database-backed rate limits, CSRF/origin checks, and secure cookies when `BETTER_AUTH_URL` is HTTPS. Never pass a session token in a business URL. Public registration cannot set `role` or `dataMode`.

| Method | Endpoint | Body |
| --- | --- | --- |
| POST | `/api/auth/sign-up/email` | `{name, email, password}`; password 12–128 characters |
| POST | `/api/auth/sign-in/email` | `{email, password}` |
| POST | `/api/auth/sign-out` | `{}` |
| GET | `/api/auth/get-session` | None |

Every business request requires a valid session and matching database environment. Every mutation also requires `Origin` to exactly match `BETTER_AUTH_URL`; use the same-origin browser client. Mutations are limited to 40 requests/minute per actor/action family, stored in PostgreSQL. JSON bodies are capped while streaming at 120 KB; multipart requests at 11 MB, with a 10 MB file limit.

## Business operations

| Method | Endpoint | Authorized actor and input |
| --- | --- | --- |
| GET | `/workspace?patientId=...` | Own patient, assigned clinician, or active READ family grant. Returns appropriate role data, up to 50 recent attempts/documents/requests/notifications. Patient/family responses contain no draft versions or private documents. |
| GET | `/instructions/:id` | Current published instruction only; requires READ. Includes approved explanations and source reference. |
| GET | `/teachback/history?patientId=...&limit=20&cursor=...` | Patient, assigned clinician, or active family TEACH_BACK grant. `{items,nextCursor}`; limit 1–50. Cursor must belong to accessible history. Family sees its own attempts only. Historical approved version references remain intact. |
| POST | `/documents` | Assigned clinician. `multipart/form-data`: `patientId` plus `file` (PDF/PNG/JPEG) **or** `text` (pasted source). Returns document ID and QUEUED status. |
| GET | `/documents/:id` | Assigned clinician; authorized private download. No permanent public storage URL. |
| GET | `/jobs/:id` | Assigned clinician; `{id,status,attempts,errorCode}`. |
| POST | `/plans/:id/versions` | Assigned clinician; no body. Creates a new draft from latest version. Rejects when a draft already exists. |
| PATCH | `/instructions/:id` | Assigned clinician; draft only. `{instruction: {...}, reviewed: true}`. Source-grounded corrections; invalidates explanation reviews. |
| POST | `/versions/:id/generate` | Assigned clinician; reviewed, clear draft instructions required. Generates unapproved English/Hindi explanations. |
| PATCH | `/explanations/:id` | Assigned clinician; draft only. `{text, reviewed: true}`; explicit language-equivalence review. |
| POST | `/versions/:id/approve` | Assigned clinician; all instructions and both language explanations reviewed. Atomically publishes the version. |
| POST | `/teachback` | Patient or permitted family. See example below. Provider failures return errors; no successful attempt is fabricated. |
| POST | `/invitations` | Owning patient only. `{patientId,email,permissions}`. Returns single-use link and expiry; plaintext token is not stored. |
| POST | `/invitations/accept` | Authenticated invited email. `{token}`. Atomic consumption; expired/used/revoked/wrong-email invitations are unavailable. |
| POST | `/invitations/:id/revoke` | Owning patient; revokes an unused invitation. |
| POST | `/grants/:id/revoke` | Owning patient; revokes active family permissions immediately. |
| POST | `/clarifications` | Patient or family CLARIFY grant. `{instructionId,question}`; question 5–2000 characters. |
| PATCH | `/clarifications/:id` | Assigned clinician. `{response}`; response 5–3000 characters. Resolves request and creates an in-app notification. Instruction changes require separate plan approval. |
| POST | `/reminders` | Patient, assigned clinician, or family REMINDERS grant. `{instructionId,scheduledAt,timezone}`; UTC ISO timestamp in the future, within one year. Explicit preference, not a prescribed schedule. |
| PATCH | `/reminders/:id` | Same resource permission. `{action:"COMPLETE"}` or `{action:"CANCEL"}`. Completion is a report, not adherence verification. |
| PATCH | `/notifications/:id` | Recipient only. `{}` marks as read. |
| PATCH | `/settings` | Owning patient. `{language:"en"|"hi", timezone:"Asia/Kolkata", largeText:boolean}`. |

Permissions are `READ`, `TEACH_BACK`, `REMINDERS`, and `CLARIFY`. `READ` is required for any family grant. Clinicians are not provisioned through registration. Newly registered invitation recipients begin as patients and become family members on acceptance.

## Extraction structure

```json
{
  "instruction": {
    "kind": "MEDICATION",
    "title": "Demo Medicine A",
    "medicationName": "Demo Medicine A",
    "dose": "one",
    "unit": "tablet",
    "route": null,
    "frequency": "twice daily",
    "timing": "after food",
    "duration": null,
    "followUpAt": null,
    "sourcePassage": "Take one tablet of Demo Medicine A twice daily after food.",
    "sourceLocation": "Page 1",
    "sourceUnclear": false
  },
  "reviewed": true
}
```

Kinds are `MEDICATION`, `FOLLOW_UP`, `CARE`, `WARNING`, and `CONTACT`. Clinical fields must be literal source values; missing values are null. An explicit follow-up timestamp requires a matching source date, time, and timezone (or exact ISO source timestamp). The API never infers a time from a date alone.

## Teach-back submission

```json
{
  "instructionId": "current-approved-instruction-id",
  "transcript": "I will take one tablet once daily after food.",
  "inputMode": "TEXT",
  "transcriptConfirmed": true,
  "personType": "PATIENT"
}
```

`inputMode` is `TEXT` or `VOICE`. VOICE requires confirmed transcription. `personType` is `PATIENT`, `ASSISTED_PATIENT`, or `CAREGIVER`; a family account can only submit `CAREGIVER`. Instructions and the exact published version are checked again after slow provider calls, and revoked family access blocks saving the result.

Each finding contains instruction ID, plan version ID, field name, approved value, stated value or `not stated`, supporting quote, validated status, a specific server-generated explanation, and the approved source clarification. Statuses: `MATCH`, `MISMATCH`, `INCOMPLETE`, `UNCLEAR`, `NEEDS_CLINICIAN_REVIEW`. The selected medication is already identified by the question; its name is additionally checked when stated. Checked dose/unit/frequency/timing fields are displayed explicitly. Non-medication live comparisons use the approved `sourcePassage` as a checked field. Non-medication demo comparisons report an explicit unsupported-operation error. No confidence percentages or safety certification are returned.

## Worker status and consistency

Document jobs use `QUEUED`, `RUNNING`, `SUCCEEDED`, or `FAILED`. Source documents expose `QUEUED`, `READY`, or `FAILED` and a sanitized failure code. Failures such as `OCR_UNAVAILABLE_MANUAL_ENTRY_REQUIRED` and `DEMO_UNSUPPORTED_SOURCE` are visible to the clinician. Processing never publishes a plan.

Plan publication, invitation consumption, grant changes, teach-back findings, clarification replies, and reminder delivery use database transactions. Job claims and notification dedupe keys permit safe retries. The audit table records actor IDs, action names, resource IDs, and timestamps; it contains no medical text or credential material.
