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
from tkinter import ttk

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "scripts" / "logs"
LOGS.mkdir(exist_ok=True)

PY = ROOT / "venv" / "Scripts" / "python.exe"
PY = str(PY) if PY.exists() else sys.executable.replace("pythonw.exe", "python.exe")
NPM = shutil.which("npm.cmd") or shutil.which("npm") or "npm"


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


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Flow Kit Control Center")
        self.resizable(False, False)
        pad = {"padx": 10, "pady": 6}
        self.rows = []
        for i, (name, port, cmd, url) in enumerate(SERVERS):
            dot = tk.Label(self, text="●", font=("Segoe UI", 14), fg="gray")
            dot.grid(row=i, column=0, **pad)
            tk.Label(self, text=f"{name}  (:{port})", width=22, anchor="w", font=("Segoe UI", 10)).grid(row=i, column=1, **pad)
            btn = ttk.Button(self, text="Start", width=9)
            btn.grid(row=i, column=2, **pad)
            ttk.Button(self, text="Restart", width=9, command=lambda p=port, n=name, c=cmd: self.restart(n, p, c)).grid(row=i, column=3, **pad)
            ttk.Button(self, text="Open", width=7, command=lambda u=url: webbrowser.open(u)).grid(row=i, column=4, **pad)
            self.rows.append((name, port, cmd, dot, btn))
        self.ext = tk.Label(self, text="", anchor="w", font=("Segoe UI", 9))
        self.ext.grid(row=len(SERVERS), column=0, columnspan=5, sticky="w", **pad)
        ttk.Button(self, text="Open logs folder", command=lambda: os.startfile(LOGS)).grid(row=len(SERVERS) + 1, column=0, columnspan=5, pady=(0, 10))
        self.tick()

    def restart(self, name, port, cmd):
        stop(port)
        self.after(1500, lambda: start(name, cmd()))

    def tick(self):
        for name, port, cmd, dot, btn in self.rows:
            up = pid_on_port(port) is not None
            dot.config(fg="#2ecc71" if up else "#e74c3c")
            btn.config(text="Stop" if up else "Start",
                       command=(lambda p=port: stop(p)) if up else (lambda n=name, c=cmd: start(n, c())))
        h = health()
        if h is None:
            self.ext.config(text="API not answering yet", fg="gray")
        elif h.get("extension_connected"):
            self.ext.config(text="✔ Extension connected. Ready to work.", fg="#2ecc71")
        else:
            self.ext.config(text="✘ Extension not connected: open a signed-in https://flow.google.com/ tab.", fg="#e67e22")
        self.after(2000, self.tick)


if __name__ == "__main__":
    App().mainloop()
