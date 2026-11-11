"""Build the credential-free download; enforce Windows launcher bytes in every archive."""
from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
output = root / 'public/workdk-agent.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source in sorted((root / 'agent').iterdir()):
        if source.name.startswith('.') or not source.is_file() or source.suffix not in {'.mjs', '.cmd', '.ps1', '.md', '.json'} or source.name in {'server.mjs', 'service.mjs'}:
            continue
        data = source.read_bytes()
        if source.suffix in {'.cmd', '.ps1'}:
            data = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n').replace(b'\n', b'\r\n')
        if source.suffix == '.cmd':
            data.decode('ascii')
        archive.writestr('workdk-agent/' + source.name, data)
print(f'Packaged {output.name}')
