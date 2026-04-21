import json
import os
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List

import paramiko


LOCAL_HOSTS = {
    '127.0.0.1',
    'localhost',
    socket.gethostname(),
    socket.getfqdn(),
}

RUNBOOKS: Dict[str, Dict] = {
    '48': {
        'summary': 'Collect ECC state and retired pages, then drain the node for manual maintenance.',
        'steps': [
            '1. Confirm the DBE in ECC telemetry and stop scheduling new work onto the node.',
            '2. Drain the node from Slurm or Kubernetes before any further GPU access.',
            '3. Review retired pages and ECC health to determine whether the GPU must be replaced.',
            '4. Open a vendor ticket or RMA if DBEs persist or page retirement thresholds are exceeded.',
        ],
        'commands': [
            {'cmd': 'nvidia-smi -q -d ECC 2>/dev/null | head -n 120', 'destructive': False},
            {'cmd': 'nvidia-smi --query-retired-pages=address,ca --format=csv 2>/dev/null', 'destructive': False},
        ],
    },
    '74': {
        'summary': 'Inspect NVLink counters and link state before scheduling physical inspection.',
        'steps': [
            '1. Inspect NVLink counters and identify the failing link or switch port.',
            '2. Drain jobs that rely on NVLink bandwidth before the fabric degrades further.',
            '3. Schedule physical inspection of the bridge, cable, OSFP, or switch port.',
            '4. Re-test topology and counters after reseat or replacement.',
        ],
        'commands': [
            {'cmd': 'nvidia-smi nvlink -s 2>/dev/null | head -n 120', 'destructive': False},
            {'cmd': 'nvidia-smi nvlink -e 2>/dev/null | head -n 120', 'destructive': False},
        ],
    },
    '79': {
        'summary': 'Attempt a controlled GPU reset only when destructive remediation is explicitly enabled.',
        'steps': [
            '1. Quiesce workloads using the affected GPU and capture recent kernel logs.',
            '2. Attempt a controlled GPU reset only under an approved maintenance window.',
            '3. If reset fails or the GPU remains missing, reboot the node and escalate as hardware instability.',
            '4. Check PCIe power, seating, and repeated XID history before returning the node to service.',
        ],
        'commands': [
            {'cmd': 'nvidia-smi --gpu-reset -i {node_id} 2>/dev/null', 'destructive': True},
        ],
    },
}

_DEFAULT_RUNBOOK = {
    'summary': 'No automated runbook exists for this fault code. Escalate to manual triage.',
    'steps': [
        '1. Capture the current hardware state and isolate the affected node.',
        '2. Drain or cordon the node before any disruptive action.',
        '3. Escalate to vendor-guided remediation because no safe automated runbook exists for this fault code.',
    ],
    'commands': [],
}


class OSIntrospectionEngine:
    def __init__(self, hostname: str, username: str, key_filename: str = None, timeout: int = 10):
        self.hostname = hostname
        self.username = username
        self.key_filename = key_filename
        self.timeout = timeout
        self.local_mode = hostname in LOCAL_HOSTS
        self.client = None
        if not self.local_mode:
            self.client = paramiko.SSHClient()
            self.client.load_system_host_keys()
            self.client.set_missing_host_key_policy(paramiko.RejectPolicy())

    def connect(self) -> bool:
        if self.local_mode:
            return True
        try:
            self.client.connect(
                hostname=self.hostname,
                username=self.username,
                key_filename=self.key_filename,
                timeout=self.timeout,
            )
            return True
        except Exception:
            return False

    def close(self) -> None:
        if self.client:
            self.client.close()

    def _execute(self, command: str, timeout: int = None) -> str:
        timeout = timeout or self.timeout
        if self.local_mode:
            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    executable='/bin/bash',
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                output = result.stdout.strip()
                error = result.stderr.strip()
                if output:
                    return output
                if error:
                    return f'ERROR: {error}'
                return ''
            except Exception as exc:
                return f'ERROR: {exc}'

        stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
        output = stdout.read().decode('utf-8').strip()
        error = stderr.read().decode('utf-8').strip()
        return output if output else (f'ERROR: {error}' if error else '')

    def get_share_doc(self, package_name: str) -> str:
        cmd = (
            f'for d in /usr/share/doc/*{package_name}*; do '
            f'if [ -d "$d" ]; then head -n 50 "$d"/*README* "$d"/*changelog* "$d"/*Release* 2>/dev/null; fi; '
            f'done'
        )
        return self._execute(cmd)

    def get_binary_docs(self, binary_name: str) -> Dict[str, str]:
        return {
            'help_flag': self._execute(f'{binary_name} --help 2>/dev/null | head -n 50'),
            'info_page': self._execute(f'info --subnodes -o - {binary_name} 2>/dev/null | head -n 100'),
            'man_page': self._execute(f'man -P cat {binary_name} 2>/dev/null | head -n 100'),
        }

    def get_package_metadata(self, package_name: str) -> str:
        return self._execute(f'rpm -qi {package_name} 2>/dev/null')

    def get_config_state(self, file_path: str) -> str:
        return self._execute(f"cat {file_path} 2>/dev/null | grep -v '^$' | head -n 80")

    def _read_thermal_zone(self) -> int:
        if not os.path.isdir('/sys/class/thermal'):
            return 0
        for zone in sorted(os.listdir('/sys/class/thermal')):
            temp_path = os.path.join('/sys/class/thermal', zone, 'temp')
            try:
                raw = Path(temp_path).read_text(encoding='utf-8').strip()
                value = int(raw)
                if value > 1000:
                    value //= 1000
                if value > 0:
                    return value
            except Exception:
                continue
        return 0

    def _read_meminfo(self) -> Dict[str, int]:
        totals = {'MemTotal': 0, 'MemAvailable': 0}
        try:
            with open('/proc/meminfo', 'r', encoding='utf-8') as handle:
                for line in handle:
                    key, _, value = line.partition(':')
                    if key in totals:
                        totals[key] = int(value.strip().split()[0])
        except Exception:
            pass
        return totals

    @staticmethod
    def _classify_output(output: str) -> str:
        text = (output or '').strip()
        if not text:
            return 'empty'
        lowered = text.lower()
        error_markers = (
            'error:',
            'command not found',
            'nvidia-smi has failed',
            "couldn't communicate with the nvidia driver",
            'failed to initialize nvml',
            'no devices were found',
            'unknown entity',
        )
        if any(marker in lowered for marker in error_markers):
            return 'error'
        return 'ok'

    @staticmethod
    def _parse_number(value: str):
        text = (value or '').strip()
        if not text or text.upper() == 'N/A':
            return None
        try:
            return float(text)
        except ValueError:
            return None

    def _parse_gpu_snapshot(self, output: str) -> List[Dict[str, Any]]:
        per_gpu: List[Dict[str, Any]] = []
        for line in output.splitlines():
            parts = [part.strip() for part in line.split(',')]
            if len(parts) < 11:
                continue

            index_value = self._parse_number(parts[0])
            util_value = self._parse_number(parts[4])
            used_value = self._parse_number(parts[5])
            total_value = self._parse_number(parts[6])
            temp_value = self._parse_number(parts[7])
            power_value = self._parse_number(parts[8])
            pcie_gen_value = self._parse_number(parts[10])

            row: Dict[str, Any] = {
                'index': int(index_value) if index_value is not None else parts[0],
                'uuid': parts[1],
                'name': parts[2],
                'pci_bus_id': parts[3],
                'pstate': parts[9],
                'pcie_link_gen_current': int(pcie_gen_value) if pcie_gen_value is not None else None,
            }
            if util_value is not None:
                row['util'] = int(round(util_value))
            if used_value is not None:
                row['vram_used'] = int(round(used_value))
            if total_value is not None:
                row['vram_total'] = int(round(total_value))
            if temp_value is not None:
                row['temp'] = int(round(temp_value))
            if power_value is not None:
                row['power'] = int(round(power_value))
            per_gpu.append(row)
        return per_gpu

    def _probe_status(self, output: str) -> str:
        status = self._classify_output(output)
        if status == 'ok':
            return 'available'
        if status == 'empty':
            return 'no-data'
        return 'unavailable'

    def collect_live_metrics(self) -> Dict[str, Any]:
        if not self.connect():
            return {
                'util': 0,
                'vram_used': 0,
                'vram_total': 0,
                'temp': 0,
                'power': 0,
                'active_faults': [],
                'source': 'unreachable',
                'degraded': True,
                'gpu_count': 0,
                'telemetry_scope': 'none',
                'degraded_reason': 'Target node unreachable; no live telemetry collected.',
                'collection_errors': ['node_unreachable'],
                'telemetry_sources': [],
                'per_gpu': [],
                'fabric_summary': {'nvlink': 'unavailable', 'dcgm': 'unavailable'},
            }

        collection_errors: List[str] = []
        telemetry_sources: List[str] = []
        smi = self._execute(
            'nvidia-smi --query-gpu=index,uuid,name,pci.bus_id,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,pstate,pcie.link.gen.current --format=csv,noheader,nounits 2>/dev/null'
        )
        xids = self._execute("dmesg | grep -i 'xid' | tail -n 5")
        dcgm_discovery = self._execute('dcgmi discovery -l 2>/dev/null | head -n 80')
        dcgm_health = self._execute('dcgmi health -g 0 --check 2>/dev/null | head -n 120')
        nvlink_status = self._execute('nvidia-smi nvlink -s 2>/dev/null | head -n 120')

        if self._classify_output(xids) == 'error':
            collection_errors.append('kernel_log_unavailable')
            active_faults: List[str] = []
        else:
            active_faults = [line.strip() for line in xids.splitlines() if line.strip()]

        if self._classify_output(dcgm_discovery) == 'ok' or self._classify_output(dcgm_health) == 'ok':
            telemetry_sources.append('dcgm')
        else:
            collection_errors.append('dcgm_unavailable')

        fabric_summary = {
            'nvlink': self._probe_status(nvlink_status),
            'dcgm': self._probe_status(dcgm_health if self._classify_output(dcgm_health) == 'ok' else dcgm_discovery),
        }
        if fabric_summary['nvlink'] != 'available':
            collection_errors.append('nvlink_status_unavailable')

        if self._classify_output(smi) == 'ok':
            per_gpu = self._parse_gpu_snapshot(smi)
            if per_gpu:
                telemetry_sources.insert(0, 'nvidia-smi')
                gpu_count = len(per_gpu)
                util = round(sum(row.get('util', 0) for row in per_gpu) / gpu_count)
                vram_used = round(sum(row.get('vram_used', 0) for row in per_gpu))
                vram_total = round(sum(row.get('vram_total', 0) for row in per_gpu))
                temp = round(sum(row.get('temp', 0) for row in per_gpu) / gpu_count)
                power = round(sum(row.get('power', 0) for row in per_gpu) / gpu_count)
                self.close()
                return {
                    'util': int(util),
                    'vram_used': int(vram_used),
                    'vram_total': int(vram_total),
                    'temp': int(temp),
                    'power': int(power),
                    'active_faults': active_faults,
                    'source': 'nvidia-smi',
                    'degraded': False,
                    'gpu_count': gpu_count,
                    'telemetry_scope': 'gpu',
                    'degraded_reason': '',
                    'collection_errors': collection_errors,
                    'telemetry_sources': telemetry_sources,
                    'per_gpu': per_gpu,
                    'fabric_summary': fabric_summary,
                }

        collection_errors.append('nvidia_smi_unavailable')
        meminfo = self._read_meminfo()
        cpu_count = os.cpu_count() or 1
        load1 = os.getloadavg()[0] if hasattr(os, 'getloadavg') else 0.0
        util = round(min(100, (load1 / cpu_count) * 100))
        temp = self._read_thermal_zone()
        self.close()
        reason = 'nvidia-smi unavailable or returned no parseable GPU telemetry; falling back to best-effort host metrics.'
        if 'kernel_log_unavailable' in collection_errors:
            reason += ' Kernel XID inspection was also unavailable.'
        return {
            'util': int(util),
            'vram_used': 0,
            'vram_total': 0,
            'temp': int(temp),
            'power': 0,
            'active_faults': active_faults,
            'source': 'host-fallback',
            'degraded': True,
            'gpu_count': 0,
            'telemetry_scope': 'host',
            'degraded_reason': reason,
            'collection_errors': collection_errors,
            'telemetry_sources': telemetry_sources or ['host'],
            'per_gpu': [],
            'fabric_summary': fabric_summary,
            'host_mem_total_kib': meminfo.get('MemTotal', 0),
            'host_mem_available_kib': meminfo.get('MemAvailable', 0),
        }

    def collect_fault_context(self, fault_code: str) -> Dict[str, Any]:
        if not self.connect():
            return {'error': 'Target node unreachable', 'commands': {}, 'command_status': {}}

        commands = {
            'gpu_inventory': 'nvidia-smi -L 2>/dev/null',
            'gpu_health': 'nvidia-smi -q -d ECC,TEMPERATURE,POWER,PERFORMANCE 2>/dev/null | head -n 240',
            'topology': 'nvidia-smi topo -m 2>/dev/null | head -n 80',
            'nvlink': 'nvidia-smi nvlink -s 2>/dev/null | head -n 120',
            'dcgm_discovery': 'dcgmi discovery -l 2>/dev/null | head -n 80',
            'dcgm_health': 'dcgmi health -g 0 --check 2>/dev/null | head -n 120',
            'recent_xids': "dmesg | grep -i 'xid' | tail -n 20",
            'fabric': '(ibstat || ibstatus || true) 2>/dev/null | head -n 120',
            'fabric_manager': 'systemctl status --no-pager nvidia-fabricmanager 2>/dev/null | head -n 80',
            'nccl_env': "env | grep -E '^(NCCL|CUDA|UCX)_' | sort",
            'storage': '(iostat -x 1 2 | tail -n 40) 2>/dev/null',
        }

        context = {
            'fault_code': fault_code,
            'node': self.hostname,
            'collected_at': int(time.time()),
            'commands': {},
            'command_status': {},
        }
        for label, command in commands.items():
            output = self._execute(command, timeout=15)[:4000]
            context['commands'][label] = output
            context['command_status'][label] = self._classify_output(output)

        self.close()
        return context


    def scrape_fault_context(self, primary_binary=None, package_name=None, related_configs=None, fault_code=None):
        if fault_code or primary_binary is None:
            return self.collect_fault_context(fault_code or 'unknown')

        if not self.connect():
            return {'error': 'Target node unreachable'}

        context = {
            'node': self.hostname,
            'binary_docs': self.get_binary_docs(primary_binary),
            'rpm_metadata': self.get_package_metadata(package_name),
            'vendor_docs': self.get_share_doc(package_name),
            'configs': {},
        }

        for conf in related_configs or []:
            context['configs'][conf] = self.get_config_state(conf)

        self.close()
        return context

    def execute_runbook(self, fault_code: str, node_id: int = 0, allow_destructive: bool = False) -> Dict[str, Any]:
        _entry = RUNBOOKS.get(str(fault_code), _DEFAULT_RUNBOOK)
        runbook = {
            'summary': _entry['summary'],
            'commands': [
                {**c, 'cmd': c['cmd'].format(node_id=node_id)} for c in _entry['commands']
            ],
        }
        commands = runbook['commands']

        if any(item['destructive'] for item in commands) and not allow_destructive:
            return {
                'status': 'manual_required',
                'message': runbook['summary'],
                'log': 'Destructive remediation is disabled. Review the runbook and execute manually after change approval.',
                'executed': False,
                'commands': [item['cmd'] for item in commands],
            }

        if not commands:
            return {
                'status': 'manual_required',
                'message': runbook['summary'],
                'log': 'No safe automated command is available for this fault code.',
                'executed': False,
                'commands': [],
            }

        if not self.connect():
            return {
                'status': 'error',
                'message': 'Node connection failed.',
                'log': 'Unable to reach the target node for remediation.',
                'executed': False,
                'commands': [item['cmd'] for item in commands],
            }

        outputs = []
        for item in commands:
            outputs.append(f"$ {item['cmd']}\n{self._execute(item['cmd'], timeout=20) or '[no output]'}")

        self.close()
        return {
            'status': 'success',
            'message': runbook['summary'],
            'log': '\n\n'.join(outputs),
            'executed': True,
            'commands': [item['cmd'] for item in commands],
        }


if __name__ == '__main__':
    import getpass

    current_user = getpass.getuser()
    scraper = OSIntrospectionEngine(hostname='127.0.0.1', username=current_user)
    print(json.dumps(scraper.collect_fault_context('48'), indent=2))
