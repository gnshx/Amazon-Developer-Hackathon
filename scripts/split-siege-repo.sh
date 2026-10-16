#!/usr/bin/env bash
set -euo pipefail

# Script to split @warrant/siege into an independent standalone git repository branch
# Usage: ./scripts/split-siege-repo.sh [target-remote-url]

echo "=== Splitting @warrant/siege into standalone git branch ==="
BRANCH_NAME="siege-standalone"

# Create a standalone branch containing only packages/warrant-siege history
git subtree split -P packages/warrant-siege -b "${BRANCH_NAME}"

echo "✅ Standalone branch '${BRANCH_NAME}' created."
echo ""
echo "To push this standalone package to a new, dedicated GitHub repository:"
echo "  1. Create a new empty repository on GitHub (e.g. https://github.com/your-user/warrant-siege)"
echo "  2. Run:"
echo "     git push <new-repo-url> ${BRANCH_NAME}:main"
echo ""
echo "Or if you prefer to push directly from this script, pass the remote URL:"
echo "  ./scripts/split-siege-repo.sh git@github.com:your-user/warrant-siege.git"

if [ $# -ge 1 ]; then
  TARGET_REMOTE="$1"
  echo "Pushing branch ${BRANCH_NAME} to ${TARGET_REMOTE}..."
  git push "${TARGET_REMOTE}" "${BRANCH_NAME}:main"
  echo "✅ Pushed to ${TARGET_REMOTE}"
fi
