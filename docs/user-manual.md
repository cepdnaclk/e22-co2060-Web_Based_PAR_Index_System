# User Manual — Web-Based PAR Index System

**Team TIMESWARE — CO2060, Faculty of Engineering, University of Peradeniya**

This manual describes the system as actually implemented in the `code/`
directory at the time of writing. It is written from the real frontend
screens and the API endpoints they call (`code/frontend/src/api/api.js`),
not from the original proposal — if a feature described here changes,
update this document alongside the code change.

---

## 1. System Requirements

To run the system yourself (developer/local setup), see
[`DeveloperGuide.md`](DeveloperGuide.md). This manual assumes the system is
already running and reachable in a browser.

- A modern browser with WebGL support (Chrome, Edge, or Firefox recommended)
  — the 3D model viewer uses Three.js and requires WebGL.
- When running via Docker Compose: Frontend at `http://localhost:5173`,
  Backend API at `http://localhost:8081`.

## 2. Accounts and Roles

The system has three roles:

| Role | How the account is created | What it can do |
|---|---|---|
| **ADMIN** | Pre-seeded only — cannot be self-registered. Two accounts ship by default (`e22014@eng.pdn.ac.lk`, `e22035@eng.pdn.ac.lk`) | Full system access: user management, audit log, ML model management |
| **ORTHODONTIST** | Self-register, choose "Orthodontist" | Clinical workflow: patients, cases, STL/OBJ upload, landmarks, PAR calculation, case finalization, reviewing undergraduate submissions |
| **UNDERGRADUATE** | Self-register, choose "Dental Undergraduate" | Submit anonymised 3D scan sets to the ML training dataset |

> The registration form only ever offers Orthodontist or Undergraduate —
> Admin cannot be chosen there by design.

### Logging in
1. Go to the login page.
2. Enter your email and password, then **Sign in**.
3. On success you're taken to the Dashboard.

### Registering (Orthodontist / Undergraduate)
1. From the login page, click **Register**.
2. Fill in full name, email, and a password (**minimum 8 characters**);
   confirm the password.
3. Choose your role (**Orthodontist** or **Dental Undergraduate**).
4. Click **Create account** — you're logged in immediately afterward.

---

## 3. Orthodontist Guide

### 3.1 Creating a patient
1. Go to **Patients** → **+ New Patient**.
2. Fill in **Reference ID*** and **Full Name*** (required), plus optional
   **Date of Birth** and **Contact**.
3. Save. The patient now appears in your patient list.

### 3.2 Creating a case
1. Open a patient's detail page → **+ New Case**.
2. Choose a **Treatment Stage**:
   - **Pre-treatment** — initial assessment before treatment begins.
   - **Post-treatment** — follow-up assessment after treatment completes.
3. The form will warn you if the stage sequence doesn't make sense for
   this patient (e.g. a Post-treatment case is blocked until a
   Pre-treatment case already exists for them).
4. Add optional notes, then create the case.

### 3.3 Uploading 3D models
Each case requires **three files, uploaded together**, before calculation
can proceed:

| Slot | Content |
|---|---|
| Upper Arch | Upper dental arch scan |
| Lower Arch | Lower dental arch scan |
| Buccal View | Buccal (cheek-side) scan |

- Accepted formats: **STL or OBJ**, up to **50 MB** each.
- All three slots are mandatory — the system will not let you calculate a
  PAR score until all three are present.

### 3.4 Landmark detection and review
1. From the case page, request **ML landmark detection** — the system
   proposes landmark positions on the 3D models automatically (a
   geometric, unsupervised detector — no manual annotation needed to get
   a starting point).
2. Review the proposed landmarks in the 3D viewer. Landmarks are grouped
   by arch: **Upper**, **Lower**, and **Buccal**, covering standard PAR
   reference points (e.g. contact-point landmarks per tooth, buccal
   segment landmarks, overjet/overbite/centreline reference points).
3. Edit any landmark by selecting and repositioning it in the 3D viewer if
   the automatic placement isn't accurate.
4. Landmarks can be cleared and re-detected if needed.

> Only **confirmed** landmarks are used to compute the stored PAR score —
> an ML-proposed point that hasn't been reviewed/confirmed cannot silently
> become the official score.

### 3.5 Calculating the PAR score
You have two ways to produce a PAR score for a case, and the system
records which one was used (`score_source`: `MANUAL`, `AUTO_LANDMARK`, or
`ML`):

**A. Manual scoring** — score each of the 7 British-Standard PAR components
yourself, using the on-screen rubric:

| Component | Weight |
|---|---|
| Upper anterior | ×1 |
| Lower anterior | ×1 |
| Buccal left | ×1 |
| Buccal right | ×1 |
| Overjet | ×6 |
| Overbite | ×2 |
| Centreline | ×4 |

For each component the form shows the actual clinical options (e.g.
Overjet: *Positive Overjet* vs *Reverse/Crossbite*; Overbite: *Overbite*
vs *Anterior Open Bite*; Buccal segments: *No crossbite* → *Crossbite
tendency* → *Single tooth in crossbite* → *Two teeth in crossbite*). The
weighted total updates live as you score each component.

**B. Auto-calculate from confirmed landmarks / ML** — once landmarks are
confirmed, the system can compute the PAR score geometrically from them,
or you can request the ML cross-check prediction and apply it as the
case's score. The **ML prediction/cross-check** result is shown with a
confidence indicator (Medium/High) so you can judge how much to trust it
before applying it.

For a **Post-treatment** case with a matching **Pre-treatment** case, the
system also shows a **weighted-PAR-reduction outcome band**:
*Greatly Improved*, *Improved*, or *No Different or Worse* (or *No
Pre-Treatment Reference* if there's no matching pre-treatment case to
compare against).

### 3.6 Finalizing a case
1. Once a PAR score exists (manual or auto), click **Finalize**.
2. A finalized case is locked — it's flagged as **Finalized** (vs
   **Draft**) and records who finalized it and when.
3. If the case can't be finalized yet (e.g. missing score), the system
   tells you why rather than failing silently.

### 3.7 Reviewing undergraduate training submissions
If an undergraduate assigns their submission to you as reviewer (see
§4.2), it appears under your **Training** review queue with status
**Pending**. You can:
- Inspect the submitted models/landmarks.
- **Approve** or **Reject** the submission. A rejected submission skips
  the file-completeness/ground-truth checks that an approval enforces.

---

## 4. Undergraduate Guide

### 4.1 Purpose
Undergraduates contribute anonymised 3D dental scans to build the ML
training dataset used for landmark detection — this is separate from the
clinical patient/case workflow, which is Orthodontist-only.

### 4.2 Submitting a dataset
1. Go to **Training** → new submission.
2. Upload the required 3D model file(s) for the submission.
3. Select an **Orthodontist reviewer** from the list to assign your
   submission for review — a reviewer must be chosen before you can
   submit.
4. Fill in the ground-truth PAR value/details requested by the form.
5. Submit.

### 4.3 Tracking your submissions
- **Training → My Submissions** shows every submission you've made, with
  status: **Pending**, **Approved**, or **Rejected**.
- You can delete your own pending submissions if needed.

---

## 5. Admin Guide

Admin accounts are pre-seeded (see §2) — sign in with one of the seeded
admin emails.

### 5.1 User management
- **Admin → Users** lists all registered users, filterable/grouped by role
  (Orthodontists / Undergraduates).
- For each user you can:
  - **Activate / Deactivate** their account.
  - Change their role (between Orthodontist and Undergraduate — Admin
    accounts are not created this way).
- Admin passwords should be changed from their defaults immediately after
  first deployment, via this same panel.

### 5.2 Audit log
- **Admin → Audit Log** shows a paginated log of login, registration, and
  data-mutation events across the system, with an **"All Actions"**
  filter and a **date-range filter** to narrow the results.
- Every login, register, and data-mutation event is recorded — this is
  the same audit trail referenced in the security review.

### 5.3 ML / model management
- **Admin → ML Status** shows: current model status, latest model
  version, count of approved training datasets, best recorded accuracy,
  and total training runs.
- You can **train** a new model version (specifying epochs, 10–500) from
  the approved training-set dataset.
- You can **roll back** to a previous model version if a new one performs
  worse.
- Metrics per model version are viewable individually.

---

## 6. Common Errors and Troubleshooting

| Symptom | Likely cause |
|---|---|
| "All three model files are required before calculation." | You tried to calculate a PAR score before uploading Upper Arch, Lower Arch, *and* Buccal View files. |
| Model upload hangs or times out | Files are capped at 50 MB each; the upload has a 2-minute timeout on the frontend for large files. |
| "Case cannot be finalised yet." | No PAR score has been produced for the case yet — score it manually or auto-calculate first. |
| Training submission won't submit | An orthodontist reviewer must be selected before submitting. |
| Login fails with a generic error | Check credentials; the exact backend error message is shown when available. |
| You see "DENTIST role is no longer supported" | The system previously had a `DENTIST` role that was merged/retired in favor of `ORTHODONTIST`; any leftover reference to the old role is treated as an error state, not a valid role to select. |

---

## Screenshots

Reference screenshots (already in the repository) for onboarding new
users — see `docs/assets/images/screenshots/`:
`login-register.png`, `dashboard.png`, `patient-management.png`,
`model-viewer.png`, `landmark-detection.png`,
`par-calculation-form.png`, `par-results.png`.

---

*This document reflects the implementation at the time of writing.
Verified against: `code/frontend/src/pages/*.jsx`,
`code/frontend/src/components/*.jsx`, `code/frontend/src/api/api.js`, and
`code/backend/src/main/java/com/parsystem/entity/OrthoCase.java`. If the
UI or API changes, update this manual in the same commit/PR.*
