import json
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLUSTER_SIM_JS = ROOT / 'js' / 'cluster-sim.js'
CLUSTER_TERMINAL_JS = ROOT / 'js' / 'cluster-terminal.js'


def load_cluster_terminal_payload():
    script = textwrap.dedent(
        f"""
        const fs = require('fs');
        globalThis.window = globalThis;
        eval(fs.readFileSync({json.dumps(str(CLUSTER_SIM_JS))}, 'utf8'));
        eval(fs.readFileSync({json.dumps(str(CLUSTER_TERMINAL_JS))}, 'utf8'));
        const store = globalThis.AEGIS_CLUSTER_SIM.createStore();
        const terminal = globalThis.AEGIS_CLUSTER_TERMINAL;
        const pendingJob = store.state.jobs.find((job) => job.state === 'pending') || store.state.jobs[0];
        const squeue = terminal.runCommand(store.state, 'squeue');
        const sinfo = terminal.runCommand(store.state, 'sinfo');
        const topo = terminal.runCommand(store.state, 'nvidia-smi topo -m');
        const ssh = terminal.runCommand(store.state, 'ssh gb200-node-03');
        const hostname = terminal.runCommand(store.state, 'hostname');
        const smi = terminal.runCommand(store.state, 'nvidia-smi -i 0');
        const sacct = terminal.runCommand(store.state, 'sacct');
        const cancel = terminal.runCommand(store.state, `scancel ${{pendingJob.id}}`);
        store.injectFault('xid_79');
        terminal.runCommand(store.state, 'ssh gb200-node-02');
        const faultSmi = terminal.runCommand(store.state, 'nvidia-smi -i 3');
        const faultIb = terminal.runCommand(store.state, 'ibstat');
        process.stdout.write(JSON.stringify({{
          squeueHeader: squeue.lines[0],
          squeueBody: squeue.lines[1] || '',
          sinfoHeader: sinfo.lines[0],
          topoHeader: topo.lines[0],
          sshLine: ssh.lines[0],
          hostnameLine: hostname.lines[0],
          smiHeader: smi.lines[2],
          sacctHeader: sacct.lines[0],
          cancelAction: cancel.action,
          faultSmiTail: faultSmi.lines.slice(-3),
          faultIbTail: faultIb.lines.slice(-1)[0],
        }}));
        """
    )
    output = subprocess.check_output(['node', '-e', script], text=True)
    return json.loads(output)


class ClusterTerminalStateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = load_cluster_terminal_payload()

    def test_scheduler_views_render_from_shared_state(self):
        self.assertIn('JOBID', self.payload['squeueHeader'])
        self.assertTrue(self.payload['squeueBody'])
        self.assertIn('PARTITION', self.payload['sinfoHeader'])
        self.assertIn('JobID', self.payload['sacctHeader'])

    def test_node_local_terminal_context_can_switch_hosts(self):
        self.assertIn('Connected to gb200-node-03', self.payload['sshLine'])
        self.assertEqual(self.payload['hostnameLine'], 'gb200-node-03')

    def test_gpu_commands_have_deterministic_cluster_output(self):
        self.assertIn('GPU0', self.payload['topoHeader'])
        self.assertIn('NVIDIA-SMI 570.86.15', self.payload['smiHeader'])

    def test_scancel_returns_action_payload(self):
        self.assertEqual(self.payload['cancelAction']['type'], 'cancel')
        self.assertIsInstance(self.payload['cancelAction']['jobId'], int)

    def test_fault_injection_changes_terminal_evidence(self):
        self.assertTrue(any('XID 79' in line for line in self.payload['faultSmiTail']))
        self.assertIn('degraded', self.payload['faultIbTail'])


if __name__ == '__main__':
    unittest.main()
