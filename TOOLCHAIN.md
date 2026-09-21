# Tested toolchain

Local verification: Windows x86-64, 2026-09-21.

- moon 0.1.20260920 (914d7da, 2026-09-20)
- moonc v0.10.14+7d59c7ec9 (2026-09-18)
- moonrun 0.1.20260920 (914d7da, 2026-09-20)
- Node.js v24.19.0 (CLI supports Node.js >=20)
- Matching core library from the official toolchain distribution

The toolchain was downloaded from cli.moonbitlang.cn and the Windows archive SHA-256 was checked against the vendor checksum. No global PATH or system settings are required to use the supplied compiled package. To rebuild, install the official toolchain and expose moon through PATH (or set the MOON environment variable to its executable).

Verified Windows toolchain archive SHA-256:
`faae225a8287d0ce69e44b5b3f754af988e97f4446056d8f32ceb3ddb998fce7`

CI installs the current stable MoonBit distribution and prints its version. It is a forward-compatibility check, not a fully pinned toolchain. The tested local versions above are the reference for this deliverable.
