# Pitchdeck (lokal)

Dieses Pitchdeck ist ein kleines React/Vite-Projekt. Die Slides sitzen in `src/app/App.tsx`.

## Voraussetzungen
- Node.js (empfohlen: aktuelle LTS)
- Paketmanager: pnpm oder npm

## Lokal starten (Dev)
```bash
cd Pitchdeck
npm install
npm run dev
```
Dann im Browser die von Vite ausgegebene URL öffnen (typisch `http://localhost:5173`).

Hinweis (Windows PowerShell): Falls `npm` wegen Execution Policy blockiert ist, nimm `npm.cmd`:
```bash
npm.cmd install
npm.cmd run dev
```

## Build/Preview
```bash
cd Pitchdeck
npm run build
npm run preview
```

## Als PDF exportieren (Print Mode)
1) Starte `npm run dev` (oder `npm run preview` nach einem Build).
2) Öffne im Browser zusätzlich `?print=1` (z.B. `http://localhost:5173/?print=1`).
3) Browser: Drucken → „Als PDF speichern“.
   - Seiten: Alle
   - Layout: Querformat
   - Ränder: Keine
   - Skalierung: 100%
   - „Hintergrundgrafiken“ aktivieren (wichtig für Farben/Backgrounds)
   - Papierformat: „Default“ lassen (CSS setzt 16:9 auf 13.333in × 7.5in)

## Screenshot/Crop-Ansicht (grüner Rahmen)
Für manuelles Ausschneiden oder Tools, die den Slide-Rand erkennen sollen:
`http://localhost:5173/?frame=1`
