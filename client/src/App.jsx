import React, { useEffect, useState } from 'react'

/*
  App structure:
  - Welcome view
  - Workspace with top nav: Archive / Ask / Handover
  - Add memory accessible via prominent button
*/

function Wordmark() {
  return (<div className="wordmark">OnboardX</div>)
}

function Welcome({ onOpenArchive, onLoadSamples, loadingSamples }) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-brand"><Wordmark /></div>
        <h1>The next team shouldn't start from zero.</h1>
        <p className="lede">Keep the decisions, lessons and unfinished work your community needs—even when leadership changes.</p>
        <div className="welcome-actions">
          <button className="primary" onClick={onOpenArchive}>Open my archive</button>
          <button className={"secondary " + (loadingSamples ? 'button-loading':'')} onClick={onLoadSamples} disabled={loadingSamples}>{loadingSamples ? 'Loading…' : 'Try a sample community'}</button>
        </div>
        <ol className="steps">
          <li><strong>Save memories.</strong> Capture decisions, lessons and unfinished work.</li>
          <li><strong>Ask the past.</strong> Get source-backed answers from saved notes.</li>
          <li><strong>Prepare the next team.</strong> Generate a handover draft and export Markdown.</li>
        </ol>
        <p className="note">This runs locally using your Ollama installation. No data leaves your machine.</p>
      </div>
    </div>
  )
}

function Nav({ currentTab, onChangeTab, onToggleAdd, onHome }) {
  return (
    <nav className="topnav">
      <div className="nav-left">
        <button className="wordmark-btn" onClick={onHome} aria-label="Home">
          <Wordmark />
        </button>
      </div>
      <div className="nav-center">
        <button className={currentTab==='archive'? 'active':''} onClick={()=>onChangeTab('archive')}>Archive</button>
        <button className={currentTab==='ask'? 'active':''} onClick={()=>onChangeTab('ask')}>Ask</button>
        <button className={currentTab==='handover'? 'active':''} onClick={()=>onChangeTab('handover')}>Handover</button>
      </div>
      <div className="nav-right">
        <button className="add-memory-btn" onClick={onToggleAdd}>Add memory</button>
      </div>
    </nav>
  )
}

function Overview({ health }) {
  return (
    <section className="overview">
      <p>Memories: <strong>{health ? health.memories : '—'}</strong></p>
    </section>
  )
}

function AddMemory({ onCreated, visible, onClose }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('decision')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')
  const [occurred_on, setOccurredOn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(()=>{ if (!visible) setError(null) }, [visible])

  async function create() {
    setError(null)
    if (title.trim().length < 3) return setError('Title must be at least 3 characters')
    if (content.trim().length < 20) return setError('Content must be at least 20 characters')
    setLoading(true)
    try {
      const body = { title, category, content, author_label: author || null, occurred_on: occurred_on || null }
      const res = await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js && js.error ? js.error.message || js.error.code : `Server error ${res.status}`)
      } else {
        const js = await res.json()
        onCreated && onCreated(js.memory)
        // keep inputs but clear to indicate success while user can still edit
        setTitle(''); setContent(''); setAuthor(''); setOccurredOn('')
        onClose && onClose()
      }
    } catch (e) {
      setError('Connection error: ' + e.message)
    } finally { setLoading(false) }
  }

  if (!visible) return null
  return (
    <section className="panel add-memory">
      <h3>Add a memory</h3>
      <label>Title <span className="hint">(3–120 chars)</span>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Workshop venue decision" />
      </label>
      <label>Category
        <select value={category} onChange={e=>setCategory(e.target.value)}>
          <option>decision</option>
          <option>event report</option>
          <option>lesson learned</option>
          <option>unfinished work</option>
          <option>handover note</option>
          <option>retrospective</option>
          <option>context</option>
          <option>general</option>
        </select>
      </label>
      <label>Content <span className="hint">(min 20 chars)</span>
        <textarea value={content} onChange={e=>setContent(e.target.value)} rows={6} placeholder="Describe what happened, decisions, and next steps." />
      </label>
      <div className="row">
        <label>Author (optional)
          <input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Outgoing lead (optional)" />
        </label>
        <label>Occurred on (optional)
          <input value={occurred_on} onChange={e=>setOccurredOn(e.target.value)} placeholder="YYYY-MM-DD" />
        </label>
      </div>
      <div className="row">
        <button className={"primary " + (loading ? 'button-loading':'')} onClick={create} disabled={loading}>{loading? 'Saving…':'Save memory'}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function Archive({ onView, refreshKey }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ search() }, [refreshKey])

  async function search() {
    setLoading(true)
    try {
      const url = '/api/memories?q=' + encodeURIComponent(q)
      const res = await fetch(url)
      const js = await res.json()
      setList(js.memories || [])
    } catch (e) {
      setList([])
    } finally { setLoading(false) }
  }

  return (
    <section className="panel archive">
      <div className="panel-header">
        <h2>Archive</h2>
        <div className="search-row">
          <input placeholder="Search archive" value={q} onChange={e=>setQ(e.target.value)} />
          <button onClick={search} disabled={loading}>Search</button>
        </div>
      </div>
      <ul className="record-list">
        {list.map(m=> (
          <li key={m.id} className="record">
            <div className="record-main">
              <button className="record-title" onClick={()=>onView(m.id)}>{m.title}</button>
              <div className="meta">{m.category}</div>
            </div>
            <p className="excerpt">{m.excerpt}</p>
          </li>
        ))}
        {list.length===0 && <li className="empty">No records. Use "Add memory" or load the sample community.</li>}
      </ul>
    </section>
  )
}

function MemoryDetail({ memory, chunks, onClose, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(memory ? memory.title : '')
  const [category, setCategory] = useState(memory ? memory.category : '')
  const [content, setContent] = useState(memory ? memory.content : '')
  const [author, setAuthor] = useState(memory ? memory.author_label : '')
  const [occurred_on, setOccurredOn] = useState(memory ? memory.occurred_on : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (memory) {
      setTitle(memory.title); setCategory(memory.category); setContent(memory.content); setAuthor(memory.author_label); setOccurredOn(memory.occurred_on || '')
    }
  }, [memory])

  if (!memory) return null

  async function save() {
    setError(null)
    if (title.trim().length < 3) return setError('Title too short')
    if (content.trim().length < 20) return setError('Content too short')
    setLoading(true)
    try {
      const body = { title, category, content, author_label: author || null, occurred_on: occurred_on || null }
      const res = await fetch('/api/memories/' + encodeURIComponent(memory.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js && js.error ? js.error.code : `Server error ${res.status}`)
      } else {
        const js = await res.json()
        onUpdated && onUpdated(js.memory)
        setEditing(false)
      }
    } catch (e) {
      setError('Connection error: ' + e.message)
    } finally { setLoading(false) }
  }

  async function remove() {
    if (!confirm('Delete this memory? This cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/memories/' + encodeURIComponent(memory.id), { method: 'DELETE' })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js && js.error ? js.error.code : `Server error ${res.status}`)
      } else {
        onDeleted && onDeleted(memory.id)
      }
    } catch (e) {
      setError('Connection error: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <section className="panel detail">
      <div className="panel-header">
        <h2>{editing ? 'Edit memory' : memory.title}</h2>
        <div className="meta">{memory.category} · {memory.author_label || '—'} · {memory.occurred_on || '—'}</div>
      </div>
      {!editing && <div className="content" style={{whiteSpace:'pre-wrap'}}>{memory.content}</div>}
      {editing && (
        <div className="edit-form">
          <input value={title} onChange={e=>setTitle(e.target.value)} />
          <input value={category} onChange={e=>setCategory(e.target.value)} />
          <textarea value={content} onChange={e=>setContent(e.target.value)} rows={6} />
        </div>
      )}

      <h3>Source excerpts</h3>
      <ol>
        {chunks.map(c => (
          <li key={c.id}><div className="excerpt-small">{c.content}</div><small className="dev">{c.id} · offsets {c.start_offset}-{c.end_offset}</small></li>
        ))}
      </ol>

      {error && <p className="error">{error}</p>}

      <div className="row">
        {editing ? (
          <>
            <button className="primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
            <button onClick={()=>setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={()=>setEditing(true)}>Edit</button>
            <button onClick={remove} disabled={loading}>Delete</button>
            <button onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </section>
  )
}

function Ask() {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [devOpen, setDevOpen] = useState(false)

  async function ask() {
    setError(null)
    setResult(null)
    const question = (q || '').trim()
    if (question.length < 5) return setError('Question must be at least 5 characters')
    setLoading(true)
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        const msg = js && js.error ? `${js.error.code}: ${js.error.message}` : `Server error ${res.status}`
        setError(msg)
      } else {
        const js = await res.json()
        setResult(js)
      }
    } catch (e) {
      setError('Connection error: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <section className="panel ask">
      <div className="panel-header">
        <h2>Ask the archive</h2>
      </div>
      <div className="ask-row">
        <input placeholder="Ask a question (e.g. Why did we choose the library?)" value={q} onChange={e=>setQ(e.target.value)} />
        <button className={"primary " + (loading ? 'button-loading':'')} onClick={ask} disabled={loading}>{loading ? 'Asking…' : 'Ask'}</button>
      </div>
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <h3>Answer</h3>
          {result.status === 'insufficient_evidence' ? (
            <p className="muted">I couldn't find that in the saved records.</p>
          ) : (
            <div className="answer">{result.answer}</div>
          )}
          <p className="meta">Status: {result.status} · {result.duration_ms}ms</p>

          {(result.status !== 'insufficient_evidence' && result.citations && result.citations.length>0) && (
            <div className="sources">
              <h4>Sources</h4>
              <ol>
                {result.citations.map(c => (
                  <li key={c.chunk_id} className="source-card">
                    <div className="source-title">{c.memory_title || c.memory_id}</div>
                    <div className="excerpt-small">{c.content}</div>
                    <details className="dev"><summary>Developer details</summary><div>chunk id: {c.chunk_id}<br/>offsets: {c.start_offset}-{c.end_offset}</div></details>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.gaps && result.gaps.length > 0 && (
            <div>
              <h4>Gaps</h4>
              <ul>{result.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>
            </div>
          )}

          <details open={false} className="dev">
                      <summary>Developer details</summary>
                      <div>Model: {result.model}</div>
                      <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result, null, 2)}</pre>
                    </details>
        </div>
      )}
    </section>
  )
}

function Handover() {
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)

  async function generate() {
    setError(null)
    setDraft(null)
    setLoading(true)
    try {
      const res = await fetch('/api/handover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js && js.error ? `${js.error.code}: ${js.error.message}` : `Server error ${res.status}`)
      } else {
        const js = await res.json()
        setDraft(js.draft)
      }
    } catch (e) {
      setError('Connection error: ' + e.message)
    } finally { setLoading(false) }
  }

  function exportMarkdown() {
    if (!draft) return
    let md = `# Handover draft\n\nGenerated: ${draft.generated_at} · Model: ${draft.model} \n\n`;
    for (const s of draft.sections) {
      md += `## ${s.title}\n\n`;
      md += (s.text || '*No content generated.*') + '\n\n';
      if (s.citations && s.citations.length>0) {
        md += `Sources:\n`;
        for (const c of s.citations) md += `- ${c.memory_title || c.memory_id}: "${c.content.replace(/\n/g,' ')}"\n`;
        md += '\n';
      }
    }
    md += `\n> Note: This draft was generated from saved records. User edits may invalidate citations.\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handover-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel handover">
      <h2>Handover draft</h2>
      <div className="row">
        <button className={"primary " + (loading ? 'button-loading':'')} onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate draft'}</button>
        <button onClick={exportMarkdown} disabled={!draft}>Export Markdown</button>
      </div>
      {error && <p className="error">{error}</p>}
      {draft && (
        <div className="draft-preview">
          {draft.sections.map(s => (
            <div key={s.key} className="draft-section">
              <h3>{s.title}</h3>
              <textarea defaultValue={s.text} rows={4} />
              {s.citations && s.citations.length>0 && (
                <div>
                  <h4>Sources</h4>
                  <ol>
                    {s.citations.map(c => (
                      <li key={c.chunk_id}><strong>{c.memory_title || c.memory_id}</strong>: {c.content}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)

  const [showWelcome, setShowWelcome] = useState(true)
  const [currentTab, setCurrentTab] = useState('archive')
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({status:'unavailable', ollama:false, memories:0}))
  }, [])

  const [loadingSamples, setLoadingSamples] = useState(false)

  async function loadSamples() {
    setMessage('')
    setLoadingSamples(true)
    try {
      const res = await fetch('/api/demo/load', { method: 'POST' })
      const js = await res.json()
      if (js.added === 0) setMessage(`Sample community already loaded (total ${js.total}).`)
      else setMessage(`Loaded ${js.added} samples (total ${js.total}).`)
      setHealth(prev => ({...prev, memories: js.total}))
      setShowWelcome(false)
      setCurrentTab('archive')
      setRefreshKey(k => k + 1)
    } catch (e) {
      setMessage('Failed to load samples: ' + e.message)
    } finally { setLoadingSamples(false) }
  }

  function openArchive() {
    setShowWelcome(false)
    setCurrentTab('archive')
  }

  function toggleAdd() { setShowWelcome(false); setCurrentTab('archive'); setShowAdd(s => !s) }

  async function viewMemory(id) {
    setSelected(id)
    try {
      const res = await fetch('/api/memories/' + encodeURIComponent(id))
      const js = await res.json()
      setDetail(js)
      setShowWelcome(false)
    } catch (e) {
      setDetail(null)
    }
  }

  function onMemoryCreated(mem) {
    setRefreshKey(k => k + 1)
    setShowAdd(false)
    setShowWelcome(false)
    setMessage('Memory saved')
    setHealth(prev => ({...prev, memories: (prev && prev.memories ? prev.memories + 1 : 1)}))
  }

  function onMemoryUpdated(mem) {
    setRefreshKey(k => k + 1)
    setDetail(prev => ({...prev, memory: mem}))
  }

  function onMemoryDeleted(id) {
    setRefreshKey(k => k + 1)
    setDetail(null)
    setMessage('Memory deleted')
    setHealth(prev => ({...prev, memories: Math.max(0, (prev && prev.memories) ? prev.memories - 1 : 0)}))
  }

  return (
    <div className="app">
      <Nav currentTab={currentTab} onChangeTab={(tab)=>{ setCurrentTab(tab); setShowWelcome(false); }} onToggleAdd={toggleAdd} onHome={()=>{ setShowWelcome(true); setCurrentTab('archive'); setShowAdd(false); }} />
      <header className="app-header">
        <div>
          <h1>OnboardX</h1>
          <p className="subtitle">Local handover demo</p>
        </div>
        <Overview health={health} />
      </header>

      <main className="workspace">
        {showWelcome ? (
                  <Welcome onOpenArchive={openArchive} onLoadSamples={loadSamples} loadingSamples={loadingSamples} />
        ) : (
          <div className="cols">
            <div className="main-col">
              {currentTab === 'archive' && <Archive onView={viewMemory} refreshKey={refreshKey} />}
              {currentTab === 'ask' && <Ask />}
              {currentTab === 'handover' && <Handover />}
            </div>
            <aside className="side-col">
              <button className="add-memory-quick" onClick={toggleAdd}>Add memory</button>
              {showAdd && <AddMemory visible={showAdd} onCreated={onMemoryCreated} onClose={()=>setShowAdd(false)} />}
              {detail && <MemoryDetail memory={detail.memory} chunks={detail.chunks} onClose={()=>setDetail(null)} onUpdated={onMemoryUpdated} onDeleted={onMemoryDeleted} />}
            </aside>
          </div>
        )}

        {message && <p className="message">{message}</p>}
      </main>
    </div>
  )
}

