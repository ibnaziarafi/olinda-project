"""Run separately: the two independently deployed services use local module names."""
import os
import sys
from pathlib import Path
from unittest.mock import patch

os.environ.update(SUPABASE_URL='', SUPABASE_KEY='', GEMINI_API_KEY='local-test-key', PYTHON_DOTENV_DISABLED='1', STAFF_USERS='testadmin:test-only-password:Test Admin:admin', AUTH_SECRET='local-test-secret')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'backend/dashboard_server'))
from fastapi.testclient import TestClient
from data import database
import main

test_db = Path(__file__).with_name('.test-dashboard.db')
test_db.unlink(missing_ok=True)
with patch.object(database, 'DB_PATH', str(test_db)):
    with TestClient(main.app) as client:
        assert client.get('/health').status_code == 200
        assert client.get('/api/staff').status_code == 401
        response = client.post('/api/login', json={'username': 'testadmin', 'password': 'test-only-password'})
        assert response.status_code == 200, response.text
        headers = {'Authorization': 'Bearer ' + response.json()['token']}
        assert client.get('/api/me', headers=headers).json()['role'] == 'admin'
        assert client.get('/api/analytics', headers=headers).status_code == 200
        assert client.get('/api/unanswered', headers=headers).status_code == 200
        assert client.get('/api/chunks', headers=headers).status_code == 200
        response = client.post('/api/staff', headers=headers, json={'username':'newstaff', 'password':'test-password-123', 'name':'New Staff', 'role':'user'})
        assert response.status_code == 200, response.text
        response = client.post('/api/login', json={'username':'newstaff','password':'test-password-123'})
        assert response.status_code == 200, response.text
        user_headers = {'Authorization':'Bearer '+response.json()['token']}
        assert client.get('/api/staff', headers=user_headers).status_code == 403
        assert client.delete('/api/staff/newstaff', headers=headers).status_code == 200
print('PASS: dashboard startup, authentication, staff persistence, authorization, analytics and knowledge routes')
test_db.unlink(missing_ok=True)
