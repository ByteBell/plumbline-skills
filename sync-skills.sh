#!/usr/bin/env bash
# Mirror the MCP server's shipped skills into this plugin repo.
#
# The server's skills/plumbline/ is the source of truth: it is what the running
# server serves as plumbline:// resources. This repo is a mirror, so the two
# drift the moment anyone hand-edits a file here. Run this instead.
#
# Usage: ./sync-skills.sh [path-to-mcp-server]
set -euo pipefail

SERVER="${1:-$HOME/programs/kube-package/services/chat-mcp/repo/mcp-server}"
SRC="$SERVER/skills/plumbline"
DEST="$(cd "$(dirname "$0")" && pwd)/plugins/plumbline/skills/plumbline"

[ -d "$SRC" ] || { echo "no skills at $SRC — pass the mcp-server path as \$1" >&2; exit 1; }

rm -f "$DEST"/*.md
cp "$SRC"/*.md "$DEST/"

# A bytebell:// URI here is a dead link: the server serves plumbline://.
if grep -rl 'bytebell://' "$DEST" 2>/dev/null; then
  echo "ERROR: dead bytebell:// URIs in the files above — fix them in $SRC" >&2
  exit 1
fi

echo "synced $(ls -1 "$DEST"/*.md | wc -l | tr -d ' ') skill files from $SRC"
git -C "$(dirname "$DEST")/../../.." status --short || true
