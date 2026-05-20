import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.peerpush_drafts import DEFAULT_CSV_PATH, generate_peerpush_drafts


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local app drafts from Peerpush CSV snapshots.")
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Peerpush CSV path. Defaults to {DEFAULT_CSV_PATH}",
    )
    args = parser.parse_args()

    result = generate_peerpush_drafts(args.csv)
    print(
        "Peerpush draft generation complete: "
        f"{result['created']} created, "
        f"{result['duplicates']} duplicates, "
        f"{result['skipped']} skipped, "
        f"{len(result['errors'])} errors."
    )
    for error in result["errors"]:
        print(f"ERROR: {error}")


if __name__ == "__main__":
    main()
