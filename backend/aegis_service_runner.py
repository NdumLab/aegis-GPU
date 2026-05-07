#!/usr/bin/env python3
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request


HOST = os.getenv('AEGIS_BIND_HOST', '127.0.0.1')
PORT = int(os.getenv('AEGIS_BIND_PORT', '8000'))
WORKERS = int(os.getenv('AEGIS_WORKERS', '4'))
READY_TIMEOUT = float(os.getenv('AEGIS_READY_TIMEOUT', '45'))
STATUS_URL = f'http://{HOST}:{PORT}/api/v1/status'
STOP_REQUESTED = False
CHILD = None


def sd_notify(message: str) -> None:
    notify_socket = os.getenv('NOTIFY_SOCKET')
    if not notify_socket:
        return
    address = notify_socket
    if notify_socket.startswith('@'):
        address = '\0' + notify_socket[1:]
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        sock.connect(address)
        sock.sendall(message.encode('utf-8'))
    finally:
        sock.close()


def stop_child(signum, _frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    if CHILD and CHILD.poll() is None:
        CHILD.send_signal(signum)


def wait_until_ready(timeout: float) -> None:
    deadline = time.time() + timeout
    last_error = 'unknown'
    while time.time() < deadline:
        if STOP_REQUESTED:
            raise RuntimeError('startup interrupted by signal')
        if CHILD and CHILD.poll() is not None:
            raise RuntimeError(f'uvicorn exited during startup with code {CHILD.returncode}')
        try:
            with urllib.request.urlopen(STATUS_URL, timeout=1.5) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            last_error = str(exc)
        time.sleep(0.5)
    raise RuntimeError(f'timed out waiting for API readiness at {STATUS_URL}: {last_error}')


def main() -> int:
    global CHILD
    signal.signal(signal.SIGTERM, stop_child)
    signal.signal(signal.SIGINT, stop_child)

    cmd = [
        '/usr/local/bin/uvicorn',
        'log-analizer:app',
        '--host', HOST,
        '--port', str(PORT),
        '--workers', str(WORKERS),
    ]

    CHILD = subprocess.Popen(cmd, cwd='/opt/aegis-gpu')
    sd_notify('STATUS=Starting uvicorn and waiting for API readiness')
    try:
        wait_until_ready(READY_TIMEOUT)
    except Exception as exc:
        sd_notify(f'STATUS=Startup failed: {exc}')
        if CHILD.poll() is None:
            CHILD.terminate()
            try:
                CHILD.wait(timeout=10)
            except subprocess.TimeoutExpired:
                CHILD.kill()
        print(str(exc), file=sys.stderr)
        return 1

    sd_notify(f'READY=1\nSTATUS=Aegis API ready on {HOST}:{PORT}')
    return CHILD.wait()


if __name__ == '__main__':
    raise SystemExit(main())
