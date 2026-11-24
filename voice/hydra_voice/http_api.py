import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .service import voice_service


class VoiceRequestHandler(BaseHTTPRequestHandler):
    def _origin_allowed(self):
        origin = self.headers.get("Origin")
        return not origin or origin == os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    def _send(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
        if self.headers.get("Origin") == origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
        self.send_response(204)
        if self.headers.get("Origin") == origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path != "/status":
            return self._send(404, {"success": False, "message": "Route not found"})
        self._send(200, voice_service.snapshot())

    def do_POST(self):
        if not self._origin_allowed():
            return self._send(403, {"success": False, "message": "Origin is not allowed"})
        if self.path == "/listen/start":
            if not voice_service.start():
                return self._send(409, {"success": False, "message": "Voice service is already active"})
            return self._send(202, {"success": True, "message": "Listening was requested"})
        if self.path == "/listen/stop":
            stopped = voice_service.stop()
            return self._send(200, {"success": True, "message": "Stop requested" if stopped else "No active recording"})
        self._send(404, {"success": False, "message": "Route not found"})

    def log_message(self, format, *args):
        print(f"Voice HTTP: {format % args}")


def main():
    host = os.getenv("VOICE_HOST", "127.0.0.1")
    port = int(os.getenv("VOICE_PORT", "8765"))
    server = ThreadingHTTPServer((host, port), VoiceRequestHandler)
    print(f"HYDRA voice service ready at http://{host}:{port}; microphone remains inactive until /listen/start")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping HYDRA voice service")
    finally:
        voice_service.stop()
        server.server_close()


if __name__ == "__main__":
    main()
