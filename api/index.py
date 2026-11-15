import os, re, ast, json, hashlib, secrets, urllib.request
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
import bcrypt, jwt, psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel

app = FastAPI(docs_url=None, redoc_url=None)
SECRET = os.environ.get("JWT_SECRET", "")
DSN = os.environ.get("DATABASE_URL", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173").rstrip("/")
_ready = False
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pw_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS reset_tokens(token_hash TEXT PRIMARY KEY,user_id INT REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,used BOOLEAN DEFAULT false);
CREATE TABLE IF NOT EXISTS rate(key TEXT PRIMARY KEY,n INT NOT NULL,since TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id SERIAL PRIMARY KEY,user_id INT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS versions(id SERIAL PRIMARY KEY,project_id INT REFERENCES projects(id) ON DELETE CASCADE,label TEXT,code TEXT NOT NULL,score INT NOT NULL,analysis JSONB NOT NULL,status TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS experiments(id SERIAL PRIMARY KEY,project_id INT REFERENCES projects(id) ON DELETE CASCADE,base_version INT,new_version INT,strategy TEXT,before INT,after INT,rules_fixed JSONB,status TEXT DEFAULT 'pending',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit(id SERIAL PRIMARY KEY,user_id INT,action TEXT,detail TEXT,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS contact_messages(id SERIAL PRIMARY KEY,name TEXT,email TEXT,message TEXT,created_at TIMESTAMPTZ DEFAULT now());
"""

@contextmanager
def db():
    global _ready
    if not DSN or len(SECRET) < 24:
        raise HTTPException(500, "Server is not configured. Set DATABASE_URL and JWT_SECRET.")
    c = psycopg.connect(DSN, row_factory=dict_row, autocommit=True)
    try:
        if not _ready:
            c.execute(SCHEMA); _ready = True
        yield c
    finally:
        c.close()

def now(): return datetime.now(timezone.utc)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
def clean_email(e):
    e = e.strip().lower()
    if not EMAIL.match(e) or len(e) > 254: raise HTTPException(400, "Enter a valid email address.")
    return e
def check_pw(p, c):
    if p != c: raise HTTPException(400, "Passwords do not match.")
    if len(p) < 10 or not re.search(r"[A-Za-z]", p) or not re.search(r"\d", p) or len(p.encode()) > 72:
        raise HTTPException(400, "Use 10-72 characters with at least one letter and one number.")

def session(res: Response, uid: int):
    t = jwt.encode({"uid": uid, "exp": now() + timedelta(days=7)}, SECRET, algorithm="HS256")
    res.set_cookie("eon_session", t, httponly=True, secure=APP_URL.startswith("https"), samesite="lax", max_age=604800, path="/")
def uid_of(req: Request):
    try: return jwt.decode(req.cookies.get("eon_session", ""), SECRET, algorithms=["HS256"])["uid"]
    except Exception: raise HTTPException(401, "Please sign in.")
def log(c, uid, action, detail=""): c.execute("INSERT INTO audit(user_id,action,detail) VALUES(%s,%s,%s)", (uid, action, detail[:300]))

def send(to, subject, html):
    k = os.environ.get("RESEND_API_KEY")
    if not k: return False
    body = json.dumps({"from": os.environ.get("MAIL_FROM", "EON <onboarding@resend.dev>"), "to": [to], "subject": subject, "html": html}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request("https://api.resend.com/emails", body, {"Authorization": "Bearer " + k, "Content-Type": "application/json"}), timeout=8)
        return True
    except Exception: return False

class Reg(BaseModel): name: str; email: str; password: str; confirm: str
class Login(BaseModel): email: str; password: str
class Forgot(BaseModel): email: str
class Reset(BaseModel): token: str; password: str; confirm: str
class Contact(BaseModel): name: str; email: str; message: str
class ProjectIn(BaseModel): name: str; code: str
class ExpIn(BaseModel): strategy: str; code: str
class Dec(BaseModel): approve: bool
class Chat(BaseModel): message: str; context: str = ""

@app.post("/api/auth/register")
def register(b: Reg):
    name = b.name.strip()
    if len(name) < 2: raise HTTPException(400, "Enter your full name.")
    email = clean_email(b.email); check_pw(b.password, b.confirm)
    h = bcrypt.hashpw(b.password.encode(), bcrypt.gensalt(12)).decode()
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE email=%s", (email,)).fetchone():
            raise HTTPException(409, "That email is already registered. Sign in instead.")
        u = c.execute("INSERT INTO users(name,email,pw_hash) VALUES(%s,%s,%s) RETURNING id", (name, email, h)).fetchone()
        log(c, u["id"], "register")
    return {"ok": True}

@app.post("/api/auth/login")
def login(b: Login, req: Request, res: Response):
    email = b.email.strip().lower()
    key = f"login:{req.headers.get('x-forwarded-for','?').split(',')[0]}:{email}"
    with db() as c:
        r = c.execute("SELECT * FROM rate WHERE key=%s", (key,)).fetchone()
        if r and r["since"] > now() - timedelta(minutes=15) and r["n"] >= 5:
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
        u = c.execute("SELECT * FROM users WHERE email=%s", (email,)).fetchone()
        ok = bcrypt.checkpw(b.password.encode()[:72], u["pw_hash"].encode()) if u else False
        if not ok:
            c.execute("INSERT INTO rate(key,n,since) VALUES(%s,1,now()) ON CONFLICT(key) DO UPDATE SET n=CASE WHEN rate.since<now()-interval '15 minutes' THEN 1 ELSE rate.n+1 END, since=CASE WHEN rate.since<now()-interval '15 minutes' THEN now() ELSE rate.since END", (key,))
            raise HTTPException(401, "Email or password is incorrect.")
        c.execute("DELETE FROM rate WHERE key=%s", (key,)); log(c, u["id"], "login")
    session(res, u["id"]); return {"ok": True}

@app.post("/api/auth/logout")
def logout(res: Response): res.delete_cookie("eon_session", path="/"); return {"ok": True}

@app.get("/api/me")
def me(req: Request):
    uid = uid_of(req)
    with db() as c: return c.execute("SELECT id,name,email FROM users WHERE id=%s", (uid,)).fetchone() or {}

@app.post("/api/auth/forgot")
def forgot(b: Forgot):
    email = b.email.strip().lower()
    with db() as c:
        u = c.execute("SELECT id FROM users WHERE email=%s", (email,)).fetchone()
        if u:
            t = secrets.token_urlsafe(32)
            c.execute("INSERT INTO reset_tokens VALUES(%s,%s,%s,false)", (hashlib.sha256(t.encode()).hexdigest(), u["id"], now() + timedelta(minutes=30)))
            link = f"{APP_URL}/reset?token={t}"
            send(email, "Reset your EON password", f'<p>Use this link within 30 minutes. It works once.</p><p><a href="{link}">{link}</a></p><p>If you did not ask for this, ignore this email.</p>')
            log(c, u["id"], "reset-requested")
    return {"ok": True}

@app.post("/api/auth/reset")
def reset(b: Reset):
    check_pw(b.password, b.confirm)
    th = hashlib.sha256(b.token.encode()).hexdigest()
    with db() as c:
        r = c.execute("UPDATE reset_tokens SET used=true WHERE token_hash=%s AND used=false AND expires_at>now() RETURNING user_id", (th,)).fetchone()
        if not r: raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
        c.execute("UPDATE users SET pw_hash=%s WHERE id=%s", (bcrypt.hashpw(b.password.encode(), bcrypt.gensalt(12)).decode(), r["user_id"]))
        log(c, r["user_id"], "password-reset")
    return {"ok": True}

@app.post("/api/contact")
def contact(b: Contact):
    email = clean_email(b.email)
    if len(b.message.strip()) < 10 or len(b.message) > 4000: raise HTTPException(400, "Write a message between 10 and 4000 characters.")
    with db() as c: c.execute("INSERT INTO contact_messages(name,email,message) VALUES(%s,%s,%s)", (b.name[:120], email, b.message))
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")
    send(os.environ.get("CONTACT_TO", "devprakashsahu348@gmail.com"), "EON contact: " + esc(b.name[:60]), f"<p>From {esc(b.name)} &lt;{email}&gt;</p><p>{esc(b.message)}</p>")
    return {"ok": True}

WEIGHT = {"high": 8, "medium": 4, "low": 1}
SECRET_NAME = re.compile(r"(password|passwd|secret|token|api_?key)", re.I)
def analyze(code: str):
    if len(code) > 300_000: raise HTTPException(400, "File too large (limit 300 KB).")
    try: tree = ast.parse(code)
    except SyntaxError as e: raise HTTPException(400, f"Python syntax error on line {e.lineno}: {e.msg}")
    F = []
    def add(rule, sev, line, msg): F.append({"rule": rule, "severity": sev, "line": line, "message": msg})
    funcs, maxc = 0, 1
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            funcs += 1
            cx = 1 + sum(isinstance(x, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.BoolOp, ast.IfExp, ast.comprehension)) for x in ast.walk(n))
            maxc = max(maxc, cx)
            if cx > 10: add("high-complexity", "medium", n.lineno, f"{n.name}() has complexity {cx}; keep it at 10 or below.")
            ln = (n.end_lineno or n.lineno) - n.lineno + 1
            if ln > 50: add("long-function", "low", n.lineno, f"{n.name}() is {ln} lines long.")
            if len(n.args.args) > 5: add("many-params", "low", n.lineno, f"{n.name}() takes {len(n.args.args)} parameters.")
            if any(isinstance(d, (ast.List, ast.Dict, ast.Set)) for d in n.args.defaults + [k for k in n.args.kw_defaults if k]):
                add("mutable-default", "medium", n.lineno, f"{n.name}() uses a mutable default argument.")
            if not ast.get_docstring(n): add("no-docstring", "low", n.lineno, f"{n.name}() has no docstring.")
        elif isinstance(n, ast.ExceptHandler) and n.type is None:
            add("bare-except", "medium", n.lineno, "Bare except hides real errors; catch specific exceptions.")
        elif isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name) and f.id in ("eval", "exec"): add("eval-exec", "high", n.lineno, f"{f.id}() runs arbitrary code.")
            if isinstance(f, ast.Attribute) and f.attr in ("loads", "load") and isinstance(f.value, ast.Name) and f.value.id == "pickle":
                add("unsafe-deserialization", "high", n.lineno, "pickle can execute code when loading untrusted data.")
            if any(k.arg == "shell" and isinstance(k.value, ast.Constant) and k.value.value is True for k in n.keywords):
                add("shell-true", "high", n.lineno, "shell=True allows command injection.")
        elif isinstance(n, ast.Assign) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str) and n.value.value:
            if any(isinstance(t, ast.Name) and SECRET_NAME.search(t.id) for t in n.targets):
                add("hardcoded-secret", "high", n.lineno, "A secret appears to be written into the source.")
    F.sort(key=lambda x: x["line"])
    by = {}
    for f in F:
        r = by.setdefault(f["rule"], {"count": 0, "points": 0, "severity": f["severity"]})
        r["count"] += 1; r["points"] += WEIGHT[f["severity"]]
    ded = sum(WEIGHT[f["severity"]] for f in F)
    return {"score": max(0, 100 - ded), "deduction": ded, "by_rule": by, "findings": F[:200],
            "metrics": {"lines": code.count("\n") + 1, "functions": funcs, "max_complexity": maxc, "findings": len(F)}}

def own(c, uid, pid):
    p = c.execute("SELECT * FROM projects WHERE id=%s AND user_id=%s", (pid, uid)).fetchone()
    if not p: raise HTTPException(404, "Project not found.")
    return p
def current(c, pid):
    return c.execute("SELECT * FROM versions WHERE project_id=%s AND status IN ('base','approved') ORDER BY id DESC LIMIT 1", (pid,)).fetchone()

@app.get("/api/projects")
def projects(req: Request):
    uid = uid_of(req)
    with db() as c:
        return c.execute("SELECT p.id,p.name,p.created_at,(SELECT score FROM versions v WHERE v.project_id=p.id AND status IN ('base','approved') ORDER BY id DESC LIMIT 1) AS score FROM projects p WHERE user_id=%s ORDER BY id DESC", (uid,)).fetchall()

@app.post("/api/projects")
def new_project(b: ProjectIn, req: Request):
    uid = uid_of(req); a = analyze(b.code); name = b.name.strip()[:80]
    if not name: raise HTTPException(400, "Name your project.")
    with db() as c:
        p = c.execute("INSERT INTO projects(user_id,name) VALUES(%s,%s) RETURNING id", (uid, name)).fetchone()
        c.execute("INSERT INTO versions(project_id,label,code,score,analysis,status) VALUES(%s,'v1 (original)',%s,%s,%s,'base')", (p["id"], b.code, a["score"], Jsonb(a)))
        log(c, uid, "project-created", name)
    return {"id": p["id"]}

def memory(c, uid):
    rows = c.execute("SELECT e.* FROM experiments e JOIN projects p ON p.id=e.project_id WHERE p.user_id=%s AND e.status IN ('approved','rejected')", (uid,)).fetchall()
    proven, strat = {}, {}
    for r in rows:
        s = strat.setdefault(r["strategy"], {"approved": 0, "rejected": 0}); s[r["status"]] += 1
        if r["status"] == "approved":
            for k, v in (r["rules_fixed"] or {}).items(): proven[k] = proven.get(k, 0) + v
    return {"proven_fixes": proven, "strategies": strat, "experiments": len(rows)}

@app.get("/api/projects/{pid}")
def project(pid: int, req: Request):
    uid = uid_of(req)
    with db() as c:
        p = own(c, uid, pid); cur = current(c, pid); mem = memory(c, uid)
        vers = c.execute("SELECT id,label,score,status,created_at FROM versions WHERE project_id=%s ORDER BY id", (pid,)).fetchall()
        exps = c.execute("SELECT * FROM experiments WHERE project_id=%s ORDER BY id DESC", (pid,)).fetchall()
    opps = sorted(({"rule": k, **v, "proven": mem["proven_fixes"].get(k, 0)} for k, v in cur["analysis"]["by_rule"].items()), key=lambda o: (-o["points"], -o["proven"]))
    return {"project": p, "current": {"id": cur["id"], "label": cur["label"], "code": cur["code"], "analysis": cur["analysis"]}, "versions": vers, "experiments": exps, "opportunities": opps, "memory": mem}

@app.post("/api/projects/{pid}/experiments")
def experiment(pid: int, b: ExpIn, req: Request):
    uid = uid_of(req); a = analyze(b.code)
    with db() as c:
        own(c, uid, pid); cur = current(c, pid)
        if b.code.strip() == cur["code"].strip(): raise HTTPException(400, "This code is identical to the current version.")
        n = c.execute("SELECT count(*) AS n FROM versions WHERE project_id=%s", (pid,)).fetchone()["n"] + 1
        strat = b.strategy.strip()[:80] or "manual"
        v = c.execute("INSERT INTO versions(project_id,label,code,score,analysis,status) VALUES(%s,%s,%s,%s,%s,'candidate') RETURNING id", (pid, f"v{n} ({strat[:40]})", b.code, a["score"], Jsonb(a))).fetchone()
        fixed = {k: o["count"] - a["by_rule"].get(k, {"count": 0})["count"] for k, o in cur["analysis"]["by_rule"].items()}
        fixed = {k: x for k, x in fixed.items() if x > 0}
        e = c.execute("INSERT INTO experiments(project_id,base_version,new_version,strategy,before,after,rules_fixed) VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING id", (pid, cur["id"], v["id"], strat, cur["score"], a["score"], Jsonb(fixed))).fetchone()
        log(c, uid, "experiment", f"project {pid}")
    return {"id": e["id"], "before": cur["score"], "after": a["score"], "rules_fixed": fixed}

@app.post("/api/experiments/{eid}/decision")
def decide(eid: int, b: Dec, req: Request):
    uid = uid_of(req)
    with db() as c:
        e = c.execute("SELECT e.* FROM experiments e JOIN projects p ON p.id=e.project_id WHERE e.id=%s AND p.user_id=%s", (eid, uid)).fetchone()
        if not e or e["status"] != "pending": raise HTTPException(404, "Experiment not found or already decided.")
        if b.approve and e["after"] <= e["before"]: raise HTTPException(400, "Only changes that raise the score can be approved.")
        s = "approved" if b.approve else "rejected"
        c.execute("UPDATE experiments SET status=%s WHERE id=%s", (s, eid)); c.execute("UPDATE versions SET status=%s WHERE id=%s", (s, e["new_version"]))
        log(c, uid, "decision-" + s, str(eid))
    return {"status": s}

@app.get("/api/memory")
def mem_endpoint(req: Request):
    uid = uid_of(req)
    with db() as c: return memory(c, uid)

RULES = {"complexity": "Complexity counts decision points (if, loops, boolean operators). Split big functions into small ones with one job each.",
 "except": "A bare except catches everything, even Ctrl+C. Catch the specific error you expect and log it.",
 "eval": "eval and exec run text as code. Replace them with ast.literal_eval or an explicit lookup table.",
 "secret": "Never write passwords or API keys in source. Read them from environment variables.",
 "score": "Score = 100 minus findings: high 8 points, medium 4, low 1 (minimum 0). It comes from static checks only, so a high score does not prove the program is correct.",
 "mutable": "def f(x=[]) shares one list across all calls. Use x=None and create the list inside.",
 "memory": "Evolution Memory records which experiments you approved or rejected and which rules they fixed, then ranks future opportunities by what worked before."}
@app.post("/api/guide")
def guide(b: Chat):
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        try:
            m = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
            body = json.dumps({"contents": [{"parts": [{"text": "You are EON Guide, a patient software mentor. Be concise. If unsure, say so.\nContext: " + b.context[:2000] + "\nQuestion: " + b.message[:1500]}]}]}).encode()
            r = urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent", body, {"Content-Type": "application/json", "x-goog-api-key": k}), timeout=20)
            return {"source": "ai", "reply": json.load(r)["candidates"][0]["content"]["parts"][0]["text"]}
        except Exception: pass
    q = b.message.lower()
    for key, v in RULES.items():
        if key in q: return {"source": "builtin", "reply": v}
    return {"source": "builtin", "reply": "Ask about: score, complexity, bare except, eval, secrets, mutable defaults, or evolution memory. Live AI answers turn on when a Gemini API key is configured."}
