# Fabricate

Fabricate is a browser-based material authoring tool for woven fabrics and carbon fiber.
It generates a full PBR texture set procedurally from a weave draft and a small set of material controls, with 2D tiling and 3D preview built in.

https://ghostface2232.github.io/fabricate/

## What It Does

- Builds woven and carbon-fiber surface patterns from procedural rules instead of bitmap sources
- Derives the full PBR stack from height as the single source of truth
- Previews materials as seamless tiles or on a 3D sphere
- Exports texture maps as PNG for downstream rendering work

Current pattern coverage includes:
- Woven: plain, basket, oxford, twill 2/1, twill 2/2, twill 3/1, broken twill, herringbone, chevron, satin, sateen
- Carbon: plain and twill

## Why This Exists

Textile look-dev usually means picking from a pre-baked texture library or stopping at a flat pattern preview.
Neither is useful when you need to iterate on structure, density, loft, edge sharpness, gloss response, and color balance at the same time.
Fabricate covers that gap — quick material exploration in the browser, no round-tripping to external tools.

## Highlights

- Procedural weave matrix generation on the CPU
- WebGL2 shader pipeline for height, normal, AO, roughness, and diffuse
- Three.js preview without React Three Fiber
- Zustand state model with undo and redo
- GitHub Pages deployment via Actions

## Quick Start

Requirements:
- Node.js 22 or newer
- A browser with WebGL2 support

Install and run locally:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The repository includes a GitHub Actions workflow for GitHub Pages.
Pushes to `main` build the app and publish the contents of `dist/`.
If you fork the project, make sure the repository Pages source is set to `GitHub Actions`.

## Project Structure

```text
src/
  components/   React UI
  engine/       WebGL2 rendering pipeline and weave generation
  patterns/     Pattern catalog metadata
  shaders/      GLSL 300 es shader sources
  stores/       Zustand state
  types/        Shared app and engine types
public/
  Logo/         App logo and favicon assets
.github/
  workflows/    CI and deployment automation
```

## Architecture Notes

- `src/engine` stays React-free
- Pattern generation flows through a single `PatternParams` interface
- Height is the authoritative source for every derived PBR map
- Weave matrices are generated on the CPU and uploaded as WebGL2 data textures

## Known Constraints

- WebGL2 is required
- The app is tuned for dark UI only
- Very large preview resolutions can be GPU-bound on lower-end hardware
- Vite currently emits a large chunk warning in production builds

## Contributing

Contributions are welcome, especially around:
- additional weave structures
- export workflow improvements
- better mobile ergonomics
- material response tuning for rendering accuracy

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

For security issues, read [SECURITY.md](./SECURITY.md).

## License

Released under the [MIT License](./LICENSE).