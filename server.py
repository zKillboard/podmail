#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            # Redirect to custom 404 handler
            self.path = '/404.html'
            return self.do_GET()
        return super().send_error(code, message, explain)

if __name__ == '__main__':
    os.chdir('.')  # Serve from current dir
    httpd = HTTPServer(('0.0.0.0', 8080), CustomHandler)
    print("Serving on http://localhost:8080")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()
