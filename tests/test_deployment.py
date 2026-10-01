"""Verify each copied server folder starts without access to the repository."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing

ROOT = Path(__file__).resolve().parents[1]


class StandaloneDeploymentTests(unittest.TestCase):
    def test_security_copies_match(self):
        self.assertEqual((ROOT / "backend/chatbot_server/security.py").read_bytes(),
            (ROOT / "backend/dashboard_server/security.py").read_bytes())

    def test_each_server_runs_from_an_isolated_folder(self):
        temp_root = ROOT / ".test-tmp"
        temp_root.mkdir(exist_ok=True)
        for server in ("chatbot_server", "dashboard_server"):
            with self.subTest(server=server), tempfile.TemporaryDirectory(dir=temp_root) as directory:
                deployment = Path(directory) / "deployment"
                shutil.copytree(ROOT / "backend" / server, deployment,
                    ignore=shutil.ignore_patterns(".env", "__pycache__", "*.db", "temp_uploads"))
                (deployment / ".env").write_text("DEPLOYMENT_LOCAL_SETTING=loaded\n", encoding="utf-8")
                environment = os.environ.copy()
                # Do not inherit real provider/database settings for smoke tests.
                environment.update(APP_ENV="development", FRONTEND_ORIGINS="http://localhost:5500",
                    SUPABASE_URL="", SUPABASE_KEY="",
                    GEMINI_API_KEY="test-not-a-real-key", GROQ_API_KEY="test-not-a-real-key",
                    STAFF_USERS="", OLINDA_DB_PATH=str(deployment / "test.db"))
                environment.pop("DEPLOYMENT_LOCAL_SETTING", None)
                # Retain external installed libraries, but forbid the repository on PYTHONPATH.
                environment["PYTHONPATH"] = os.pathsep.join(str(Path(p).resolve())
                    for p in environment.get("PYTHONPATH", "").split(os.pathsep)
                    if p and Path(p).resolve() != ROOT)
                script = """import os, sys, pathlib
import main, security
assert 'backend' not in sys.modules
assert pathlib.Path(security.__file__).parent == pathlib.Path.cwd()
assert os.environ['DEPLOYMENT_LOCAL_SETTING'] == 'loaded'
assert any(route.path == '/health' for route in main.app.routes)
print('standalone import passed')
"""
                result = subprocess.run([sys.executable, "-c", script], cwd=deployment,
                    env=environment, capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("standalone import passed", result.stdout)
                if server == "dashboard_server":
                    self.assertTrue((deployment / "supabase_security_migration.sql").is_file())
