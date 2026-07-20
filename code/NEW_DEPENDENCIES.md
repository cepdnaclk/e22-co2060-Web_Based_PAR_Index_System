# NEW_DEPENDENCIES.md
# Dependencies required by the ML integration that are NOT already in pom.xml or package.json.
# REQUIREMENT 17: Every new dependency listed here with exact coordinates.

---

## Java (Maven — add to pom.xml)

No new Java dependencies are required.

All ML integration code (MLClientService, MLService, RestTemplateConfig) uses only:
- `spring-boot-starter-web` → RestTemplate, HttpEntity, ResponseEntity, HttpHeaders
- `spring-boot-starter-data-jpa` → @Version, optimistic locking, JPA repositories
- `lombok` → @Slf4j, @RequiredArgsConstructor, @Builder
- `jackson-databind` → ObjectMapper, JsonNode (already on classpath via spring-boot-starter-web)

---

## Python (ML Engine — in requirements_ml.txt)

The following are **new** compared to the accepted system's Python dependencies:

| Package                 | Version  | Why needed                                         |
|-------------------------|----------|----------------------------------------------------|
| `slowapi`               | 0.1.9    | REQUIREMENT 9: Rate limiting on `/predict` endpoint (max 10/minute) |
| `filelock`              | 3.13.4   | REQUIREMENT 14: Concurrent-safe `.pt` file writes in preprocessor and model_store |
| `pydantic-settings`     | 2.2.1    | FastAPI settings management (loads from `.env`)    |
| `mysql-connector-python`| 8.3.0    | REQUIREMENT 14: DB access in dataset_preprocessor.py |
| `python-dotenv`         | 1.0.1    | REQUIREMENT 16: Load `.env` credentials in preprocessor |

Packages already present in the ML version zips (fastapi, uvicorn, torch, trimesh, numpy) are not listed again.

---

## React / npm

No new npm packages are required.

All React changes (ErrorBoundary, MLStatusPanel, STLViewer updates) use only:
- `three` + `three/examples/jsm/loaders/STLLoader` + `three/examples/jsm/controls/OrbitControls` — already in package.json
- `react-router-dom` — already in package.json
- `axios` — already in package.json

**NOT added (per REQUIREMENT 17):**
- babylon.js ✗
- react-three-fiber ✗
- @react-three/fiber ✗
- Any other 3D library ✗
