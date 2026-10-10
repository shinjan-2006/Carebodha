# Phone sign-in and medicine reminders

Password sign-in remains enabled. A patient first registers with email/password, then verifies their own E.164 phone number in **Language & access**. Subsequent sign-in can use a six-digit phone OTP. Codes expire after five minutes with three verification attempts; the existing authentication rate limits still apply. Patient sign-up cannot grant medical-expert access.

To activate real SMS delivery, configure these **server-only** production environment variables, then redeploy:

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<account SID>
TWILIO_AUTH_TOKEN=<secret>
TWILIO_MESSAGING_SERVICE_SID=<messaging service SID>
```

Keep secrets in Vercel Secret environment variables and a gitignored local `.env`. Configure the messaging service to support the destination country and the provider's sender/template requirements. There are no fixed, developer-visible or bypass OTP codes. Without a configured provider, phone features show their unavailable state and password sign-in continues working.

Patients explicitly opt into SMS after phone verification. Reminder messages can contain the approved medicine name, and the consent label explains this. Users choose reminder times; the app does not infer dosing times or change a prescription. One-time and daily reminders for 7 or 30 days are available, with a maximum of 90 scheduled reminders per request. Multiple daily dosing times can be scheduled as separate batches. In-app notifications remain available.

On Vercel, each reminder starts the existing durable reminder workflow. Locally, run `node --import tsx scripts/worker.ts`. The worker validates that the instruction still belongs to the currently published version, creates the in-app notification, and sends SMS only to the patient's verified number while consent remains enabled. A database claim prevents duplicate SMS during retries. Ambiguous delivery failures are not retried automatically. `SENT` means the provider accepted the message, not confirmed handset delivery.

Automatic teach-back compares explicit answers against the published instruction. Recognized quantities, units and frequencies can match or mismatch automatically. Negation, contradictory answers and unclear source instructions are never marked understood; unsupported freeform comparisons remain eligible for clinician review. Medical translations remain clinician-reviewed: when none is published, Listen reads the existing English instruction in English.
