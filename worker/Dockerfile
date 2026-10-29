FROM oven/bun:1.3.5 AS build
WORKDIR /source
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY src ./src
RUN bun build ./src/worker.js --target=node --format=cjs --outdir=/bundle

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xvfb xauth libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libgl1-mesa-dri libxss1 libxtst6 libatk-bridge2.0-0t64 libdrm2 libxdamage1 libxrandr2 libxcomposite1 libxkbcommon0 fonts-dejavu-core tini && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 https://github.com/Kruithne/wow.export/releases/download/0.2.19/portable-wow-export-linux-x64-0.2.19.tar.gz -o /tmp/export.tar.gz \
 && echo "26081285b0e0e17218176d2d52aa1abd10bdc5182a1fabbe8797ffff19cf4259  /tmp/export.tar.gz" | sha256sum -c - \
 && mkdir /app && tar -xzf /tmp/export.tar.gz -C /app --strip-components=1 && rm /tmp/export.tar.gz && test -x /app/wow.export && test -f /app/mmap.node
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /bundle/worker.js ./src/worker.js
COPY src/worker.html ./src/worker.html
COPY worker/package.json ./package.json
COPY worker/entrypoint.sh /entrypoint.sh
COPY worker/healthcheck.sh /healthcheck.sh
RUN chmod -R a+rX /app && chmod +x /entrypoint.sh /healthcheck.sh && mkdir -p /work /cache && chown -R 10001:10001 /work /cache
ENV HOME=/cache LIBGL_ALWAYS_SOFTWARE=1 WOW_EXPORT_DATA_PATH=/cache/exporter
USER 10001:10001
RUN test -x /app/wow.export && test -r /app/mmap.node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20m CMD /healthcheck.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
