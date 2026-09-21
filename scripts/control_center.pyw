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
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "scripts" / "logs"
LOGS.mkdir(exist_ok=True)

PY = ROOT / "venv" / "Scripts" / "python.exe"
PY = str(PY) if PY.exists() else sys.executable.replace("pythonw.exe", "python.exe")
NPM = shutil.which("npm.cmd") or shutil.which("npm") or "npm"

# Same palette as dashboard/src/index.css
BG, CARD, BORDER = "#0b0d14", "#151a26", "#232a3b"
TEXT, MUTED, ACCENT = "#e6e9f2", "#7c849c", "#6c8cff"
GREEN, RED, ORANGE = "#2ecc71", "#e74c3c", "#e67e22"
FONT = "Segoe UI"


def dashboard_cmd():
    run = f'"{NPM}" run dev --prefix dashboard'
    if not (ROOT / "dashboard" / "node_modules").exists():
        return f'"{NPM}" install --prefix dashboard --no-audit --no-fund && {run}'
    return run


SERVERS = [
    # name, port, command (built lazily so first-run npm install is detected at click time), url to open
    ("API server", 8100, lambda: f'"{PY}" -m agent.main', "http://127.0.0.1:8100/health"),
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


def button(parent, text, command, bg=CARD, fg=TEXT, width=8, bold=False):
    b = tk.Button(parent, text=text, command=command, width=width, bg=bg, fg=fg, relief="flat", bd=0,
                  cursor="hand2", font=(FONT, 9, "bold" if bold else "normal"), padx=6, pady=5,
                  activebackground=BORDER if bg == CARD else bg, activeforeground=fg,
                  highlightthickness=1, highlightbackground=BORDER, highlightcolor=BORDER)
    return b


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Flow Kit Control Center")
        self.configure(bg=BG)
        self.resizable(False, False)

        head = tk.Frame(self, bg=BG)
        head.pack(fill="x", padx=20, pady=(18, 10))
        tk.Label(head, text="F", bg=ACCENT, fg=BG, font=(FONT, 11, "bold"), width=2).pack(side="left", padx=(0, 10))
        tk.Label(head, text="FLOW KIT", bg=BG, fg=TEXT, font=(FONT, 11, "bold")).pack(side="left")
        tk.Label(head, text="control center", bg=BG, fg=MUTED, font=(FONT, 9)).pack(side="left", padx=8)
        self.stop_all_btn = button(head, "■  Stop all", self.stop_all, bg=CARD, fg=RED, width=10, bold=True)
        self.stop_all_btn.pack(side="right", padx=(6, 0))
        self.start_all_btn = button(head, "▶  Start all", self.start_all, bg=ACCENT, fg=BG, width=11, bold=True)
        self.start_all_btn.pack(side="right")

        self.rows = []
        for name, port, cmd, url in SERVERS:
            card = tk.Frame(self, bg=CARD, highlightthickness=1, highlightbackground=BORDER)
            card.pack(fill="x", padx=20, pady=4)
            dot = tk.Label(card, text="●", bg=CARD, fg=MUTED, font=(FONT, 13))
            dot.pack(side="left", padx=(14, 8), pady=12)
            txt = tk.Frame(card, bg=CARD)
            txt.pack(side="left")
            tk.Label(txt, text=name, bg=CARD, fg=TEXT, font=(FONT, 10, "bold"), anchor="w").pack(anchor="w")
            state = tk.Label(txt, text=f"localhost:{port}", bg=CARD, fg=MUTED, font=(FONT, 8), anchor="w")
            state.pack(anchor="w")
            button(card, "Open", lambda u=url: webbrowser.open(u), width=6).pack(side="right", padx=(4, 12))
            button(card, "Restart", lambda p=port, n=name, c=cmd: self.restart(n, p, c)).pack(side="right", padx=4)
            btn = button(card, "Start", None)
            btn.pack(side="right", padx=4)
            self.rows.append((name, port, cmd, dot, state, btn))

        foot = tk.Frame(self, bg=BG)
        foot.pack(fill="x", padx=20, pady=(10, 16))
        self.ext_dot = tk.Label(foot, text="●", bg=BG, fg=MUTED, font=(FONT, 10))
        self.ext_dot.pack(side="left", padx=(4, 6))
        self.ext = tk.Label(foot, text="", bg=BG, fg=MUTED, font=(FONT, 9), anchor="w")
        self.ext.pack(side="left")
        tk.Label(foot, text="logs", bg=BG, fg=ACCENT, font=(FONT, 9, "underline"), cursor="hand2").pack(side="right")
        foot.winfo_children()[-1].bind("<Button-1>", lambda e: os.startfile(LOGS))
        self.tick()

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
            dot.config(fg=GREEN if up else RED)
            state.config(text=f"localhost:{port}  ·  {'running' if up else 'stopped'}", fg=GREEN if up else MUTED)
            btn.config(text="Stop" if up else "Start", fg=RED if up else GREEN,
                       command=(lambda p=port: stop(p)) if up else (lambda n=name, c=cmd: start(n, c())))
        self.start_all_btn.config(state="disabled" if all_up else "normal", bg=BORDER if all_up else ACCENT,
                                  fg=MUTED if all_up else BG)
        self.stop_all_btn.config(state="normal" if any_up else "disabled", fg=RED if any_up else MUTED)
        h = health()
        if h is None:
            self.ext_dot.config(fg=MUTED); self.ext.config(text="API not answering yet", fg=MUTED)
        elif h.get("extension_connected"):
            self.ext_dot.config(fg=GREEN); self.ext.config(text="Extension connected · ready to work", fg=GREEN)
        else:
            self.ext_dot.config(fg=ORANGE); self.ext.config(text="Extension not connected · open a signed-in flow.google.com tab", fg=ORANGE)
        self.after(2000, self.tick)


if __name__ == "__main__":
    App().mainloop()
