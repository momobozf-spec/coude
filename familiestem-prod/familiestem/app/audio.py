"""Audio: duur meten (ook voor webm zonder duur-metadata) en een afspeelbare mp3 maken."""
import re
import subprocess


class AudioError(Exception):
    pass


def duration_seconds(path: str) -> float:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", path, "-f", "null", "-"],
                       capture_output=True, text=True, timeout=120)
    times = re.findall(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)", p.stderr)
    if p.returncode != 0 or not times:
        raise AudioError("Opname kon niet gelezen worden.")
    h, m, s = times[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


def to_mp3(src: str, dst: str) -> None:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", src, "-vn", "-ac", "1",
                        "-c:a", "libmp3lame", "-b:a", "64k", dst],
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        raise AudioError("Opname kon niet omgezet worden.")
