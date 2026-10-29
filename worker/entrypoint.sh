#!/bin/sh
set -eu
mkdir -p /cache/exporter /work/inbox /work/processing /work/done /work/failed /work/results
exec xvfb-run -a -s '-screen 0 1024x768x24 -nolisten tcp' ./wow.export . --user-data-dir=/tmp/wow-profile --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage
