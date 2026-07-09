import json
import re
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
COVERAGE_JSON = REPO / 'docs' / 'nvidia-exam-coverage.json'
LABS_JS = ROOT / 'js' / 'labs.js'
LABS_PARTS = [ROOT / 'js' / f'labs-part-{n}.js' for n in range(1, 6)]

# Ratings that assert an execute step must exist for the mapped labs.
EXECUTE_RATINGS = {'Full', 'Partial'}
# Ratings that assert at least one mapped lab has a fault (troubleshoot) step.
TROUBLESHOOT_RATINGS = {'Full'}


def load_labs():
    labs_source = ''.join(p.read_text(encoding='utf-8') for p in LABS_PARTS)
    draw_names = sorted(set(re.findall(r'draw:\s*([A-Za-z_][A-Za-z0-9_]*)', labs_source)))
    draw_stub = '\n'.join(f'globalThis.{n} = () => null;' for n in draw_names)
    script = textwrap.dedent(
        f"""
        const fs = require('fs');
        globalThis.window = globalThis;
        {draw_stub}
        {chr(10).join(f"eval(fs.readFileSync({json.dumps(str(p))}, 'utf8'));" for p in LABS_PARTS)}
        eval(fs.readFileSync({json.dumps(str(LABS_JS))}, 'utf8') + '\\nglobalThis.__LABS__ = LABS;');
        const labs = globalThis.__LABS__;
        const out = {{}};
        for (const [id, lab] of Object.entries(labs)) {{
          out[id] = {{
            hasExecute: lab.steps.some(s => s.terminal && Array.isArray(s.terminal.accepted) && s.terminal.accepted.length > 0),
            hasFault: lab.steps.some(s => s.fault === true),
            stepTypes: lab.steps.map(s => s.type),
          }};
        }}
        process.stdout.write(JSON.stringify(out));
        """
    )
    return json.loads(subprocess.check_output(['node', '-e', script], text=True))


class ExamCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.coverage = json.loads(COVERAGE_JSON.read_text(encoding='utf-8'))
        cls.labs = load_labs()

    def _objectives(self):
        for cert in self.coverage['certifications']:
            for domain in cert['domains']:
                for obj in domain['objectives']:
                    yield cert['exam_code'], domain, obj

    def test_every_mapped_lab_exists(self):
        for exam, _domain, obj in self._objectives():
            for lab_id in obj['labs']:
                self.assertIn(lab_id, self.labs, f'{exam} {obj["id"]} maps to unknown lab {lab_id}')

    def test_mapped_step_types_exist_in_their_labs(self):
        for exam, _domain, obj in self._objectives():
            available = set()
            for lab_id in obj['labs']:
                available.update(self.labs.get(lab_id, {}).get('stepTypes', []))
            for st in obj['step_types']:
                self.assertIn(st, available, f'{exam} {obj["id"]} references step type {st} absent from its labs')

    def test_executable_objectives_have_execute_step(self):
        for exam, _domain, obj in self._objectives():
            if obj['rating_after'] in EXECUTE_RATINGS:
                self.assertTrue(
                    any(self.labs[l]['hasExecute'] for l in obj['labs']),
                    f'{exam} {obj["id"]} rated {obj["rating_after"]} but no mapped lab has an accepted-command (execute) step',
                )

    def test_full_objectives_have_troubleshoot_step(self):
        for exam, _domain, obj in self._objectives():
            if obj['rating_after'] in TROUBLESHOOT_RATINGS:
                self.assertTrue(
                    any(self.labs[l]['hasFault'] for l in obj['labs']),
                    f'{exam} {obj["id"]} rated Full but no mapped lab has a fault (troubleshoot) step',
                )

    def test_ratings_use_defined_scale(self):
        scale = set(self.coverage['rating_scale'].keys())
        for exam, _domain, obj in self._objectives():
            self.assertIn(obj['rating_before'], scale, f'{exam} {obj["id"]} bad rating_before')
            self.assertIn(obj['rating_after'], scale, f'{exam} {obj["id"]} bad rating_after')

    def test_weighted_scores_match_ratings(self):
        scale = self.coverage['rating_scale']
        for cert in self.coverage['certifications']:
            total_before = 0.0
            total_after = 0.0
            for domain in cert['domains']:
                objs = domain['objectives']
                w = domain['weight_pct']
                before = w * sum(scale[o['rating_before']] for o in objs) / len(objs)
                after = w * sum(scale[o['rating_after']] for o in objs) / len(objs)
                recorded = self.coverage['weighted_scores']['domains'][domain['id']]
                self.assertAlmostEqual(before, recorded['score_before'], places=2,
                                       msg=f'{domain["id"]} before score mismatch')
                self.assertAlmostEqual(after, recorded['score_after'], places=2,
                                       msg=f'{domain["id"]} after score mismatch')
                total_before += before
                total_after += after
            self.assertAlmostEqual(total_before, self.coverage['weighted_scores']['total_before_pct'], places=2)
            self.assertAlmostEqual(total_after, self.coverage['weighted_scores']['total_after_pct'], places=2)

    def test_domain_weights_sum_to_100(self):
        for cert in self.coverage['certifications']:
            self.assertEqual(sum(d['weight_pct'] for d in cert['domains']), 100)


if __name__ == '__main__':
    unittest.main()
