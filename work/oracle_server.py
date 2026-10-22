#!/usr/bin/env python3
"""Serwer podgladu projektu + zapis zrzutow RAM z emulatora (wyrocznia).

GET  /...             - pliki projektu (jak python -m http.server)
POST /dump/<nazwa>    - zapisuje cialo zadania do work/dumps/<nazwa>
                        (tylko z 127.0.0.1, nazwa [A-Za-z0-9_.-], max 32 MB)

Uzycie: python work/oracle_server.py [port] [adres]   (domyslnie 8435 0.0.0.0)
"""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMPS = os.path.join(ROOT, 'work', 'dumps')
NAME = re.compile(r'^[A-Za-z0-9_.-]{1,80}$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')   # przegladarka zawsze sprawdza nowa wersje plikow
        super().end_headers()

    def do_POST(self):
        name = self.path[len('/dump/'):] if self.path.startswith('/dump/') else ''
        size = int(self.headers.get('Content-Length') or 0)
        if self.client_address[0] != '127.0.0.1':
            return self.send_error(403, 'dump only from localhost')
        if not NAME.match(name) or name.startswith('.') or not 0 < size <= 32 << 20:
            return self.send_error(400, 'bad name or size')
        os.makedirs(DUMPS, exist_ok=True)
        with open(os.path.join(DUMPS, name), 'wb') as f:
            f.write(self.rfile.read(size))
        self.send_response(204)
        self.end_headers()
        print('dump saved:', name, size, 'B')


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8435
    host = sys.argv[2] if len(sys.argv) > 2 else '0.0.0.0'
    print(f'http://127.0.0.1:{port}/  (root {ROOT})')
    http.server.ThreadingHTTPServer((host, port), Handler).serve_forever()
