"""Authenticated server-to-server entry point for the dashboard search service."""
import hmac
import os
from searx.webapp import app

def application(environ, start_response):
    if environ.get("PATH_INFO") == "/healthz":
        start_response("200 OK", [("Content-Type", "application/json")])
        return [b'{"status":"ready"}']
    expected = os.environ.get("SEARCH_SERVICE_KEY", "")
    provided = environ.get("HTTP_X_SEARCH_SERVICE_KEY", "")
    if not expected or not hmac.compare_digest(provided, expected):
        start_response("401 Unauthorized", [("Content-Type", "application/json")])
        return [b'{"error":"Unauthorized"}']
    if environ.get("PATH_INFO") != "/search":
        start_response("404 Not Found", [("Content-Type", "application/json")])
        return [b'{"error":"Not found"}']
    return app(environ, start_response)
