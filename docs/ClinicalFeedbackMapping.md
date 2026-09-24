# Clinical Feedback → Implementation Mapping

**Team TIMESWARE — CO2060 Milestone 4**

This document maps real clinical feedback collected from practising
orthodontists to what the team actually built or changed in response. It
is built directly from the two feedback PDFs already in this repository
(`clinical_feedback_form.pdf` — Phase 1, `clinical_feedback_2nd_phase.pdf`
— Phase 2), read by hand since the responses are handwritten annotations,
not machine text.

Two respondents, both anonymous by form design:

| | Phase 1 | Phase 2 |
|---|---|---|
| Role | Registrar in Orthodontics | Orthodontist |
| Experience | 10 years | (handwriting unclear — recorded as written) |
| Institution | FDS – UoP | Dental Hospital, Peradeniya |
| Date | 2026-06-15 (as written) | 2026-07-22 |
| Prior use of similar tools | No | No |

> **Important honesty note:** these are two respondents, not a large clinical
> trial. Treat this as qualitative, directional feedback — exactly the
> scale a 2nd-year student project can realistically gather — not as a
> validated clinical study.

---

## Feedback → Implementation Table

| # | Clinical Feedback (verbatim/summarised from the form) | Source | Requirement / Issue Raised | What We Changed / Built | Evidence in Repo | Status |
|---|---|---|---|---|---|---|
| 1 | *"AI detection part & machine learning for automatic point detection must be improved."* | Phase 1, Q11.1 | Automated landmark-detection accuracy was the top confidence blocker | Built a full **ML training/model management** subsystem: admins can train new model versions from approved datasets, view per-version accuracy metrics, and roll back a version if it underperforms | `code/frontend/src/pages/AdminPanel.jsx`, `code/frontend/src/components/MLStatusPanel.jsx` | **Partially addressed** — infrastructure to *improve* the model over time now exists; landmark accuracy itself is still flagged as a weak point in Phase 2 (see #4 below) |
| 2 | *"Manpower to obtain a sufficient data bank for the ML part."* | Phase 1, Q11.2 | Not enough labelled training data to make the ML model reliable | Built the **Undergraduate dataset-submission workflow**: undergraduates upload 3D scans + ground-truth PAR values, an assigned orthodontist reviews and approves/rejects each submission before it enters the training set | `code/frontend/src/pages/TrainingSubmit.jsx`, `TrainingReview.jsx`, `TrainingList.jsx` | **Done** — this is a direct, purpose-built response to this specific feedback point: it turns "manpower for a data bank" into a repeatable pipeline instead of asking clinicians to source data themselves |
| 3 | Concerns ticked: *"Liability and accountability for AI-generated results"*, *"System errors causing incorrect treatment decisions"* | Phase 1, Q4.6 | Clinicians must not be forced to trust an unreviewed AI output | The **manual review/confirm step for landmarks is mandatory** before a PAR score is computed from them — an ML-proposed landmark that hasn't been reviewed/confirmed is never used as the official score. Manual scoring remains a fully independent first-class path, not a fallback. | `code/backend/.../controller/LandmarkController.java` (`auto-calculate ignores unconfirmed predictions until a clinician…`), manual PAR rubric in `CaseDetail.jsx` | **Done** |
| 4 | Confidence in AI-computed PAR accuracy: **3/10**; AI-vs-manual match: **4/10**; *"Used override on every case"* | Phase 2, Q4.5, Q6.1, Q6.3 | Landmark/PAR automation is still not clinically trusted, even in Phase 2 | Added the **ML cross-check confidence indicator** (Medium/High, driven by how much approved training data exists) shown alongside any ML-derived PAR score, so clinicians see an explicit trust signal instead of a bare number | `code/frontend/src/components/AutoScoreResult.jsx`, `MLStatusPanel.jsx` (500-dataset threshold for "high-confidence") | **Known limitation, honestly surfaced rather than hidden** — the underlying accuracy gap is not solved; what changed is that the system now tells the clinician when *not* to trust it, rather than presenting every ML score with false confidence |
| 5 | *"Need automated PAR score generation."*; *"…without automation accuracy we cannot implement this."* | Phase 2, Q11.1, Q11.4 | Manual-only scoring isn't enough for adoption — clinicians want automation, but only if trustworthy | Built **geometric auto-calculation from confirmed landmarks** (`auto-calculate` endpoint) as a second automated path alongside the ML cross-check — gives a repeatable, explainable score derived from confirmed points rather than only a black-box model prediction | `code/backend/.../controller/LandmarkController.java` (`POST /auto-calculate — run geometric PAR & save result`) | **Done** |
| 6 | Feature ratings — File Upload 4→5, 3D Viewer unrated→5, PDF Report 5→5, Manual Override unrated→4 (Phase 1 → Phase 2) | Both phases, Q3 | General usability and secondary features were already well received; no major redesign requested | Kept these features stable — STL/OBJ upload with 50MB limit and validation feedback, Three.js 3D viewer, Manual Override landmark editor, PDF export via `exportPDF()` | `ModelUploadSlots.jsx`, `Model3DViewer.jsx`/`STLViewer.jsx`, `LandmarkPanel.jsx`, `PatientDetail.jsx` (`exportPDF`) | **No change needed — retained as-is** |
| 7 | Overall system rating: Good → **Excellent**; Recommend to colleagues: Probably yes → **Definitely yes** (Phase 1 → Phase 2) | Both phases, Q10.1–10.2 | — | General usability, responsiveness (7.1: Acceptable → Very smooth/responsive), and workflow fit clearly improved between phases | (Outcome measure, not a single feature) | **Positive trend** — supporting evidence that iterative changes between phases had a real effect |
| 8 | *"Ceph[alometric] analysis"* named as the top priority for further automation by **both** respondents independently | Phase 1 Q11.3, Phase 2 Q11.3 | Clinicians want cephalometric analysis automated next | Not attempted — out of scope for this milestone | — | **Not implemented — logged as future work**, not claimed as done |
| 9 | *"No need of any monetary allocation"* to adopt this at their facility | Phase 2, Q11.2 | Cost is not a barrier to adoption | No action needed — noted as a positive adoption signal for the presentation | — | **Informational** |

---

## What this table deliberately does NOT claim

- It does not claim landmark-detection accuracy itself was fixed — Phase 2's own numbers (3/10 confidence, 4/10 match, override used on every case) show it wasn't, and the table says so plainly rather than presenting the ML-training feature as a full fix.
- It does not fabricate a third respondent or additional detail beyond what's legible on the two scanned forms.
- Cephalometric analysis is recorded as *requested, not built* — a good "future work" slide item, not a completed feature.

## Suggested use for the Milestone 4 presentation

Items **#2** (data-bank pipeline) and **#5** (auto-calculate from
landmarks) are your strongest "feedback → feature" story, because you can
point to a specific quote and a specific shipped feature. Item **#4** is
worth including too, framed honestly as "we chose to surface the
confidence gap rather than hide it" — evaluators tend to respond well to
that kind of candour more than to an overclaimed "we solved AI accuracy"
slide.

---

*Built from: `clinical_feedback_form.pdf`, `clinical_feedback_2nd_phase.pdf`
(both in repo root, read visually — responses are handwritten, not
extractable as text) cross-checked against the current implementation in
`code/`.*
