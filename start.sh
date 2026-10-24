#!/bin/sh
# Traps 'n Treasures: starts a local web server for the game and opens it in the browser (python3 or node).
# With the demo pack the game offers to load your own ADF disks at the bottom of the page.
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8435}
URL="http://127.0.0.1:$PORT/game/"
echo "Traps 'n Treasures: $URL  (Ctrl+C stops the server)"
(sleep 1; if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; elif command -v open >/dev/null 2>&1; then open "$URL"; fi) >/dev/null 2>&1 &
if command -v node >/dev/null 2>&1; then exec node serve.mjs "$PORT"
elif command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT" --bind 127.0.0.1
else echo "Needs node or python3"; exit 1
fi
