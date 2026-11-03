#!/usr/bin/env python3
"""Serve this folder for the TV display.

Use this instead of `python3 -m http.server`. That one is single-threaded: the
page loads about a dozen ES modules at once and the plain server intermittently
resets connections under that burst, which makes the display boot blank perhaps
one time in four. Caught in rehearsal on election morning.

    python3 tools/serve.py          # then open http://localhost:8000/

Serves on all interfaces so the control window can also be opened from a phone
on the same network if the laptop screen is in use.
"""

import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keeps connections alive. Under the default HTTP/1.0 the browser
    # opens a fresh socket for every one of the ~14 ES modules and the server
    # resets some of them, so the page boots blank.
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        # Never let the browser cache the app itself: a reload mid-evening must
        # pick up any fix immediately. The feeds set their own cache headers.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Only log failures; a success line per poll would bury them.
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    # The default listen backlog of 5 overflows when the module graph is
    # requested all at once.
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    server.daemon_threads = True
    # flush=True: without it Python buffers when stdout is not a terminal, and
    # you get no confirmation the server actually came up.
    print(f"Election night display serving {ROOT}", flush=True)
    print(f"  TV      http://localhost:{PORT}/", flush=True)
    print(f"  Control http://localhost:{PORT}/control.html", flush=True)
    print("Ctrl-C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
