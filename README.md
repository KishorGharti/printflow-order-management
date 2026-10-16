# Print Ghar Order Manager

## Run the application

1. Run `npm install`.
2. Run `npm start`.
3. Open `http://localhost:3000`.

The order manager opens directly without a login screen.

## Design and reference files

Create Order accepts JPEG, PNG, PDF, TIF/TIFF and PSD attachments through file selection, drag-and-drop, or clipboard image paste. The original files are stored locally in the browser using IndexedDB, while the order keeps their metadata. JPEG, PNG and PDF files have an in-app preview; TIFF and PSD files can be downloaded from the same eye-button preview panel.

## Checks

Run `npm run build` for runtime syntax checks and `npm test` for the complete automated test suite.

## Current runtime architecture

The production browser UI served by `server.js` is `dist/app.js`. The `src/` React/TypeScript tree is an older partial implementation and is not currently bundled into the runtime by `npm run build`. Treat `dist/app.js` as the running source until the project is consolidated into one canonical build pipeline.

## Data safety

Use **Profile & Business Settings → Backup & Data Safety** to download or restore a JSON backup of business records. Large uploaded artwork/reference attachment blobs are stored separately in IndexedDB and are not included in the JSON records backup.
