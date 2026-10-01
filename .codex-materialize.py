import hashlib
import json
import subprocess
from pathlib import Path

BASE = 'c2cf771ded4ba6258a7bb6f9a22b931368569f64'
HELPERS = ['.github/workflows/codex-materialize.yml', '.codex-materialize.py', '.codex-deltas.json']
deltas = json.loads(Path('.codex-deltas.json').read_text())

def git(*args):
    return subprocess.check_output(['git', *args])

def blob_sha(content):
    return hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()

allowed = {'CLAUDE.md', 'README.md', 'docs/fast-tutoring.md', 'docs/gamification.md', 'functions/fast-tutor-core.js', 'functions/fast-tutor-provider.js', 'functions/gamification-provider.js', 'functions/index.js', 'functions/test/fast-tutor-provider.test.js', 'index.html', 'tools/tutor-tests.mjs', 'functions/ai-router.js', 'functions/test/ai-router.test.js', 'tools/ai-defaults-tests.mjs'}
assert {entry['path'] for entry in deltas} == allowed
assert git('rev-parse', 'origin/main').decode().strip() == BASE, 'main moved; stop rather than overwrite changes'
for entry in deltas:
    path = entry['path']
    if 'content' in entry:
        content = entry['content']
    else:
        baseline = git('show', BASE + ':' + path)
        assert blob_sha(baseline) == entry['baseSha'], 'baseline mismatch: ' + path
        lines = baseline.decode('utf-8').splitlines(keepends=True)
        for op in reversed(entry['ops']):
            lines[op['start']:op['start'] + op['delete']] = [op['insert']]
        content = ''.join(lines)
    encoded = content.encode('utf-8')
    assert blob_sha(encoded) == entry['expectedSha'], 'output mismatch: ' + path
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encoded)
for helper in HELPERS:
    Path(helper).unlink()
changed = set(git('diff', '--name-only', BASE).decode().splitlines())
changed |= set(git('ls-files', '--others', '--exclude-standard').decode().splitlines())
assert changed == allowed, 'unexpected changed paths: ' + repr(changed ^ allowed)
subprocess.check_call(['git', 'diff', '--check'])
print('Verified all 14 final file hashes; temporary helpers removed.')
