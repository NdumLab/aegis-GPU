import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')


class FrontendSmokeTest(unittest.TestCase):
    def test_expected_assets_are_referenced(self):
        self.assertIn('css/styles.css', INDEX)
        self.assertIn('js/labs-part-1.js', INDEX)
        self.assertIn('js/labs-part-4.js', INDEX)
        self.assertIn('js/app.js', INDEX)
        self.assertIn('js/learning-part-1.js', INDEX)
        self.assertIn('js/render.js', INDEX)

    def test_frontend_uses_same_origin_api_prefix(self):
        self.assertIn('/api/v1', APP_JS)
        self.assertRegex(APP_JS, r'API_BASE\s*=')

    def test_no_hardcoded_bearer_token_exists(self):
        self.assertNotIn('Bearer ey', APP_JS)
        self.assertNotRegex(APP_JS, re.compile(r'sk-[A-Za-z0-9_-]{20,}'))


if __name__ == '__main__':
    unittest.main()
