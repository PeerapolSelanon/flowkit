@echo off
:: Double-click to open the Flow Kit Control Center window.
cd /d "%~dp0.."
if exist venv\Scripts\pythonw.exe (venv\Scripts\pythonw.exe scripts\control_center.pyw) else (start "" pythonw scripts\control_center.pyw)
