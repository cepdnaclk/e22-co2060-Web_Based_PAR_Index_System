# Testing Documentation — Web-Based PAR Index System (Backend)

This document describes the backend testing approach, environment, test coverage, verified results, debugging history, and current limitations of the Web-Based PAR Index System.

Every test count and final result documented below is based on an actual Maven test execution. No test results or coverage percentages are estimated or assumed.

---

## 1. Testing Approach

Testing was carried out incrementally and in priority order, with particular attention given to business-critical and security-sensitive functionality.

The testing process followed these steps:

1. Inspect the actual source code for the class or controller under test before writing tests.
2. Identify existing test coverage and missing test areas.
3. Determine why the missing coverage is important.
4. Write the smallest meaningful set of tests required to verify the identified behavior.
5. Run `mvn test` or `mvn clean test` and record the actual result.
6. If a test failed, investigate the failure output and source code to determine the actual root cause.
7. Apply corrections only when appropriate and verify the result again.
8. Keep known unresolved findings documented separately instead of silently changing production behavior only to make tests pass.

The objective was not to maximize the number of tests, but to verify meaningful system behavior, security controls, validation rules, and important business logic.

---

## 2. Testing Environment

| Component             | Version / Technology |
| --------------------- | -------------------- |
| Java                  | 17.0.17              |
| Spring Boot           | 3.2.4                |
| Spring Framework      | 6.1.5                |
| Build Tool            | Maven                |
| Database Driver       | MySQL Connector/J    |
| Database Migration    | Flyway               |
| JWT Library           | JJWT 0.12.5          |
| Test Framework        | JUnit 5              |
| Test Platform         | JUnit Platform       |
| Mocking Framework     | Mockito              |
| Web Testing           | Spring MockMvc       |
| Security Testing      | Spring Security Test |
| Operating Environment | Windows              |
| Maven Command         | `mvn clean test`     |

The tests were executed from:

```powershell
code/backend
```

The final verification was performed using:

```powershell
mvn clean test
```

This command performs a clean rebuild by deleting the previous Maven `target` directory before compiling and executing the complete test suite.

The latest execution compiled 50 production source files and 15 test source files using Java 17.

---

## 3. Testing Tools and Frameworks

### 3.1 Unit Testing

JUnit 5 was used for unit-level verification.

Mockito was used to isolate classes from their direct dependencies where appropriate.

Examples include:

* `JwtUtilTest`
* `JwtAuthFilterTest`
* `AuthServiceTest`
* `AccessControlServiceTest`
* `PARCalculatorServiceTest`
* `GeometricPARServiceTest`
* `PatientServiceTest`
* `StorageServiceTest`

---

### 3.2 Controller Testing

Spring's `MockMvc` was used to test controller endpoints.

Controller tests verify:

* HTTP status codes
* Authentication and authorization
* Role-based access
* Request validation
* Business-rule enforcement
* Service-layer interaction

Security tests use Spring Security testing facilities to simulate authenticated users with specific roles.

Examples include:

* `CaseControllerTest`
* `TrainingSetControllerTest`
* `MLControllerTest`
* `FileServeControllerSecurityTest`
* `LandmarkControllerTest`

---

### 3.3 Integration-Level Security Testing

`JwtRoundTripIntegrationTest` verifies the interaction between the actual JWT utility and the actual JWT authentication filter.

Unlike tests that mock one side of the authentication process, this test uses the real components together to verify:

* Token creation
* Token parsing
* Token authentication
* Expired-token rejection
* Invalid-signature rejection

This provides additional confidence that the JWT components work together correctly.

---

## 4. Test Classes and Coverage

The current backend test suite contains **15 test classes and 123 tests**.

|  # | Test Class                        | Tests | Main Coverage                                                                                                                     |
| -: | --------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------- |
|  1 | `PARScoreTest`                    |     4 | PAR score entity/value logic, weighted calculations, overjet weighting and maximum boundary                                       |
|  2 | `JwtUtilTest`                     |     1 | Core JWT token utility logic                                                                                                      |
|  3 | `AccessControlServiceTest`        |    28 | Patient, case and model-file access rules across ORTHODONTIST, UNDERGRADUATE and ADMIN roles                                      |
|  4 | `AuthServiceTest`                 |     6 | Registration validation, duplicate email handling, role validation, login and token issuance                                      |
|  5 | `GeometricPARServiceTest`         |    15 | Geometric PAR calculation from 3D landmarks, required-landmark validation, POST/PRE classification and missing reference handling |
|  6 | `PARCalculatorServiceTest`        |     9 | Manual and ML-based PAR calculation, finalized-case protection and classification labels                                          |
|  7 | `PatientServiceTest`              |     2 | Core patient service behavior                                                                                                     |
|  8 | `StorageServiceTest`              |     8 | Path traversal protection, path validation, file upload validation and file handling                                              |
|  9 | `FileServeControllerSecurityTest` |     3 | File download authorization, per-file access control and authorized download                                                      |
| 10 | `JwtAuthFilterTest`               |     5 | Authentication behavior for missing, malformed, valid, invalid and unknown-user tokens                                            |
| 11 | `CaseControllerTest`              |     8 | Case finalization/unfinalization rules and PRE/POST case requirements                                                             |
| 12 | `TrainingSetControllerTest`       |     9 | Review authorization, ground-truth validation, model-file validation and ownership enforcement                                    |
| 13 | `MLControllerTest`                |     9 | Role restrictions for ML status, metrics, training and rollback endpoints                                                         |
| 14 | `JwtRoundTripIntegrationTest`     |     3 | Real JWT utility + real JWT authentication filter integration                                                                     |
| 15 | `LandmarkControllerTest`          |    13 | Landmark endpoint authorization and request-body validation                                                                       |

### Total

**123 tests across 15 test classes.**

The test classes and their individual counts correspond to the latest verified suite.

---

# 5. Detailed Test Coverage

## 5.1 PAR Score Entity

`PARScoreTest` contains 4 tests covering:

* Zero PAR score
* Weighted PAR score calculation
* Overjet weighting
* Maximum boundary conditions

These tests verify the core value and calculation behavior of the PAR score entity.

---

## 5.2 JWT Utility

`JwtUtilTest` verifies the core JWT utility behavior.

This provides a focused test of the token-generation and token-processing functionality used by the authentication system.

---

## 5.3 Access Control

`AccessControlServiceTest` contains 28 tests.

The tests cover access rules involving:

* Patients
* Cases
* Model files
* Training-set ownership
* Different user roles
* Archived patients
* Read operations
* Write operations
* Reviewer/ownership checks

The main roles tested are:

* `ADMIN`
* `ORTHODONTIST`
* `UNDERGRADUATE`

This is one of the largest test classes because access control is a security-critical part of the application.

---

## 5.4 Authentication Service

`AuthServiceTest` contains 6 tests covering:

* Duplicate email registration
* Prevention of self-service ADMIN registration
* Rejection of unsupported DENTIST role registration
* Successful registration
* Successful login
* Login when the user does not exist

This verifies important authentication and registration rules.

---

## 5.5 Geometric PAR Service

`GeometricPARServiceTest` contains 15 tests.

The tests cover:

* Required landmark validation
* Missing landmark handling
* Upper anterior measurements
* Lower anterior measurements
* Buccal transverse measurements
* Overjet
* Overbite
* Centreline
* PRE-stage calculations
* POST-stage calculations
* Missing PRE-treatment reference
* PAR calculation and classification

The latest clean run successfully executed all 15 tests.

---

## 5.6 PAR Calculator Service

`PARCalculatorServiceTest` contains 9 tests.

The tests verify:

* Manual PAR calculation
* ML-sourced PAR calculation
* Finalized-case protection
* Classification labels
* Calculation behavior under different conditions

All 9 tests passed during the latest clean build.

---

## 5.7 Patient Service

`PatientServiceTest` contains 2 tests covering the core patient service behavior.

Both tests passed during the final verification.

---

## 5.8 Storage Service

`StorageServiceTest` contains 8 tests.

The tests cover security and validation concerns including:

* Path traversal rejection
* `../` path attacks
* Invalid paths
* Null/blank path handling
* Valid path resolution
* Empty-file validation
* Oversized-file validation
* Disallowed file extensions

The latest test run also produced runtime log evidence showing that path traversal attempts were detected and blocked.

All 8 tests passed.

---

## 5.9 File Serving Security

`FileServeControllerSecurityTest` contains 3 tests.

The tests verify:

1. An `UNDERGRADUATE` user is blocked from unauthorized file download.
2. An `ORTHODONTIST` without access to a file is blocked.
3. An authorized `ORTHODONTIST` can successfully download the file.

All 3 tests passed in the latest clean run.

---

## 5.10 JWT Authentication Filter

`JwtAuthFilterTest` contains 5 tests covering:

* Missing Authorization header
* Malformed Authorization header
* Valid JWT
* Invalid/rejected JWT
* Unknown user

The tests also verify that the filter continues the request chain appropriately rather than incorrectly blocking every request.

All 5 tests passed.

---

## 5.11 Case Controller

`CaseControllerTest` contains 8 tests.

The tests verify important case-management rules including:

* A case cannot be finalized without a valid PAR score.
* A zero PAR score cannot be used to incorrectly finalize a case.
* An already finalized case cannot be finalized again.
* A case cannot be unfinalized without an appropriate reason.
* An unfinalized case cannot be incorrectly unfinalized again.
* A POST-stage case requires an appropriate finalized PRE-stage case.

The latest run completed all 8 tests successfully.

---

## 5.12 Training Set Controller

`TrainingSetControllerTest` contains 9 tests.

The tests verify:

* Reviewer authorization
* ADMIN override behavior
* Assigned-reviewer restrictions
* `groundTruthPar` range validation
* Model-file completeness
* APPROVED review validation
* REJECTED review behavior
* Training-set ownership
* Delete authorization

An important security scenario verifies that a non-owner `UNDERGRADUATE` cannot delete another user's pending training-set submission.

The latest clean run passed all 9 tests.

---

## 5.13 ML Controller

`MLControllerTest` contains 9 tests.

The tests verify endpoint-specific role restrictions.

The tested behavior includes:

| Endpoint    | Tested Access           |
| ----------- | ----------------------- |
| `/status`   | ORTHODONTIST allowed    |
| `/metrics`  | ORTHODONTIST restricted |
| `/train`    | ORTHODONTIST restricted |
| `/rollback` | ADMIN only              |

This ensures that visually similar ML endpoints do not accidentally receive identical authorization rules.

All 9 tests passed during the final verification.

---

## 5.14 JWT Round-Trip Integration

`JwtRoundTripIntegrationTest` contains 3 tests.

The test uses the real JWT components together instead of mocking them.

It verifies:

* A valid token is accepted.
* A genuinely expired token is rejected.
* A token signed with a different secret is rejected.

All 3 tests passed.

---

## 5.15 Landmark Controller

`LandmarkControllerTest` contains 13 tests.

The controller exposes five main endpoint areas:

* `POST /landmarks`
* `GET /landmarks`
* `DELETE /landmarks`
* `POST /predict-landmarks`
* `POST /auto-calculate`

The tests verify:

* `UNDERGRADUATE` users are blocked from protected landmark operations.
* `ORTHODONTIST` users are permitted where appropriate.
* `ADMIN` users are permitted where appropriate.
* Request-body validation works correctly.
* `slot` cannot be null.
* `points` cannot be empty.
* Individual landmark point names are validated.

All 13 tests passed in the latest clean run.

---

# 6. Notable Test Cases

## 6.1 Real JWT Round Trip

`JwtRoundTripIntegrationTest` was included because testing the JWT utility and JWT filter independently does not prove that the two real components agree with each other.

The integration test therefore verifies the complete interaction between:

```text
JWT creation
      ↓
JWT token
      ↓
JWT authentication filter
      ↓
Authenticated request
```

It also verifies rejection of expired and incorrectly signed tokens.

---

## 6.2 ML Role Matrix

`MLControllerTest` specifically tests both permitted and restricted access for the ML endpoints.

This is important because `/status`, `/metrics`, `/train`, and `/rollback` do not all have the same authorization requirements.

The test suite therefore checks the role matrix instead of assuming that similar endpoints share identical access rules.

---

## 6.3 Training Set Ownership

`TrainingSetControllerTest` includes ownership-focused security checks.

The tests verify that:

* The owner can delete their own pending submission.
* A different `UNDERGRADUATE` user cannot delete it.
* An `ADMIN` retains the appropriate override capability.

The test also verifies that unauthorized deletion does not proceed to repository deletion or audit logging.

---

## 6.4 Landmark Controller Authorization

The `LandmarkController` contains multiple protected endpoints.

Each endpoint's authorization behavior is tested rather than assuming that one successful security test represents all endpoints.

This closes an important controller-level testing gap that was not covered simply by testing the underlying `GeometricPARService`.

---

# 7. Testing Issues Found and Resolved

Two important testing issues were identified during the testing process.

---

## 7.1 FileServeControllerSecurityTest Configuration Issue

### Initial Result

The test did not initially behave as expected.

Two of the three security tests expected HTTP 403 responses but received HTTP 200 responses.

### Root Cause

The test used a mocked `JwtAuthFilter`.

The mock did not call:

```java
chain.doFilter(request, response)
```

As a result, the request stopped inside the mocked filter and did not reach the authorization logic being tested.

Therefore, the 200 response was caused by incorrect test configuration rather than a demonstrated production security failure.

### Fix

The mocked filter was configured to behave as a passthrough filter using `doAnswer(...)` so that the request could continue through the Spring Security chain.

### Final Result

The test was then re-run successfully:

```text
3 tests
0 failures
0 errors
```

---

## 7.2 Initial Maven Compilation Issue

An earlier execution produced compilation errors suggesting that test-related imports and duplicate class declarations had entered the production controller source.

The actual source file was inspected and did not contain the reported contamination.

The issue was determined to be stale Maven build state.

Running:

```powershell
mvn clean test
```

cleared the previous `target` directory and resolved the compilation problem without requiring production source changes.

The current clean build confirms that the backend compiles successfully.

---

# 8. Final Verified Test Result

The complete backend test suite was re-verified on:

**24 September 2026**

Command:

```powershell
mvn clean test
```

Environment:

```text
Java 17.0.17
Spring Boot 3.2.4
Windows
Maven
```

Final Maven result:

```text
Tests run: 123, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Total execution time:

```text
51.498 seconds
```

This result came from a clean Maven rebuild rather than an incremental/cached test execution.

### Final Testing Status

| Metric         |            Result |
| -------------- | ----------------: |
| Test Classes   |                15 |
| Tests Executed |               123 |
| Passed         |               123 |
| Failed         |                 0 |
| Errors         |                 0 |
| Skipped        |                 0 |
| Build Result   | **BUILD SUCCESS** |

Therefore, the current backend test suite has a:

**123/123 passing test execution result.**

---

# 9. Compilation Warnings

The clean build completed successfully, but two Lombok warnings were reported in `LandmarkPoint.java`.

The warnings concern fields with initializers used together with Lombok `@Builder`.

The compiler reported that the builder ignores those initializing expressions unless `@Builder.Default` is used or the fields are made final where appropriate.

A deprecation notice was also reported for `MLService.java`.

These are warnings and did not cause the build or test suite to fail.

They may be addressed in a future cleanup pass, but they are not blockers for the current testing milestone.

---

# 10. Testing Limitations

## 10.1 Test Pass Rate Is Not Code Coverage

The result:

```text
123/123 tests passed
```

does **not** mean:

```text
100% code coverage
```

No dedicated code coverage tool such as JaCoCo has been executed against the project.

Therefore, the current result should be described as:

> **123/123 backend tests passed**

and not as:

> **100% code coverage**

---

## 10.2 External ML Service Communication

Dedicated tests have not yet been created for the complete communication between:

* `MLClientService`
* `MlPredictionService`
* External FastAPI ML service

The existing tests cover the application's own logic and controller behavior, but they do not constitute a complete external-service integration test.

---

## 10.3 AuditService

`AuditService` was reviewed as a simple pass-through service without significant branching logic.

It primarily creates and saves an `AuditLog`.

It is indirectly exercised by other tests that verify calls to:

```text
auditService.log(...)
```

A separate test class has therefore not been prioritized.

---

## 10.4 Docker and Deployment Configuration

Docker/deployment configuration has not been comprehensively covered by the backend unit-test suite.

The testing described in this document primarily verifies application-level Java/Spring behavior.

Deployment configuration should therefore be considered separately from the 123 passing backend tests.

---

# 11. Known Findings

The testing process identified several findings that should remain documented separately rather than being hidden by the passing test count.

The current documented findings include:

### 11.1 JWT Secret Fallback

A hardcoded JWT secret fallback remains documented for deployment-impact review.

This has not been silently changed as part of the testing work.

---

### 11.2 Dead MIME Validation Constant

A MIME-validation-related constant in `StorageService` remains identified for cleanup.

---

### 11.3 Missing Case Unfinalize UI

A backend capability exists for case unfinalization, but the corresponding UI functionality remains a documented finding.

---

### 11.4 Missing Patient Archive/Reactivate UI

Patient archive/reactivate functionality remains documented as a UI-level finding.

---

### 11.5 Resolved Findings

The following previously identified issues have been resolved:

* Training-set deletion ownership gap
* Hardcoded live credentials in `config.txt` / `init.sql`

These should be documented as resolved findings in `BugLog.md`.

---

# 12. Overall Testing Statement

The Web-Based PAR Index System backend has undergone a structured testing process covering authentication, authorization, access control, PAR calculations, geometric landmark processing, file security, case management, training-set management, ML endpoint security, and landmark controller validation.

As of **24 September 2026**, the complete automated backend test suite has been cleanly rebuilt and executed with:

```text
15 test classes
123 tests
123 passed
0 failed
0 errors
0 skipped
BUILD SUCCESS
```

The result demonstrates that all currently implemented automated tests pass successfully under the verified test environment.

However, the result should not be interpreted as complete code coverage or as proof that every deployment, external ML-service interaction, or UI behavior has been exhaustively tested.

The current testing milestone can therefore be accurately recorded as:

> **Backend automated testing: 123/123 tests passed, 0 failures, 0 errors, 0 skipped, verified using `mvn clean test` on 24 September 2026.**
