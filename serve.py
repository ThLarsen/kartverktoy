"""Enkel utviklingsserver. `python serve.py` og åpne http://localhost:8777.

Grunnen til at dette trengs i det hele tatt: ES-moduler (`<script type="module">`)
blokkeres av nettleseren over file://. Derfor må mappa serveres over HTTP, og
denne filen er den korteste veien dit uten Node.
"""

import http.server
import os
import socketserver
import webbrowser

PORT = int(os.environ.get("PORT", "8777"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Ingen caching under utvikling — ellers serverer nettleseren gammel JS
        # etter hver eneste endring, og du feilsøker forrige versjon.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in fmt % args:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/"
        print(f"Kartverktøy kjører på {url}  (Ctrl+C for å stoppe)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()
