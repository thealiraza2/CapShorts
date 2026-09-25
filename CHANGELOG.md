# Changelog

All notable changes to CapShorts are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2026-09-25

### Fixed
- **Task Prune & Eviction Lifecycle (`N-001`)**: Resolved high-severity regression where completed/failed tasks were immediately pruned upon finishing due to missing timestamps, breaking progress polling and retrieval endpoints. Added timestamp retention (`_created_at`, `_completed_at`) and protected terminal tasks for full TTL.
- **Cross-Video State Corruption (`N-002`)**: Loading a new video now fully cancels in-flight transcription polling and resets transcription progress/state, preventing out-of-order overwrite.
- **Export Semaphore Saturation (`N-003`)**: Added synchronous `HTTP 429 Too Many Requests` with `Retry-After: 30` header when concurrent export capacity is saturated, eliminating background async task drops.
- **Word Validation & KeyError Prevention (`F-028`)**: Added strict `WordItem` Pydantic model with validation (`HTTP 422`) and defensive accessors in clip generation to prevent `KeyError: 'word'` on incomplete payloads.
- **Dead Session Token Code Removed (`F-001`, `N-006`)**: Removed unwired token generator that wrote to `~/.capshorts/session_token` on every import; loopback security boundary cleanly retained.
- **Dead Code Cleanup (`N-009`)**: Removed unused `generate_demo_transcript()`.
- **Upload Streaming Cleanup (`N-011`)**: Streamlined file upload streaming without redundant file descriptor close calls.
- **Error Sanitization (`F-006`)**: Prevented raw internal exception traces, system paths, and FFmpeg stderr logs from leaking in API responses.
- **Packaged Update UX (`N-004`)**: Fixed misleading "Update applied successfully! Reloading studio..." prompt when downloading official releases.
- **Contrast & UI Ergonomics (`N-016`)**: Improved contrast and formatting of the render failure banner in `ExportModal`.
- **Transcribe Polling Attempt Limit (`F-043`)**: Added 10-minute timeout cap (1200 poll cycles) to transcription store poller.
- **Version Drift Resolution (`N-005`, `N-015`)**: Synchronized version `1.1.4` across root `package.json`, `Cargo.toml`, `tauri.conf.json`, `telemetry.py`, `docs/index.html`, `README.md`, and `DOCUMENTATION.md`.
- **Toolchain Alignment (`N-012`, `N-013`)**: Aligned CI workflow with release toolchain (Python 3.11, Node 22) and keyed npm cache on `package-lock.json`.
- **Secret Scanner Hygiene (`N-014`)**: Replaced `gsk_` sample API key prefix in `.env.example` with non-secret dummy placeholders.
- **Missing Cargo.lock Committed (`F-073`)**: Tracked and committed `CapShorts/src-tauri/Cargo.lock`.

## [1.1.3] - 2026-09-25
### Added
- Multi-platform packaging for Windows and macOS Universal (Apple Silicon & Intel).
- Pinned portable FFmpeg binary with SHA-256 verification in release workflow.

## [1.1.2] - 2026-09-24
### Fixed
- Fixed SSRF prevention in B-roll fetching with DNS resolution and private network filtering.
- Pinned Python package dependencies strictly to exact versions (`==`).
- Enforced 4 GB streaming upload ceiling.

## [1.1.0] - 2026-09-23
### Added
- Initial standalone release with local Faster-Whisper, Groq Turbo cloud transcription, viral shorts extractor, and interactive CapCut timeline.
