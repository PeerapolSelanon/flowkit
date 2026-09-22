"""Flow Kit Control Center: start/stop the API and dashboard from a small window.

Double-click this file (or scripts\\control-center.bat). Uses only the Python
standard library so nothing extra needs installing.
"""
import json
import os
import shutil
import subprocess
import sys
import tkinter as tk
import tkinter.font as tkfont
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "scripts" / "logs"
LOGS.mkdir(exist_ok=True)

VENV_PY = ROOT / "venv" / "Scripts" / "python.exe"
# Same as .claude/launch.json when there is no venv: uv provisions 3.11 + requirements.txt
PY = f'"{VENV_PY}"' if VENV_PY.exists() else "uv run --python 3.11 --with-requirements requirements.txt python"
NPM = shutil.which("npm.cmd") or shutil.which("npm") or "npm"

# Same tokens as dashboard/src/index.css and extension/theme.css (tk needs opaque hex, so the
# translucent lines/soft fills are pre-blended against their surface).
BG, SURFACE, CARD, CARD2 = "#0b0c10", "#101218", "#151821", "#1b1f2a"
LINE, LINE_STRONG = "#1e2129", "#2a2e38"
TEXT, TEXT2, MUTED = "#eceef3", "#aab0bf", "#6e7484"
ACCENT, ACCENT_INK, ACCENT_SOFT = "#a394ff", "#0b0c10", "#262640"
OK, OK_SOFT = "#3ddc84", "#17301f"
FAIL, FAIL_SOFT = "#ff6b6b", "#3a1e21"
BUSY, BUSY_SOFT = "#f5b73d", "#3a2f18"


def pick_font():
    """IBM Plex Sans Thai when it is installed (the dashboard's face), else Segoe UI."""
    try:
        families = set(tkfont.families())
    except Exception:
        return "Segoe UI"
    for name in ("IBM Plex Sans Thai", "IBM Plex Sans", "Segoe UI"):
        if name in families:
            return name
    return "Segoe UI"


MONO = "Cascadia Code"


def dashboard_cmd():
    run = f'"{NPM}" run dev --prefix dashboard'
    if not (ROOT / "dashboard" / "node_modules").exists():
        return f'"{NPM}" install --prefix dashboard --no-audit --no-fund && {run}'
    return run


SERVERS = [
    # name, port, command (built lazily so first-run npm install is detected at click time), url to open
    ("API server", 8100, lambda: f'{PY} -m agent.main', "http://127.0.0.1:8100/health"),
    ("Dashboard", 5173, dashboard_cmd, "http://localhost:5173"),
]


def pid_on_port(port):
    """PID listening on the port, or None. netstat is the one tool every Windows has."""
    out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW).stdout
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0] == "TCP" and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
            return int(parts[4])
    return None


def start(name, cmd):
    log = open(LOGS / f"{name.split()[0].lower()}.log", "a", encoding="utf-8", errors="replace")
    subprocess.Popen(cmd, cwd=ROOT, shell=True, stdout=log, stderr=subprocess.STDOUT,
                     stdin=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)


def stop(port):
    pid = pid_on_port(port)
    if pid:  # /T kills the tree: npm -> node, or python reloader -> worker
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)


def health():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8100/health", timeout=0.5) as r:
            return json.load(r)
    except Exception:
        return None


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.font = pick_font()
        self.title("Flow Kit Control Center")
        self.configure(bg=BG)
        self.resizable(False, False)

        # ── header: brand mark + name + start/stop all ─────────────────────────
        head = tk.Frame(self, bg=BG)
        head.pack(fill="x", padx=22, pady=(20, 12))
        tk.Label(head, text="F", bg=ACCENT, fg=ACCENT_INK, font=(self.font, 11, "bold"), width=3, pady=2).pack(side="left", padx=(0, 10))
        title = tk.Frame(head, bg=BG)
        title.pack(side="left")
        tk.Label(title, text="Flow Kit", bg=BG, fg=TEXT, font=(self.font, 12, "bold"), anchor="w").pack(anchor="w")
        tk.Label(title, text="control center", bg=BG, fg=MUTED, font=(self.font, 9), anchor="w").pack(anchor="w")
        self.stop_all_btn = self.button(head, "■  Stop all", self.stop_all, kind="ghost", fg=FAIL, width=10)
        self.stop_all_btn.pack(side="right", padx=(6, 0))
        self.start_all_btn = self.button(head, "▶  Start all", self.start_all, kind="primary", width=11)
        self.start_all_btn.pack(side="right")

        # ── one card per server ──────────────────────────────────────────────
        self.rows = []
        for name, port, cmd, url in SERVERS:
            card = tk.Frame(self, bg=CARD, highlightthickness=1, highlightbackground=LINE, highlightcolor=LINE)
            card.pack(fill="x", padx=22, pady=4)
            dot = tk.Label(card, text="●", bg=CARD, fg=MUTED, font=(self.font, 12))
            dot.pack(side="left", padx=(14, 8), pady=13)
            txt = tk.Frame(card, bg=CARD)
            txt.pack(side="left")
            tk.Label(txt, text=name, bg=CARD, fg=TEXT, font=(self.font, 10, "bold"), anchor="w").pack(anchor="w")
            state = tk.Label(txt, text=f"localhost:{port}", bg=CARD, fg=MUTED, font=(MONO, 8), anchor="w")
            state.pack(anchor="w")
            self.button(card, "Open", lambda u=url: webbrowser.open(u), kind="ghost", width=6).pack(side="right", padx=(4, 12))
            self.button(card, "Restart", lambda p=port, n=name, c=cmd: self.restart(n, p, c), kind="ghost").pack(side="right", padx=4)
            btn = self.button(card, "Start", None, kind="ghost")
            btn.pack(side="right", padx=4)
            self.rows.append((name, port, cmd, dot, state, btn))

        # ── footer: extension status + logs link ─────────────────────────────
        foot = tk.Frame(self, bg=BG)
        foot.pack(fill="x", padx=22, pady=(12, 18))
        self.ext_pill = tk.Label(foot, text="●  checking", bg=CARD2, fg=MUTED, font=(self.font, 9), padx=10, pady=3)
        self.ext_pill.pack(side="left")
        logs = tk.Label(foot, text="open logs", bg=BG, fg=ACCENT, font=(self.font, 9, "underline"), cursor="hand2")
        logs.pack(side="right")
        logs.bind("<Button-1>", lambda e: os.startfile(LOGS))
        self.tick()

    def button(self, parent, text, command, kind="ghost", fg=None, width=8):
        """kind: 'primary' (accent fill) or 'ghost' (surface with a line)."""
        primary = kind == "primary"
        bg = ACCENT if primary else CARD2
        fg = fg or (ACCENT_INK if primary else TEXT)
        b = tk.Button(parent, text=text, command=command, width=width, bg=bg, fg=fg, relief="flat", bd=0,
                      cursor="hand2", font=(self.font, 9, "bold" if primary else "normal"), padx=6, pady=5,
                      activebackground=ACCENT if primary else LINE_STRONG, activeforeground=fg,
                      highlightthickness=1, highlightbackground=ACCENT if primary else LINE_STRONG,
                      highlightcolor=ACCENT if primary else LINE_STRONG, disabledforeground=MUTED)
        return b

    def start_all(self):
        for name, port, cmd, *_ in self.rows:
            if pid_on_port(port) is None:
                start(name, cmd())

    def stop_all(self):
        for _, port, *_ in self.rows:
            stop(port)

    def restart(self, name, port, cmd):
        stop(port)
        self.after(1500, lambda: start(name, cmd()))

    def tick(self):
        all_up, any_up = True, False
        for name, port, cmd, dot, state, btn in self.rows:
            up = pid_on_port(port) is not None
            all_up &= up
            any_up |= up
            dot.config(fg=OK if up else FAIL)
            state.config(text=f"localhost:{port}  ·  {'running' if up else 'stopped'}", fg=OK if up else MUTED)
            btn.config(text="Stop" if up else "Start", fg=FAIL if up else OK,
                       command=(lambda p=port: stop(p)) if up else (lambda n=name, c=cmd: start(n, c())))
        self.start_all_btn.config(state="disabled" if all_up else "normal",
                                  bg=CARD2 if all_up else ACCENT, fg=MUTED if all_up else ACCENT_INK,
                                  highlightbackground=LINE_STRONG if all_up else ACCENT)
        self.stop_all_btn.config(state="normal" if any_up else "disabled", fg=FAIL if any_up else MUTED)
        h = health()
        if h is None:
            self.ext_pill.config(text="●  API not answering yet", bg=CARD2, fg=MUTED)
        elif h.get("extension_connected"):
            self.ext_pill.config(text="●  Extension connected · ready to work", bg=OK_SOFT, fg=OK)
        else:
            self.ext_pill.config(text="●  Extension not connected · open a signed-in flow.google.com tab", bg=BUSY_SOFT, fg=BUSY)
        self.after(2000, self.tick)


if __name__ == "__main__":
    App().mainloop()
