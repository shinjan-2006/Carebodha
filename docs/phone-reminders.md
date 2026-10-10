# Phone sign-in and medicine reminders

With a configured phone OTP service, patient/family sign-in uses only a six-digit code sent to a registered, verified number. New patients enter their name and username and verify their phone before an account or patient profile is created. Share the username with the medical expert to assign care. Medical-expert accounts retain administrator-provisioned password access.

## Twilio Verify (OTP, including eligible free trials)

Set these server-only environment variables locally and in Vercel Production, then redeploy:

```
PHONE_OTP_PROVIDER=twilio-verify
TWILIO_ACCOUNT_SID=<account SID>
TWILIO_AUTH_TOKEN=<secret>
TWILIO_VERIFY_SERVICE_SID=<Verify service SID>
```

Use Vercel's **Secret** type for the auth token. Keep the local `.env` ignored by Git. Twilio generates and checks the OTP; CareBodha never displays a code or provides a fixed-code bypass. Challenges expire locally after five minutes, permit three verification attempts, and are consumed once. Sending is rate-limited to two requests per minute per IP. Verification is also rate-limited. Expired, exhausted, consumed or provider-rejected codes never create a session.

An existing patient who registered with email/password must verify their phone in **Language & access while still signed in** before using phone login. Do not create a second account to migrate an existing patient. If phone OTP is not configured, legacy password access remains available; once configured, patient password endpoints are rejected server-side. Expert password endpoints remain available.

Twilio's trial currently supports a limited number of verified tester phones and expires after 30 days. It is a testing service, not unrestricted public patient registration. Check the current [Twilio trial rules](https://www.twilio.com/docs/usage/trials) before enabling it. No paid upgrade is performed by the application.

## Medicine reminder SMS (separate capability)

Verify does **not** send custom medicine reminders. To activate those, configure a messaging service that supports custom messages and the destination country's requirements:

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<account SID>
TWILIO_AUTH_TOKEN=<secret>
TWILIO_MESSAGING_SERVICE_SID=<messaging service SID>
```

Until then, in-app reminders continue working and SMS-reminder controls explain why they are unavailable. Patients explicitly opt into SMS after phone verification. Messages can contain the approved medicine name. Users choose reminder times; CareBodha does not infer dosing times or change prescriptions. One-time and daily reminders for 7 or 30 days are available, with at most 90 scheduled reminders per request.

On Vercel, each reminder starts the durable reminder workflow. Locally, run `node --import tsx scripts/worker.ts`. Before delivery, the worker validates the current published plan and checks the verified number and consent. A database claim prevents duplicate SMS during retries. Ambiguous delivery failures are not retried automatically. `SENT` means provider acceptance, not confirmed handset delivery.

Automatic teach-back compares answers against published instructions. Recognized quantities, units and frequencies can match or mismatch automatically. Negation, contradictory answers and unclear source instructions are never marked understood; unsupported freeform comparisons remain eligible for clinician review. Translations remain clinician-reviewed: when none is published, Listen reads the approved English instruction in English.

## Tests

`pnpm test` covers the SMS and Verify transports with mocks. To run the real auth-handler lifecycle against a **local isolated database** (mocked SMS only), migrate a database named `carebodha_normal_test`, set `PHONE_AUTH_TEST_DATABASE_URL` to its localhost URL, and run `pnpm exec vitest run tests/phone-auth.integration.test.ts`. This test never contacts Twilio and does not establish handset delivery.
