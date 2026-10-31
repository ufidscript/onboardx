# OnboardX

**Keep your community's memory when its leaders change.**

OnboardX is a local, AI-powered handover tool. It stores the decisions, lessons and unfinished work that usually get lost when a community lead steps down, then lets the next person ask questions and get **source-backed answers** and generate an **editable, cited handover draft**.

Everything runs on your machine using [Gemma](https://ai.google.dev/gemma) through [Ollama](https://ollama.com). No cloud services, no API keys, and your notes never leave your computer.

<img width="948" height="419" alt="image" src="https://github.com/user-attachments/assets/126254d9-6b2c-4e3c-9e00-b4f3db232b91" />


> **Status:** local single-user demo. It is built for trying the idea out, not for multi-user or production use.

## Why OnboardX

When a community lead, organiser or volunteer moves on, the context goes with them: why a decision was made, what went wrong last time, what was left half-finished. New leaders end up repeating old mistakes or digging through old chats.

OnboardX turns those scattered notes into something the next person can search and trust.

## Features

- **Save handover notes** covering decisions, lessons learned and unfinished work
- **Ask questions in plain language** and get answers grounded in your own notes
- **See the sources** behind every answer, with the note title and the exact passage used
- **Honest "I don't know"**: if your notes don't contain the answer, the app says so instead of guessing
- **Generate a handover draft** with citations that you can edit before sharing
- **Fully local**: runs offline once Ollama and the model are installed

## How it works

```
React (Vite) client  →  Express API  →  Ollama (Gemma)
     :5178                 :3000            :11434
```

1. Notes are saved as "memories" and split into smaller chunks.
2. When you ask a question, the API finds the most relevant chunks.
3. Only those chunks are passed to the model, which answers using them and returns the chunk IDs it relied on.
4. The API resolves those IDs into citations (note title plus excerpt) so you can verify the answer.

<!-- TODO: confirm how chunks are retrieved (keyword match, embeddings, etc.) and where memories are stored (in-memory, JSON file, SQLite) and say so here. -->

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer, with npm
- [Ollama](https://ollama.com/download) installed and running

### 1. Pull the model

```bash
ollama pull gemma3:1b
```

`gemma3:1b` is small and runs on most laptops. You can use a larger Gemma model for better answers (see [Configuration](#configuration)).

### 2. Clone and configure

```bash
git clone https://github.com/ufidscript/onboardx.git
cd onboardx
```

Create your local `.env` file:

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
```

The defaults work out of the box, so you only need to edit `.env` if your setup differs.

### 3. Start the API server

In one terminal:

```bash
cd server
npm install
npm start
```

### 4. Start the client

In a second terminal:

```bash
cd client
npm install
npm run dev
```

### 5. Open the app

| What | URL |
| --- | --- |
| UI (Vite dev server) | http://localhost:5178 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |

## Configuration

Settings live in `.env` at the repository root. The server reads it from there, so you can start it from either the project root or the `server` folder.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the API server listens on |
| `OLLAMA_MODEL` | `gemma3:1b` | Ollama model used to answer questions. Run `ollama pull <model>` first |
| `OLLAMA_HOST` | `localhost` | Host where Ollama is running |
| `OLLAMA_PORT` | `11434` | Port Ollama listens on (its default) |
| `NODE_ENV` | `development` | Node environment |

> Never commit your `.env`. `.env.example` is safe to commit.

<!-- TODO: the UI port 5178 is not in .env.example. If it is set in client/vite.config, mention that here. -->

## Try it

### Check that everything is connected

```bash
curl http://localhost:3000/api/health
```

The response reports the API status, how many memories and chunks are loaded, and whether Ollama is reachable. If `ollama` is not OK, see [Troubleshooting](#troubleshooting).

### Ask a question

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"When did installation problems delay the start?"}'
```

PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/ask' `
  -ContentType 'application/json' `
  -Body '{"question":"When did installation problems delay the start?"}'
```

The response includes:

| Field | Meaning |
| --- | --- |
| `status` | Whether the question could be answered from your notes |
| `answer` | The answer text, or empty if there wasn't enough evidence |
| `citation_ids` | IDs of the chunks the answer relied on |
| `citations` | Resolved sources, each with `memory_title`, `chunk_id` and `content` |

**Answerable question.** The example above matches the sample demo data, so you get an answer plus citations.

**Unanswerable question.** Try `"What is the server password?"`. Nothing in your notes covers this, so OnboardX should respond with an insufficient-evidence status and no answer rather than inventing one. This is the behaviour that makes the answers trustworthy.

### Run the smoke tests (Windows / PowerShell)

The script checks the health endpoint, then runs one answerable and one unanswerable question:

```powershell
./scripts/smoke-test.ps1
# or point it at different URLs
./scripts/smoke-test.ps1 -ApiUrl "http://localhost:3000" -UiUrl "http://localhost:5178"
```

<!-- TODO: replace smoke-test.ps1 with the real script filename. -->

## Project structure

```
onboardx/
├── client/                 React + Vite front end
├── server/                 Express API (notes, retrieval, Ollama calls)
├── scripts/                Helper scripts, including the PowerShell smoke test
├── docs/                   Product requirements and implementation checklist
├── .env.example            Template for local configuration
└── README.md
```

<!-- TODO: move onboardxPrd.md and IMPLEMENTATION_CHECKLIST.md into docs/ and update links. -->

## Troubleshooting

**Health check shows Ollama is unreachable**
Make sure Ollama is running (`ollama serve`, or open the Ollama app) and that `OLLAMA_HOST` and `OLLAMA_PORT` in `.env` match.

**Model not found**
Run `ollama pull gemma3:1b`, or whichever model `OLLAMA_MODEL` is set to.

**Requests time out or answers are slow**
The first request after startup loads the model into memory and can take a while, especially on CPU-only machines. Later requests are faster.

**Port already in use**
Change `PORT` in `.env`. If you change the API port, make sure the client is pointed at the new address.

## Limitations

- Single-user, local demo with no authentication or sync
- Answer quality depends on the model. `gemma3:1b` is fast but small, so a larger Gemma model will give better results
- Answers only reflect what has been saved, so gaps in your notes mean gaps in the answers

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes first, then submit a pull request.

<!-- TODO: add CONTRIBUTING.md and label some issues "good first issue". -->

## License

<!-- TODO: add a LICENSE file (e.g. MIT) and update this line. -->
Released under the [MIT License](LICENSE).
