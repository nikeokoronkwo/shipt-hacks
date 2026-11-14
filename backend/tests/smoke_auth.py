"""Run from backend: .venv/bin/python tests/smoke_auth.py."""
import os
from pathlib import Path
import subprocess
import tempfile
import sys
import time
import httpx

ROOT = Path(__file__).resolve().parents[2]
AUTH = 'http://localhost:13001'
API = 'http://127.0.0.1:18000'


def wait(url, process):
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError(f"Server exited before readiness: {url}")
        try:
            if httpx.get(url).status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(.1)
    raise RuntimeError(f'Server failed to start: {url}')


def run():
    with tempfile.TemporaryDirectory(prefix='shelterconnect-auth-') as tmp:
        env = {**os.environ, 'BETTER_AUTH_SECRET': 'temporary-smoke-test-secret-at-least-32-characters',
               'BETTER_AUTH_URL': AUTH, 'AUTH_DB_PATH': f'{tmp}/test.db', 'PORT': '13001',
               'AUTH_ISSUER': AUTH, 'AUTH_AUDIENCE': 'smoke-api', 'JWT_AUDIENCE': 'smoke-api', 'AUTH_JWKS_URL': f'{AUTH}/api/auth/jwks',
               'DATABASE_URL': f'sqlite:///{tmp}/test.db',
               'ADMIN_EMAIL': 'admin@example.com', 'ADMIN_PASSWORD': 'SmokePassword-12345'}
        tsx = str(ROOT / 'auth/node_modules/.bin/tsx')
        for script in ['migrate', 'bootstrap-admin']:
            subprocess.run([tsx, f'src/{script}.ts'], cwd=ROOT / 'auth', env=env, check=True)
        processes = []
        try:
            def start_auth():
                process = subprocess.Popen([tsx, 'src/server.ts'], cwd=ROOT / 'auth', env=env)
                processes.append(process)
                wait(f'{AUTH}/health', process)
                return process
            auth_process = start_auth()
            processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn',
                'app.main:app', '--port', '18000'], cwd=ROOT / 'backend', env=env))
            wait(f'{API}/health', processes[-1])
            with httpx.Client(base_url=AUTH, headers={'Origin': 'http://localhost:5173'}) as client:
                def post(path, body):
                    return client.post(f'/api/auth/{path}', json=body)
                response = post('sign-up/email', {'name': 'Test Driver', 'email': 'driver@example.com',
                    'password': 'DriverPassword-12345', 'role': 'super_admin', 'is_verified': True})
                assert response.status_code == 400, response.text
                response = post('sign-up/email', {'name': 'Test Driver', 'email': 'driver@example.com',
                    'password': 'DriverPassword-12345'})
                assert response.status_code == 200, response.text
                user_id = response.json()['user']['id']
                assert response.json()['user']['role'] == 'driver'
                assert post('admin/set-role', {'userId': user_id, 'role': 'super_admin'}).status_code == 403
                assert post('admin/create-user', {'name': 'Escalation', 'email': 'bad@example.com',
                    'password': 'DriverPassword-12345', 'role': 'super_admin'}).status_code == 403
                assert client.get('/api/auth/get-session').json()['user']['id'] == user_id
                jwks_before = client.get('/api/auth/jwks').json()
                assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
                jwt_token = client.get('/api/auth/token').json()['token']
                assert httpx.get(f'{API}/api/me', headers={'Authorization': f'Bearer {jwt_token}'}).json() == {'id': user_id, 'role': 'driver'}
                assert httpx.get(f'{API}/api/me').status_code == 401
                auth_process.terminate()
                auth_process.wait(timeout=10)
                start_auth()
                assert client.get('/api/auth/get-session').json()['user']['id'] == user_id
                assert client.get('/api/auth/jwks').json() == jwks_before
                fresh_token = client.get('/api/auth/token').json()['token']
                assert httpx.get(f'{API}/api/me', headers={'Authorization': f'Bearer {fresh_token}'}).status_code == 200
                assert post('sign-out', {}).status_code == 200
                assert client.get('/api/auth/get-session').json() is None
                assert client.get('/api/auth/token').status_code == 401
                assert post('sign-in/email', {'email': 'driver@example.com', 'password': 'wrong-password'}).status_code == 401
                assert post('sign-in/email', {'email': 'driver@example.com', 'password': 'DriverPassword-12345'}).status_code == 200
                assert post('sign-out', {}).status_code == 200
                assert post('sign-in/email', {'email': env['ADMIN_EMAIL'], 'password': env['ADMIN_PASSWORD']}).status_code == 200
                assert post('admin/set-role', {'userId': user_id, 'role': ['driver', 'shelter_admin']}).status_code == 400
                assert post('admin/set-role', {'userId': user_id, 'role': 'shelter_admin'}).status_code == 200
                assert post('admin/create-user', {'name': 'Shelter Admin', 'email': 'shelter@example.com',
                    'password': 'ShelterPassword-12345', 'role': 'shelter_admin'}).status_code == 200
                assert post('sign-out', {}).status_code == 200
                assert post('sign-in/email', {'email': 'driver@example.com', 'password': 'DriverPassword-12345'}).status_code == 200
                changed_token = client.get('/api/auth/token').json()['token']
                assert httpx.get(f'{API}/api/me', headers={'Authorization': f'Bearer {changed_token}'}).json()['role'] == 'shelter_admin'
            print('PASS: signup, escalation rejection, sessions, JWT/FastAPI, restart persistence, logout, login, admin operations')
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=10)


if __name__ == '__main__':
    run()
