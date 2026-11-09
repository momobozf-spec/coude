"""Vervang de testtoon in het voorbeeld door echte ingesproken opnames.

Gebruik:
  python -m app.demo_audio kermis.m4a bakkerij.m4a raad.m4a
  python -m app.demo_audio --ai 1.wav 2.wav 3.wav   (stem gemaakt met AI: wordt zo vermeld op de site)

De bestanden horen in deze volgorde bij de drie voorbeeldverhalen:
  1. Hoe heb je je partner leren kennen?  (de kermis)
  2. Wat was je eerste baan?              (de bakkerij)
  3. Welke herinnering wil je doorgeven?  (niet alles in één keer weten)
Elk formaat dat ffmpeg leest werkt (m4a van iPhone, mp3, ogg, wav, webm). Max. 3 minuten per opname.
Het voorbeeld blijft gemarkeerd als verzonnen verhaal; enkel het geluid verandert.
"""
import sys
from pathlib import Path

from . import audio, config, db
from .main import many, run

MAX_SECONDS = 180


def main(argv=None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    ai = "--ai" in args
    files = [Path(f) for f in args if f != "--ai"]
    if not files:
        print(__doc__)
        return 1
    db.init()
    stories = many("SELECT s.* FROM stories s JOIN orders o ON o.id=s.order_id JOIN questions q ON q.id=s.question_id "
                   "WHERE o.is_demo=1 AND o.deleted_at IS NULL ORDER BY q.position")
    if not stories:
        print("FOUT: geen voorbeeld gevonden. Draai eerst: python -m app.seed_demo", file=sys.stderr)
        return 1
    if len(files) > len(stories):
        print(f"FOUT: {len(files)} bestanden, maar het voorbeeld heeft {len(stories)} verhalen.", file=sys.stderr)
        return 1
    for f, s in zip(files, stories):
        if not f.exists():
            print(f"FOUT: {f} bestaat niet.", file=sys.stderr)
            return 1
        try:
            secs = audio.duration_seconds(str(f))
        except audio.AudioError:
            print(f"FOUT: {f.name} kon niet gelezen worden.", file=sys.stderr)
            return 1
        if secs > MAX_SECONDS:
            print(f"FOUT: {f.name} duurt {secs:.0f} s; max. {MAX_SECONDS} s voor een voorbeeld.", file=sys.stderr)
            return 1
        target = Path(s["audio_path"])
        import shutil
        import subprocess
        original = target.with_name(f"demo_voice_{s['id']}{f.suffix.lower()}")
        shutil.copyfile(f, original)
        audio.to_mp3(str(original), str(target.with_suffix(".mp3")))
        # originele opname bewaren als webm/opus voor de ZIP-export van het voorbeeld
        subprocess.run([config.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(original),
                        "-vn", "-c:a", "libopus", "-b:a", "48k", str(target)], check=True)
        original.unlink()
        run("UPDATE stories SET audio_seconds=?, transcript_source=? WHERE id=?", secs, "demo_ai_voice" if ai else "demo_voice", s["id"])
        print(f"OK  verhaal {s['id']}: {f.name} ({secs:.0f} s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
