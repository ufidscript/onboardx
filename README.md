# OnboardX (local demo)

A local single-user app for saving community handover notes, asking source-backed questions, and producing a cited handover draft. This is a local demo — no cloud services required.

Prerequisites
- Node.js 18+ and npm
- Ollama installed with a local model (recommended: gemma3:1b)

Setup
1. Create a local .env (copy .env.example):
   Copy-Item .env.example .env
   Edit .env if needed (default uses gemma3:1b and ports 3000/5178)

2. Start server (separate shell):
   cd C:\projects\onboardx\server
   npm install
   npm start

3. Start client (separate shell):
   cd C:\projects\onboardx\client
   npm install
   npm run dev

URLs
- UI (Vite dev): http://localhost:5178
- API server: http://localhost:3000
- Health: http://localhost:3000/api/health

Quick smoke tests (PowerShell):
$health = Invoke-RestMethod -UseBasicParsing 'http://localhost:3000/api/health'
Write-Host "HEALTH: $($health.status) memories=$($health.memories) ollama=$($health.ollama)"

# Ask examples
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/ask' -ContentType 'application/json' -Body '{"question":"When did installation problems delay the start?"}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/ask' -ContentType 'application/json' -Body '{"question":"What is the server password?"}'

Notes
- The server reads .env from the repository root so start commands work whether you run them from project root or the server folder.
- Do not commit your .env. .env.example is safe to commit.
- This project is a local demo; a hosted live demo is optional for Hacktoberfest and not required.

License / Attribution
- Co-authored-by trailer may appear in commits if you accept Copilot's assistance. Remove it if you prefer.
