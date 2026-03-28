# Contributing

## Before You Start

- Check existing issues and pull requests first
- For changes that affect rendering behavior, describe the expected visual result clearly
- Keep the scope tight; small, reviewable pull requests are easier to merge

## Local Setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run build
```

## Project Rules

- Keep `src/engine` free of React dependencies
- Treat height as the single source of truth for derived PBR maps
- Keep shared engine and UI inputs flowing through `PatternParams`
- Prefer adding new weave logic in the engine rather than hardcoding UI-only behavior
- Do not introduce non-WebGL2 rendering paths unless there is a strong reason

## Pull Request Notes

Include the following in your PR description:

- what changed
- why it changed
- whether the change affects rendered output, export output, or both
- screenshots or short before/after notes for visual changes

## Coding Style

- TypeScript strict mode
- React function components and hooks
- `@/` import alias
- GLSL sources under `src/shaders`
- Manual engine edits should stay readable and explicit over overly clever abstractions

## Good First Contributions

- new weave presets and pattern metadata
- UI polish that does not alter the engine contract
- documentation improvements
- export pipeline quality-of-life fixes