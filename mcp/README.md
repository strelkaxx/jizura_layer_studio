# JIZURA Layer Studio MCP

Local stdio MCP for the cityedge-based fork. It runs the normal Layer Studio engine in an isolated headless Edge browser. Normal web pages do not load the MCP bridge or a server.

## Install and connect

Node.js 20+ and Microsoft Edge are required on Windows. In `mcp/` run `npm ci --ignore-scripts`. On other platforms install Playwright Chromium with `npx playwright install chromium`, or set `JIZURA_BROWSER` to an existing browser executable. Build with `python build.py` from the repository root.

Example Codex registration (replace the repository path with your absolute path):

```powershell
codex mcp add jizura-layer-studio --env "JIZURA_OUTPUT_DIR=E:/JIZURA-local/jizura_layer_studio/mcp/output" -- node "E:/JIZURA-local/jizura_layer_studio/mcp/server.mjs"
```

Generic MCP configuration:

```json
{"mcpServers":{"jizura-layer-studio":{"command":"node","args":["E:/JIZURA-local/jizura_layer_studio/mcp/server.mjs"],"env":{"JIZURA_OUTPUT_DIR":"E:/JIZURA-local/jizura_layer_studio/mcp/output"}}}}
```

`JIZURA_OUTPUT_DIR` defaults to `mcp/output`. `JIZURA_HEADLESS=0` shows the dedicated browser. `JIZURA_OFFLINE=1` disables Google Fonts for reproducible offline tests and uses OS fallbacks. stdio is protocol-only; do not type into the server terminal. The ephemeral HTTP listener binds to `127.0.0.1` only. Inputs use temporary unpredictable URLs, expire after import, and are not sent to external servers. Output filenames are simple names and existing files are never overwritten.

## Workflow

1. `session_create`, then `catalog` and `project_get`. The catalog supplies real IDs and project schema.
2. `asset_import(kind="srt")` loads UTF-8 SRT with the native start/end/overlap behavior. `audio` and a single image/video `background` are supported. Import additional font families into the OS, then use their existing project font keys. Raw font-file import is not provided by Layer Studio.
3. Set theme/pools with `theme_set` and `project_edit`, choose a common font with `font_set`, and `generate(seed)`. `font_set` persists across generation and saved-cut restoration.
4. `cue_edit` and `cue_randomize` use subtitle indices. `cut_update` uses the current resolved cut index. Indices can change after edits: reread state. `audio_preview` returns a WAV interval; `audio_analysis` reports beats, not lyric onset recognition.
5. `preview_frame(time,width)` returns the real composite PNG, including the imported background and title. It does not generate a video. Compare entrances, holds and exits.
6. Use favorite/custom-effect/motion tools below. `project_undo` restores the last MCP project edit, not imported media files.
7. `project_audit` performs technical checks only. After actually inspecting current frame images, `quality_approve(revision,note)` records the agent's review. This is not a user permission request. Editing invalidates the record. Project and library JSON can be saved without review.
8. `export_start` returns an asynchronous job. Poll `job_status` until `completed`, `failed` or `cancelled`. `mp4` uses native simple composite export with optional audio; `front` is the native silent lyric front. Save a project before `session_close`; browser assets are session-owned.

## Favorite and motion tools

- `favorite_spec`, `favorite_validate`, `favorite_save`, `favorite_list`, `favorite_apply`, `favorite_delete`, `favorite_preview`.
- `custom_effect_spec`, `custom_effect_validate`, `custom_effect_import`, `custom_effect_list`, `custom_effect_preview`.
- `motion_save`, `motion_list`, `motion_apply`: Layer Studio's native whole-subtitle recipes, adapted to new text. Export as `kind="motions"` for use in the existing Motion library UI.

Favorite payloads use the lyric subset of `jizura-cut-effects` v1, including standard effect IDs, parameters, bounded JSON drawing programs, embedded components and installed-font family references (no font binaries). Read the spec; executable JavaScript is never accepted. Reuse stock parts before defining custom ones. Components target lyric layout/entrance/hold/exit/treatment/background/camera/decoration/transition groups. Custom screen-FX components and ONE STOP EDITION media tracks are not supported. Preview custom screen appearance as a composed favorite or generated frame.

New editor and MCP projects default to the clean typography policy: nine core stock layouts, no motif backgrounds or stock decorations, and one common Gothic face. The checkbox beside the font selector restores the full stock candidate set. Explicitly authored custom components remain available. Old source picks are retained; the policy changes generated/rendered cuts, not the stored original overrides.

Normal editor users have an **お気に入り演出 / Favorite effects** button beside Motion library. They can capture the current cut, preview sample lyrics, apply to a cut, import/export library JSON and undo project edits. A **全編の書体を固定 / One font for all lyrics** selector is shown in the layer panel. Project JSON retains authored favorites, custom components and applied overrides.

## Formats and compatibility

| Export kind | Format |
|---|---|
| project, settings | `.jizura.json`; subtitle data, settings, favorites and custom components; no audio/background/font binaries |
| favorites | `.jizura-layer-favorites.json`; `jizura-layer-favorites` v1 |
| motions | `.jizura-motions.json`; native `jizura-motion-library` v1 |
| mp4, front | `.mp4` |

The bounded JSON interpreter and component registration are adapted from [hirazisora/JIZURA](https://github.com/hirazisora/JIZURA), retaining MIT attribution. This is a Layer Studio adapter, **not binary `.jizuraichifav` / `.jizuraichi` compatibility**. Foreground/media track APIs, PNG/AE exports and packed project containers from ONE STOP EDITION are not advertised by this MCP server. Older Layer Studio versions do not understand authored favorites. SRT from the previous locally modified JIZURA should be reimported from the original `.srt`, since its `[end:...]` lyric extension is not Layer Studio's cue format.

## Test

From the repository root, run `node mcp/test.mjs`. This uses the real SDK stdio client, isolated Edge, native engine, PNG previews, favorite JSON transfer, SRT import, custom layouts, fonts, native motion recipes, local WAV/background fixtures and both composite/front MP4 exports. It checks the H.264/AAC streams with `ffprobe` (test dependency only). Artifacts use a fresh OS temporary directory. The usual `dev/*test.js` suite remains available. No user project is used by the tests.
