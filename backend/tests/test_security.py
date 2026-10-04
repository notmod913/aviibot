import os
import unittest

from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.api.security import require_api_access


class ApiAccessTests(unittest.TestCase):
    def setUp(self):
        self.original_environment = os.environ.get("APP_ENV")
        self.original_token = os.environ.get("API_ACCESS_TOKEN")
        os.environ["APP_ENV"] = "development"
        os.environ.pop("API_ACCESS_TOKEN", None)

    def tearDown(self):
        if self.original_environment is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = self.original_environment
        if self.original_token is None:
            os.environ.pop("API_ACCESS_TOKEN", None)
        else:
            os.environ["API_ACCESS_TOKEN"] = self.original_token

    @staticmethod
    def make_request(client_host):
        return Request({
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/api/schedule",
            "raw_path": b"/api/schedule",
            "query_string": b"",
            "headers": [],
            "client": (client_host, 12345),
            "server": ("127.0.0.1", 8000),
        })

    def test_development_allows_loopback_without_a_token(self):
        self.assertIsNone(require_api_access(self.make_request("127.0.0.1"), None))

    def test_development_rejects_non_loopback_without_a_token(self):
        with self.assertRaises(HTTPException) as error:
            require_api_access(self.make_request("192.0.2.10"), None)
        self.assertEqual(error.exception.status_code, 503)

    def test_configured_token_is_required_and_checked(self):
        token = "t" * 32
        os.environ["API_ACCESS_TOKEN"] = token
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        self.assertIsNone(require_api_access(self.make_request("127.0.0.1"), credentials))

        bad_credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong")
        with self.assertRaises(HTTPException) as error:
            require_api_access(self.make_request("127.0.0.1"), bad_credentials)
        self.assertEqual(error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
