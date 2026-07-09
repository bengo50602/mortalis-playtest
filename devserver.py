#!/usr/bin/env python3
"""Tiny no-cache static server for local playtesting/preview.
Sends Cache-Control: no-store so edits to engine.js/ui.js are always picked up
on reload. Not needed to run the game — index.html works by double-click too.
"""
import http.server
import socketserver

PORT = 8642


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Serving on http://127.0.0.1:{PORT} (no-cache)")
    httpd.serve_forever()
