# Bug Log — Web-Based PAR Index System

This log records only issues actually discovered during development, testing, and
security review. No item here is hypothetical — each was confirmed by inspecting
the actual source code and, where applicable, actual test output. Severity and
status are tracked per item; nothing is marked "fixed" without a passing test or
explicit code change backing that claim.

---

## BUG-001 — Hardcoded JWT secret fallback

**Severity:** High (confirmed security defect)
**Status:** Confirmed, **not fixed** — awaiting a controlled, deliberate fix
**Found:** Manual inspection of `src/main/resources/application.yml`

### Description

`application.yml` (around line 63) configures the JWT signing secret with a
hardcoded fallback value, rather than requiring the `JWT_SECRET` environment
variable unconditionally. The fallback decodes to a specific, readable value
that is committed to the public GitHub repository.

`JwtUtil.validateSecret()` only checks that:
- the secret is non-blank, and
- the decoded secret is at least 32 bytes.

The fallback value satisfies both checks, so the application will start
successfully and issue/validate tokens using this fallback if `JWT_SECRET` is
not explicitly supplied in the deployment environment.

### Impact

If a deployment ever runs without `JWT_SECRET` set, anyone who knows the
fallback value (visible in the public repo) could forge a valid JWT for that
deployment — including forged role claims (e.g. claiming `ROLE_ADMIN`) — since
`JwtUtil.generateToken`/`isValid` only check signature validity and expiry, not
which secret was used to sign.

`JwtRoundTripIntegrationTest.tokenSignedWithDifferentSecretIsRejected` confirms
the underlying rejection mechanism works correctly when two different secrets
are in play — the defect here is specifically that the *fallback* secret is
known and committed, not that the signature-checking logic is broken.

### Reference configuration

`application-example.yml` demonstrates the safe pattern:

```yaml
secret: ${JWT_SECRET}
```

with no fallback — the application fails to start if the variable is absent,
which is the correct behavior for this class of secret.

### Why this is not yet fixed

The minimal fix (`secret: ${JWT_SECRET}`, no fallback) changes deployment
behavior: the application will no longer start without `JWT_SECRET` explicitly
set. This has operational implications (e.g. for any deployment scripts,
CI/CD, or documentation that currently relies on the fallback working). Per
project decision, this fix is deferred until deployment impact is reviewed and
the change is made deliberately, not as a side effect of another task.

### Recommended fix (not yet applied)

Replace the fallback-bearing line in `application.yml` with:
```yaml
secret: ${JWT_SECRET}
```
and ensure `JWT_SECRET` is set in every deployment environment before this
change ships.

---

## BUG-002 — `StorageService.ALLOWED_MIMES` is declared but never enforced

**Severity:** Low (validation gap, not currently exploitable beyond what
extension-checking already covers)
**Status:** Confirmed, not fixed
**Found:** Manual inspection of `src/main/java/com/parsystem/service/StorageService.java`

### Description

`StorageService` declares a `Set<String> ALLOWED_MIMES` constant, presumably
intended to restrict uploads by MIME type. This constant is never referenced
anywhere else in the class — `validate(MultipartFile file)` only checks:
1. the file is non-empty,
2. the file size is within the 50 MB limit, and
3. the file extension is in `ALLOWED_EXTENSIONS`.

`file.getContentType()` is never read or compared against `ALLOWED_MIMES`.

### Impact

A file with an allowed extension (`.stl`/`.obj`) but an arbitrary or spoofed
`Content-Type` header will be accepted — there is no independent MIME check
behind the extension check. This is a defense-in-depth gap rather than a
directly exploitable hole on its own, since extension filtering still applies.

### Recommended fix (not yet applied)

Either wire `ALLOWED_MIMES` into `validate()` (compare
`file.getContentType()` against it and reject on mismatch), or remove the
unused constant if MIME checking was intentionally dropped in favor of
extension-only validation — whichever reflects the actual intended design.

---

## BUG-003 (Low, unfixed) — Missing UI: Case Unfinalize

**Severity:** Low
**Status:** Open
**Found:** While tracing frontend features against backend endpoints for `UserManual.md`

### Description

The backend endpoint to unfinalize a case works and is covered by tests
(`CaseControllerTest`). The frontend API client (`api.js`) has the method
wired (`unfinalize: (id, reason) => ...`). However, no button or form in the
UI calls it.

### Impact

Users cannot unfinalize a case through the application; the action is only
reachable via a direct API call.

### Recommended fix

Add a UI control (e.g. button + reason prompt) wherever finalized cases are
displayed, wired to the existing `api.js` method.

---

## BUG-004 (Low, unfixed) — Missing UI: Patient Archive/Reactivate

**Severity:** Low
**Status:** Open
**Found:** While tracing frontend features against backend endpoints for `UserManual.md`

### Description

`Patient.isArchived` status is displayed (Active/Archived badge) in
`PatientList` and `PatientDetail`, but no UI control exists to change it.

### Impact

Patients cannot be archived or reactivated through the application UI.

### Recommended fix

Add an archive/reactivate action (button or menu item) in `PatientDetail`
(and optionally `PatientList`).

---

## RESOLVED-003 (formerly BUG-005) — Hardcoded, committed live credentials in `config.txt` and `init.sql`

**Severity:** High
**Status:** Resolved — rotated and verified
**Found:** Manual inspection while writing `docs/DeveloperGuide.md`

### Description

Two files in the public repository contained real, usable credentials, not
placeholders or examples:

1. **`code/config.txt`** — a plaintext dump of `docker compose config`
   output, containing the actual values of `DB_PASSWORD`, `JWT_SECRET`, and
   `ML_SERVICE_SECRET` as they were configured at the time it was generated
   and committed.
2. **`code/database/init.sql`** — created the MySQL user `paruser` with a
   hardcoded plaintext password directly in the SQL, rather than sourcing it
   from an environment variable at runtime.

### Impact

Unlike `BUG-001` (a fallback that only activates if `JWT_SECRET` is unset),
these were **live secrets exposed at the time of discovery** in a public
repository. Anyone who had cloned, forked, or viewed the repo had access to:
- The database password (`DB_PASSWORD`, used as the MySQL root password —
  `paruser` itself turned out to be unused by the running application; see
  Investigation below).
- The JWT signing secret (allowing forged tokens, including forged
  `ROLE_ADMIN` claims, identical in effect to exploiting BUG-001 but with a
  guaranteed-valid secret instead of a hopeful fallback).
- The ML-service shared secret (`X-ML-Service-Key`), allowing unauthenticated
  calls to the ML service's `/predict`, `/train`, and `/rollback` endpoints
  as if they were the backend.

### Investigation

Inspecting `docker-compose.yml` showed `paruser` (created by `init.sql`) was
never actually used — `par-backend` and `par-ml` both connect to MySQL as
`root`, authenticated via `MYSQL_ROOT_PASSWORD`/`DB_PASSWORD`. So the one
credential that actually mattered operationally was `DB_PASSWORD` (the root
password), not the `paruser` password — though both were hardcoded and both
needed to go.

### Fix applied

- `DB_PASSWORD` (MySQL root password), `JWT_SECRET`, and `ML_SERVICE_SECRET`
  all rotated to newly generated values (`openssl rand -base64`).
- `code/database/init.sql` emptied — the unused `paruser` account and its
  hardcoded password removed entirely; the app continues to connect as
  MySQL root via `MYSQL_ROOT_PASSWORD` (env-sourced), which was already the
  actual runtime behavior.
- `code/docker-compose.yml` updated to drop the now-unnecessary `init.sql`
  bind-mount on the `mysql` service.
- `code/config.txt` removed from the repository and added to `.gitignore`
  (commit `54892fc`, pushed to `main`).

### Verification

- MySQL data volume wiped and reseeded fresh (`docker compose down -v`) so
  the new root password took effect immediately, rather than requiring an
  in-place `ALTER USER`.
- Full stack (`mysql`, `par-backend`, `par-ml`, `par-frontend`) rebuilt via
  `docker compose up --build` and confirmed running with all three rotated
  secrets — login, patient/case retrieval (backend↔MySQL), and the ML
  service's `/health` endpoint all verified working post-rotation.
- `par-ml`'s host port was moved from `8000` to `8002` in
  `docker-compose.yml` during this work, due to an unrelated local port
  conflict with another project's container — internal
  container-to-container traffic (`ML_SERVICE_URL: http://par-ml:8000`) was
  unaffected since only the host-side mapping changed.

### Known residual risk (not yet addressed)

The *old*, now-inactive secret values (including the old `paruser` password)
remain visible in earlier git commits and are recoverable via `git log`/
`git show` unless history is separately rewritten. Rotation neutralizes the
live exposure — the old values no longer grant access to anything — but
does not remove them from history. Scrubbing history
(`git filter-repo`/BFG Repo-Cleaner + force-push) is a more invasive,
separate action, intentionally not done as part of this fix; revisit if full
historical removal is wanted.

---

## RESOLVED-002 (formerly FLAGGED-001) — `TrainingSetController.delete()` had no ownership check

**Severity:** Medium
**Status:** Resolved — fixed and verified
**Found:** Manual inspection of `src/main/java/com/parsystem/controller/TrainingSetController.java`
**Decision:** Confirmed as unintended — restricted to submission owner + admin

### Original issue

`delete()` was restricted by `@PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")`
and checked only that the training set's `status` was `PENDING`. It did not
check whether the calling user was the submission's actual owner
(`submittedBy`), allowing any UNDERGRADUATE to delete any other
undergraduate's pending training-set submission, not only their own.

### Fix applied

Added an ownership check before the existing status check, mirroring the
pattern already used in `review()`:

```java
if (user.getRole() != User.Role.ADMIN &&
        !ts.getSubmittedBy().getId().equals(user.getId())) {
    throw new AccessDeniedException("You can only delete your own training set submissions.");
}
```

`TrainingSet.submittedBy` was already a populated `@ManyToOne User` field
(set on creation via `@PrePersist`/builder), so no schema change was
required — the fix is contained entirely to `TrainingSetController.delete()`.

`AccessDeniedException` was used (rather than `IllegalArgumentException`) so
the failure maps to HTTP 403, correctly signaling an authorization failure
rather than a bad request. Confirmed this mapping works correctly via the
`nonOwnerUndergraduateCannotDeleteOthersSubmission` test — no changes to the
exception handler were needed.

### Verification

Three new tests added to `TrainingSetControllerTest`:
- `ownerCanDeleteOwnPendingSubmission` — owner can still delete their own submission (204 preserved)
- `nonOwnerUndergraduateCannotDeleteOthersSubmission` — non-owner UNDERGRADUATE gets 403, no delete/audit call occurs
- `adminCanDeleteAnyPendingSubmission` — ADMIN override still works as before

Confirmed via actual `mvn clean test` output: full suite now **110/110
tests passing, 0 failures, 0 errors, BUILD SUCCESS** (up from the prior
107/107 baseline).

---

## RESOLVED-001 — Duplicate, diverged `CaseController.java` / `MlPredictionService.java` outside the Maven source tree

**Severity:** N/A (repository hygiene, no functional impact)
**Status:** Resolved — stray files deleted
**Found:** Manual inspection while preparing `CaseController` tests

### Description

Two files existed outside `src/main/java/...` (`code/backend/controller/CaseController.java`
and `code/backend/service/MlPredictionService.java`), never compiled or used by
the build. They were added in the same commit as their real counterparts
(`9714729 "Testcases Added"`), most likely from an accidental duplicate
directory structure rather than a deliberate backup.

### Investigation

The stray `CaseController.java` called an auto-landmark-prediction step after
upload that the real, compiled `CaseController.java` does not have. Diffing
`MlPredictionService.java`'s two copies showed both contain the same
functional fix (attaching the `X-ML-Service-Key` header to ML-service calls);
they differed only in refactoring style. Checking real source-tree usages
confirmed `MlPredictionService` is used correctly by `LandmarkController` via
its own explicit endpoint (`POST /api/v1/cases/{id}/predict-landmarks`) — no
functionality was actually missing from the running application. The stray
`CaseController.java` most likely represented an earlier, abandoned attempt at
auto-triggering prediction on upload, superseded by the current explicit
on-demand design.

### Resolution

Both stray files deleted. Confirmed via `mvn test` (104/104 before and after
deletion) that this had zero effect on the build or test results.

---

## Test-pass baseline referenced throughout this log

At time of writing: **110/110 backend tests passing — 0 failures — 0 errors —
BUILD SUCCESS.** This is a pass rate, not a code-coverage measurement; coverage
has not been measured with a tool such as JaCoCo.