@echo off
REM Traps 'n Treasures: starts a local web server for the game and opens it in the browser (nothing to install).
REM With the demo pack the game offers to load your own ADF disks at the bottom of the page.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
