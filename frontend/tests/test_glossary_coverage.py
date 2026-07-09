"""Every lab must define its own basics — nothing assumed.

If a technical term or acronym appears in a lab's step narrative or learning-guide
prose, the same lab must teach it: either a coreTerms entry names it (or a variant
containing it, e.g. "XID 48" covers "XID"), or the term's plain-language expansion
appears somewhere in the lab's own text. Definitions that teach by explicit
contrast count for the paired term (a GPU definition that says "unlike a CPU,
which has a few fast cores..." teaches CPU too — if one side of the highway goes
north, the other goes south).
"""
import json
import re
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LABS_JS = ROOT / 'js' / 'labs.js'
LEARNING_JS = ROOT / 'js' / 'learning.js'
LABS_PARTS = [ROOT / 'js' / f'labs-part-{n}.js' for n in range(1, 6)]
LEARNING_PARTS = [ROOT / 'js' / f'learning-part-{n}.js' for n in range(1, 3)]

# term -> (usage regex, definition-evidence regex). Evidence includes contrast
# phrasings that teach the term from its opposite.
GLOSSARY = {
    'GPU': (r'\bGPU\b', r'graphics processing unit|thousands of (small|simple) cores'),
    'CPU': (r'\bCPU\b', r'central processing unit|few fast(, flexible)? cores'),
    'NVLink': (r'\bNVLink\b', r'GPU-to-GPU|express lane.*GPU'),
    'PCIe': (r'\bPCIe\b', r'PCI Express'),
    'ECC': (r'\bECC\b', r'error.?correct'),
    'SBE': (r'\bSBE\b', r'single.?bit'),
    'DBE': (r'\bDBE\b', r'double.?bit'),
    'XID': (r'\bXID\b', r'error (code|id)'),
    'CRC': (r'\bCRC\b', r'checksum'),
    'CUDA': (r'\bCUDA\b', r'programming platform|lets software run on the GPU'),
    'NCCL': (r'\bNCCL\b', r'collective communication|communications library'),
    'MIG': (r'\bMIG\b', r'multi.?instance'),
    'vGPU': (r'\bvGPU\b', r'virtual GPU'),
    'DPU': (r'\bDPU\b', r'data processing unit'),
    'RDMA': (r'\bRDMA\b', r'remote direct memory access'),
    'HCA': (r'\bHCA\b', r'host channel adapter'),
    'MTU': (r'\bMTU\b', r'(largest|maximum).*(packet|frame|transmission)'),
    'NIC': (r'\bNIC\b', r'network interface'),
    'gradient': (r'\bgradient', r'correction signal|(how much|direction).*(adjust|change)'),
    'batch': (r'\bbatch\b', r'(group|chunk) of samples'),
    'latency': (r'\blatency\b', r'how long one|single (request|item) takes'),
    'throughput': (r'\bthroughput\b', r'(work|total|much).*(finishes |)per second'),
    'bandwidth': (r'\bbandwidth\b', r'data.*(per second|can move)'),
    'training': (r'\btraining\b', r'learning phase|model.*adjust.*weight'),
    'inference': (r'\binference\b', r'(finished|trained) model.*(answer|request|live)|uses the finished model'),
    'DCGM': (r'\bDCGM\b', r'data center GPU manager'),
    'Prometheus': (r'\bPrometheus\b', r'metrics database|time.?series'),
    'Slurm': (r'\bSlurm\b', r'scheduler'),
    'Kubernetes': (r'\bKubernetes\b', r'orchestrat'),
    'container': (r'\bcontainer', r'packag.*(software|dependenc)'),
    'NGC': (r'\bNGC\b', r'NVIDIA GPU Cloud|catalog'),
    'Triton': (r'\bTriton\b', r'inference server'),
    'cuDNN': (r'\bcuDNN\b', r'building blocks|primitives'),
    'DGX': (r'\bDGX\b', r'integrated GPU server'),
    'TCO': (r'\bTCO\b', r'total cost of ownership'),
    'SM': (r'\bSMs?\b', r'streaming multiprocessor'),
    'fabric': (r'\bfabric\b', r'network that connects|switches, cables'),
    'lossless': (r'\blossless\b', r'instead of drop'),
    'oversubscription': (r'oversubscri', r'than physically exists'),
    'PFC': (r'\bPFC\b', r'priority flow control'),
    'ECN': (r'\bECN\b', r'explicit congestion notification'),
    'GDS': (r'\bGDS\b', r'GPUDirect Storage'),
    'SIMT': (r'\bSIMT\b', r'single instruction'),
}


def load_lab_text():
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
        {chr(10).join(f"eval(fs.readFileSync({json.dumps(str(p))}, 'utf8'));" for p in LEARNING_PARTS)}
        eval(fs.readFileSync({json.dumps(str(LEARNING_JS))}, 'utf8'));
        const G = globalThis.AEGIS_LEARNING;
        const out = {{}};
        for (const [id, lab] of Object.entries(globalThis.__LABS__)) {{
          const g = G[id] || {{}};
          const stepText = lab.steps.map(s => [s.label, s.cmd, s.whatsHappening, s.deeperContext, s.meaning,
            s.commonMistake, s.operatorTakeaway, (s.lookFor || []).join(' '), (s.takeAction || []).join(' '),
            (s.avoid || []).join(' ')].filter(Boolean).join(' ')).join(' ');
          const proseText = [g.objectiveText, g.plainPicture, (g.whyOperatorsCare || []).join(' '),
            (g.wholePlatform || []).join(' '), (g.commonMisreads || []).join(' '),
            (g.safeActions || []).join(' ')].filter(Boolean).join(' ');
          out[id] = {{
            terms: (g.coreTerms || []).map(t => t.term),
            prose: stepText + ' ' + proseText,
            defs: (g.coreTerms || []).map(t => t.term + ' ' + t.plain + ' ' + t.why).join(' '),
          }};
        }}
        process.stdout.write(JSON.stringify(out));
        """
    )
    return json.loads(subprocess.check_output(['node', '-e', script], text=True))


class GlossaryCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.labs = load_lab_text()

    def test_every_used_term_is_defined_in_its_lab(self):
        failures = []
        for lab_id, v in self.labs.items():
            names = ' | '.join(v['terms']).lower()
            everything = v['prose'] + ' ' + v['defs']
            for term, (use_re, ev_re) in GLOSSARY.items():
                if not re.search(use_re, v['prose']):
                    continue
                if term.lower() in names:
                    continue
                if re.search(ev_re, everything, re.I):
                    continue
                failures.append(f'{lab_id}: uses "{term}" without defining it')
        self.assertFalse(failures, 'Labs assume undefined basics:\n' + '\n'.join(failures))

    def test_no_duplicate_core_terms(self):
        for lab_id, v in self.labs.items():
            lowered = [t.lower() for t in v['terms']]
            self.assertEqual(len(lowered), len(set(lowered)), f'{lab_id} has duplicate coreTerms')


if __name__ == '__main__':
    unittest.main()
