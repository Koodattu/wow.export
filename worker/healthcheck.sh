#!/bin/sh
set -eu
grep -Eq '^  "state": "(ready|exporting)"' /work/status.json
test -n "$(find /work/heartbeat -mmin -1 -print)"
