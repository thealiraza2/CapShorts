# Security Policy

CapShorts is committed to ensuring the security and privacy of video creators worldwide. As an application designed to process personal audio and video locally, data isolation and vulnerability prevention are top priorities.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within CapShorts, please report it privately:

1. **Do NOT open a public GitHub issue.**
2. Send an email to the project maintainer at `security@capshorts.dev` (or open a private security advisory on GitHub).
3. Include detailed reproduction steps, proof of concept (PoC), and affected components (backend engine, Tauri frontend, or dependencies).

We will review and acknowledge receipt of your report within 48 hours, validate the vulnerability, and issue a patched release promptly.

## Security Practices

- **Zero Remote Telemetry of User Media:** No audio, video files, transcripts, or personal credentials leave the user's local machine without explicit user configuration.
- **Strict Local Loopback:** The backend engine strictly listens on loopback (`127.0.0.1`) and rejects remote network access.
- **Input Sanitization & Path Traversal Guards:** File paths are strictly validated and constrained within approved project sandbox directories (`TEMP_DIR` and `OUTPUT_DIR`).
- **Cryptographic Supply Chain:** Pre-built FFmpeg binaries are verified using strict SHA-256 checksums during automated CI builds.
