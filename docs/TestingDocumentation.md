# Testing Documentation — Web-Based PAR Index System (Backend)

This document describes the backend testing approach, environment, and
results as actually verified via `mvn test` output. Every count and result
below is taken from an actual Maven run recorded during testing — nothing is
estimated or assumed. Where a test initially failed and was corrected, that
history is kept, since it documents real debugging evidence rather than a
polished-over narrative.

---

## 1. Testing approach

Testing was carried out incrementally, in priority order, targeting areas
with the highest business or security impact first:

1. Inspect the actual source code for the class/controller under test before
   writing anything — no test was written against assumed behavior.
2. Identify what is already tested, what is missing, and why the missing
   coverage matters, before writing new tests.
3. Write the smallest meaningful test set for that gap — not padded for test
   count.
4. Run `mvn test` (or `mvn clean test` when in doubt about stale build state)
   and record the **actual** result before claiming anything passes.
5. Where a test failed, diagnose the actual root cause from the failure
   output and source code — not guessed — before changing anything.
6. Production code was only ever changed with explicit confirmation; several
   findings in this round were left deliberately unfixed and are tracked in
   `BugLog.md` instead.

## 2. Environment

| Component | Version |
|---|---|
| Java | 17 |
| Spring Boot | 3.2.4 (`spring-boot-starter-parent`) |
| Build tool | Maven |
| Database driver (runtime) | `mysql-connector-j` |
| Migrations | Flyway (`flyway-core`, `flyway-mysql`) |
| JWT library | `jjwt-api`/`jjwt-impl`/`jjwt-jackson` 0.12.5 |
| Test runner | `spring-boot-starter-test` (JUnit 5 via `junit-platform-launcher` 1.10.5) |
| Mocking | Mockito (via `spring-boot-starter-test`) |
| Web layer testing | `spring-security-test` (`SecurityMockMvcRequestPostProcessors`), Spring's `MockMvc` |

All tests were run locally via:
```powershell
mvn test
```
or, when a stale build state was suspected:
```powershell
mvn clean test
```
from `code/backend`.

## 3. Tools and frameworks used, by test type

- **Pure unit tests** (no Spring context): plain JUnit 5 + Mockito, e.g.
  `JwtAuthFilterTest`, `JwtRoundTripIntegrationTest` — these instantiate the
  class under test directly and mock only its immediate collaborators, to
  keep the test fast and avoid re-introducing Spring-context configuration
  mistakes.
- **Service-layer unit tests**: JUnit 5 + Mockito with `@ExtendWith(MockitoExtension.class)`
  and `@Mock`/`@InjectMocks`, e.g. `AuthServiceTest`, `PARCalculatorServiceTest`,
  `AccessControlServiceTest`.
- **Controller-layer tests**: `@WebMvcTest` + `@Import(SecurityConfig.class)` +
  `MockMvc`, with `@MockBean` for repositories/services and
  `SecurityMockMvcRequestPostProcessors.user(...)` to simulate an
  authenticated principal with a specific role, e.g. `CaseControllerTest`,
  `TrainingSetControllerTest`, `MLControllerTest`, `FileServeControllerSecurityTest`,
  `LandmarkControllerTest`.

## 4. Test classes and what each covers

| # | Test class | Tests | Covers |
|---|---|---|---|
| 1 | `PARScoreTest` | 4 | PAR score entity/value logic — zero score, weighted sum, overjet weighting, maximum boundary |
| 2 | `JwtUtilTest` | 1 | Core JWT token utility logic |
| 3 | `AccessControlServiceTest` | 28 | Patient/case/model-file read & write access rules across ORTHODONTIST/UNDERGRADUATE/ADMIN roles, including archived-patient handling and training-set ownership/reviewer checks |
| 4 | `AuthServiceTest` | 6 | Registration validation (duplicate email, self-service ADMIN blocked, DENTIST role rejected), successful registration/login token issuance, login-user-not-found handling |
| 5 | `GeometricPARServiceTest` | 15 | Geometric PAR calculation from 3D landmark points — required-landmark validation, POST/PRE classification, missing pre-treatment reference handling |
| 6 | `PARCalculatorServiceTest` | 9 | Manual and ML-sourced PAR calculation, finalized-case protection, classification labels |
| 7 | `PatientServiceTest` | 2 | Core patient service behavior |
| 8 | `StorageServiceTest` | 8 | Path-traversal rejection on both `delete()` and `resolveReadablePath()`, null/blank path handling, legitimate-path resolution, empty-file/oversized-file/disallowed-extension upload validation |
| 9 | `FileServeControllerSecurityTest` | 3 | URL-level role restriction on file downloads, service-layer per-file access denial, successful authorized download |
| 10 | `JwtAuthFilterTest` | 5 | Authentication gate behavior: no header, malformed header, valid token, invalid/rejected token, unknown user — and confirms the filter never itself blocks a request (always calls `chain.doFilter`) |
| 11 | `CaseControllerTest` | 8 | Case finalize/unfinalize business rules — cannot finalize without a real, non-zero PAR score; cannot re-finalize; cannot unfinalize without a reason or a currently-finalized case; cannot create a POST-stage case without a finalized PRE-stage case |
| 12 | `TrainingSetControllerTest` | 9 | Review authorization (assigned reviewer or admin only), `groundTruthPar` range validation, model-file completeness check, confirmation that these checks are scoped to APPROVED reviews only, and ownership enforcement on `delete()`: owner can delete their own pending submission, a non-owner UNDERGRADUATE is rejected with 403, and ADMIN retains override to delete any pending submission |
| 13 | `MLControllerTest` | 9 | Per-endpoint role matrix — confirms ORTHODONTIST is allowed on `/status` but blocked on `/metrics` and `/train`, and that `/rollback` is ADMIN-only |
| 14 | `JwtRoundTripIntegrationTest` | 3 | End-to-end token round trip using the **real** `JwtUtil` and **real** `JwtAuthFilter` together (no mocking of either) — valid token accepted, genuinely expired token rejected, token signed with a different secret rejected |
| 15 | `LandmarkControllerTest` | 13 | Role gating across all 5 endpoints (`POST`/`GET`/`DELETE /landmarks`, `POST /predict-landmarks`, `POST /auto-calculate`) — UNDERGRADUATE blocked with 403 on every endpoint, ORTHODONTIST/ADMIN allowed through to the service layer; request-body validation on `POST /landmarks` (`@NotNull slot`, `@NotEmpty points`, cascading `@Valid`/`@NotBlank` on each point's `name`) |

**Total: 123 tests across 15 test classes.**

## 5. Notable test cases and what they specifically prove

- **`JwtRoundTripIntegrationTest`** exists specifically because every other
  JWT-related test mocks one side of the login → token → authenticated-request
  chain. This class proves the real components actually agree with each
  other on token format, claims, and signing key — something no individual
  unit test could show on its own.
- **`MLControllerTest`** deliberately tests both the "blocked" and "allowed"
  case for `/metrics` and `/train`, because those two endpoints exclude
  ORTHODONTIST while a visually similar endpoint (`/status`) allows it — the
  exact kind of role-matrix detail a copy-pasted `@PreAuthorize` annotation
  could silently break.
- **`CaseControllerTest`**'s expected HTTP status codes (400/409/422) were
  taken directly from reading `GlobalExceptionHandler`'s actual exception-to-status
  mapping, not assumed from convention.
- **`TrainingSetControllerTest`** includes a test that a `REJECTED` review
  bypasses the `groundTruthPar`/file-completeness checks entirely (which only
  apply to `APPROVED`), confirmed by asserting `model3DFileRepository` is
  never even queried in that case. It also includes a test asserting
  that a non-owner UNDERGRADUATE's delete attempt is rejected with HTTP 403
  and that neither `trainingSetRepository.deleteById(...)` nor
  `auditService.log(...)` is invoked in that case.
- **`LandmarkControllerTest`** closes a gap that existed even though the
  underlying `GeometricPARService` was already covered at 15/15 — the
  *controller's own* `@PreAuthorize` rules and `@Valid` request validation
  had never been exercised at all before this. All 5 endpoints share the
  same `hasAnyRole('ORTHODONTIST','ADMIN')` rule, so each is tested for the
  UNDERGRADUATE-blocked case individually, since a copy-pasted annotation on
  one endpoint provides no guarantee about the others.

## 6. Expected vs. actual results — history of failures found and resolved

Two genuine failures were found and corrected during this testing effort;
both are recorded here rather than omitted, since they demonstrate real
verification, not just a final green run.

### 6.1 `FileServeControllerSecurityTest` — initially 1/3 passing, then 3/3

**Expected (per the test's own intent):** UNDERGRADUATE blocked with 403;
ORTHODONTIST without file access blocked with 403; authorized ORTHODONTIST
succeeds with 200.

**Actual (first run):** 2 of 3 tests failed — both expected 403, received 200.

**Root cause:** `@MockBean private JwtAuthFilter jwtAuthFilter;` created a
Mockito mock that is a no-op for every method, including the one Spring
Security calls to run it in the filter chain (`doFilter(request, response,
chain)`). Since this mock never called `chain.doFilter(...)`, every request
stopped at that filter and never reached the authorization check or the
controller — `MockMvc` reported the untouched default response (200, empty
body) instead of a real result. This was a **test-configuration bug**, not a
production security defect; the actual `@PreAuthorize`/`SecurityConfig` rules
were never proven broken, only never actually exercised.

**Fix:** stubbed the mock via `doAnswer(...)` to call
`chain.doFilter(request, response)`, making it a passthrough filter (correct
here, since these tests inject the authenticated principal directly and don't
need real JWT parsing).

**Result after fix:** 3/3 passing, confirmed via `mvn clean test -Dtest=FileServeControllerSecurityTest`.

### 6.2 Initial compile failure on the same test class

**Actual (very first run):** `mvn test -Dtest=FileServeControllerSecurityTest`
failed to compile, with errors suggesting `FileServeController.java` contained
test-only imports (`JUnit`, `Mockito`, `MockMvc`) and a duplicate class
declaration.

**Root cause:** determined to be stale Maven build-cache state rather than an
actual file content problem — line-by-line inspection of the real file
content on disk showed no such contamination.

**Fix:** `mvn clean test` (clearing `target/`) resolved the compile failure
with no source changes needed.

## 7. Final verified result

This is the actual output of `mvn test` at time of writing, covering all 15
test classes above. (110/110 was the baseline prior to this round; 123/123
reflects the addition of `LandmarkControllerTest`, closing the coverage gap
previously noted in §8's "Scope not yet covered" list — `LandmarkController`'s
own authorization/validation behavior had never been separately tested even
though the underlying `GeometricPARService` was already covered at 15/15.)

**Re-verified 2026-09-24** (`mvn clean test`, Windows, Java 17.0.17, Maven via
the committed wrapper) — full clean rebuild, not a cached/incremental run:

```
[INFO] Running com.parsystem.controller.CaseControllerTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.controller.FileServeControllerSecurityTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.controller.LandmarkControllerTest
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.controller.MLControllerTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.controller.TrainingSetControllerTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.entity.PARScoreTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.security.JwtAuthFilterTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.security.JwtRoundTripIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.security.JwtUtilTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.AccessControlServiceTest
[INFO] Tests run: 28, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.AuthServiceTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.GeometricPARServiceTest
[INFO] Tests run: 15, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.PARCalculatorServiceTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.PatientServiceTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.parsystem.service.StorageServiceTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0

[INFO] Results:
[INFO] Tests run: 123, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  19.845 s
```

Two pre-existing Lombok `@Builder` warnings on `LandmarkPoint.java` (fields
with an initializer that `@Builder` silently ignores) and one deprecation
notice in `MLService.java` were emitted during compilation — both are
warnings, not failures, and don't affect this result. Worth a cleanup pass
if time allows, but not blocking for Milestone 4.

## 8. Limitations

- **This is a test pass rate, not a code coverage measurement.** No coverage
  tool (e.g. JaCoCo) has been run against this codebase. "123/123 passing"
  says every written test currently succeeds; it does not say what fraction
  of the codebase those tests actually exercise.
- **Scope not yet covered by dedicated tests:**
  - `MLClientService`/`MlPredictionService`'s communication with the external
    ML service (FastAPI) beyond what was incidentally observed during the
    stray-file investigation recorded in `BugLog.md`.
  - `AuditService` was reviewed and found to be a single-method, no-branching
    pass-through (build an `AuditLog`, save it); it was deliberately not
    given its own test class, since it is already implicitly exercised by
    every other test that verifies `auditService.log(...)` was called with
    correct arguments, and a dedicated test would mostly test Mockito's own
    mechanics rather than catch anything meaningful.
  - Docker/deployment configuration, beyond the JWT secret fallback already
    documented in `BugLog.md` and `SecurityReview.md`.
- **Known, deliberately unresolved findings** (see `BugLog.md` for full
  detail): a confirmed hardcoded JWT secret fallback (not fixed pending a
  deliberate deployment-impact review), a dead MIME-validation constant in
  `StorageService`, and two missing-UI findings (case unfinalize, patient
  archive/reactivate). The `TrainingSetController.delete()` ownership gap and
  the hardcoded live credentials in `config.txt`/`init.sql` have both been
  resolved — see `BugLog.md` RESOLVED-002 and RESOLVED-003.