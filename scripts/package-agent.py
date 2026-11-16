"""Build or verify a reproducible, credential-free collector download."""
import argparse
import io
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/workdk-agent.zip"


def build_archive():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for source in sorted((ROOT / "agent").iterdir()):
            if (source.name.startswith(".") or not source.is_file()
                    or source.suffix not in {".mjs", ".cmd", ".ps1", ".md", ".json"}
                    or source.name in {"server.mjs", "service.mjs"}
                    or (source.suffix == ".json" and source.name != "mcp.example.json")):
                continue
            data = source.read_bytes()
            # Git and Windows may use different checkout line endings.
            data = data.replace(b"\r\n", b"\n")
            if source.suffix in {".cmd", ".ps1"}:
                data = data.replace(b"\r", b"\n").replace(b"\n", b"\r\n")
            if source.suffix == ".cmd":
                data.decode("ascii")
            entry = zipfile.ZipInfo("workdk-agent/" + source.name, (2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check committed download against source")
    args = parser.parse_args()
    expected = build_archive()
    if args.check:
        # Compare names and uncompressed bytes, independent of zlib versions.
        if not OUTPUT.exists():
            raise SystemExit("Missing download. Run npm run package:agent.")
        with zipfile.ZipFile(io.BytesIO(expected)) as generated, zipfile.ZipFile(OUTPUT) as shipped:
            if (generated.namelist() != shipped.namelist()
                    or any(generated.read(name) != shipped.read(name) for name in generated.namelist())):
                raise SystemExit("Collector download is stale. Run npm run package:agent and commit the ZIP.")
        print("Collector download matches source.")
    else:
        OUTPUT.write_bytes(expected)
        print(f"Packaged {OUTPUT.name}")


if __name__ == "__main__":
    main()
