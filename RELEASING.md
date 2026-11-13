# Releasing JobRadar

Installed copies check GitHub Releases for a newer version every few hours, download it quietly, and offer "Restart and update".

## Publish a new version

1. Make and test your changes (`npm test`, `npm run dev`).
2. Raise the version (it must be higher than the last release):
   `npm version 0.1.1 --no-git-tag-version`
3. Build and publish in one step:
   `npm run release "What changed in this version"`
4. Save your work: `git add .`, `git commit -m "release 0.1.1"`, `git push`

`npm run release` runs `npm run dist` (needs Windows Developer Mode on) and then uploads these three files to a GitHub Release tagged `v0.1.1`:
- `JobRadar-Setup-0.1.1.exe` (what people download)
- `JobRadar-Setup-0.1.1.exe.blockmap` (lets updates download only what changed)
- `latest.yml` (tells installed copies a new version exists)

All three must be on the release, or updates will not work.

## Notes
- The first install is a manual download from the Releases page. Every later version updates itself.
- Users' saved jobs, applications and CV details are kept across updates.
- Installers are not code-signed, so Windows shows "Windows protected your PC" on the first install only (More info, then Run anyway).
