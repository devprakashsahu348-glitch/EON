import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from './api'
import { useUser } from './App'
import { LEGAL, UPDATED } from './legal'

function title(t: string, d?: string) {
  document.title = t + ' | EON'
  if (d) document.querySelector('meta[name=description]')?.setAttribute('content', d)
}
function Crumbs({ items }: { items: [string, string?][] }) {
  return <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link>{items.map(([l, to]) => <span key={l}> / {to ? <Link to={to}>{l}</Link> : l}</span>)}</nav>
}
function Msg({ e, ok }: { e?: string; ok?: string }) {
  return e ? <div className="msg err" role="alert">{e}</div> : ok ? <div className="msg ok" role="status">{ok}</div> : null
}
function Pw({ label, value, set, id }: { label: string; value: string; set: (v: string) => void; id: string }) {
  const [show, setShow] = useState(false)
  return <label htmlFor={id}>{label}<span className="pw"><input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => set(e.target.value)} required autoComplete="new-password" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span></label>
}

export function Landing() {
  title('Software that evolves under your control', 'EON analyses your code, tests improvements side by side and remembers what worked. You approve every change.')
  return <>
    <section className="hero">
      <h1>Software that doesn't just run. It evolves.</h1>
      <p>Upload a Python project. EON finds its weak spots, measures each candidate fix against the original, and remembers what worked. Nothing is overwritten, and nothing ships without your approval.</p>
      <Link className="btn" to="/signup">Start evolving a project</Link>{' '}<Link className="btn ghost" to="/login">Sign in</Link>
      <div className="loop" aria-label="Evolution loop">{['Observe', 'Analyse', 'Discover', 'Plan', 'Modify', 'Test', 'Evaluate', 'Evolve'].map(s => <span key={s}>{s}</span>)}</div>
    </section>
    <section className="cols">
      <div className="box"><h3>Evolution Lab</h3><p>Submit a changed version and see the score before and after, finding by finding. Approve it to make it the current version, or reject it. The original is always kept.</p></div>
      <div className="box"><h3>Evolution Memory</h3><p>Every approved and rejected experiment is stored. EON ranks future opportunities by the fixes that worked in your earlier projects.</p></div>
      <div className="box"><h3>Autonomous Discovery</h3><p>You do not describe the problem. EON scans for complexity, risky calls, hidden secrets and error-handling gaps, then lists what to fix first by points gained.</p></div>
    </section>
    <section style={{ marginTop: 48 }}>
      <h2>What is real today</h2>
      <p>Python analysis uses the language's own syntax tree. The score is 100 minus 8 per high, 4 per medium and 1 per low finding, so you can verify every point. Other languages, container test runs and cross-project learning are experimental and not yet available.</p>
    </section>
  </>
}

export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const { setUser } = useUser(), nav = useNavigate(), signup = mode === 'signup'
  title(signup ? 'Create account' : 'Sign in')
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (signup) { await api('/auth/register', 'POST', f); await api('/auth/login', 'POST', { email: f.email, password: f.password }) }
      else await api('/auth/login', 'POST', { email: f.email, password: f.password })
      setUser(await api('/me')); nav('/dashboard')
    } catch (x: any) { setErr(x.message) }
    setBusy(false)
  }
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v })
  return <><Crumbs items={[[signup ? 'Create account' : 'Sign in']]} />
    <form className="box" onSubmit={go} noValidate={false}>
      <h1 style={{ fontSize: '2rem' }}>{signup ? 'Create your account' : 'Welcome back'}</h1>
      <Msg e={err} />
      {signup && <label>Full name<input value={f.name} onChange={e => set('name')(e.target.value)} required autoComplete="name" /></label>}
      <label>Email<input type="email" value={f.email} onChange={e => set('email')(e.target.value)} required autoComplete="email" /></label>
      <Pw id="pw" label="Password" value={f.password} set={set('password')} />
      {signup && <Pw id="pw2" label="Confirm password" value={f.confirm} set={set('confirm')} />}
      {signup && <small>At least 10 characters, with a letter and a number.</small>}
      <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : signup ? 'Create account' : 'Sign in'}</button>
      {!signup && <Link to="/forgot">Forgot password?</Link>}
      <small>{signup ? <>Already registered? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}</small>
    </form></>
}

export function Forgot() {
  const [email, setEmail] = useState(''), [ok, setOk] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  title('Forgot password')
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api('/auth/forgot', 'POST', { email }); setOk('If that email is registered, a reset link is on its way. It expires in 30 minutes.') } catch (x: any) { setErr(x.message) }
    setBusy(false)
  }
  return <form className="box" onSubmit={go}><h1 style={{ fontSize: '2rem' }}>Reset your password</h1><Msg e={err} ok={ok} />
    <label>Registered email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : 'Send reset link'}</button><Link to="/login">Back to sign in</Link></form>
}

export function ResetPw() {
  const [q] = useSearchParams(), nav = useNavigate(), [p, setP] = useState(''), [c, setC] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  title('Choose a new password')
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api('/auth/reset', 'POST', { token: q.get('token') || '', password: p, confirm: c }); nav('/login') } catch (x: any) { setErr(x.message) }
    setBusy(false)
  }
  return <form className="box" onSubmit={go}><h1 style={{ fontSize: '2rem' }}>Choose a new password</h1><Msg e={err} />
    <Pw id="np" label="New password" value={p} set={setP} /><Pw id="np2" label="Confirm new password" value={c} set={setC} />
    <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : 'Update password'}</button></form>
}

export function Dashboard() {
  const { user } = useUser(), nav = useNavigate()
  const [list, setList] = useState<any[] | null>(null), [name, setName] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [mem, setMem] = useState<any>(null)
  title('Dashboard')
  useEffect(() => { api('/projects').then(setList).catch(x => setErr(x.message)); api('/memory').then(setMem).catch(() => {}) }, [])
  async function file(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) { setCode(await f.text()); if (!name) setName(f.name.replace(/\.py$/, '')) } }
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const r = await api('/projects', 'POST', { name, code }); nav('/project/' + r.id) } catch (x: any) { setErr(x.message); setBusy(false) }
  }
  const sample = `def total(items=[]):\n    t = 0\n    for i in items:\n        try:\n            t += eval(i)\n        except:\n            pass\n    return t\n\nAPI_KEY = "abc123"\n`
  return <><Crumbs items={[['Dashboard']]} /><h1 style={{ fontSize: '2.4rem' }}>Hello, {user?.name.split(' ')[0]}</h1>
    <div className="cols">
      <form className="box" onSubmit={add} style={{ margin: 0, maxWidth: 'none' }}><h2>New project</h2><Msg e={err} />
        <label>Project name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label>
        <label>Upload a .py file<input type="file" accept=".py,text/x-python" onChange={file} /></label>
        <label>Or paste Python code<textarea value={code} onChange={e => setCode(e.target.value)} required /></label>
        <div><button className="btn" disabled={busy}>{busy ? <span className="spin" /> : 'Analyse project'}</button>{' '}<button type="button" className="btn ghost" onClick={() => { setName('Sample: risky totals'); setCode(sample) }}>Load sample</button></div>
      </form>
      <div className="box"><h2>Your projects</h2>
        {list === null ? <span className="spin" /> : list.length === 0 ? <p>No projects yet. Paste code or load the sample to run your first analysis.</p> :
          <table><tbody>{list.map(p => <tr key={p.id}><td><Link to={'/project/' + p.id}>{p.name}</Link></td><td>Score {p.score}</td></tr>)}</tbody></table>}
        <h3 style={{ marginTop: 24 }}>Evolution Memory</h3>
        {mem && (mem.experiments === 0 ? <p>Empty. Decide on an experiment and EON starts learning.</p> : <>
          <p>{mem.experiments} decided experiments.</p>
          {Object.entries(mem.proven_fixes).map(([k, v]) => <span key={k} className="tag">{k} fixed {String(v)}x</span>)}</>)}
      </div>
    </div></>
}

export function ProjectPage() {
  const { id } = useParams(), [d, setD] = useState<any>(null), [err, setErr] = useState(''), [code, setCode] = useState(''), [strat, setStrat] = useState('Manual refactor'), [busy, setBusy] = useState(false), [ok, setOk] = useState('')
  const load = () => api('/projects/' + id).then(r => { setD(r); setCode(c => c || r.current.code); title(r.project.name) }).catch(x => setErr(x.message))
  useEffect(() => { load() }, [id])
  async function run(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true)
    try { const r = await api(`/projects/${id}/experiments`, 'POST', { strategy: strat, code }); setOk(`Experiment ready: score ${r.before} to ${r.after}. Review it below.`); await load() } catch (x: any) { setErr(x.message) }
    setBusy(false)
  }
  async function decide(eid: number, approve: boolean) {
    if (!confirm(approve ? 'Approve this version as the new current version?' : 'Reject this experiment?')) return
    setErr(''); try { await api(`/experiments/${eid}/decision`, 'POST', { approve }); setCode(''); await load() } catch (x: any) { setErr(x.message) }
  }
  if (!d) return err ? <Msg e={err} /> : <span className="spin" />
  const a = d.current.analysis
  return <><Crumbs items={[['Dashboard', '/dashboard'], [d.project.name]]} /><h1 style={{ fontSize: '2.2rem' }}>{d.project.name}</h1>
    <Msg e={err} ok={ok} />
    <div className="cols">
      <div className="box"><div className="score">{a.score}</div><p>Current: {d.current.label}. {a.metrics.lines} lines, {a.metrics.functions} functions, max complexity {a.metrics.max_complexity}.</p>
        <p><small>Score = 100 &minus; (8 &times; high + 4 &times; medium + 1 &times; low). Deduction here: {a.deduction}.</small></p></div>
      <div className="box"><h3>Score by version</h3><div style={{ height: 150 }}><ResponsiveContainer><LineChart data={d.versions.map((v: any, i: number) => ({ n: 'v' + (i + 1), score: v.score }))}><XAxis dataKey="n" stroke="#9bb0a2" /><YAxis domain={[0, 100]} stroke="#9bb0a2" width={30} /><Tooltip /><Line dataKey="score" stroke="#e2a336" strokeWidth={3} /></LineChart></ResponsiveContainer></div></div>
    </div>
    <h2 style={{ marginTop: 40 }}>Discovered opportunities</h2>
    {d.opportunities.length === 0 ? <p>No findings. Nothing to improve by these checks.</p> : <table><thead><tr><th>Rule</th><th>Severity</th><th>Count</th><th>Points to gain</th><th>Memory</th></tr></thead><tbody>{d.opportunities.map((o: any) => <tr key={o.rule}><td>{o.rule}</td><td className={'sev-' + o.severity}>{o.severity}</td><td>{o.count}</td><td>{o.points}</td><td>{o.proven ? `Fixed ${o.proven}x before` : 'No history yet'}</td></tr>)}</tbody></table>}
    <details style={{ marginTop: 16 }}><summary>All findings ({a.findings.length})</summary><table><tbody>{a.findings.map((f: any, i: number) => <tr key={i}><td>Line {f.line}</td><td className={'sev-' + f.severity}>{f.severity}</td><td>{f.message}</td></tr>)}</tbody></table></details>
    <h2 style={{ marginTop: 40 }}>Evolution Lab</h2>
    <form className="box" onSubmit={run} style={{ maxWidth: 'none', margin: 0 }}>
      <p>Edit the code below (or paste an improved version), then run the experiment. EON re-analyses it and compares the result to the current version. Your original stays untouched.</p>
      <label>Strategy name<input value={strat} onChange={e => setStrat(e.target.value)} maxLength={80} /></label>
      <label>Candidate code<textarea value={code} onChange={e => setCode(e.target.value)} style={{ minHeight: 280 }} /></label>
      <div><button className="btn" disabled={busy}>{busy ? <span className="spin" /> : 'Run experiment'}</button></div>
      <small>Running your tests inside isolated containers is experimental and not available on this hosted version.</small>
    </form>
    <h2 style={{ marginTop: 40 }}>Experiment history</h2>
    {d.experiments.length === 0 ? <p>No experiments yet.</p> : <table><thead><tr><th>Strategy</th><th>Before</th><th>After</th><th>Fixed</th><th>Status</th><th></th></tr></thead><tbody>{d.experiments.map((e: any) => <tr key={e.id}><td>{e.strategy}</td><td>{e.before}</td><td>{e.after}</td><td>{Object.entries(e.rules_fixed || {}).map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}</td><td>{e.status}</td>
      <td>{e.status === 'pending' && <><button className="btn" onClick={() => decide(e.id, true)} disabled={e.after <= e.before}>Approve</button>{' '}<button className="btn ghost" onClick={() => decide(e.id, false)}>Reject</button></>}</td></tr>)}</tbody></table>}
  </>
}

export function ContactPage() {
  const [f, setF] = useState({ name: '', email: '', message: '' }), [st, setSt] = useState<'idle' | 'busy' | 'ok'>('idle'), [err, setErr] = useState('')
  title('Contact', 'Contact the EON team with questions, feedback or support requests.')
  async function go(e: React.FormEvent) { e.preventDefault(); setErr(''); setSt('busy'); try { await api('/contact', 'POST', f); setSt('ok') } catch (x: any) { setErr(x.message); setSt('idle') } }
  if (st === 'ok') return <div className="box" style={{ margin: '40px auto', maxWidth: 460 }}><h1 style={{ fontSize: '2rem' }}>Message sent</h1><p>Thanks. We reply to the email you gave within a few days.</p></div>
  return <><Crumbs items={[['Contact']]} /><form className="box" onSubmit={go}><h1 style={{ fontSize: '2rem' }}>Contact us</h1><p>Or email <a href="mailto:devprakashsahu348@gmail.com">devprakashsahu348@gmail.com</a>.</p><Msg e={err} />
    <label>Name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></label>
    <label>Email<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></label>
    <label>Message<textarea value={f.message} onChange={e => setF({ ...f, message: e.target.value })} required minLength={10} style={{ minHeight: 140 }} /></label>
    <button className="btn" disabled={st === 'busy'}>{st === 'busy' ? <span className="spin" /> : 'Send message'}</button></form></>
}

export function Legal({ slug }: { slug: string }) {
  const L = LEGAL[slug]; title(L.title, L.title + ' for EON.')
  return <><Crumbs items={[[L.title]]} /><h1 style={{ fontSize: '2.4rem' }}>{L.title}</h1><p>Last updated: {UPDATED}</p>
    {L.body.map(([h, t]) => <section key={h}><h2 style={{ fontSize: '1.3rem', marginTop: 24 }}>{h}</h2><p>{t}</p></section>)}</>
}

export function NotFound() {
  title('Page not found'); useEffect(() => { document.title = '404 Page not found | EON' }, [])
  return <section className="hero"><h1>That page does not exist</h1><p>The link may be old or mistyped.</p><Link className="btn" to="/">Go to the home page</Link></section>
}
