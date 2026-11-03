# Local collectible series builder

Build the selected characters on this machine, then copy approved model files to
the website. The VM does not need wow.export, game data, or an export service.
The first interface is a JSON selection file and one command; there is no series
editor or pose picker in the website yet.

## Build a series

Requirements: Docker Desktop with Linux containers, Node.js 24.22.1+, and the
website's development figurine lab running on localhost (currently port 3015).
The lab supplies public EU appearance snapshots using its existing server-side
Blizzard credentials. Credentials never enter the exporter or series files.

From the wow.export repository root, install the separate local optimizer once:

```powershell
npm ci --prefix worker/optimizer
```

Copy/edit `worker/series.example.json`. Add your selected characters, for example
16 entries for a weekly series. Give every series and every figure a unique
lowercase ID. The builder supports 1–64 figures, including multiple poses of the
same character under different figure IDs.

```powershell
node worker/build-series.mjs worker/series.example.json
# If the local website uses another port:
node worker/build-series.mjs worker/series.example.json http://127.0.0.1:3000
```

The command fetches appearances, starts/builds the local export container, exports
one figure at a time, compresses and validates each file, then stops the container.
Cached game assets remain on disk. Normal errors also stop the container.
Do not submit separate worker jobs while a series build owns the queue.

Output is `worker/data/series/<series-id>/`:

- `models/<figure-id>.glb`: packed Meshopt + WebP file for the website.
- `series.json`: names, poses, relative model paths, file sizes/hashes, WoW build,
  and review status.
- `selection.json`: the requested characters and poses.
- `sources/<figure-id>.json`: frozen appearance, exporter provenance, available
  animations, and compression/validation results.

A successful build has state `needs-review`. Check appearance, gear, pose, and
effects against the reference image before using the models in a released series.
Structural validation does not prove visual correctness. Nothing is uploaded,
published, scheduled, or automatically approved.

Existing series folders are never overwritten, even after failure. Use a new ID
for a revised build. A normal failure preserves diagnostic output and marks the
series failed. An abrupt process termination can leave a lock or running worker:
stop the worker, confirm no series-builder process remains, and then remove only
`worker/data/series-build.lock` before retrying with a new series ID.

## Character forms

Non-Evoker Dracthyr automatically use their saved humanoid visage appearance;
Evokers use their Dracthyr form. Both factions follow this default. A character
recipe may set `"form": "dracthyr"` or `"form": "visage"` for an explicit exception.
These overrides require a Dracthyr character. The existing druid `"form": "cat"`
option is unchanged. Export provenance records the resolved form and model ID.
Poses are sampled on the selected form, so animation availability/duration may
change when switching forms.

## Poses

Each character entry accepts a frozen animation sample:

```json
{
  "id": "roidy-wave",
  "name": "röidy",
  "realm": "kazzak",
  "pose": { "animationId": 67, "variation": 0, "timeMs": 750 }
}
```

Omitting pose defaults to Stand (animation 0, variation 0, time 0). The above wave
was verified on Röidy's Haranir female model; available animations and durations
vary by model. The `export.poses` list in each source file records supported
animation IDs, names, variations, and durations. Time must be less than the
selected animation duration; unavailable poses fail instead of silently falling
back. There is no invented universal set of poses.

The builder samples bone transforms and bakes them into character and equipment
vertices. The resulting GLB has no skeleton or animation clips. It remains fully
rotatable in 3D; the website animates the box and the figure as whole objects.

To change the pose later, regenerate from a saved appearance job with a different
pose and a new job ID. The low-level queue accepts the same pose object, so an
existing collectible need not change gear when its pose changes. Arbitrary
hand/limb editing requires a rigged authoring export in Blender; the baked web
file is not a rig. Desktop wow.export's existing pose controls and OBJ/STL
pose-export option remain available.

## Curated community series and verification

The versioned selection is `worker/series.community-001.json`: 16 unique EU
characters with fixed emote timestamps and explicit `weapons: "held" | "sheathed" | "hidden"`.
Use a fresh series ID before rebuilding; previous batch snapshots are immutable.
Röidy and Yolobolt hold their weapons; most others sheath them. Retail
Item.SheatheType chooses opposing back/hip or central shield attachments.
Items with no sheath location are hidden. `hidden` removes both hand weapons
and opens the hands. Laku uses WALean01 (1260, variation 0) at 0 ms with hidden weapons. Player-selected hip/back overrides
are not currently read from the appearance API.

The fork now follows ChrRaces sex-specific component fallbacks. Haranir female
Röidy selects matching Night Elf female boots/cape, remapped by bone CRC/pivot;
body-fitted cape meshes deform with the character skeleton. Belt buckles and
extra rigid shoulder pieces use their slot attachments.

The upcoming second box has its own `worker/series.community-002.json` recipe.
Chipiepew has been removed from the first recipe; Chipie the priest remains.
Historical frozen batches are retained unchanged.

CPU bone storage now covers the complete skeleton rather than the 256-entry GPU
palette. Dracthyr shoulder attachments use bones 304 and 309 of a 345-bone
skeleton; their export transforms must be evaluated even though they are outside
the GPU palette. Only the supported palette is uploaded to the existing shader.

Bone transforms sample global sequences at track zero and the global clock,
independent of the chosen emote. This preserves the fixed rotations on sheath
bones; previously the emote index dropped these rotations and weapons stuck out
horizontally. Tests exercise the actual renderer attachment-matrix path.

Exports preserve source blend mode/flags in material.extras.wowM2. The website
restores additive weapon effects; generic glTF viewers only see the standard
alpha approximation. The scene also records wowCharacter.groundY from visible
body/boot triangles, excluding low weapons, for pedestal placement. centerX and
centerZ use the midpoint of the lower 10% body/boot footprint, so weapons and
raised arms do not drag the stance away from the center of the pedestal. This
uses footprint bounds rather than a density-biased average of vertices.

The curated batch is Meshopt/WebP compressed (quality 89, max texture size 2048),
validated after geometry decoding, and reviewed in the browser gallery. The
website tests enforce a 2,000,000-byte per-character budget and exact hashes.
Röidy's Stand/Wave cloak and boot fit were also inspected with Blender renders.
Remaining undefined replaceable-texture warnings are retained in source records.
Full WoW shader combiners, particles, animated UVs, and Funko proportions are not
implemented. Every new item/pose still needs visual review for clipping.

The exporter still uses several GB temporarily while loading CASC lookup entries
and character tables. Curated batches stop the local container afterward; no
exporter runs on the VM. First startup downloads indexes/tables and assets;
later jobs reuse the persistent cache. Download size is not GPU memory usage.

## Worker internals and manual jobs

The local container uses the checksum-verified portable wow.export 0.2.19 Linux
runtime (NW.js/native mmap), this checkout's bundled character code, an offscreen
WebGL context, Xvfb, and SwiftShader. No desktop clicking or host WoW installation
is required. Bun 1.3.5 matches upstream's build tool.

The first discovered EU Retail build is pinned in the cache. Series jobs require
that exact build. For a future game build, prepare a separate cache and review
the resulting assets; existing collectibles retain their saved snapshots.

The container exposes no HTTP port, runs as a non-root user, drops capabilities,
and enables no-new-privileges. Chromium's inner sandbox is disabled inside this
dedicated trusted-input container. Its initial limit is four CPUs and 8 GB RAM.
This is a local tool, not an Internet-facing service or VM deployment setup.

For manual jobs:

```powershell
docker compose -f worker/compose.yaml up -d --build
node worker/submit.cjs C:\path\appearance.json unique-job-id
docker compose -f worker/compose.yaml stop
```

The queue accepts either a raw Blizzard appearance snapshot (default EU/Stand) or
`{ "region": "eu", "appearance": { ... }, "pose": { ... } }`.
Files flow through `inbox/`, `processing/`, `done/` or `failed/`; raw outputs are
in `worker/data/results/<job-id>/`. Jobs have a ten-minute timeout. Interrupted
jobs are marked failed on startup; retry with a new ID. JSON result files record
build/version/hash, selected pose, applied customization, gear, timing, and
warnings. The low-level worker stays running until stopped.

### Asset jobs: search and export game models or textures

The same queue takes asset jobs for set dressing (props, ground textures). One job
can search the listfile, export named files, or both:

```json
{ "kind": "models", "search": ["anvil", "crystal|gear"], "limit": 200,
  "models": [{ "name": "gnome-gear", "file": "world/khazmodan/ironforge/passivedoodads/gnomearea/gnomekinggear.m2" }] }
```

- `kind` is `models` (M2, exported as GLB with embedded textures) or `textures`
  (BLP, exported as PNG; the list key is then `textures`).
- `animations`: optional boolean for model jobs (default `false`). Set `true` to
  retain skeletal animation clips as well as the rig; preserve both during optimization.
- `search`: up to 20 case-insensitive regular expressions, matched in one pass
  against every listfile path with that kind's extension. `search.json` gets, per
  pattern, `total` and up to `limit` (default 600, max 5000) `{ file, fileDataID }`
  sorted by path. Write a literal dot as `[.]` (or `\\.`: JSON doubles the backslash).
- `models` / `textures`: up to 32 / 64 `{ name, file }`, where `file` is a listfile
  path or a fileDataID and `name` (lowercase letters, digits, hyphens) names the output.

```powershell
node worker/submit.cjs search.json station-search-004
```

`submit.cjs` checks the job (JSON, patterns, names) before queueing it; the worker
checks it again. Results land in `worker/data/results/<job-id>/`, and `result.json`
records how many paths the search scanned, how long it took and each pattern's
match count. A 20-pattern model search scans about 134,000 paths in under a second.
Raw exports keep their skeletons; strip them and optimize before use on the website
(see `optimizer/`).

For a reproducible raw-file compression comparison:

```powershell
node worker/optimizer/measure.mjs path/to/source.glb worker/data/new-comparison
```

## Checks

```powershell
node --test worker/*.test.cjs
docker compose -f worker/compose.yaml ps -a
```

## Druid cat collectibles

A character entry can set `form: "cat"`. The worker resolves the selected
customization through ChrCustomizationElement/ChrCustomizationDisplayInfo and
CreatureDisplayInfo, exports the chosen creature skin/geosets, and bakes its
animation without humanoid equipment. Only explicit cat appearances are
supported: missing/default/random choices or unavailable animations fail.
Zetabeach's Ghost of the Pridemother (Green), choice 10088/display 66783, has a
1000 ms EmoteDance loop; the current recipe samples 500 ms.

Box 2 is frozen in `community-002-posed-004`, with 16 files totaling 18,000,036
bytes. Three Dracthyr exceed 2 MB (largest 2,451,912 bytes); the user approved
retaining 2048-pixel/WebP-89 textures instead of lowering quality.

Equipment GLBs now include fixed texture references from each M2 as well as
item-display replacements. This repairs Abiw's mop and slippers, and six box-2
characters, without changing gear or poses.

## Automatic clothing and static weapon effects

Base clothing defaults to `chrIncludeBaseClothing: "auto"`. Top (atlas layer 13)
and bottom (14) are evaluated independently: a visible chest/leg appearance
hides underwear in that region, while a hidden/empty slot keeps it. Saved
boolean preferences still explicitly show/hide both. Desktop users with an old
saved preference can select **Underwear → Auto (per armor slot)**. Component
texture selection now applies gender/class filtering to single candidates too;
missing compatible regions are skipped rather than borrowing another gender's
texture.

Posed GLB equipment export bakes two-UV Mod_Mod / Mod_Mod2x effect materials into
RGBA atlases. It preserves texture transforms, wrapping and sampled opacity,
preventing missing secondary masks from turning effects into solid sheets.
Repeated/overlapping effect faces retain last-face-wins output without repeatedly
sampling the same pixels. This does not implement all WoW shaders or
view-dependent edge fading. New effect families still require visual review.
Tonzidan and Syöpä were checked in the frontend lab; the optimized baker produced
byte-identical compressed GLBs in an independent repeat build.

Static body effects also bake supported two-UV Mod/Mod2x combiners when both
inputs are fixed M2 textures. This preserves Lightforged forehead rune masks and
their sampled UV animation (Valotettu, body submesh 88). Replacement-texture body
effects and other shader families retain the existing export path; this is not
a complete implementation of WoW's effect shaders. Animated desktop GLBs remain
outside the static-pose baker.

### Per-hand weapon placement

A recipe or worker job may set `weaponStates: { "mainHand": "held", "offHand": "sheathed" }`.
Each hand accepts `held`, `sheathed`, or `hidden`; an omitted hand inherits `weapons`.
This changes the actual equipment attachment and hand grip before baking the pose.
For example, Shippyboi uses `weapons: "held", weaponStates: { "offHand": "sheathed" }`
to keep the main-hand weapon equipped and the shield on the back. Existing recipes
without overrides retain their behavior. This is a worker setting; no desktop UI
control has been added. The output records overrides and each attachment's state.