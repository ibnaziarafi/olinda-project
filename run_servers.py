"""Run the independent Olinda services for local development."""

import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVICES = [
    ("chatbot", ROOT / "backend" / "chatbot_server", "8000"),
    ("dashboard", ROOT / "backend" / "dashboard_server", "8001"),
]

processes = []


def stop_processes(*_args):
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        process.wait()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, stop_processes)
    signal.signal(signal.SIGTERM, stop_processes)

    for name, directory, port in SERVICES:
        env = os.environ.copy()
        env["PORT"] = port
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", port],
            cwd=directory,
            env=env,
        )
        processes.append(process)
        print(f"{name.title()} server started on http://localhost:{port}")

    try:
        while any(process.poll() is None for process in processes):
            for process in processes:
                if process.poll() not in (None, 0):
                    raise SystemExit(process.returncode)
    finally:
        stop_processes()
