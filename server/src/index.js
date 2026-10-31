const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const fs = require('fs').promises;

// Port and data file resolution
const DEFAULT_PORT = 3000;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

let DATA_FILE;
if (process.env.ARCHIVE_PATH) {
  // Resolve ARCHIVE_PATH relative to the project when given as a relative path
  DATA_FILE = path.isAbsolute(process.env.ARCHIVE_PATH) ? process.env.ARCHIVE_PATH : path.resolve(__dirname, '..', '..', process.env.ARCHIVE_PATH);
} else {
  DATA_FILE = path.join(__dirname, '..', 'data', 'archive.json');
}

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (e) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify({ memories: [], chunks: [] }, null, 2), 'utf8');
  }
}

async function readData() {
  await ensureDataFile();
  const txt = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(txt);
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function chunkMemoryText(memory, maxSize = 900, overlap = 150) {
  const text = memory.content || '';
  // Split into paragraphs
  const paras = text.split(/\r?\n\r?\n|\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let cursor = 0;
  let globalIndex = 0;

  // Reconstruct with paragraphs while keeping offsets
  let cumulative = '';
  for (let i = 0; i < paras.length; i++) {
    if (cumulative.length > 0) cumulative += '\n\n';
    cumulative += paras[i];
  }

  // Fallback: if no paragraphs, use whole text
  const source = cumulative || text;

  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + maxSize, source.length);
    // try to expand end to a sentence or whitespace backward for nicer boundaries
    if (end < source.length) {
      const lastSpace = source.lastIndexOf(' ', end);
      if (lastSpace > start) end = lastSpace;
    }
    const content = source.slice(start, end).trim();
    const chunk = {
      id: `chunk-${memory.id || generateId('mem')}-${globalIndex}`,
      memory_id: memory.id,
      content,
      start_offset: start,
      end_offset: end
    };
    chunks.push(chunk);
    globalIndex++;
    if (end >= source.length) break;
    start = Math.max(0, end - overlap);
  }

  // Ensure at least one chunk
  if (chunks.length === 0 && source.length > 0) {
    chunks.push({ id: `chunk-${memory.id || generateId('mem')}-0`, memory_id: memory.id, content: source, start_offset: 0, end_offset: source.length });
  }

  return chunks;
}

const { spawn } = require('child_process');
const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const data = await readData();
    // Check Ollama availability by attempting `ollama ps` (non-blocking)
    let ollamaAvailable = false;
    try {
      const ps = spawn('ollama', ['ps']);
      ps.on('error', () => {});
      ollamaAvailable = true;
    } catch (_) {
      ollamaAvailable = false;
    }

    res.json({ status: 'ok', memories: (data.memories || []).length, chunks: (data.chunks || []).length, ollama: ollamaAvailable });
  } catch (err) {
    res.status(500).json({ error: { code: 'READ_ERROR', message: err.message } });
  }
});

// Create memory
app.post('/api/memories', async (req, res) => {
  try {
    const { title, content, category, author_label, occurred_on } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) return res.status(400).json({ error: { code: 'INVALID_TITLE' } });
    if (!content || typeof content !== 'string' || content.trim().length < 20 || content.trim().length > 12000) return res.status(400).json({ error: { code: 'INVALID_CONTENT' } });
    const data = await readData();
    const id = generateId('mem');
    const now = new Date().toISOString();
    const memory = { id, title: title.trim(), content: content.trim(), category: (category||'').trim(), author_label: (author_label||null), occurred_on: occurred_on || null, synthetic: false, created_at: now, updated_at: now };
    data.memories.push(memory);
    // create chunks
    const chunks = chunkMemoryText(memory);
    data.chunks = (data.chunks || []).filter(c => c.memory_id !== memory.id).concat(chunks);
    await writeData(data);
    res.status(201).json({ memory, chunks: chunks.map(c => ({ id: c.id, excerpt: c.content.slice(0,200) })) });
  } catch (err) {
    res.status(500).json({ error: { code: 'CREATE_FAILED', message: err.message } });
  }
});

// List / search memories
app.get('/api/memories', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const category = (req.query.category || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const per_page = Math.min(50, Math.max(1, parseInt(req.query.per_page || '10')));
    const data = await readData();
    let memories = data.memories || [];

    if (category) memories = memories.filter(m => (m.category||'').toLowerCase() === category);

    if (q) {
      const matchedMemoryIds = new Set();
      // search titles
      for (const m of memories) {
        if ((m.title||'').toLowerCase().includes(q)) matchedMemoryIds.add(m.id);
      }
      // search chunks
      for (const c of data.chunks || []) {
        if (c.content && c.content.toLowerCase().includes(q)) matchedMemoryIds.add(c.memory_id);
      }
      memories = memories.filter(m => matchedMemoryIds.has(m.id));
    }

    const total = memories.length;
    const paged = memories.slice((page-1)*per_page, page*per_page);
    res.json({ total, page, per_page, memories: paged.map(m => ({ id: m.id, title: m.title, category: m.category, excerpt: (m.content||'').slice(0,200) })) });
  } catch (err) {
    res.status(500).json({ error: { code: 'SEARCH_FAILED', message: err.message } });
  }
});

// Get memory detail including chunks
app.get('/api/memories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = await readData();
    const memory = (data.memories || []).find(m => m.id === id);
    if (!memory) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const chunks = (data.chunks || []).filter(c => c.memory_id === id);
    res.json({ memory, chunks });
  } catch (err) {
    res.status(500).json({ error: { code: 'READ_FAILED', message: err.message } });
  }
});

// Update memory
app.patch('/api/memories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = await readData();
    const idx = (data.memories || []).findIndex(m => m.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const memory = data.memories[idx];
    const allowed = ['title','content','category','author_label','occurred_on'];
    let changed = false;
    for (const k of allowed) {
      if (k in req.body) {
        memory[k] = req.body[k];
        changed = true;
      }
    }
    if (changed) memory.updated_at = new Date().toISOString();
    // rebuild chunks for this memory
    data.chunks = (data.chunks || []).filter(c => c.memory_id !== id).concat(chunkMemoryText(memory));
    data.memories[idx] = memory;
    await writeData(data);
    res.json({ memory });
  } catch (err) {
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

// Delete memory
app.delete('/api/memories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = await readData();
    const before = (data.memories || []).length;
    data.memories = (data.memories || []).filter(m => m.id !== id);
    data.chunks = (data.chunks || []).filter(c => c.memory_id !== id);
    await writeData(data);
    const after = data.memories.length;
    res.json({ deleted: before - after });
  } catch (err) {
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

// Idempotent sample loader (rebuilds chunks)
app.post('/api/demo/load', async (req, res) => {
  try {
    const data = await readData();
    const existingIds = new Set((data.memories || []).map(m => m.id));

    const samples = [
      {
        id: 'mem-venue-1',
        synthetic: true,
        title: 'Workshop venue decision',
        category: 'decision',
        content: 'We chose the library because it had reliable power and seating.',
        author_label: 'Outgoing lead (synthetic)',
        occurred_on: '2026-09-10',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-workshop-1',
        synthetic: true,
        title: 'First workshop report',
        category: 'event report',
        content: 'Installation problems delayed the start by 30 minutes.',
        author_label: 'Event notes (synthetic)',
        occurred_on: '2026-09-11',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-lesson-1',
        synthetic: true,
        title: 'Lesson learned: setup instructions',
        category: 'lesson learned',
        content: 'Share setup instructions at least two days ahead.',
        author_label: 'Organizer (synthetic)',
        occurred_on: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-unfinished-1',
        synthetic: true,
        title: 'Unfinished: resource hub draft',
        category: 'unfinished work',
        content: 'Resource hub draft awaiting review in /team/resource-hub.',
        author_label: 'Documentation (synthetic)',
        occurred_on: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-handover-files-1',
        synthetic: true,
        title: 'Design files organisation',
        category: 'handover note',
        content: 'Design files are organised in a team folder; no private URL included.',
        author_label: 'Designer (synthetic)',
        occurred_on: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-volunteer-1',
        synthetic: true,
        title: 'Volunteer retrospective',
        category: 'retrospective',
        content: 'Check-in needed a second volunteer to manage sign-in.',
        author_label: 'Volunteer lead (synthetic)',
        occurred_on: '2026-09-11',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-venue-2',
        synthetic: true,
        title: 'Later venue note (contradiction)',
        category: 'note',
        content: 'We later recorded that the external cafe was preferred but unresolved.',
        author_label: 'Log (synthetic)',
        occurred_on: '2026-10-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mem-mission-1',
        synthetic: true,
        title: 'Community mission and term',
        category: 'context',
        content: 'Campus Builders Circle — leadership term 2026-09-01 to 2027-08-31.',
        author_label: 'Charter (synthetic)',
        occurred_on: '2026-09-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    let added = 0;
    for (const s of samples) {
      if (!existingIds.has(s.id)) {
        data.memories.push(s);
        added++;
      }
    }

    // rebuild all chunks freshly to ensure offsets
    const allChunks = [];
    for (const m of data.memories) {
      allChunks.push(...chunkMemoryText(m));
    }
    data.chunks = allChunks;

    if (added > 0) {
      await writeData(data);
    } else {
      // still persist chunk rebuild
      await writeData(data);
    }

    res.json({ added, total: data.memories.length });
  } catch (err) {
    res.status(500).json({ error: { code: 'DEMO_LOAD_FAILED', message: err.message } });
  }
});

// Serve built client in production (later)
const staticDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(staticDir));
  app.get('*', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

// Ask endpoint: retrieval -> local Ollama model -> validated structured response
app.post('/api/ask', async (req, res) => {
  const start = Date.now();
  try {
    const { question, model } = req.body || {};
    const modelName = model || DEFAULT_MODEL;
    if (!question || typeof question !== 'string' || question.trim().length < 5 || question.trim().length > 500) {
      return res.status(400).json({ error: { code: 'INVALID_QUESTION', message: 'Question must be 5-500 chars' } });
    }
    const q = question.trim().toLowerCase();
    const data = await readData();
    // Simple keyword match over chunks
    const matches = [];
    for (const c of data.chunks || []) {
      if (!c.content) continue;
      const lc = c.content.toLowerCase();
      if (lc.includes(q) || q.split(/\s+/).some(tok => tok && lc.includes(tok))) {
        matches.push(c);
      }
    }
    // Deduplicate by memory_id preserving order
    const byMemory = new Map();
    for (const c of matches) {
      if (!byMemory.has(c.memory_id)) byMemory.set(c.memory_id, []);
      byMemory.get(c.memory_id).push(c);
    }
    const flat = [];
    for (const [_memId, chs] of byMemory) {
      for (const ch of chs) flat.push(ch);
    }
    // Select up to 4 chunks, combined <= 4000 chars
    const selected = [];
    let totalChars = 0;
    for (const c of flat) {
      if (selected.length >= 4) break;
      if (totalChars + (c.content||'').length > 4000) break;
      selected.push(c);
      totalChars += (c.content||'').length;
    }

    if (selected.length === 0) {
      const duration_ms = Date.now() - start;
      return res.json({ status: 'insufficient_evidence', answer: null, citation_ids: [], gaps: ['No matching records found in local archive'], duration_ms });
    }

    // Build prompt
    let prompt = `You are a concise assistant that answers a single question using only the provided source chunks. Return ONLY a single JSON object with keys: status (answered|insufficient_evidence|conflicting_evidence), answer (string), citation_ids (array of chunk ids), gaps (array of strings). \n`;
    prompt += `Do NOT invent facts or claim information not present in the chunks. If the chunks disagree, set status to conflicting_evidence and list the relevant citation_ids. If evidence is insufficient to answer, set status to insufficient_evidence and leave answer empty.\n\n`;
    prompt += `Chunks:\n`;
    for (const c of selected) {
      prompt += `--- CHUNK id=${c.id} memory=${c.memory_id} offsets=${c.start_offset}-${c.end_offset} ---\n${c.content}\n\n`;
    }
    prompt += `Question: ${question}\n\nRespond with the JSON only.`;

    // Call Ollama CLI: `ollama run MODEL --format json` with prompt on stdin
    const runModel = (modelName, inputPrompt, timeoutMs = 120000) => new Promise((resolve, reject) => {
      const proc = spawn('ollama', ['run', modelName, '--format', 'json']);
      let stdout = '';
      let stderr = '';
      const to = setTimeout(() => {
        proc.kill();
        reject(new Error('MODEL_TIMEOUT'));
      }, timeoutMs);
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('error', err => { clearTimeout(to); reject(err); });
      proc.on('close', code => { clearTimeout(to); if (code !== 0) return reject(new Error(`MODEL_EXIT_${code} ${stderr}`)); resolve(stdout); });
      // write prompt to stdin then end
      proc.stdin.write(inputPrompt);
      proc.stdin.end();
    });

    let modelText;
    try {
      modelText = await runModel(modelName, prompt, 110000);
    } catch (err) {
      const duration_ms = Date.now() - start;
      return res.status(503).json({ error: { code: 'MODEL_UNAVAILABLE', message: String(err) }, duration_ms });
    }

    // Extract first JSON object from modelText
    const jsonMatch = modelText.match(/\{[\s\S]*?\}\s*/);
    if (!jsonMatch) {
      const duration_ms = Date.now() - start;
      return res.status(502).json({ error: { code: 'MODEL_INVALID_RESPONSE', message: 'No JSON found in model output', model_output: modelText.slice(0,2000) }, duration_ms });
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      const duration_ms = Date.now() - start;
      return res.status(502).json({ error: { code: 'MODEL_INVALID_JSON', message: err.message, model_output: modelText.slice(0,2000) }, duration_ms });
    }

    // Validate shape
    const allowedStatuses = new Set(['answered','insufficient_evidence','conflicting_evidence']);
    if (!parsed || !allowedStatuses.has(parsed.status) || (parsed.status === 'answered' && (!parsed.citation_ids || parsed.citation_ids.length === 0))) {
      // one retry requesting strict JSON only
      const retryPrompt = `ONLY OUTPUT THE JSON OBJECT. ${prompt}`;
      let retryText;
      try {
        retryText = await runModel(modelName, retryPrompt, 60000);
        const jm = retryText.match(/\{[\s\S]*?\}\s*/);
        if (jm) parsed = JSON.parse(jm[0]);
      } catch (e) {
        // ignore retry failure
      }
    }

    // Final validation
    if (!parsed || !allowedStatuses.has(parsed.status)) {
      const duration_ms = Date.now() - start;
      return res.status(502).json({ error: { code: 'MODEL_BAD_SCHEMA', message: 'Model did not produce valid structured response', model_output: modelText.slice(0,2000) }, duration_ms });
    }
    // Ensure citation ids are known
    const knownChunkIds = new Set((selected||[]).map(c => c.id));
    const citationOk = (parsed.citation_ids || []).every(id => knownChunkIds.has(id));
    if (!citationOk && parsed.status === 'answered') {
      const duration_ms = Date.now() - start;
      return res.status(502).json({ error: { code: 'MODEL_REFERENCED_UNKNOWN_CHUNKS', message: 'Model cited unknown chunk ids', cited: parsed.citation_ids, known: Array.from(knownChunkIds) }, duration_ms });
    }

    const duration_ms = Date.now() - start;

    // Resolve cited chunk ids to memory titles and exact excerpts
    const resolved = [];
    const allChunks = data.chunks || [];
    const allMemories = data.memories || [];
    const chunkById = new Map(allChunks.map(c => [c.id, c]));
    const memById = new Map(allMemories.map(m => [m.id, m]));
    for (const cid of (parsed.citation_ids || [])) {
      const c = chunkById.get(cid);
      if (!c) continue;
      const mem = memById.get(c.memory_id);
      resolved.push({ chunk_id: c.id, memory_id: c.memory_id, memory_title: mem ? mem.title : null, content: c.content, start_offset: c.start_offset, end_offset: c.end_offset });
    }

    return res.json({ status: parsed.status, answer: parsed.answer, citation_ids: parsed.citation_ids || [], citations: resolved, gaps: parsed.gaps || [], duration_ms, model: modelName });

  } catch (err) {
    const duration_ms = Date.now() - start;
    res.status(500).json({ error: { code: 'ASK_FAILED', message: err.message }, duration_ms });
  }
});

// Handover generation endpoint
// Produces draft sections using bounded relevant records and model-assisted synthesis
app.post('/api/handover', async (req, res) => {
  const start = Date.now();
  try {
    const { model } = req.body || {};
    const modelName = model || DEFAULT_MODEL;
    const data = await readData();
    const chunks = data.chunks || [];
    const memories = data.memories || [];

    function selectChunksByFilter(filterFn, limit = 4, charLimit = 4000) {
      const selected = [];
      let total = 0;
      for (const c of chunks) {
        const mem = memories.find(m => m.id === c.memory_id);
        if (!mem) continue;
        if (!filterFn(mem, c)) continue;
        if (selected.length >= limit) break;
        if (total + (c.content||'').length > charLimit) break;
        selected.push(c);
        total += (c.content||'').length;
      }
      return selected;
    }

    const sections = [
      { key: 'context', title: 'Community context', filter: (m,c) => (m.category||'').toLowerCase() === 'context' || (m.title||'').toLowerCase().includes('mission') },
      { key: 'documented_decisions', title: 'Documented decisions', filter: (m,c) => (m.category||'').toLowerCase() === 'decision' || (m.category||'').toLowerCase().includes('decision') },
      { key: 'lessons', title: 'Lessons learned', filter: (m,c) => (m.category||'').toLowerCase().includes('lesson') || (m.category||'').toLowerCase().includes('retrospective') },
      { key: 'unfinished_work', title: 'Unfinished work', filter: (m,c) => (m.category||'').toLowerCase().includes('unfinished') || ((m.content||'').toLowerCase().includes('awaiting') || (m.content||'').toLowerCase().includes('awaiting review')) },
      { key: 'gaps', title: 'Gaps and open questions', filter: (m,c) => false }
    ];

    const runModel = (modelName, inputPrompt, timeoutMs = 120000) => new Promise((resolve, reject) => {
      const proc = spawn('ollama', ['run', modelName, '--format', 'json']);
      let stdout = '';
      let stderr = '';
      const to = setTimeout(() => {
        proc.kill();
        reject(new Error('MODEL_TIMEOUT'));
      }, timeoutMs);
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('error', err => { clearTimeout(to); reject(err); });
      proc.on('close', code => { clearTimeout(to); if (code !== 0) return reject(new Error(`MODEL_EXIT_${code} ${stderr}`)); resolve(stdout); });
      proc.stdin.write(inputPrompt);
      proc.stdin.end();
    });

    const draft = { generated_at: new Date().toISOString(), model: modelName, sections: [] };

    for (const s of sections) {
      const sel = selectChunksByFilter(s.filter, 4, 4000);
      if (sel.length === 0) {
        draft.sections.push({ key: s.key, title: s.title, text: '', citations: [] });
        continue;
      }
      // Build prompt for section
      let prompt = `You are a concise assistant that composes a short draft section titled: ${s.title}. Use ONLY the provided chunks. Return ONLY a JSON object with keys: text (string), citation_ids (array of chunk ids). Do NOT invent facts.\n\n`;
      prompt += `Chunks:\n`;
      for (const c of sel) {
        prompt += `--- CHUNK id=${c.id} memory=${c.memory_id} offsets=${c.start_offset}-${c.end_offset} ---\n${c.content}\n\n`;
      }
      prompt += `Compose a short paragraph (3-5 sentences) for the section '${s.title}' that summarizes the evidence and cites chunk ids in citation_ids. Output JSON only.`;

      let modelText;
      try {
        modelText = await runModel(modelName, prompt, 110000);
      } catch (err) {
        return res.status(503).json({ error: { code: 'MODEL_UNAVAILABLE', message: String(err) }, duration_ms: Date.now()-start });
      }
      const jm = modelText.match(/\{[\s\S]*?\}\s*/);
      if (!jm) {
        return res.status(502).json({ error: { code: 'MODEL_INVALID_RESPONSE', message: 'No JSON in model output', model_output: modelText.slice(0,2000) } });
      }
      let parsed;
      try { parsed = JSON.parse(jm[0]); } catch (e) { return res.status(502).json({ error: { code: 'MODEL_INVALID_JSON', message: e.message, model_output: modelText.slice(0,2000) } }); }
      // validate
      if (!parsed || typeof parsed.text !== 'string' || !Array.isArray(parsed.citation_ids)) {
        return res.status(502).json({ error: { code: 'MODEL_BAD_SCHEMA', message: 'Model schema invalid', model_output: modelText.slice(0,2000) } });
      }
      // Resolve citations
      const chunkById = new Map(chunks.map(c => [c.id,c]));
      const memById = new Map(memories.map(m => [m.id,m]));
      const resolved = [];
      for (const cid of parsed.citation_ids) {
        const cobj = chunkById.get(cid);
        if (!cobj) continue;
        const mem = memById.get(cobj.memory_id);
        resolved.push({ chunk_id: cobj.id, memory_id: cobj.memory_id, memory_title: mem ? mem.title : null, content: cobj.content, start_offset: cobj.start_offset, end_offset: cobj.end_offset });
      }
      draft.sections.push({ key: s.key, title: s.title, text: parsed.text, citations: resolved });
    }

    // Also collect sources list
    const sources = ([]).concat(...draft.sections.map(sec => sec.citations)).map(c => ({ memory_id: c.memory_id, memory_title: c.memory_title })).filter((v,i,a)=>i===a.findIndex(x=>x.memory_id===v.memory_id));

    return res.json({ draft, sources, duration_ms: Date.now()-start });
  } catch (err) {
    res.status(500).json({ error: { code: 'HANDOVER_FAILED', message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`OnboardX server listening on http://localhost:${PORT}`);
});
