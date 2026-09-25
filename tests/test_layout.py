"""Catch broken static paths when frontend files move between folders."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LayoutTests(unittest.TestCase):
    def test_widget_import_and_stylesheet_paths(self):
        files = [ROOT/'frontend/chatbot/widget.js', *ROOT.glob('frontend/chatbot/js/**/*.js')]
        for file in files:
            source = file.read_text(encoding='utf-8')
            refs = re.findall(r"(?:from\s+['\"]|new URL\(['\"])(\.{1,2}/[^'\"]+)", source)
            if file.name == 'widget.js' and file.parent.name == 'chatbot':
                refs.append('./js/core/widget.js')
            for ref in refs:
                with self.subTest(file=file, ref=ref):
                    self.assertTrue((file.parent/ref).resolve().is_file())

    def test_dashboard_assets_and_vercel_rewrites(self):
        dashboard = ROOT/'frontend/dashboard'
        html = (dashboard/'dashboard.html').read_text(encoding='utf-8')
        for ref in re.findall(r'(?:src|href)="(\./(?:scripts|styles)/[^"]+)"', html):
            with self.subTest(ref=ref):
                self.assertTrue((dashboard/ref).is_file())
        vercel = json.loads((ROOT/'vercel.json').read_text(encoding='utf-8'))
        rewrites = {rule['source']: rule['destination'] for rule in vercel['rewrites']}
        self.assertEqual(rewrites['/widget.js'], '/chatbot/widget.js')
        self.assertEqual(rewrites['/js/:path*'], '/chatbot/js/:path*')
        self.assertEqual(rewrites['/widget.css'], '/chatbot/ui/widget.css')
        self.assertEqual(rewrites['/dashboard.css'], '/dashboard/styles/dashboard.css')


if __name__ == '__main__':
    unittest.main()
