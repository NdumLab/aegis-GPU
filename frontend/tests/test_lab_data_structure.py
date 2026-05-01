import json
import re
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LABS_JS = ROOT / 'js' / 'labs.js'
LEARNING_JS = ROOT / 'js' / 'learning.js'
LABS_PARTS = [
    ROOT / 'js' / 'labs-part-1.js',
    ROOT / 'js' / 'labs-part-2.js',
    ROOT / 'js' / 'labs-part-3.js',
    ROOT / 'js' / 'labs-part-4.js',
]
LEARNING_PARTS = [
    ROOT / 'js' / 'learning-part-1.js',
    ROOT / 'js' / 'learning-part-2.js',
]


def load_frontend_data():
    labs_source = ''.join(path.read_text(encoding='utf-8') for path in LABS_PARTS)
    learning_source = LEARNING_JS.read_text(encoding='utf-8')
    draw_names = sorted(set(re.findall(r'draw:\s*([A-Za-z_][A-Za-z0-9_]*)', labs_source)))
    draw_stub_block = '\n'.join(f'globalThis.{name} = () => null;' for name in draw_names)
    script = textwrap.dedent(
        f"""
        const fs = require('fs');
        globalThis.window = globalThis;
        {draw_stub_block}
        {chr(10).join(f"eval(fs.readFileSync({json.dumps(str(path))}, 'utf8'));" for path in LABS_PARTS)}
        eval(fs.readFileSync({json.dumps(str(LABS_JS))}, 'utf8') + '\\nglobalThis.__LABS__ = LABS;');
        {chr(10).join(f"eval(fs.readFileSync({json.dumps(str(path))}, 'utf8'));" for path in LEARNING_PARTS)}
        eval(fs.readFileSync({json.dumps(str(LEARNING_JS))}, 'utf8'));
        const labs = globalThis.__LABS__;
        const learning = globalThis.AEGIS_LEARNING;
        const summary = {{
          labKeys: Object.keys(labs),
          learningKeys: Object.keys(learning),
          labs: Object.fromEntries(
            Object.entries(labs).map(([id, lab]) => [id, {{
              steps: lab.steps.length,
              missingScreenshotReference: lab.steps.filter(step => !step.screenshotReference).map(step => step.label),
              missingScreenshots: lab.steps.filter(step => !Array.isArray(step.screenshots) || step.screenshots.length === 0).map(step => step.label),
              missingTerminalMetadata: ['nvlink', 'nccl_fallback', 'k8s', 'slurm', 'monitoring', 'cuda_stack', 'container', 'training', 'allreduce', 'ib_fabric', 'roce'].includes(id)
                ? lab.steps.filter(step => !step.terminal || !Array.isArray(step.terminal.examples) || step.terminal.examples.length === 0).map(step => step.label)
                : [],
            }}])
          ),
          learning: Object.fromEntries(
            Object.entries(learning).map(([id, guide]) => [id, {{
              missingFields: [
                'objectiveText',
                'plainPicture',
                'whyOperatorsCare',
                'wholePlatform',
                'coreTerms',
                'commonMisreads',
                'safeActions',
              ].filter(field => {{
                const value = guide[field];
                return value === undefined || value === null || value.length === 0;
              }})
            }}])
          )
        }};
        process.stdout.write(JSON.stringify(summary));
        """
    )
    output = subprocess.check_output(['node', '-e', script], text=True)
    return json.loads(output)


class FrontendDataStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.summary = load_frontend_data()

    def test_expected_lab_count(self):
        self.assertEqual(len(self.summary['labKeys']), 16)

    def test_learning_and_lab_keys_stay_aligned(self):
        self.assertEqual(sorted(self.summary['labKeys']), sorted(self.summary['learningKeys']))

    def test_every_lab_step_has_screenshot_metadata(self):
        for lab_id, info in self.summary['labs'].items():
            self.assertFalse(info['missingScreenshotReference'], f'{lab_id} missing screenshotReference: {info["missingScreenshotReference"]}')
            self.assertFalse(info['missingScreenshots'], f'{lab_id} missing screenshots: {info["missingScreenshots"]}')
            self.assertFalse(info['missingTerminalMetadata'], f'{lab_id} missing terminal metadata: {info["missingTerminalMetadata"]}')

    def test_learning_guides_have_required_sections(self):
        for guide_id, info in self.summary['learning'].items():
            self.assertFalse(info['missingFields'], f'{guide_id} missing guide fields: {info["missingFields"]}')


if __name__ == '__main__':
    unittest.main()
