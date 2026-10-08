# CareBodha / Matter redesign

Reference: [Matter Immersive](https://www.aura.build/templates/matter-immersive), by Aksonvady Phomhome. Inspected on 8 October 2026: the template page's embedded public preview, the [full public preview](https://matter-immersive.aura.build/), desktop and mobile viewport rendering, hero markup, CSS, and the Three.js module exposed in the preview iframe's `srcdoc`.

The Copy code control redirects to Aura sign-in. No authenticated export was obtained. The publicly rendered HTML revealed the exact fonts, color tokens, gutter, editorial composition, and sculpture implementation. Its blade geometry, glass/chrome material settings, six-strand spine, and orientation math were adapted directly into the existing lazy-loaded Three.js component. Aura wrapper scripts, analytics, custom cursor, fixed scroll chapters, physics gallery, and unrelated studio pages were not imported.

## Shared system

- Archivo 400/600/800/900 and Instrument Serif italic, self-hosted with their SIL Open Font License files. Hindi retains the existing system font fallback.
- Pearl `#f3f2ee`, ink `#0a0a0b`, electric blue `#2a5bff`; darker blue `#234ee0` on smaller interactive text. Semantic green/amber/red remain readable on light surfaces.
- Landing uses a 4vw desktop gutter, two oversized black lines with a generous interval, diagonal segmented glass, upper-right supporting copy, lower-left italic serif, right-side calls to action, minimal navigation, and thin rules. The longer CAREBODHA headline is scaled to fit its content.
- Shared buttons, forms, status chips, panels, source disclosures, language tabs, app navigation, and headings use the same tokens. Clinical instructions remain normal case and large; original source instructions stay available.
- Mobile uses a 6vw gutter, readable supporting copy below the sculpture, 48px patient actions, and a single-column content flow. Native scrolling and the system cursor remain intact.

## Screen coverage

Landing, sign-in, registration, invitation acceptance, patient dashboard, approved care plans and individual instructions, teach-back and findings/history, follow-up visits, family assistance, clarification requests, notifications, settings, clinician overview/upload/extraction review/bilingual approval, and family workspace share the new design.

Authentication, API handlers, database schema, worker, source grounding, approval gates, version logic, voice confirmation, and granular permissions were preserved. No backend files or migrations were changed by this redesign.

## Motion and accessibility

The ribbon uses instanced geometry, capped pixel ratio, fewer mobile segments, and pauses rendering while off-screen or the document is hidden. It is decorative and cannot receive pointer events. Its static SVG is available during loading, WebGL failure/context loss, and reduced motion; reduced motion avoids allocating WebGL resources and responds to preference changes. There is no scroll hijacking.

The motion follow-up adapts MATTER's actual entrance and sculpture timeline: first-line masked rise (1s), second-line horizontal stretch (1.15s after .55s), individual blurred/rotated letters (55ms/45ms stagger), serif wipe (1.25s after 1.35s), and supporting-copy reveal (1s after 2.05s). Native scrolling drives a CSS sticky hero: damped text exit, velocity-sensitive stretch, ribbon expansion, staggered blade-to-grid morph, depth flight, and light-to-dark glass emission. The four sculpture phases are compressed into 2.3 desktop / 1.8 mobile viewport lengths of scrolling. The preview's full unrelated gallery/typography/physics chapters are not duplicated.

Pointer movement now pushes individual glass pieces with the source's spring force and torque. CTA letters use the source's magnetic spring parameters with bounded displacement so their targets remain stable. MENU opens and closes through the source's .95s circular clip reveal, with staggered links, Escape/focus restoration, and inert background content. Section headings and editorial rows reveal on intersection. Reduced motion removes the pinned chapter length, letter reveals, magnetic motion, and WebGL; GPU failure also falls back to a short static hero.

MENU is a keyboard-accessible disclosure: it focuses its first link, closes on Escape, restores button focus, and exposes working section and authentication links. Shared controls retain labels, visible focus outlines, disabled states, and status messages. The keyboard skip link remains first.

## Evidence

Screenshots in `docs/screenshots/` capture the landing and application at desktop and 390px mobile widths. `landing-motion.webm` records the entrance, pointer response, expansion, grid, depth, and circular menu; stills preserve each scroll phase. Playwright checks actual pinned scroll progress, intro completion, menu animation, dynamic reduced-motion switching, mobile section navigation, overflow, WebGL failure, authentication and medical workflows. The preview's host visually scales its iframe on mobile; CareBodha instead uses a readable responsive layout.

## October 9 refinement and normal account environment

Re-inspected the public MATTER srcdoc, especially the two moving text lines and letter zoom (p=4–7), gallery positions/rotations, perspective typography with per-character depth, physics suspension/gravity, final torus rings, 8px cursor/40px trailing ring, and two-column circular menu. Copy code still requires Aura sign-in; the accessible public implementation was adapted directly.

The landing now carries those motion ideas into CareBodha: the missing dark second chapter moves CARE SHOULD / FEEL CLEAR sideways and zooms through CLEAR; a three-step sculptural gallery scrolls between Understand / Explain back / Clarify; Read / Listen / Explain / Clarify travel through perspective; family shapes respond to the pointer and scroll gravity; the final call to action uses animated concentric torus rings. Headings reveal individual letters and preserve complete words when wrapping. The first hero composition is retained.

The menu uses numbered editorial links, fine rules, serif/blue supporting copy, account actions, and responsive spacing. Native anchors and scrolling work. Escape and both directions of keyboard focus wrapping work without hiding the focused control. The fine-pointer dot/ring uses difference blending and expands over links; editable inputs retain the system cursor. Touch and reduced motion use the native pointer, static sculptures, readable text and short unpinned sections. Navigation and body copy use explicit high-contrast surfaces.

Visible language controls were added to the landing, authentication and workspace headers, with English, Hindi, Bengali, Odia, Telugu, Punjabi and Tamil. Primary navigation/auth labels are localized; explanatory marketing and some clinical-workflow labels remain English. Clinical text is never automatically translated on selection. Missing reviewed translations have an explicit English fallback notice. Clinicians can draft/review all seven languages; optional unreviewed drafts remain private after approval.

The account environment now defaults to normal, with a separate empty database and private storage. Email/password sign-in uses the app’s password without OTP. Manual document processing preserves original source paragraphs and requires clinician entry/approval. Manual teach-back creates a real review request and notification. Live AI remains an optional configured integration. Backend approval, source grounding, version immutability and family permissions remain enforced; no schema migration was needed for the additional languages.

New screenshots: refined-matter, refined-menu-desktop/mobile, refined-gallery, refined-typography, refined-family, refined-final and normal-bengali-plan. These supersede the earlier notes about omitting later chapters and preserving only the native cursor. CareBodha retains native scrolling rather than adopting the reference’s 22-viewport fixed global scene; its chapter lengths and care content are intentionally adapted.

## Medical equipment and middle-section composition

The user-approved first hero, dark text chapter, and final rings/call to action are retained. The abstract gallery objects are replaced with code-built Three.js models of a stethoscope, blood-pressure monitor with cuff, and IV stand. Blue tubing, reflective metal, pearl housings, and a translucent IV bag connect the hospital equipment to the existing Matter palette. The monitor has an unmeasured display, with no invented patient reading. Self-contained SVG equipment silhouettes remain available during reduced motion and WebGL failure.

The public preview was inspected again for its gallery, typography and physics layout: gallery titles use roughly 8.6vw type, the depth words use 21vw and a 900px perspective, and physics places a 6.4vw headline at 22vh above a lower corner interaction hint and opposite statistics. CareBodha now follows those proportions more closely. The gallery uses damped scroll progression and mouse dragging alongside its keyboard-accessible step buttons. Object rotation remains restrained enough to keep equipment recognizable. The duplicate three-card explanation is removed so the gallery flows directly into perspective typography.

Teach-back uses a full-height editorial composition with thin rules, a heavy uppercase heading and blue italic serif text. Its fictional example, checked-answer feedback, speech, retry, and app links remain functional. Family assistance is now a sticky full-screen equipment physics scene with pointer repulsion, an explicit scatter button, and a return toward resting positions after scattering. Permission copy and the link into actual family assistance remain readable and accessible. Reduced motion presents static equipment and removes the decorative scatter action. Mobile permission labels and section anchor positions were checked for clipping and overlap.

No authentication, API, database, medical-processing or authorization logic changed in this refinement. New evidence is saved as `medical-gallery-1/2/3-desktop.png`, `medical-gallery-mobile.png`, `medical-gallery-fallback.png`, `medical-teachback-desktop.png`, and `medical-family-desktop/mobile.png`.

### Exact Matter Finale follow-up
The second-last support chapter adapts the public template's exported Finale and procedural studio-light shader directly. It keeps the centered black composition, 80 thick glass triangles, chrome core, staggered outward expansion, shrinking faces and particle dissolve. CareBodha text and a family-assistance link occupy that composition. Chapter intervals correspond to the reference's 18–21 timeline; the final CTA keeps its approved ring composition. Native scrolling drives the timeline, and keyboard focus brings hidden incoming actions into view.

The conversation chapter now assembles Read / Explain / Clarify with readable pauses, black type, blue italic accents and a small progress rail. The second-to-third handoff finishes the CLEAR mask with a pearl wash; the third-to-fourth uses coordinated outgoing and incoming opacity and vertical movement. Reduced motion skips these transitions and presents the content in normal document flow.

The closing handoff now uses sequential document flow rather than a negative-margin crossfade. The outgoing shell/particles must be fully cleared before the incoming page can reveal. The finale retains the reference sculpture and uses a plain gold-dot/ring cursor without the earlier enlarged SCROLL label.
## Short closing timeline and adjacent handoffs

The hero/gallery handoff now shares a viewport; gallery/conversation and conversation/teach-back overlap only during their outgoing/incoming motion. These transitions preserve native wheel and touch scrolling. The last conversation word holds until the teach-back section enters.

The dark finale uses a sticky shared viewport and 240px of native scroll travel rather than several screen heights. Its outgoing shell fully clears before the brighter final call to action appears. SCROLL DOWN also works as a direct keyboard-accessible transition. Reduced motion uses stacked sections and static artwork. No medical, account, or permission logic changed.
## Teach-back to pearl transition and slower burst

The fifth section gently dims and lifts as the dark glass scene fades and scales into view. A disappearing edge mask softens the incoming section boundary; it is fully open once the scene fills the viewport. Reduced-motion preference restores the stacked static layout.

The 240px native scroll distance remains, but animation progress now advances at a bounded rate. A quick wheel gesture cannot skip the shell and particle stages: breakup unfolds over approximately two seconds before the final page appears. Reverse scrolling remains responsive and the final call to action waits for the scene to clear.
