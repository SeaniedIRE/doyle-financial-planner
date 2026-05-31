#!/bin/bash
# Pull latest Docker image from GHCR and restart the container.
# Run on the Unraid host. Requires Docker to be available.
# Usage: ./scripts/update.sh

set -euo pipefail

IMAGE="ghcr.io/seaniedire/doyle-financial-planner:latest"
CONTAINER_NAME="doyle-financial-planner"

echo "Pulling latest image..."
docker pull "$IMAGE"

echo "Restarting container..."
docker restart "$CONTAINER_NAME" 2>/dev/null || echo "Container '$CONTAINER_NAME' not running — start it from the Unraid UI."

echo "Done. Version:"
docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE" 2>/dev/null || echo "(digest unavailable)"
