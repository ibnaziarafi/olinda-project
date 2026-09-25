"""API regressions with a temporary database and no external model calls."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_KEY'] = ''
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend/chatbot_server'))

from fastapi.testclient import TestClient
import database
import main


class ChatbotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(database, 'DB_PATH', str(Path(self.temp.name)/'test.db'))
        self.db_patch.start()
        self.client = TestClient(main.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.db_patch.stop()
        self.temp.cleanup()

    def test_escalation_returns_persistent_answer_and_changeable_vote(self):
        response = self.client.post('/chat', json={'session_id': 'test-session', 'query': 'change my timetable'})
        self.assertEqual(response.status_code, 200)
        answer = response.json()
        self.assertTrue(answer['escalated'])
        vote = {'session_id': 'test-session', 'message_id': answer['message_id'], 'rating': 'like'}
        self.assertEqual(self.client.post('/feedback', json=vote).status_code, 200)
        vote['rating'] = 'dislike'
        self.assertEqual(self.client.post('/feedback', json=vote).status_code, 200)
        conn = database.get_db()
        try:
            rows = conn.execute('SELECT * FROM message_feedback').fetchall()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['rating'], 'dislike')
        finally:
            conn.close()
        vote['session_id'] = 'another-session'
        self.assertEqual(self.client.post('/feedback', json=vote).status_code, 404)
        vote['rating'] = 'invalid'
        self.assertEqual(self.client.post('/feedback', json=vote).status_code, 422)

    @patch('chat.retrieve_context', return_value=([], 0.0))
    def test_low_confidence_is_logged(self, _retrieve):
        response = self.client.post('/chat', json={'query': 'An unknown course'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['message_id'])
        conn = database.get_db()
        try:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM unanswered_log').fetchone()[0], 1)
        finally:
            conn.close()

    @patch('chat.generate_llm_response', return_value='A grounded answer')
    @patch('chat.retrieve_context', return_value=(['Course details https://example.edu/course'], .9))
    def test_answer_contract_and_guardrail_prompt(self, _retrieve, generate):
        response = self.client.post('/chat', json={'query': 'Which course?', 'session_id': 'session-a'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['reply'], 'A grounded answer')
        self.assertTrue(response.json()['message_id'])
        self.assertEqual(response.json()['action_links'][0]['url'], 'https://example.edu/course')
        self.assertIn('Only answer', generate.call_args.args[0][0]['content'])

    def test_bad_query_and_missing_vote(self):
        self.assertEqual(self.client.post('/chat', json={'query': '  '}).status_code, 400)
        self.assertEqual(self.client.post('/chat', json={'query': 'x'*4001}).status_code, 422)
        self.assertEqual(self.client.post('/feedback', json={'message_id': 'missing', 'session_id': 'test', 'rating': 'like'}).status_code, 404)

    def test_cors_and_health(self):
        self.assertEqual(self.client.get('/health').status_code, 200)
        response = self.client.options('/chat', headers={'Origin': 'http://localhost:5500', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:5500')
        response = self.client.options('/chat', headers={'Origin': 'https://unknown.invalid', 'Access-Control-Request-Method': 'POST'})
        self.assertNotIn('access-control-allow-origin', response.headers)


if __name__ == '__main__':
    unittest.main()
