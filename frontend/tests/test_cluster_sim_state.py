import json
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLUSTER_SIM_JS = ROOT / 'js' / 'cluster-sim.js'


def load_cluster_sim_summary():
    script = textwrap.dedent(
        f"""
        const fs = require('fs');
        globalThis.window = globalThis;
        eval(fs.readFileSync({json.dumps(str(CLUSTER_SIM_JS))}, 'utf8'));
        const api = globalThis.AEGIS_CLUSTER_SIM;
        const store = api.createStore();
        const before = store.getSummary();
        store.tick(3);
        const after = store.getSummary();
        process.stdout.write(JSON.stringify({{
          before,
          after,
          nodeCount: store.state.nodes.length,
          gpuCount: store.state.nodes.reduce((sum, node) => sum + node.gpus.length, 0),
          jobStates: store.state.jobs.map((job) => job.state),
          hasAlerts: store.state.alerts.length > 0,
        }}));
        """
    )
    output = subprocess.check_output(['node', '-e', script], text=True)
    return json.loads(output)


class ClusterSimStateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.summary = load_cluster_sim_summary()

    def test_default_cluster_shape_matches_loop_one_foundation(self):
        self.assertEqual(self.summary['nodeCount'], 8)
        self.assertEqual(self.summary['gpuCount'], 576)
        self.assertTrue(self.summary['hasAlerts'])

    def test_summary_reports_cluster_level_metrics(self):
        before = self.summary['before']
        self.assertEqual(before['totalNodes'], 8)
        self.assertEqual(before['totalGpus'], 576)
        self.assertGreaterEqual(before['runningJobs'], 1)
        self.assertGreaterEqual(before['pendingJobs'], 1)
        self.assertGreater(before['avgUtilPct'], 0)
        self.assertGreater(before['totalPowerKw'], 0)

    def test_tick_keeps_state_alive(self):
        after = self.summary['after']
        self.assertEqual(after['totalNodes'], 8)
        self.assertEqual(after['totalGpus'], 576)
        self.assertGreater(after['avgUtilPct'], 0)
        self.assertIn('running', self.summary['jobStates'])

    def test_store_can_submit_and_cancel_workloads(self):
        script = textwrap.dedent(
            f"""
            const fs = require('fs');
            globalThis.window = globalThis;
            eval(fs.readFileSync({json.dumps(str(CLUSTER_SIM_JS))}, 'utf8'));
            const store = globalThis.AEGIS_CLUSTER_SIM.createStore();
            const submitted = store.submitPreset('llm_train');
            const submittedState = submitted.state;
            const postSubmit = store.getSummary();
            const cancelled = store.cancelJob(submitted.id);
            const postCancel = store.getSummary();
            process.stdout.write(JSON.stringify({{
              submittedState,
              cancelState: cancelled.state,
              postSubmitRunning: postSubmit.runningJobs,
              postCancelPending: postCancel.pendingJobs,
              totalJobs: store.state.jobs.length,
            }}));
            """
        )
        output = subprocess.check_output(['node', '-e', script], text=True)
        payload = json.loads(output)
        self.assertIn(payload['submittedState'], ('running', 'pending'))
        self.assertEqual(payload['cancelState'], 'cancelled')
        self.assertGreaterEqual(payload['postSubmitRunning'], 1)
        self.assertGreaterEqual(payload['totalJobs'], 5)

    def test_store_can_inject_and_clear_faults(self):
        script = textwrap.dedent(
            f"""
            const fs = require('fs');
            globalThis.window = globalThis;
            eval(fs.readFileSync({json.dumps(str(CLUSTER_SIM_JS))}, 'utf8'));
            const store = globalThis.AEGIS_CLUSTER_SIM.createStore();
            const fault = store.injectFault('xid_79');
            const node = store.getNode(fault.nodeId);
            const afterInject = {{
              health: node.healthState,
              xid: node.gpus[fault.gpuId].xid,
              activeFaults: store.state.activeFaults.length,
            }};
            store.clearFault('xid_79');
            const afterClear = {{
              activeFaults: store.state.activeFaults.length,
              health: store.getNode(fault.nodeId).healthState,
            }};
            process.stdout.write(JSON.stringify({{ afterInject, afterClear }}));
            """
        )
        output = subprocess.check_output(['node', '-e', script], text=True)
        payload = json.loads(output)
        self.assertEqual(payload['afterInject']['health'], 'critical')
        self.assertEqual(payload['afterInject']['xid'], 79)
        self.assertEqual(payload['afterInject']['activeFaults'], 1)
        self.assertEqual(payload['afterClear']['activeFaults'], 0)


if __name__ == '__main__':
    unittest.main()
