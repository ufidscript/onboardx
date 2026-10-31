Stage 0 — Inspection (done)
- [x] Inspect repository files — found onboardxPrd.md only
- [x] Check runtime availability: git, Ollama present; Node/npm missing (blocker)

Stage 1 (next): Minimal working app skeleton (no model calls)
- [ ] server: Express app with JSON-file persistence, basic /api/health and /api/demo/load
- [ ] client: Vite + React skeleton with Overview, Archive, Ask, Handover pages (static UI)
- [ ] API proxy for dev with Vite
- [ ] Sample data JSON in server/samples/ (8 fictional records)

Stage 2: Archive CRUD and persistence
- [ ] Implement memory create/read/update/delete (server/data/archive.json)
- [ ] Chunking and simple keyword retrieval
- [ ] Search endpoint /api/memories?q=

Stage 3: Ollama integration and Ask
- [ ] Add model service wrapper using Ollama HTTP API
- [ ] Implement /api/ask: retrieval → model → validated structured response
- [ ] Handle abstention when no evidence

Stage 4: Handover generation and export
- [ ] Implement /api/handover generating sectioned draft with citations
- [ ] Client preview editor and Markdown export

Stage 5: polish, tests and demo prep (reserve last 2 hours for recording and article)

Notes and blockers:
- Node/npm missing in this environment; install to continue development and run the local dev server.
- Ollama is present: version 0.40.13. Confirm model availability with `ollama list`.

Suggested commit message for Stage 0:
"chore: add README, gitignore and Stage 0 inspection notes"
