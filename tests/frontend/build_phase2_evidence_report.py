import argparse
import json
from pathlib import Path


SCENARIO_GROUPS = {
    'study_progress_empty': 'adaptive guidance',
    'ask_aegis_main': 'state-aware Ask Aegis',
    'ask_aegis_detached': 'detached coach behavior',
    'ecc_bad': 'branch consequence flow',
    'nvlink_bad': 'branch consequence flow',
    'storage_warn': 'branch consequence flow',
}


def build_summary(payload, label, commit):
    scenarios = payload.get('scenarios', [])
    pass_count = sum(1 for item in scenarios if item.get('status') == 'pass')
    fail_count = sum(1 for item in scenarios if item.get('status') != 'pass')
    grouped = {}
    for item in scenarios:
        name = item.get('scenario', '')
        group = SCENARIO_GROUPS.get(name, 'other')
        grouped.setdefault(group, []).append({
            'scenario': name,
            'status': item.get('status', ''),
            'summary': item.get('summary', ''),
        })
    return {
        'report_label': label,
        'commit': commit,
        'suite': payload.get('suite', ''),
        'scenario_count': len(scenarios),
        'pass_count': pass_count,
        'fail_count': fail_count,
        'all_passed': fail_count == 0 and bool(scenarios),
        'result_port': payload.get('result_port'),
        'app_port': payload.get('app_port'),
        'groups': grouped,
    }


def build_text(summary):
    lines = [
        'Aegis V3 Phase 2 Evidence Summary',
        '',
        f"Label: {summary['report_label']}",
        f"Commit: {summary['commit']}",
        f"Suite: {summary['suite']}",
        f"Scenarios: {summary['scenario_count']}",
        f"Passed: {summary['pass_count']}",
        f"Failed: {summary['fail_count']}",
        f"All passed: {'yes' if summary['all_passed'] else 'no'}",
        '',
        'Coverage groups:',
    ]
    for group, rows in summary['groups'].items():
        lines.append(f'- {group}:')
        for row in rows:
            lines.append(f"  - {row['scenario']}: {row['status']} ({row['summary']})")
    lines.extend([
        '',
        'Interpretation:',
        '- The proof set demonstrates state-aware study guidance, in-page Ask Aegis, detached coach behavior, and cross-family degraded branch flows.',
        '- This is evidence for pilot and grant packaging, not a market-ranking claim.',
    ])
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description='Build a phase-2 evidence summary from browser proof JSON.')
    parser.add_argument('--input', required=True, help='Path to browser proof JSON')
    parser.add_argument('--output-json', required=True, help='Path to write summary JSON')
    parser.add_argument('--output-text', required=True, help='Path to write readable summary text')
    parser.add_argument('--label', default='workspace', help='Short label for the report')
    parser.add_argument('--commit', default='unknown', help='Commit identifier for the report')
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
    summary = build_summary(payload, args.label, args.commit)
    output_json = Path(args.output_json)
    output_text = Path(args.output_text)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_text.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    output_text.write_text(build_text(summary), encoding='utf-8')


if __name__ == '__main__':
    main()
