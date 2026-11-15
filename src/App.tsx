import { useEffect, useState, createContext, useContext } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { Landing, Auth, Forgot, ResetPw, Dashboard, ProjectPage, ContactPage, Legal, NotFound } from './pages'

type U = { id: number; name: string; email: string } | null
const Ctx = createContext<{ user: U; setUser: (u: U) => void }>({ user: null, setUser: () => {} })
export const useUser = () => useContext(Ctx)

function Guide() {
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [busy, setBusy] = useState(false)
  const [log, setLog] = useState<{ from: string; text: string; src?: string }[]>([{ from: 'bot', text: 'Ask me about your score, a finding, or how Evolution Memory works.', src: 'builtin' }])
  async function ask(e: React.FormEvent) {
    e.preventDefault(); if (!q.trim()) return
    const m = q; setQ(''); setBusy(true); setLog(l => [...l, { from: 'me', text: m }])
    try { const r = await api('/guide', 'POST', { message: m, context: location.pathname }); setLog(l => [...l, { from: 'bot', text: r.reply, src: r.source }]) }
    catch (x: any) { setLog(l => [...l, { from: 'bot', text: x.message, src: 'builtin' }]) }
    setBusy(false)
  }
  return <>
    {open && <div className="chat" role="dialog" aria-label="EON Guide">
      <div className="log">{log.map((m, i) => <div key={i} className="bubble" style={m.from === 'me' ? { background: 'var(--line)' } : {}}>{m.text}{m.src && <small>{m.src === 'ai' ? 'AI-generated suggestion. Verify before you rely on it.' : 'Built-in guidance'}</small>}</div>)}{busy && <span className="spin" />}</div>
      <form onSubmit={ask}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask EON Guide" aria-label="Your question" /><button className="btn">Ask</button></form>
    </div>}
    <button className="btn fab" style={{ background: 'var(--moss)', color: 'var(--ink)', boxShadow: '0 4px 14px rgba(0,0,0,.28)' }} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Ask EON'}</button>
  </>
}

export default function App() {
  const [user, setUser] = useState<U>(null), [ready, setReady] = useState(false), [menu, setMenu] = useState(false)
  const [cookie, setCookie] = useState(() => !localStorage.getItem('eon-cookie')), [prog, setProg] = useState(0), [top, setTop] = useState(false)
  const loc = useLocation(), nav = useNavigate()
  useEffect(() => { api('/me').then(setUser).catch(() => {}).finally(() => setReady(true)) }, [])
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    const f = () => { const h = document.documentElement; setProg(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100); setTop(h.scrollTop > 600) }
    addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f)
  }, [])
  const theme = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('eon-theme', t) }
  async function out() { await api('/auth/logout', 'POST'); setUser(null); nav('/') }
  if (!ready) return <div className="wrap" style={{ padding: 60 }}><span className="spin" /> Loading</div>
  return <Ctx.Provider value={{ user, setUser }}>
    <div className="progress" style={{ width: prog + '%' }} />
    <header className="top"><div className="wrap">
      <Link to="/" className="logo">E<b>O</b>N</Link>
      <button className="menu" onClick={() => setMenu(!menu)} aria-expanded={menu}>Menu</button>
      <nav className={menu ? 'open' : ''} aria-label="Main">
        <Link to="/contact">Contact</Link>
        {user ? <><Link to="/dashboard">Dashboard</Link><button onClick={out}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link to="/signup" className="btn">Create account</Link></>}
        <button onClick={theme} aria-label="Toggle light and dark mode">Light/Dark</button>
      </nav>
    </div></header>
    <main id="main" className="wrap">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Auth mode="login" />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Auth mode="signup" />} />
        <Route path="/forgot" element={<Forgot />} /><Route path="/reset" element={<ResetPw />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/project/:id" element={user ? <ProjectPage /> : <Navigate to="/login" />} />
        <Route path="/contact" element={<ContactPage />} />
        {['privacy', 'terms', 'cookies', 'payment-terms'].map(p => <Route key={p} path={'/' + p} element={<Legal slug={p} />} />)}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <footer><div className="wrap">
      <span>&copy; {new Date().getFullYear()} Dev Prakash Sahu. All rights reserved.</span>
      <a href="mailto:devprakashsahu348@gmail.com">devprakashsahu348@gmail.com</a>
      <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/payment-terms">Payment terms</Link>
    </div></footer>
    {top && <button className="btn ghost top-btn" onClick={() => scrollTo({ top: 0 })} aria-label="Back to top">Top</button>}
    <Guide />
    {cookie && <div className="cookie" role="region" aria-label="Cookie notice"><span>We use one essential cookie to keep you signed in. <Link to="/cookies">Details</Link></span><button className="btn" onClick={() => { localStorage.setItem('eon-cookie', '1'); setCookie(false) }}>Got it</button></div>}
  </Ctx.Provider>
}
