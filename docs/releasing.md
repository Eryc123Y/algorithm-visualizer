# Releasing

How a release of algomotion goes out: the checks, the versions, the files, and where each is published. A release publishes to npm, the GitHub releases page, Typst Universe and CTAN, and redeploys the site and the Worker. Publishing needs the owner's accounts (`CLAUDE.md`); everything before it can be prepared in a pull request.

## 1. Check

On an up-to-date `main`, with nothing left open for the release in [the roadmap](roadmap.md):

```sh
npm ci
npm run check
npm run build
npm run test:e2e
npm run test:typst
npm run test:latex
npm run build:standalone -w @algomotion/mcp && npm run test:standalone
npm run test:worker
```

- Run the property tests deep, a few files at a time: `FUZZ_RUNS=5000 npx vitest run <files>`. `packages/recipes/tests/properties.spec.ts` alone takes more than an hour.
- Remeasure the bundles with `npm run sizes`, and commit `docs/sizes.md` if they moved.
- Look at the figures with `npm run gallery`, in both languages.

## 2. Versions

The npm packages share one version, and the Typst and the LaTeX package each have their own (ADR 0021). One command sets them everywhere the repository writes them. `scripts/versions.spec.ts` fails if any place disagrees.

```sh
node scripts/version.ts --npm 1.0.0 --typst 1.0.0 --latex 1.0.0
```

Then, in the same pull request:

- **Lock file.** Set the root package's version in `package-lock.json`, or run `npm install --package-lock-only`.
- **Changelog.** Turn `## Unreleased` in `CHANGELOG.md` into `## 1.0.0 (date)`, with a sentence on the release.
- **Words.** Update what the docs say about where to get each output: the status sections of `README.md` and `README.zh-CN.md`, and the guide's install notes in both languages (`apps/site/src/docs/guides/`, `start`, `web`, `typst` and `latex`).
  - Once the Typst package is on Universe, imports change from `@local/algomotion` to `@preview/algomotion`.
  - Once the LaTeX package is on CTAN, the install steps change too.
- **Roadmap.** Tick the release in `docs/roadmap.md`.

Merge it, then tag the merge commit: `git tag v1.0.0 && git push origin v1.0.0`.

## 3. Files

The tag starts the **Release files** workflow (`.github/workflows/release.yml`). It builds the standalone `algomotion` command for macOS (arm64 and x64), Linux (x64 and arm64) and Windows (x64), and runs each once. It also packs three archives with `scripts/release-assets.sh`:

- `algomotion-typst-<version>.zip`: the Typst package, in the layout of a local package directory;
- `algomotion-latex.zip`: the LaTeX package as CTAN takes it;
- `algomotion-player-<version>.zip`: the player's files, to host.

The files are the run's artifacts. Download them from the run's page, or with `gh run download`. The same archives build locally with `npm run build && scripts/release-assets.sh`, into `release/`.

## 4. Publish (owner)

- **npm.** Run `scripts/publish.sh`. It builds from clean and publishes the eight libraries in dependency order. A prerelease goes under its own tag, such as `alpha`; a release goes under `latest`. npm asks to authenticate each package in the browser.
- **GitHub.** Make a release from the tag with the files of step 3, and notes taken from the changelog. Mark it as a prerelease only for one.
- **Typst Universe.** Fork [typst/packages](https://github.com/typst/packages). Copy the Typst archive's `local/algomotion/<version>/` to `packages/preview/algomotion/<version>/`, and open a pull request there.
  - The package's README, licence and the fonts' OFL go with it.
  - Typst's reviewers check the manifest, the README's examples and the files' sizes: `plugin.wasm` and `engine.bc` are about 2.5 MB together.
- **CTAN.** Upload the LaTeX archive at [ctan.org/upload](https://ctan.org/upload). Give the licence as GPL 3 or later, and the repository as the home page.
  - The package needs the `algomotion` command, from npm or the GitHub release.
  - Say so in the upload's notes, as for any package that runs a program through shell escape.

## 5. Deploy

Deploy from a checkout of the tag, with `npx wrangler login` done once:

```sh
npm run build -w @algomotion/site && (cd apps/site && npx wrangler deploy)
(cd apps/worker && npx wrangler deploy --env production)
```

The Worker's `production` environment carries this project's domain. Its top level deploys anywhere, as the Deploy to Cloudflare button does.

Then check the live site's footer version and a share link, and connect the hosted MCP server once, for example with `claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp`.
