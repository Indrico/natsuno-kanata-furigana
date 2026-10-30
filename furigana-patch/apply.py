#!/usr/bin/env python3
"""Apply the local furigana payload to this game's ASAR; retain an exact backup."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct


ORIGINAL_SHA256 = "2d5b5b289c6eb177f0c7ca68a4c778e4fe68c90a654b6f182042f3388325549d"
PATCH_DIR = Path(__file__).resolve().parent
ARCHIVE = PATCH_DIR.parent / "resources" / "app.asar"
BACKUP = ARCHIVE.with_name("app.asar.original")


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def entries(tree, prefix=""):
    for name, entry in tree["files"].items():
        path = prefix + name
        if "files" in entry:
            yield from entries(entry, path + "/")
        else:
            yield path, entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restore", action="store_true", help="restore the original archive")
    args = parser.parse_args()
    if args.restore:
        if not BACKUP.exists() or digest(BACKUP) != ORIGINAL_SHA256:
            raise SystemExit("A verified original backup is required to restore.")
        temporary = ARCHIVE.with_name("app.asar.restoring")
        shutil.copy2(BACKUP, temporary)
        temporary.replace(ARCHIVE)
        print("Original game restored. Backup retained:", BACKUP)
        return

    if not BACKUP.exists():
        if digest(ARCHIVE) != ORIGINAL_SHA256:
            raise SystemExit("This patch expects the original natsuno-kanata 1.0.0 archive.")
        shutil.copy2(ARCHIVE, BACKUP)
    if digest(BACKUP) != ORIGINAL_SHA256:
        raise SystemExit("Backup does not match the expected original archive.")

    payload = {path.relative_to(PATCH_DIR / "payload").as_posix(): path
               for path in sorted((PATCH_DIR / "payload").rglob("*")) if path.is_file()}
    temporary = ARCHIVE.with_name("app.asar.patching")
    try:
        with BACKUP.open("rb") as source:
            size, header_size, _, json_size = struct.unpack("<4I", source.read(16))
            if size != 4:
                raise SystemExit("Unexpected ASAR header.")
            tree = json.loads(source.read(json_size))
            data_start = 8 + header_size
            originals = {path: dict(entry) for path, entry in entries(tree)}
            if any("link" in e or e.get("unpacked") for e in originals.values()):
                raise SystemExit("This patch only supports this game's embedded archive files.")
            for path in payload:
                node = tree
                components = path.split("/")
                for folder in components[:-1]:
                    node = node["files"].setdefault(folder, {"files": {}})
                node["files"][components[-1]] = {"size": payload[path].stat().st_size}

            offset = 0
            for path, entry in entries(tree):
                entry["offset"] = str(offset)
                offset += entry["size"]
            header_json = json.dumps(tree, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            padding = (-len(header_json)) % 4
            header = struct.pack("<II", 4 + len(header_json) + padding, len(header_json))
            header += header_json + b"\0" * padding
            with temporary.open("wb") as output:
                output.write(struct.pack("<II", 4, len(header)))
                output.write(header)
                for path, entry in entries(tree):
                    if path in payload:
                        with payload[path].open("rb") as replacement:
                            shutil.copyfileobj(replacement, output)
                    else:
                        source.seek(data_start + int(originals[path]["offset"]))
                        remaining = entry["size"]
                        while remaining:
                            chunk = source.read(min(remaining, 1024 * 1024))
                            if not chunk:
                                raise SystemExit("Unexpected end of original archive.")
                            output.write(chunk)
                            remaining -= len(chunk)
        temporary.replace(ARCHIVE)
    finally:
        temporary.unlink(missing_ok=True)
    print("Furigana patch applied:", ARCHIVE)
    print("Original backup:", BACKUP)
    print("Patched SHA-256:", digest(ARCHIVE))


if __name__ == "__main__":
    main()
