#!/usr/bin/env python3
"""Serve this folder for the TV display.

Use this instead of `python3 -m http.server`. That one is single-threaded: the
page loads about a dozen ES modules at once and the plain server intermittently
resets connections under that burst, which makes the display boot blank perhaps
one time in four. Caught in rehearsal on election morning.

    python3 tools/serve.py          # then open http://localhost:8000/

It also relays between the TV page and the control page, so the two no longer
need to share a browser profile and the control page works from a phone on the
same network. The relay holds one snapshot of state and a short queue of
commands, both in memory: nothing is persisted and a restart simply starts
over, which is what you want mid-evening.

    GET  /api/state              latest snapshot the TV pushed
    POST /api/state              TV pushes its snapshot
    POST /api/command            control queues a command
    GET  /api/commands?since=N   commands newer than N, for the TV to apply
"""

import functools
import json
import os
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# The relay. One state snapshot, and a queue of commands with sequence numbers
# so the TV can ask only for what it has not seen. Trimmed so a long evening
# cannot grow it without bound.
MAX_COMMANDS = 100
RELAY = {"state": None, "seq": 0, "commands": []}
LOCK = threading.Lock()


def lan_ip():
    """Best guess at this machine's address on the local network, for the
    phone. No traffic is actually sent; it just asks the routing table."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None

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

    # ---------------------------------------------------------- relay ----

    def _json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return None
        try:
            return json.loads(self.rfile.read(length) or b"null")
        except ValueError:
            return None

    def do_GET(self):
        if self.path.startswith("/api/state"):
            with LOCK:
                return self._json({"state": RELAY["state"], "seq": RELAY["seq"]})
        if self.path.startswith("/api/commands"):
            since = 0
            if "since=" in self.path:
                try:
                    since = int(self.path.split("since=", 1)[1].split("&", 1)[0])
                except ValueError:
                    since = 0
            with LOCK:
                pending = [c for c in RELAY["commands"] if c["seq"] > since]
                return self._json({"seq": RELAY["seq"], "commands": pending})
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/state"):
            body = self._read_json()
            with LOCK:
                RELAY["state"] = body
            return self._json({"ok": True})
        if self.path.startswith("/api/command"):
            body = self._read_json()
            with LOCK:
                RELAY["seq"] += 1
                RELAY["commands"].append({"seq": RELAY["seq"], "payload": body})
                del RELAY["commands"][:-MAX_COMMANDS]
                return self._json({"ok": True, "seq": RELAY["seq"]})
        self.send_error(404)

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
    try:
        server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    except OSError as e:
        # Errno 48 is "address already in use" — usually an earlier copy of
        # this server that did not shut down. A traceback is no help at 6 PM,
        # so say what to do instead.
        if e.errno != 48:
            raise
        print(f"Port {PORT} is already in use.\n", file=sys.stderr)
        print("Most likely an earlier copy of this server is still running.", file=sys.stderr)
        print("Find and stop it with:\n", file=sys.stderr)
        print(f"    lsof -nP -iTCP:{PORT} -sTCP:LISTEN", file=sys.stderr)
        print(f"    kill <PID>\n", file=sys.stderr)
        print(f"Or serve on another port:  python3 tools/serve.py {PORT + 1}", file=sys.stderr)
        sys.exit(1)
    server.daemon_threads = True
    # flush=True: without it Python buffers when stdout is not a terminal, and
    # you get no confirmation the server actually came up.
    print(f"Election night display serving {ROOT}", flush=True)
    print(f"  TV      http://localhost:{PORT}/", flush=True)
    print(f"  Control http://localhost:{PORT}/control.html", flush=True)
    ip = lan_ip()
    if ip:
        print(f"  Phone   http://{ip}:{PORT}/control.html   (same Wi-Fi)", flush=True)
    print("Ctrl-C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
