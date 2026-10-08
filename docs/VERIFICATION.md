# Verification record

Verified locally on 8 October 2026 using Windows, Chrome, a real UTF-8 PostgreSQL database, Next.js, and the separate worker. This report describes application behavior with fictional data, not clinical validation.

## Evidence so far

| Boundary | Evidence |
| --- | --- |
| Authentication and sessions | Real browser/API sign-in, registration, and logout; registration cannot grant clinician privileges. |
| Authorization | Other patients denied; family requires active granular grants; private documents require an assigned clinician. |
| Source → worker → draft | Manual fixture extraction and actual PDF parsing persist drafts in PostgreSQL, with page references and private file keys. |
| Draft → approval → patient | Patient cannot retrieve drafts; missing reviews block approval; publication exposes the exact reviewed version. A new draft preserves the previous approved version. |
| Teach-back → findings | Explicit dose/frequency mismatches, incomplete/unclear answers, supportive evidence quotes, correct retry, and historical version references. Invalid AI identifiers, claims, statuses, and quotes are rejected. |
| Voice → confirmation | Browser UI exercised with a simulated speech-recognition transcript; unchecked/edited transcripts cannot submit. Server rejects unconfirmed VOICE attempts. Real microphones/transcription services were not used. |
| Family consent | Hashed token storage, single-use acceptance, expiry, separate caregiver attempts, and immediate server denial after grant revocation. |
| Clarification | Patient question → assigned-clinician reply → resolved database record and in-app notification. |
| Reminder | Worker-created notification exactly once; read state and reported completion remain separate. |
| Restart | Actual web/worker stop and restart; API response matched persisted records: six teach-back attempts, two plan versions, and one resolved clarification for the initial acceptance fixture. |
| Production build | Next.js webpack build compiled and generated all routes successfully. A final build is rerun after final changes. |

The first run passed 19 medical-boundary unit tests and 12 browser/API tests. Expanded checks exposed and fixed two issues: database files repeatedly triggered the development watcher, and patient selection needed to persist through clinician/family navigation. The clinician browser now confirms extraction plus both languages before publishing. Final command results will be appended below after the complete suite finishes.

## Visual and interaction checks

The original build used the public AI Studio page. The current redesign follows the user's new [Matter Immersive reference](https://www.aura.build/templates/matter-immersive). Its public embedded preview and full preview were inspected before edits, including desktop/mobile rendering, CSS, hero markup, and the publicly embedded Three.js source. Copy code requires Aura sign-in; the exposed preview geometry and materials were adapted directly. See [DESIGN.md](DESIGN.md) for source and implementation details.

Desktop and 390×844 mobile views were inspected. Pearl surfaces, heavy black Archivo headings, blue accents, italic Instrument Serif, and thin dividers carry across authentication and all three roles. Playwright checks desktop/tablet/mobile navigation and horizontal overflow, readable Hindi instructions, keyboard skip/focus and MENU behavior, reduced motion, WebGL-unavailable static ribbon, and the interactive fictional demo. Primary workflow controls are exercised against real backend responses. Browser screenshots are saved in `test-results/`; presentation evidence is preserved in `docs/screenshots/`.

## Integrations not tested

- Live AI provider calls, model-specific compatibility, real extraction quality, and Hindi clinical equivalence beyond the reviewed fictional fixtures.
- Enabled Tesseract OCR and its downloaded English/Hindi language data; disabled-OCR/manual-entry behavior is implemented.
- S3/object-storage credentials, deployment access policies, durable hosted volumes, and hosted worker lifecycle.
- Actual microphone recording, external browser speech-recognition services, and audible Hindi playback on this device. Voice UI confirmation was simulated; approved text is available throughout.
- Docker execution, because Docker is not installed in this workspace host. Migrations ran against local PostgreSQL; Docker Compose configuration is supplied.
- Email, SMS, and push delivery (no providers are configured or delivery claims made).
- Public website deployment, independent penetration testing, clinical validation, and healthcare regulatory-compliance assessment.

The OpenAI-compatible adapter has bounded retries/timeouts, server-only credentials, `store:false`, schema/source validation, and explicit failure states. Those controls do not establish clinical accuracy, zero provider retention, or regulatory compliance.

## Final results

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | PASS — both PostgreSQL migrations applied, including finding/responder/completion foreign keys. |
| `pnpm db:generate` | PASS — Prisma client generated after releasing Windows runtime DLL locks. |
| `pnpm typecheck` | PASS — no TypeScript errors. |
| `pnpm test` | PASS — 23 tests; provider calls mocked for validation/timeout checks, with no paid API calls. |
| `pnpm test:e2e` | PASS — 16 real browser/API/database tests, 42.4 seconds in the final complete run. |
| `pnpm build` | PASS — optimized Next.js build; all public, authentication, application, and API routes compiled. |
| Actual web/worker restart + `pnpm verify:restart` | PASS — persisted attempts, published versions, and resolved questions matched real API responses. |

Rapid role-switching tests respect Better Auth's default sign-in throttling (including its retry interval). Authentication protections were not disabled for testing. No automatic reset or authentication bypass endpoint was added.

After the final mobile presentation review, irrelevant medication fields were removed from follow-up/contact cards, and medication cards gained the exact missing-information message. TypeScript and the production build passed again. Two patient/mobile browser smoke tests also passed against the running production preview (5.5 seconds). Refreshed desktop/mobile screenshots reflect that final presentation.

The final production-preview restart check passed with six persisted attempts, three persisted plan versions, one resolved clarification, and matching API/database counts. `prisma migrate status` confirmed the database schema is up to date. The documented Windows pnpm wrapper returned version 11.25.0 successfully.

## Matter redesign verification

After the UI redesign, TypeScript and the optimized production build passed. All 23 medical-boundary tests and all 17 browser/API/database tests passed (28.7 seconds for the production browser suite). The extra browser check covers the desktop/tablet MENU links, demo destination, and WebGL failure independently of reduced motion. The mobile check verifies Escape/focus restoration, the static ribbon, Hindi care instructions, and native scrolling without horizontal overflow. Production sign-in, mismatch/correct retry, voice confirmation, clinician review, and the full authorization/upload/family/reminder suite passed with the original backend unchanged.

The initial development run caught a duplicate heading selector and transient navigation failures while the application was rebuilding. The selector was narrowed to the exact hero heading; the complete suite then passed against the production build. Auth throttling, permissions, safety checks, and clinical assertions were retained.

## Motion follow-up

The public MATTER module and CSS were inspected again for actual entrance timing, camera/FOV, damping, spring parameters, menu clip transitions, and scroll phases. The landing now includes staggered blurred letters, masked rise/horizontal stretch, serif wipe, supporting-copy entrance, magnetic CTA letters, native sticky scroll progression, velocity-sensitive type stretch, blade expansion/grid/depth morph, cursor forces, and circular menu opening/closing. Reduced motion and GPU failure skip the long pinned sequence.

Final production verification: optimized build and TypeScript PASS; 23 medical-boundary tests PASS; all 19 end-to-end tests PASS (50.1 seconds). New checks exercise actual intro completion, pinned hero bounds and scroll progress, grid/depth phases, circular menu animation, live preference switching, mobile section navigation, and accessible CTAs. The full authentication/upload/approval/family/teach-back suite remained intact. A demo-link regression caused by pointer focus triggering keyboard scroll recovery was fixed and the original test passed again.

`docs/screenshots/landing-motion.webm` records the final browser animation, and `motion-expansion.png`, `motion-grid.png`, `motion-depth.png`, `motion-menu.png`, and `motion-how.png` capture the sequence. The four sculpture phases use a shorter scroll distance than the full studio template; unrelated gallery/physics chapters were not introduced into the healthcare application.

## October 9 refinement and normal account mode

This refinement supersedes the earlier omission of the later Matter chapters. The public embedded source was inspected for the opposing text/letter zoom, scrolling sculpture gallery, perspective typography, floating shapes, final rings, trailing cursor, and menu timing. These are now adapted to CareBodha with native scrolling, readable settled text, keyboard menu navigation, responsive layouts, static GPU fallbacks, and reduced-motion alternatives. An authenticated template export was unavailable. Scroll distances and healthcare copy remain adapted rather than identical to the studio preview.

The active localhost environment now uses a separate persistent `carebodha_normal` database, password authentication, private normal-mode storage, and a running worker. It had zero accounts when activated. Existing demo data is preserved in its separate database and the saved, ignored `.env.demo`; it was not reset. No Google OAuth or OTP setup is required. New registrations create patient accounts without sample care plans; clinician access is provisioned through the documented controlled process.

Visible language selection supports English, Hindi, Bengali, Odia, Telugu, Punjabi, and Tamil across landing, authentication, and application screens. Selection persists; patient settings also persist in the database. Core navigation/authentication labels are localized. Some explanatory interface copy remains English. Care instructions only display clinician-approved translations, with an explicit approved-English fallback when the selected translation is unavailable.

| Check | Final result |
| --- | --- |
| TypeScript and optimized production build | PASS after the final application changes. |
| Unit tests | PASS — 26 tests, including manual processing without invented medical values or translations. |
| Original full-stack browser suite | PASS — 17 checks for authentication, uploads, approval, teach-back, family permissions, notifications, and clinician review in the isolated demo environment. |
| Motion and responsive browser checks | PASS — 3 checks against the final normal-mode production app, including the missing chapters, cursor, desktop/mobile menu, keyboard focus, native scrolling, and reduced motion. |
| `pnpm verify:normal` | PASS — an additional end-to-end check in the separate `carebodha_normal_test` database: real password registration/session, empty initial account, private upload/worker extraction, source review, seven language drafts, reviewed-only publication, language persistence/fallback, teach-back review queue, clinician response, and persisted notification. |
| Desktop/mobile visual capture | PASS — complete sequence recorded, with readable gallery captions and password sign-in screenshots. |

Together these cover 26 unit tests and 21 distinct browser checks across the isolated environments. Fictional test records remain in their test/demo databases; none were seeded into the active normal account database. The active provider is `manual`: exact source paragraphs become drafts and teach-back answers enter clinician review. Automated AI provider calls require credentials and were not exercised. Medical approval, original instruction access, and family permission checks remain enforced.

Evidence: [complete motion recording](screenshots/refined-motion.webm), [desktop menu](screenshots/refined-menu-desktop.png), [mobile menu](screenshots/refined-menu-mobile.png), [second text chapter](screenshots/refined-matter.png), [gallery](screenshots/refined-gallery.png), [perspective text](screenshots/refined-typography.png), [floating shapes](screenshots/refined-family.png), [final rings](screenshots/refined-final.png), [desktop password sign-in](screenshots/normal-signin-desktop.png), [mobile password sign-in](screenshots/normal-signin-mobile.png), and [approved Bengali plan](screenshots/normal-bengali-plan.png).

## Medical equipment follow-up

The abstract gallery and family physics shapes were replaced with recognizable stethoscopes, blood-pressure monitors/cuffs, and IV stands. The first hero, second dark text chapter, and final rings scene were retained. The public Matter embedded preview was inspected again for gallery title/object proportions, 21vw typography with 900px perspective, and the full-screen physics composition; no authenticated template export was available. Gallery movement now includes damped native scrolling and mouse dragging. The repeated card explanation was removed; teach-back and family assistance retain their actions in editorial layouts.

Final checks for this change:

- TypeScript and optimized production build: PASS.
- Four browser checks against the final production build: PASS (39.1 seconds), including gallery button selection and dragging, equipment fallback, mobile permission rail visibility, existing hero/second/outro motion, menu focus, native scrolling, interactive teach-back, and reduced-motion preference switching.
- Desktop/mobile capture of all three gallery models, teach-back and family assistance: no page errors or horizontal overflow.
- React review: heavy rendering remains dynamically loaded and mounted near the viewport; animation frames, observers, event handlers, materials, shared geometries and environment textures are cleaned up; clinical controls and navigation retain accessible labels.
- `git diff --check`: PASS. Backend/auth/database logic was untouched by this visual follow-up; the earlier full-stack verification remains applicable.

Screenshots: [stethoscope gallery](screenshots/medical-gallery-1-desktop.png), [monitor gallery](screenshots/medical-gallery-2-desktop.png), [IV stand gallery](screenshots/medical-gallery-3-desktop.png), [mobile gallery](screenshots/medical-gallery-mobile.png), [static equipment](screenshots/medical-gallery-fallback.png), [teach-back](screenshots/medical-teachback-desktop.png), [family scene](screenshots/medical-family-desktop.png), and [mobile family scene](screenshots/medical-family-mobile.png).

## Medical expert sign-in and direct care assignment — 9 October 2026

- Added `/expert/signin` and `/expert`, plus a patient/family versus medical-expert sign-in selector and a landing-menu entry. All accounts use the app password; no Google OAuth or email OTP is required.
- The Better Auth username plugin adds optional, case-insensitive, immutable usernames. Existing email accounts still work and can choose a username once in Language & access. A non-destructive migration adds the nullable unique User.username column.
- Authorized clinicians use Connect patient to assign an exact registered email or username immediately, without patient acceptance. The assignment, audit record, and one patient notification persist in a transaction; repeat connections are idempotent. Wrong-role, unauthenticated, unknown, and cross-environment targets are rejected. Public signup still cannot create medical-expert privileges.
- Three isolated normal-mode browser/API/database stories passed: expert username login through immediate assignment and reviewed care publication; existing-account username selection and role restrictions; patient registration, private uploads, seven languages, approval, teach-back, and clinician clarification. No normal user records were reset. Expert provisioning remains the documented operator command.

## Matter closing scene and chapter handoffs — 9 October 2026

- Inspected Aura's public embedded preview and its available HTML export. Adapted the exported Finale geometry, hash/stagger, shader studio environment, materials, radial expansion, chrome core, points, bloom curve, and 18–21 chapter intervals directly into local Three.js components.
- The second-last page now uses the centered dark crystalline composition with CareBodha support copy. The shell breaks into 80 faces, expands, shrinks, and becomes particles before the original final CTA appears. Mobile uses the template's lighter material path; reduced motion uses a static illustration and ordinary stacked content.
- Replaced the old Your words matter corridor with Read / Explain / Clarify: large stable black words, electric-blue italic supporting lines, letter assembly, and readable pause intervals. Updated the adjacent teach-back heading to Make sense of your care.
- Added a pearl wash at the end of the second chapter and coordinated opacity/position handoffs from the medical gallery into conversation. First-page composition, approved gallery equipment, final-page composition, app permissions and doctor-approved sources remain intact.
- Fixed initial chapter-height shifting before hydration and keyboard focus alignment at the outro. Checked desktop 1440×960 and mobile 390×844, reverse scrolling, native scrolling, care-step selection/dragging, menu focus, cursor state, and reduced-motion changes. Seven motion browser checks passed in the preview; production verification follows below.

Final production verification: `pnpm build` passed (including TypeScript); 26 existing unit tests passed; all seven landing motion/accessibility checks passed in 56.6 seconds; all three isolated normal-account workflows passed in 13.8 seconds. These checks include immediate expert assignment without patient acceptance, username/email login, private uploads, review/approval gating, language preferences, teach-back clarification, and role/environment restrictions. The normal production site and worker are running at localhost:3000.

Review artifacts: `matter-finale-assembled.png`, `matter-finale-shattering.png`, `matter-finale-particles.png`, `matter-finale-mobile.png`, `matter-finale-static-mobile.png`, `gallery-conversation-handoff.png`, and `matter-closing-motion.webm` under `docs/screenshots/`.

## Closing overlap, cursor, and local test experts — 9 October 2026

Removed the last-page negative margin and gated its reveal until the second-last shell, core and particles are completely cleared. The compact 330svh closing stage keeps native scrolling and avoids both simultaneous scenes and an extended empty handoff. The finale cursor now uses a plain 44px ring and gold dot, without the oversized SCROLL label; it resets as the last page enters.

Added controlled local-only provisioning for three explicitly labeled TEST medical experts. Their individually generated passwords are saved in the ignored `.local-test-doctors.json`; existing accounts are verified, never overwritten. Verified each account through the actual `/expert/signin` UI and confirmed CLINICIAN workspace access. No patient assignments or real records were changed.

The production build passed; all seven chapter, cursor, desktop/mobile, keyboard and reduced-motion checks passed after the final update. Updated the recording at `docs/screenshots/matter-closing-motion.webm` and captured the sequential transition in `closing-no-overlap.png`.
## Local fictional prescription fixtures — 2026-10-09

Created three TEST-only patients and prescriptions in the local normal database, assigned to the three existing test experts. Each plan has one published version and one private draft. Source-grounding checks and the existing application approval service were used; no clinical guard was weakened. All medicines and appointments are explicitly fictional.

TypeScript passed. Running provisioning twice reused existing accounts and records. Live Chrome checks passed for all three expert and all three patient sign-ins, selected-patient prescription visibility, expert draft access, patient draft exclusion, and patient access to original source passages. The login throttle was respected by waiting for its window to expire during verification. Existing records were not reset.
## Landing handoffs and faster closing sequence — 2026-10-09

Removed the empty viewport between the oversized CLEAR transition and the medical-equipment gallery. Added native-scroll fade and movement between gallery/conversation and conversation/teach-back. The final conversation word remains readable until its handoff. Static WebGL fallback and reduced-motion layouts keep ordinary document flow.

The closing chapters share a sticky frame with a 240px scroll distance: two standard 120px wheel steps reach the final page at desktop and mobile widths. The shell bursts earlier; its title and particles clear before final content enters. SCROLL DOWN is a keyboard-accessible shortcut. The final page has brighter blue rings, white main text, and lighter supporting text. The cursor updates when the closing phase changes with a stationary pointer.

Production build and all eight landing browser checks passed (1.1 minutes). Verified desktop/mobile wheel travel, no overlapping support text, scene clearance, cue navigation, keyboard focus, visible controls, reduced-motion switching, menus, and no horizontal overflow. Live recording: docs/screenshots/matter-closing-motion.webm.
## Slower pearl burst and fifth-section fade — 2026-10-09

Added a native-scroll fade, gentle lift/scale, and disappearing edge mask between teach-back and the pearl scene. Limited forward animation progress so a quick scroll cannot skip the roughly two-second shell/particle breakup. The short two-wheel-step scroll range, scroll-down shortcut, scene-clearance gate and reduced-motion static layout remain intact.

Production build passed. All nine landing browser checks passed before the final visual edge refinement; all five chapter-handoff checks passed again afterward (41.3 seconds). Desktop and mobile screenshots were inspected. The timing assertion confirms the final burst no longer completes immediately after the second wheel step, and patient-facing controls and keyboard focus still work. The local closing video was updated to the slower sequence.
