# Viva Preparation — TIMESWARE, CO2060 Milestone 4

Answers below are written to be simple, technically accurate, and
grounded in the actual implementation — not generic textbook answers.
Practice saying these in your own words rather than reading them verbatim.

---

## Project & Problem

**Q: What problem does your project solve?**
PAR (Peer Assessment Rating) is a standard way to score how well an
orthodontic treatment worked, based on 7 measurements taken from a
patient's dental models. Today it's done manually — a clinician measures
each component by hand on physical or scanned models. That's slow and
depends on the individual doing it. We built a web system that automates
as much of that as possible: upload 3D scans, get landmark points
detected automatically, and get a PAR score either from a rubric-based
manual entry or computed automatically from the confirmed landmarks —
with an independent ML prediction shown alongside for comparison.

**Q: Why PAR specifically, and why orthodontics?**
PAR is a well-established, standardised index (British Standard, 7
weighted components), so it's a well-defined problem to automate — the
scoring rules are fixed and don't require us to invent a new clinical
standard. Orthodontics also gave us direct access to real clinical
feedback from staff at the Dental Hospital, Peradeniya, which shaped
what we built.

**Q: Who is this for?**
Three user types: Orthodontists (the clinical workflow — patients, cases,
scoring), Undergraduates (contribute anonymised scans to grow the ML
training dataset), and Admins (user management, audit log, ML model
lifecycle).

---

## Architecture

**Q: Walk me through the architecture.**
Four services, run together with Docker Compose: a React frontend (with
a Three.js-based 3D model viewer), a Spring Boot backend (REST API, JWT
authentication, role-based access control), a FastAPI ML microservice
(landmark detection + PAR prediction), and a MySQL database. The backend
talks to the ML service over HTTP; the frontend never talks to the ML
service directly.

**Q: Why did you split the ML service out from the backend instead of doing it all in Java?**
Because the ML/geometric-processing work is Python — model loading,
mesh/point-cloud math — and Python's ecosystem for that (and for the
FastAPI service) is a better fit than trying to do it in Java. Keeping it
as a separate service also means the ML service can fail or be
unavailable without taking the whole backend down — the backend logs a
warning and degrades gracefully rather than crashing.

**Q: Why React?**
Component-based UI fit our page structure well (Patients, Cases,
Training, Admin), and its ecosystem has mature libraries for the 3D
viewer (Three.js) and PDF export that we needed.

**Q: Why Spring Boot?**
Strong, well-documented support for exactly what we needed — Spring
Security for JWT/RBAC, Spring Data for the database layer, and a mature
testing framework (JUnit/MockMvc), which is what let us build 123
automated tests with confidence.

**Q: Why MySQL?**
Relational data (patients, cases, landmarks, users, training sets) with
clear foreign-key relationships fits a relational database well; MySQL
specifically because of team familiarity and first-class Docker/Flyway
support.

**Q: Why FastAPI for the ML service?**
Lightweight, async-friendly Python web framework, low overhead for a
service that's mostly doing numeric/geometric work rather than complex
web logic.

**Q: Why Docker Compose?**
Four independent services (frontend, backend, ML service, database) need
to start in the right order and talk to each other on a private network.
Compose lets a fresh clone get the entire system running with one
command, verified ourselves via a clean install.

---

## Security

**Q: How does authentication work?**
JWT (JSON Web Tokens). On login, the backend issues a signed token with
an expiry; the frontend sends it as a Bearer token on every subsequent
request. The signing secret must be at least 32 bytes (enforced at
startup — the app refuses to start with a weak/missing secret) and is
provided via environment variable, never hardcoded.

**Q: How is access control enforced?**
Role-based, enforced server-side with Spring Security annotations (e.g.
`@PreAuthorize("hasRole('ADMIN')")`) on controller methods — not just
hidden in the UI. So even if someone bypassed the frontend, the backend
itself rejects unauthorized requests.

**Q: What roles exist?**
ADMIN, ORTHODONTIST, UNDERGRADUATE. (An earlier DENTIST role was retired
in favor of ORTHODONTIST during development.)

**Q: What other security measures did you take?**
Path-traversal protection on file storage — the `StorageService` blocks
attempts to read/delete files outside its base directory (we have tests
specifically for `../escape.txt`-style attempts). No secrets or `.env`
files are committed to the repository. A dedicated `SecurityReview.md`
document covers this in more depth.

---

## Core Technical Features

**Q: How does STL/OBJ upload work?**
Each case needs 3 files — Upper Arch, Lower Arch, Buccal View — accepted
as STL or OBJ, capped at 50MB each. All three must be present before any
PAR calculation can run; the system blocks calculation otherwise with a
clear message rather than failing silently.

**Q: How does landmark detection work?**
A geometric detector in the ML service analyses the uploaded mesh/point
cloud and proposes landmark positions — this is a rule-based geometric
approach, not a trained neural network, though the "ML model" for PAR
*prediction* (separate from placement) is trained and versioned. The
clinician then reviews and can reposition any landmark in the 3D viewer.
Only confirmed landmarks are used for the automatic PAR calculation —
an unconfirmed ML-proposed point never silently becomes the official
score.

**Q: How do you calculate the PAR score?**
Two independent paths: (1) manual entry — the clinician scores each of
the 7 British-Standard components (upper/lower anterior, buccal
left/right, overjet, overbite, centreline) against the standard rubric,
weighted and summed live; (2) automatic — computed geometrically from
confirmed landmark positions. A separate ML model can also predict a PAR
score directly, shown with a confidence indicator, as a cross-check
against either.

**Q: What does the confidence indicator mean and why did you add it?**
It reflects how much approved training data backs the current ML model
(e.g. a threshold around 500 approved datasets for "high confidence").
We added it because clinical feedback flagged real concern about trusting
an AI-generated score with no context — showing confidence explicitly
is more honest than presenting every prediction with equal weight.

**Q: How does the training-data pipeline work?**
Undergraduates upload scan sets plus a ground-truth PAR value, and assign
an orthodontist as reviewer. The reviewer approves or rejects the
submission; only approved submissions are eligible to be used in the next
model-training run, which an Admin triggers from the ML Status panel
(configurable epoch count, with the ability to roll back to a previous
model version if a new one underperforms).

---

## Testing

**Q: How did you test the backend?**
123 automated JUnit/MockMvc tests across controllers, services, JWT
security, access control, and PAR calculation logic — all passing,
independently re-verified with a clean `mvn clean test` build on
2026-09-24. We also wrote 42 manual test cases covering the full
clinical workflow end-to-end (auth, RBAC, uploads, landmark review,
scoring, admin functions).

**Q: What bugs did you find and fix?**
Logged in `docs/BugLog.md` — 4 bugs total, 3 resolved with documented
cause and fix. [Be ready to name 1–2 specific ones from that file and
explain them in your own words.]

**Q: What's NOT well tested / what are the limitations of your testing?**
The automated suite covers backend logic well but doesn't cover the ML
service or frontend with automated tests — that's manual-only right now.
Our clinical feedback also came from only two respondents, so it's
directional, not a validated clinical trial.

---

## Clinical Feedback

**Q: What feedback did you get and what did you change because of it?**
Two rounds of feedback from practising clinical staff. Concretely: they
told us the ML data bank needed more manpower to grow — we built the
undergraduate submission + review pipeline in response. They asked for
automated PAR generation — we built the geometric auto-calculate path.
They raised liability/trust concerns about AI results — we made landmark
confirmation mandatory before auto-scoring and added the visible
confidence indicator. Full mapping in `docs/ClinicalFeedbackMapping.md`.

**Q: Was the feedback all positive?**
No, and we kept it that way honestly. Overall satisfaction improved
between the two rounds (Good → Excellent, "Probably yes" → "Definitely
yes" on recommending it), but the second respondent still rated AI PAR
confidence at 3/10 and reported using manual override on every case —
landmark/PAR automation accuracy is a real, unresolved limitation, not
something we're claiming to have solved.

---

## Team & Process

**Q: What was your individual contribution?** *(answer for yourself — see `docs/EPortfolioContent.md` for each member's drafted, git-history-backed contribution)*

**Q: How did you collaborate on GitHub?**
[Describe your actual workflow — branches, PRs, or direct commits to
main — honestly, based on how you actually worked, not an idealized
description.]

---

## Limitations & Future Work

**Q: What are the main limitations of the current system?**
Landmark-detection and PAR-prediction accuracy isn't yet at a level
clinicians fully trust (see Clinical Feedback above) — manual override
is still needed often. Clinical feedback is from two respondents, not a
broad trial. No automated cephalometric analysis yet.

**Q: What would you do next?**
Both clinical respondents independently asked for automated
cephalometric analysis — that's the clearest next feature. Beyond that:
grow the approved training dataset to improve landmark accuracy, and
consider integration with existing Patient Management Systems, which
both respondents rated as "very important."

---

*Prepared from the actual implementation and documentation in this
repository — cross-reference `docs/DeveloperGuide.md`,
`docs/ClinicalFeedbackMapping.md`, `docs/BugLog.md`, and
`docs/TestingDocumentation.md` for deeper detail on any answer above.*
