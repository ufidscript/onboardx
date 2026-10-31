# OnboardX (local demo)

Purpose: local, synthetic demo of handover notes, retrieval-backed QA and export. This repo implements the MVP described in onboardxPrd.md.

Status: Stage 0 inspection completed. Node.js is not installed in this environment; Ollama is present (version 0.40.13). Git is available (2.56.0).

Prerequisites (developer machine):
- Node.js 18+ LTS (install from https://nodejs.org/)
- npm (bundled with Node)
- Ollama installed with a local model (default: gemma3:1b)

Quick start (after installing Node and dependencies):

Server (open terminal 1):
  cd C:\projects\onboardx\server
  npm install express
  npm start

Client (open terminal 2):
  cd C:\projects\onboardx\client
  npm install react react-dom vite @vitejs/plugin-react
  npm run dev

Visit http://localhost:5173, click "Load sample community" then ask a question.

Do not commit secrets or model weights.
