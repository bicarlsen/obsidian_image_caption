# Build

## Dev
Run `npm run dev`.

## Release
1. Update plugin and Obsidian version info in `versions.json`, `manifest.json`, and `package.json`.
2. Git commit with version tag `x.y.z`.
3. Run `npm run build`.
4. Push changes to GitHub.
5. Issue a new release on GitHub, include the built `main.js`, `styles.css`, and `maifest.json` files. 