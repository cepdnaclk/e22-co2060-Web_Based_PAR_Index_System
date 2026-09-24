# Manual Test Cases — Web-Based PAR Index System

**Team TIMESWARE — CO2060 Milestone 4**

> **How to use this document:** every case below was written directly from
> the real implementation (frontend pages, `api.js`, backend controllers —
> the same sources verified in `docs/user-manual.md`), so the *steps* and
> *expected results* are accurate to the code. What is **not** done yet is
> execution: the "Actual Result" and "Status" columns are intentionally
> blank. Run each case against the running system, fill in what actually
> happened, and keep this file as your Milestone 4 manual-testing evidence.
> Do not fill in results without actually running the step — an
> unexecuted case left blank is better evidence than a fabricated pass.

**Environment for execution:** ________________ (e.g. `docker compose up`, local URLs from README)
**Tested by:** ________________
**Date(s) executed:** ________________

---

## 1. Authentication

### TC-01 — Valid login
| | |
|---|---|
| Preconditions | A registered, active user account exists (any role) |
| Steps | 1. Go to login page. 2. Enter correct email + password. 3. Click Sign in. |
| Expected Result | Redirected to Dashboard; user's role-appropriate navigation is visible |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-02 — Invalid login (wrong password)
| | |
|---|---|
| Preconditions | A registered account exists |
| Steps | 1. Enter correct email, incorrect password. 2. Click Sign in. |
| Expected Result | Login rejected with an error message; no redirect |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-03 — Invalid login (deactivated account)
| | |
|---|---|
| Preconditions | Admin has deactivated a test account (Admin → Users → Deactivate) |
| Steps | 1. Attempt login with that account's correct credentials. |
| Expected Result | Login rejected — deactivated accounts must not be able to sign in |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-04 — Registration (Orthodontist)
| | |
|---|---|
| Preconditions | Email not already registered |
| Steps | 1. Click Register. 2. Fill name/email/password (≥8 chars)/confirm. 3. Choose "Orthodontist". 4. Submit. |
| Expected Result | Account created, logged in immediately, Orthodontist navigation shown |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-05 — Registration (Undergraduate)
| | |
|---|---|
| Preconditions | Email not already registered |
| Steps | Same as TC-04, choosing "Dental Undergraduate" |
| Expected Result | Account created; Undergraduate navigation (Training) shown, no Patients/Cases access |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-06 — Registration rejects password confirmation mismatch
| | |
|---|---|
| Steps | Enter two different values in password / confirm-password fields, submit |
| Expected Result | Form blocks submission with a validation message |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-07 — Registration cannot create an Admin account
| | |
|---|---|
| Steps | Open the registration role selector |
| Expected Result | Only "Orthodontist" and "Dental Undergraduate" are offered — no Admin option |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-08 — Logout
| | |
|---|---|
| Preconditions | Logged in as any role |
| Steps | Click Logout |
| Expected Result | Session ends, redirected to login; protected pages become inaccessible until re-login |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 2. Role-Based Access Control

### TC-09 — Undergraduate cannot access Patients/Cases
| | |
|---|---|
| Preconditions | Logged in as Undergraduate |
| Steps | Attempt to navigate directly to a Patients or Case URL |
| Expected Result | Access denied / redirected — clinical workflow is Orthodontist-only |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-10 — Orthodontist cannot access Admin panel
| | |
|---|---|
| Preconditions | Logged in as Orthodontist |
| Steps | Attempt to navigate directly to the Admin panel URL |
| Expected Result | Access denied / redirected |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-11 — Undergraduate cannot access Admin panel
| | |
|---|---|
| Steps | Same as TC-10, logged in as Undergraduate |
| Expected Result | Access denied / redirected |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 3. Patient & Case Management (Orthodontist)

### TC-12 — Create a patient
| | |
|---|---|
| Preconditions | Logged in as Orthodontist |
| Steps | Patients → + New Patient → fill Reference ID + Full Name (required) → Save |
| Expected Result | Patient appears in patient list |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-13 — Create patient fails without required fields
| | |
|---|---|
| Steps | Attempt to save with Reference ID or Full Name blank |
| Expected Result | Form blocks submission / shows validation error |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-14 — Create a Pre-treatment case
| | |
|---|---|
| Preconditions | A patient exists |
| Steps | Open patient → + New Case → select "Pre-treatment" → create |
| Expected Result | Case created and listed under the patient |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-15 — Post-treatment case blocked without a prior Pre-treatment case
| | |
|---|---|
| Preconditions | A patient with **no** existing Pre-treatment case |
| Steps | Attempt to create a "Post-treatment" case for them |
| Expected Result | System warns/blocks — stage sequence must make sense |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-16 — Create a Post-treatment case (valid sequence)
| | |
|---|---|
| Preconditions | Same patient now has a Pre-treatment case |
| Steps | Create a "Post-treatment" case for them |
| Expected Result | Case created successfully |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 4. Model Upload

### TC-17 — Upload all three required models (valid STL)
| | |
|---|---|
| Preconditions | An open case with no models yet |
| Steps | Upload valid `.stl` files to Upper Arch, Lower Arch, and Buccal View slots |
| Expected Result | All three accepted; case proceeds to landmark stage |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-18 — Calculation blocked with an incomplete upload
| | |
|---|---|
| Preconditions | Only 1–2 of the 3 model slots filled |
| Steps | Attempt to run PAR calculation |
| Expected Result | System blocks with "All three model files are required" (or equivalent) |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-19 — Invalid file type rejected
| | |
|---|---|
| Steps | Attempt to upload a non-STL/OBJ file (e.g. `.jpg`, `.pdf`) to a model slot |
| Expected Result | Upload rejected with a clear error, not a silent failure |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-20 — Oversized file rejected
| | |
|---|---|
| Steps | Attempt to upload a file larger than 50MB |
| Expected Result | Upload rejected before/at limit, with a clear message |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 5. Landmark Detection & Review

### TC-21 — Automatic landmark detection runs after upload
| | |
|---|---|
| Preconditions | All 3 models uploaded on a case |
| Steps | Open the case's landmark/3D viewer | 
| Expected Result | ML-predicted landmarks already appear (per `CaseController.triggerMLPredictionAsync`), marked as unconfirmed |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-22 — Manual landmark repositioning
| | |
|---|---|
| Steps | Select a landmark in the 3D viewer, drag/reposition it, save |
| Expected Result | New position persists on reload; landmark now marked `MANUAL`/confirmed |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-23 — Unconfirmed landmark does not count toward auto-calculated score
| | |
|---|---|
| Steps | With landmarks still unconfirmed, attempt auto-calculate |
| Expected Result | Per `LandmarkController`'s documented behavior, unconfirmed predictions are ignored until confirmed — score should reflect that (e.g. blocked, or computed only from confirmed points) |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 6. PAR Calculation

### TC-24 — Manual PAR scoring (all 7 components)
| | |
|---|---|
| Steps | Score each of the 7 components using the on-screen rubric; observe the live weighted total |
| Expected Result | Weighted total updates live and matches manual arithmetic (component score × its weight, summed) |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-25 — Auto-calculate from confirmed landmarks
| | |
|---|---|
| Preconditions | Landmarks confirmed (TC-22) |
| Steps | Click auto-calculate |
| Expected Result | A PAR score is produced and saved with `score_source = AUTO_LANDMARK` |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-26 — ML cross-check prediction with confidence indicator
| | |
|---|---|
| Steps | Request the ML PAR prediction/cross-check on a case |
| Expected Result | A predicted score is shown with a Medium/High confidence indicator; applying it sets `score_source = ML` |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-27 — Weighted-PAR-reduction outcome for a Pre/Post pair
| | |
|---|---|
| Preconditions | Both a scored Pre-treatment and its matching Post-treatment case exist |
| Steps | Open the Post-treatment case's result | 
| Expected Result | Outcome band shown: Greatly Improved / Improved / No Different or Worse |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-28 — Outcome shows "No Pre-Treatment Reference" when there's nothing to compare
| | |
|---|---|
| Preconditions | A Post-treatment case with no linked Pre-treatment case (edge case / data issue) |
| Expected Result | System shows "No Pre-Treatment Reference" rather than crashing or showing a wrong band |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 7. Case Finalization

### TC-29 — Finalize a scored case
| | |
|---|---|
| Preconditions | Case has a PAR score (manual, auto, or ML-applied) |
| Steps | Click Finalize |
| Expected Result | Case locked, flagged Finalized, records who/when |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-30 — Finalize blocked without a score
| | |
|---|---|
| Preconditions | Case has no PAR score yet |
| Steps | Attempt to Finalize |
| Expected Result | Blocked with a clear reason ("Case cannot be finalised yet" or equivalent) |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 8. Undergraduate Dataset Submission

### TC-31 — Submit a training dataset
| | |
|---|---|
| Preconditions | Logged in as Undergraduate |
| Steps | Training → new submission → upload model(s) → select an Orthodontist reviewer → enter ground-truth PAR → Submit |
| Expected Result | Submission created with status "Pending", visible under My Submissions |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-32 — Submission blocked without a reviewer selected
| | |
|---|---|
| Steps | Attempt to submit without choosing a reviewer |
| Expected Result | Submission blocked — reviewer is mandatory |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-33 — Orthodontist approves a submission
| | |
|---|---|
| Preconditions | A submission assigned to this Orthodontist, status Pending |
| Steps | Open Training review queue → Approve |
| Expected Result | Status becomes Approved; file-completeness/ground-truth checks are enforced |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-34 — Orthodontist rejects a submission
| | |
|---|---|
| Steps | Same queue → Reject |
| Expected Result | Status becomes Rejected |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 9. Admin Functions

### TC-35 — Deactivate / reactivate a user
| | |
|---|---|
| Preconditions | Logged in as Admin |
| Steps | Admin → Users → toggle a user's active status |
| Expected Result | Status changes and persists; deactivated user cannot log in (see TC-03) |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-36 — Change a user's role
| | |
|---|---|
| Steps | Admin → Users → change a user between Orthodontist/Undergraduate |
| Expected Result | Role updates; user's accessible pages change accordingly on next login |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-37 — Audit log records a login event
| | |
|---|---|
| Steps | Log in as any user, then check Admin → Audit Log | 
| Expected Result | The login event appears, filterable via "All Actions" / date range |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-38 — ML status panel reflects real dataset/model state
| | |
|---|---|
| Steps | Admin → ML Status |
| Expected Result | Shows current model version, approved dataset count, best accuracy, matching actual DB state |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-39 — Train a new model version
| | |
|---|---|
| Preconditions | At least some approved training datasets exist |
| Steps | Admin → ML Status → Train (choose epoch count 10–500) |
| Expected Result | Training run starts/completes; new version appears in model history |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-40 — Roll back to a previous model version
| | |
|---|---|
| Preconditions | More than one model version exists |
| Steps | Admin → ML Status → Rollback to an earlier version |
| Expected Result | Active model version reverts as selected |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## 10. Error Handling

### TC-41 — Backend/ML service unreachable during upload
| | |
|---|---|
| Steps | Simulate ML service down (stop `par-ml` container), then upload models |
| Expected Result | Per `CaseController`, landmark prediction logs a warning and fails gracefully; total-PAR prediction is independent and unaffected |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

### TC-42 — Generic error surfaced to user, not swallowed silently
| | |
|---|---|
| Steps | Trigger any backend error (e.g. malformed request, expired session) |
| Expected Result | A user-visible error message appears — no blank screen / silent failure |
| Actual Result | |
| Status | ☐ Pass ☐ Fail |

---

## Summary (fill in after execution)

| Total Cases | Passed | Failed | Not Executed |
|---|---|---|---|
| 42 | | | |

Any **Fail** result should be logged as a new entry in `docs/BugLog.md`
with cause, fix, and responsible member — do not mark a case Pass if the
actual behavior differed from Expected Result, even slightly.
