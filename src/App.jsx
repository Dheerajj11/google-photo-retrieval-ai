import React, { useMemo, useRef, useState } from 'react'
import {
  Search, Sparkles, Images, X, SlidersHorizontal, Check, ChevronLeft,
  Clock3, MapPin, Brain, Undo2, Download, RotateCcw, Eye, CircleHelp,
  WandSparkles, Layers3, ChevronDown
} from 'lucide-react'
import { demoPhotos, demoTasks } from './data/photos'
import { generatedPhotos } from './data/generatedPhotos'
import { aiSearch, extractClues, explanation, clarificationFor, moreLikeThis } from './lib/search'

const libraryPhotos = generatedPhotos.length ? generatedPhotos : demoPhotos

const NAV = [
  {id:'photos', label:'Photos', icon:Images},
  {id:'search', label:'Search', icon:Search},
  {id:'memory', label:'Memory Search', icon:Sparkles},
]

const certaintyLabel = { certain:'Certain', approximate:'Approximate', guess:'Guess', unknown:'Unknown' }

function seconds(ms) {
  const s = Math.max(0, Math.round(ms/1000))
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`
}

function App() {
  const [view,setView] = useState('photos')
  const [query,setQuery] = useState('')
  const [baseline,setBaseline] = useState('')
  const [clues,setClues] = useState([])
  const [results,setResults] = useState([])
  const [selected,setSelected] = useState(null)
  const [modelStatus,setModelStatus] = useState('AI loads only when Memory Search is used')
  const [progress,setProgress] = useState(null)
  const [busy,setBusy] = useState(false)
  const [clarification,setClarification] = useState(null)
  const [task,setTask] = useState(null)
  const [history,setHistory] = useState([])
  const [showSession,setShowSession] = useState(false)
  const inputRef = useRef(null)

  const baselineResults = useMemo(() => {
    const q = baseline.trim().toLowerCase()
    if (!q) return libraryPhotos
    return libraryPhotos.filter(p => `${p.title || ''} ${p.place || ''} ${p.description || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q))
  }, [baseline])

  const activeText = useMemo(() => clues.filter(c=>c.enabled).map(c=>c.value).join(' '), [clues])

  const startTask = (memory) => {
    const now=Date.now()
    const t = {
      id:`task-${now}`,
      startedAt:new Date(now).toISOString(),
      startedMs:now,
      startingMemory:memory,
      events:[{type:'task_started',at:new Date(now).toISOString(),memory}],
      candidateSets:[],
      photosOpened:[],
      refinements:[],
      questions:[],
      outcome:null,
      targetId:null,
    }
    setTask(t)
    return t
  }

  const patchTask = (fn) => setTask(prev => prev ? fn(prev) : prev)

  async function runMemorySearch(memory=query, nextClues=null, reason='initial') {
    const text = memory.trim()
    if (!text) return

    setBusy(true)
    setProgress(null)

    // A different text query starts a NEW retrieval task. Never carry clues
    // (for example "medicine") into the next query (for example "cafe").
    const previousMemory = task?.startingMemory?.trim().toLowerCase() || ''
    const isNewMemory = !nextClues && previousMemory !== text.toLowerCase()

    const cs = nextClues || (
      isNewMemory
        ? extractClues(text)
        : (clues.length ? clues : extractClues(text))
    )

    if (isNewMemory) {
      setClues(cs)
      setHistory([])
      setResults([])
      setClarification(null)
    } else if (!clues.length && !nextClues) {
      setClues(cs)
    }

    const currentTask = isNewMemory ? startTask(text) : (task || startTask(text))
    const effective = [text, ...cs.filter(c=>c.enabled).map(c=>c.value)]
      .filter((value,index,array)=>array.indexOf(value)===index)
      .join('. ')

    try {
      const ranked = await aiSearch(effective, libraryPhotos, {
        onStatus:setModelStatus,
        onProgress:setProgress
      })
      setResults(ranked)
      const q = clarificationFor(ranked, cs)
      setClarification(q)

      const snapshot = {
        at:new Date().toISOString(),
        reason,
        query:effective,
        ids:ranked.slice(0,12).map(p=>p.id),
        scores:ranked.slice(0,12).map(p=>Number(p.score.toFixed(4)))
      }

      setHistory(h=>[...h,{query:text,clues:cs,results:ranked}])
      setTask(prev => {
        const base = isNewMemory ? currentTask : (prev || currentTask)
        return {...base,
          candidateSets:[...(base.candidateSets||[]),snapshot],
          events:[...(base.events||[]),{type:'candidate_set',...snapshot}]
        }
      })
    } finally {
      setBusy(false)
    }
  }

  function addRecoveredClue(value, certainty='certain') {
    const v=value.trim()
    if (!v) return
    const c={id:`clue-${Date.now()}`,value:v,certainty,source:'recovered_memory',enabled:true}
    const next=[...clues,c]
    setClues(next)
    patchTask(t=>({...t,
      refinements:[...t.refinements,{at:new Date().toISOString(),type:'recovered_clue',value:v,certainty}],
      events:[...t.events,{type:'recovered_clue',at:new Date().toISOString(),value:v,certainty}]
    }))
    runMemorySearch(query,next,'recovered_clue')
  }

  function toggleClue(id) {
    const next=clues.map(c=>c.id===id?{...c,enabled:!c.enabled}:c)
    setClues(next)
  }

  function setCertainty(id,certainty) {
    const next=clues.map(c=>c.id===id?{...c,certainty}:c)
    setClues(next)
  }

  function removeClue(id) {
    setClues(clues.filter(c=>c.id!==id))
  }

  function openPhoto(p) {
    setSelected(p)
    patchTask(t=> t ? {...t,
      photosOpened:[...t.photosOpened,{id:p.id,at:new Date().toISOString(),rank:results.findIndex(r=>r.id===p.id)+1}],
      events:[...t.events,{type:'photo_opened',at:new Date().toISOString(),id:p.id,rank:results.findIndex(r=>r.id===p.id)+1}]
    } : t)
  }

  async function visualRefine(p) {
    setSelected(null)
    setBusy(true)
    try {
      const ranked=await moreLikeThis(p,libraryPhotos,{onStatus:setModelStatus,onProgress:setProgress})
      setResults(ranked)
      patchTask(t=>({...t,
        refinements:[...t.refinements,{at:new Date().toISOString(),type:'more_like_this',photoId:p.id}],
        candidateSets:[...t.candidateSets,{at:new Date().toISOString(),reason:'more_like_this',ids:ranked.slice(0,12).map(x=>x.id)}],
        events:[...t.events,{type:'more_like_this',at:new Date().toISOString(),photoId:p.id}]
      }))
    } finally { setBusy(false) }
  }

  function answerQuestion(answer) {
    patchTask(t=>({...t,
      questions:[...t.questions,{at:new Date().toISOString(),question:clarification.question,answer}],
      events:[...t.events,{type:'clarification_answered',at:new Date().toISOString(),question:clarification.question,answer}]
    }))
    if (answer==='not sure') { setClarification(null); return }
    setClarification(null)
    addRecoveredClue(answer,'certain')
  }

  function confirmTarget(p) {
    const end=Date.now()
    patchTask(t=>({...t,
      completedAt:new Date(end).toISOString(),
      elapsedMs:end-t.startedMs,
      targetId:p.id,
      outcome:'confirmed',
      events:[...t.events,{type:'target_confirmed',at:new Date(end).toISOString(),photoId:p.id}]
    }))
    setSelected(null)
    setShowSession(true)
  }

  function endNoMatch() {
    const end=Date.now()
    patchTask(t=>({...t,
      completedAt:new Date(end).toISOString(),
      elapsedMs:end-t.startedMs,
      outcome:'no_confirmed_match',
      events:[...t.events,{type:'task_ended',at:new Date(end).toISOString(),outcome:'no_confirmed_match'}]
    }))
    setShowSession(true)
  }

  function resetTask() {
    setQuery(''); setClues([]); setResults([]); setSelected(null); setTask(null)
    setHistory([]); setClarification(null); setProgress(null); setShowSession(false)
    setModelStatus('AI loads only when Memory Search is used')
  }

  function undo() {
    if (history.length<2) return
    const prior=history[history.length-2]
    setHistory(history.slice(0,-1)); setQuery(prior.query); setClues(prior.clues); setResults(prior.results)
  }

  function exportSession() {
    if (!task) return
    const blob=new Blob([JSON.stringify({...task,elapsedMs:task.elapsedMs || Date.now()-task.startedMs},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`${task.id}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const grouped = useMemo(() => {
    const map={}
    libraryPhotos.forEach(p => {
      const m = p.taken ? new Date(p.taken).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : 'Project photo library'
      ;(map[m] ||= []).push(p)
    })
    return map
  },[])

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setView('photos')} aria-label="Memory Guided Photos home">
        <span className="brand-mark"><Sparkles size={19}/></span>
        <span>Memory Guided Photos</span>
      </button>
      <nav className="nav">
        {NAV.map(({id,label,icon:Icon}) => <button key={id} className={view===id?'nav-item active':'nav-item'} onClick={()=>setView(id)}>
          <Icon size={18}/><span>{label}</span>
        </button>)}
      </nav>
      <div className="status-pill"><span className="status-dot"/>{libraryPhotos.length} demo photos</div>
    </header>

    <main>
      {view==='photos' && <section className="page photos-page">
        <div className="hero-row">
          <div><p className="eyebrow">DEMO LIBRARY</p><h1>Your photos</h1><p className="muted">A deliberately mixed library with similar moments and near-duplicates for realistic retrieval testing.</p></div>
          <button className="primary" onClick={()=>{setView('memory'); setTimeout(()=>inputRef.current?.focus(),100)}}><Sparkles size={18}/> Find from memory</button>
        </div>
        {Object.entries(grouped).map(([month,photos])=><div className="month" key={month}>
          <h2>{month}</h2>
          <div className="photo-grid">{photos.map(p=><PhotoCard key={p.id} photo={p} onClick={()=>openPhoto(p)} showBadge={!!p.duplicateOf}/>)}</div>
        </div>)}
      </section>}

      {view==='search' && <section className="page">
        <div className="search-head">
          <p className="eyebrow">BASELINE</p><h1>Search</h1>
          <p className="muted">Keyword matching only. Use this as the comparison condition in testing.</p>
          <div className="big-search"><Search size={21}/><input value={baseline} onChange={e=>setBaseline(e.target.value)} placeholder="Try café, city, medicine, beach…"/></div>
        </div>
        <div className="result-head"><strong>{baselineResults.length} photos</strong>{baseline && <span>matching “{baseline}”</span>}</div>
        <div className="photo-grid">{baselineResults.map(p=><PhotoCard key={p.id} photo={p} onClick={()=>openPhoto(p)}/>)}</div>
      </section>}

      {view==='memory' && <section className="page memory-page">
        <div className="memory-hero">
          <span className="ai-kicker"><Sparkles size={16}/> MEMORY SEARCH</span>
          <h1>What do you remember about the photo?</h1>
          <p>Describe it naturally. Exact dates and perfect keywords are not required.</p>
          <div className="memory-box">
            <textarea ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Example: It was during our Goa trip. We were at a café with plants around us. I don't remember the exact date…"/>
            <div className="memory-actions">
              <span className="privacy-note"><Brain size={15}/> Runs with a free browser AI model when available</span>
              <button className="primary" disabled={busy||!query.trim()} onClick={()=>runMemorySearch()}>{busy?<span className="spinner"/>:<WandSparkles size={18}/>} {busy?'Searching…':'Search from memory'}</button>
            </div>
          </div>
          {!task && <div className="demo-prompts">
            <span>Try a demo:</span>
            {demoTasks.slice(0,3).map(t=><button key={t} onClick={()=>setQuery(t)}>{t}</button>)}
          </div>}
        </div>

        {task && <div className="workspace">
          <aside className="clue-panel">
            <div className="panel-title"><div><p className="eyebrow">ACTIVE MEMORY</p><h3>Clues</h3></div><SlidersHorizontal size={19}/></div>
            <p className="small-muted">Turn off uncertain details instead of letting a guess remove the target.</p>
            <div className="clue-list">
              {clues.map(c=><div className={c.enabled?'clue':'clue disabled'} key={c.id}>
                <button className="clue-check" onClick={()=>toggleClue(c.id)}>{c.enabled?<Check size={14}/>:null}</button>
                <div className="clue-main"><strong>{c.value}</strong><select value={c.certainty} onChange={e=>setCertainty(c.id,e.target.value)}>
                  <option value="certain">Certain</option><option value="approximate">Approximate</option><option value="guess">Guess</option><option value="unknown">Unknown</option>
                </select></div>
                <button className="icon-btn" onClick={()=>removeClue(c.id)} aria-label="Remove clue"><X size={15}/></button>
              </div>)}
            </div>
            <RecoveredInput onAdd={addRecoveredClue}/>
            <div className="panel-actions">
              <button className="secondary small" onClick={()=>runMemorySearch(query,clues,'manual_refinement')} disabled={busy}><Sparkles size={15}/> Apply clues</button>
              <button className="secondary small" onClick={undo} disabled={history.length<2}><Undo2 size={15}/> Undo</button>
            </div>
            <div className="model-status">
              <span className="status-dot ai"/><div><strong>Retrieval engine</strong><span>{progress?.label || modelStatus}</span></div>
            </div>
          </aside>

          <div className="candidate-area">
            <div className="candidate-head">
              <div><p className="eyebrow">CANDIDATES</p><h2>{results.length ? 'Possible matches' : 'Ready to search'}</h2></div>
              {results.length>0 && <div className="candidate-meta"><Eye size={16}/>{task.photosOpened.length} inspected</div>}
            </div>

            {clarification && <div className="clarification">
              <div className="clarification-icon"><CircleHelp size={20}/></div>
              <div><strong>{clarification.question}</strong><p>Answer only if you remember. “Not sure” keeps the search broad.</p>
                <div className="answer-row">{clarification.options.map(o=><button key={o} onClick={()=>answerQuestion(o)}>{o}</button>)}</div>
              </div>
              <button className="icon-btn" onClick={()=>setClarification(null)}><X size={16}/></button>
            </div>}

            {results.length>0 && <>
              <div className="ranked-grid">{results.slice(0,16).map((p,i)=><PhotoCard key={p.id} photo={p} rank={i+1} score={p.score} onClick={()=>openPhoto(p)} showBadge={!!p.duplicateOf}/>)}</div>
              <div className="no-match">
                <div><strong>Still not seeing it?</strong><p>No confirmed match only means it was not found in this demo collection yet.</p></div>
                <button className="secondary" onClick={endNoMatch}>End as no confirmed match</button>
              </div>
            </>}
          </div>
        </div>}
      </section>}
    </main>

    {selected && <PhotoModal photo={selected} query={view==='memory' ? `${query} ${activeText}`:baseline} memoryMode={view==='memory'&&!!task}
      onClose={()=>setSelected(null)} onConfirm={confirmTarget} onMoreLike={visualRefine}/>}

    {showSession && task && <SessionModal task={task} onClose={()=>setShowSession(false)} onExport={exportSession} onReset={resetTask}/>}
  </div>
}

function RecoveredInput({onAdd}) {
  const [value,setValue]=useState('')
  const [certainty,setCertainty]=useState('certain')
  return <div className="recovered-box">
    <label>Seeing results reminded me…</label>
    <input value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&value.trim()){onAdd(value,certainty);setValue('')}}} placeholder="e.g. there was a yellow sign"/>
    <div className="recovered-actions">
      <select value={certainty} onChange={e=>setCertainty(e.target.value)}><option value="certain">Certain</option><option value="approximate">Approximate</option><option value="guess">Guess</option></select>
      <button onClick={()=>{if(value.trim()){onAdd(value,certainty);setValue('')}}}>Add clue</button>
    </div>
  </div>
}

function PhotoCard({photo,onClick,rank,score,showBadge}) {
  return <button className="photo-card" onClick={onClick}>
    <img src={photo.url} alt={photo.title} loading="lazy"/>
    {rank && <span className="rank">#{rank}</span>}
    {showBadge && <span className="similar-badge"><Layers3 size={12}/> similar</span>}
    {score!==undefined && <span className="score">{Math.round(score*100)}%</span>}
    <div className="photo-caption"><strong>{photo.title}</strong><span>{photo.place || 'Project library'}</span></div>
  </button>
}

function PhotoModal({photo,onClose,onConfirm,onMoreLike,memoryMode,query}) {
  const matched=explanation(query,photo)
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="photo-modal">
      <div className="modal-top"><button className="secondary small" onClick={onClose}><ChevronLeft size={17}/> Back</button><span>{photo.title}</span><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      <div className="photo-modal-body">
        <div className="large-photo"><img src={photo.url} alt={photo.title}/></div>
        <aside className="photo-info">
          <p className="eyebrow">PHOTO DETAILS</p><h2>{photo.title}</h2>
          <div className="detail-row"><Clock3 size={17}/><span>{photo.taken ? new Date(photo.taken).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}) : 'Date not provided'}</span></div>
          <div className="detail-row"><MapPin size={17}/><span>{photo.place || 'Location not provided'}</span></div>
          {memoryMode && <>
            <div className="why"><strong>Why this may match</strong><div className="match-tags">{matched.map(x=><span key={x}><Check size={13}/>{x}</span>)}</div><p>Visual match signals are model inference; date/place shown above are demo metadata.</p></div>
            <button className="primary full" onClick={()=>onConfirm(photo)}><Check size={18}/> Yes — this is the photo</button>
            <button className="secondary full" onClick={()=>onMoreLike(photo)}><Images size={18}/> More like this</button>
          </>}
        </aside>
      </div>
    </div>
  </div>
}

function SessionModal({task,onClose,onExport,onReset}) {
  const elapsed=task.elapsedMs || Date.now()-task.startedMs
  return <div className="modal-backdrop">
    <div className="session-modal">
      <div className="success-icon">{task.outcome==='confirmed'?<Check size={30}/>:<Search size={28}/>}</div>
      <p className="eyebrow">TEST SESSION</p>
      <h2>{task.outcome==='confirmed'?'Photo confirmed':'Search ended'}</h2>
      <p className="muted">{task.outcome==='confirmed'?'The task is recorded as a confirmed retrieval.':'No confirmed match was found in this demo collection.'}</p>
      <div className="metric-grid">
        <Metric label="Time" value={seconds(elapsed)}/>
        <Metric label="Photos inspected" value={task.photosOpened.length}/>
        <Metric label="Refinements" value={task.refinements.length}/>
        <Metric label="AI questions" value={task.questions.length}/>
      </div>
      <div className="session-actions"><button className="secondary" onClick={onExport}><Download size={17}/> Export session JSON</button><button className="primary" onClick={onReset}><RotateCcw size={17}/> Start another task</button></div>
      <button className="text-btn" onClick={onClose}>Keep viewing this session</button>
    </div>
  </div>
}

function Metric({label,value}) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }

export default App
