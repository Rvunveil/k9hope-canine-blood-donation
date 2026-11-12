# Open-source readiness audit

Prepared on the `feature/k9hope-landing` branch, November 2026. These are findings from reading the repository. Nothing below has been changed in production. Items marked **Owner decision** need a maintainer to act.

## Blocking before announcing K9HOPE as open source

### 1. No licence is declared — Owner decision
- There is no `LICENSE` file. GitHub's API reports `license: null`.
- `README.md` and `package.json` say MIT, and `package.json` also has `"private": true` (this only stops npm publishing; it does not affect the licence).
- Without a `LICENSE` file, the code is legally "all rights reserved", whatever the README says.
- **Action:** the copyright holders agree on a licence and add a `LICENSE` file. If MIT is intended, the copyright line needs to name the right holder(s); the README currently says "© 2025 RIT Chennai CSE Department".

### 2. Firestore security rules allow anyone to read and write — Owner decision
- `firestore.rules` contains `allow read, write: if true` for user and request collections ("Temporarily allow all access for development").
- If these rules are deployed, anyone with the public Firebase config can read or change donor and owner records.
- **Action:** check which rules are live in the Firebase console, then restrict access by authenticated role before promoting the site.

### 3. Client-side session cookies can be forged — Owner decision
- `context/UserContext.tsx` encrypts the session cookie with `NEXT_PUBLIC_COOKIE_ENCRYPT_KEY`, which is shipped to every browser, and falls back to a hard-coded key.
- `middleware.ts` only checks that `userId` and `role` cookies exist.
- **Action:** move session handling to the server (for example Firebase Auth ID tokens verified server-side).

### 4. Fresh clones cannot install — Fix needed
- `package.json` depends on `@firebasegen/default-connector` via `file:dataconnect-generated/js/default-connector`, but that folder is not in the repository.
- The `firebase` package itself is only installed transitively through that missing folder.
- **Action:** commit the generated connector (or remove the dependency) and add `firebase` as a direct dependency.

## Accuracy issues to resolve before publicity — Owner decision

The README, `NOVELTY.md`, `package.json` and code comments make claims that the new website deliberately does **not** repeat until they are confirmed:

| Claim in repository | Concern |
|---|---|
| Team listed as Vikram T, Prem Kumar, Ramkishore, faculty mentor Pandithurai O (RIT Chennai) | The website brief lists Vikram T, Adithya T and Trisha Pal. Please confirm who should be credited and update README, `package.json` and `NOVELTY.md` to match. Faculty and earlier contributors may deserve acknowledgement. |
| "Exclusive partnership" with Madras Veterinary College | Not shown on the website. Only publish with written confirmation from MVC. |
| "India's first" | Not verifiable; omitted. |
| 12-minute matching, 98% success, 8% wastage | These come from simulation in the project report. If used, label them as simulation results. |
| Python OCR + NLP engine | No Python code is in the repo. Document triage calls a Gemini multimodal model (`app/api/ocr-flag`). |
| Haversine 10 km matching | Implemented in `lib/veterinary/geospatialMatching.ts` but not imported by the app. Live requests are filtered by blood type and city. |
| "DAHD 2025" eligibility automation | Rules exist in `lib/veterinary/dahdCompliance.ts` (not imported) and in donor onboarding validation. A veterinary reviewer should confirm the thresholds and the SOP citation. |
| ZICP stock advisor | Runs on synthetic demand data. Its note cites "Pandithurai et al., iCONNECT 2026" while the featured paper is IEEE ICDSBS 2026; please confirm the correct citation. |
| Contact `k9hope@ritchennai.edu.in` | Not used on the website; confirm it is monitored before publishing. |

## Community files

| File | Status |
|---|---|
| `README.md` | Present; needs the accuracy fixes above |
| `CONTRIBUTING.md` | Present; refers to a code of conduct that did not exist |
| `CODE_OF_CONDUCT.md` | **Added** (Contributor Covenant 2.1 by reference). Needs a maintainer contact email. |
| `SECURITY.md` | **Added**. Enable private vulnerability reporting in repository settings. |
| Issue templates | **Added** (bug, feature, security contact link) |
| Pull request template | **Added** |
| `ROADMAP.md` | **Added**, all items marked planned |
| `env.template` | Present. Lists `NEXT_PUBLIC_GEMINI_API_KEY`, but the code reads `GEMINI_API_KEY` (server-only); update the template and never expose AI keys with a `NEXT_PUBLIC_` prefix. Uploadcare, Resend and phone/email verification variables should be documented. |

## Housekeeping
- Remove committed scratch files: `build.log`, `seed_out.txt`, `tmp_seed_output.txt`, `app/app/(donor)/d/profile/page.txt`.
- `next.config.ts` ignores TypeScript and ESLint errors during builds; consider turning these back on once errors are fixed.
- `app/api/chatbot/route.ts` logs the first characters of the Gemini API key at module load; remove that log.
- `app/layout.tsx` references `/og-image.png` and `/k9hope-logo-192.png`, which are not in `public/`.
