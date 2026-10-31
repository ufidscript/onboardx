Stage 0 — Inspection (done)
- [x] Inspect repository files — PRD, client and server scaffolding present
- [x] Check runtime availability: Ollama present; Node/npm may be required locally to run the app (was missing in one runtime environment earlier)

Stage 1: Minimal working app skeleton (no model calls)
- [x] server: Express app with JSON-file persistence, basic /api/health and /api/demo/load
- [x] client: Vite + React skeleton with Overview, Archive, Ask, Handover pages (interactive UI)
- [x] API proxy for dev with Vite (client/vite.config.js proxies /api → server)
- [ ] Sample data JSON in server/samples/ (8 fictional records) — NOT implemented. Instead the server provides an idempotent /api/demo/load endpoint that injects synthetic sample records at runtime.

Stage 2: Archive CRUD and persistence
- [x] Implement memory create/read/update/delete backed by server/data/archive.json
- [x] Chunking and simple keyword retrieval (paragraph-aware chunking, stable chunk ids)
- [x] Search endpoint /api/memories?q= (title + chunk content matching)

Stage 3: Ollama integration and Ask
- [x] Add model service wrapper — implemented using the local Ollama CLI invocation (child_process spawn 'ollama run <model> --format json')
  - Note: the implementation uses the Ollama CLI (spawn) not an HTTP API.
- [x] Implement /api/ask: retrieval → prompt construction → model call → validated structured JSON response
- [x] Handle abstention when no evidence (status: insufficient_evidence) and do NOT show supporting sources for abstentions

Stage 4: Handover generation and export
- [x] Implement /api/handover generating sectioned draft with citations (server synthesises per-section JSON)
- [x] Client preview editor and Markdown export (Export Markdown button serialises draft and downloads .md)

Stage 5: polish, tests and demo prep
- [x] UI polish: Welcome page, navigation, Add memory prominence, editorial theme, Ask input layout fixes
- [x] Developer details collapsed (raw model output, chunk ids, offsets) — visible only in dev view
- [x] Basic smoke-test script added: scripts/smoke-test.ps1
- [ ] Automated tests / CI — not present
- [ ] Full UX polishing (pixel-perfect to supplied screenshot) — iterative

Tests actually run / verification performed
- [x] Static code inspection of server and client source files (reviewed endpoints and UI wiring)
- [x] Server start verification after installing dotenv (server started on http://localhost:3000 in the user's environment)
- [x] Vite dev server configuration updated and client served locally on http://localhost:5178 (user confirmed)
- [ ] I did not run the smoke-test.ps1 end-to-end in this sandbox; the script was added and pushed for you to run locally. The user ran their own local checks and reported the server and UI worked.

Notes and corrected descriptions
- Ollama integration: uses the local Ollama CLI via child_process spawn (command: `ollama run <model> --format json`) and the prompt is piped to stdin. This avoids shell interpolation of user input. The checklist previously said "HTTP API" — that is outdated for this codebase.
- Sample data: there is no committed server/samples JSON file; instead /api/demo/load inserts synthetic samples idempotently.
- ARCHIVE_PATH: server now resolves ARCHIVE_PATH relative to repo root so .env at repo root is respected even when starting from server/.

Outstanding / recommended next steps
- Add automated tests for /api/ask and /api/memories (server-side smoke/unit tests).
- Add a committed sample JSON (optional) if you prefer file-based seeds rather than runtime injection.
- Consider a modal Add-memory UX if you want the form to overlay the Welcome page instead of switching views.

Suggested commit message for these checklist updates:
"docs: update IMPLEMENTATION_CHECKLIST — reflect implemented features, Ollama CLI usage, and tests added"
