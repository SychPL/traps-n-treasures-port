@echo off
REM Uruchamia serwer podgladu projektu w sieci lokalnej (port 8435).
REM Otworz w przegladarce: http://127.0.0.1:8435/  (lub adres LAN komputera)
cd /d "%~dp0"
echo ============================================
echo  Traps 'n Treasures - serwer podgladu
echo  Lokalnie : http://127.0.0.1:8435/
echo  Gra      : http://127.0.0.1:8435/game/
echo  Ekstraktor: http://127.0.0.1:8435/extractor/
echo  Zatrzymanie: Ctrl+C
echo ============================================
python work\oracle_server.py 8435 0.0.0.0
