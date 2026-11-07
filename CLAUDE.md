# Working on algoviz

The owner (Eric) hands this project to Claude to iterate on unattended, one roadmap item at a time. These rules say how. Talk to the owner in Chinese; write code, docs, commits and PRs in English.

## Read first

- [`docs/requirements.md`](docs/requirements.md): what 1.0 must do and the quality bar.
- [`docs/roadmap.md`](docs/roadmap.md): the items, their order and their status.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): commands, conventions, adding a kind, tests and the Git workflow.
- The ADRs the item touches ([`docs/adr/`](docs/adr/README.md)). Accepted ADRs are not edited; a change of decision is a new ADR.

## One iteration

1. **Pick** the first unchecked roadmap item whose prerequisites are done, unless the owner named one. Skip items waiting on the owner (marked _owner_, or an ADR still `Proposed`), and say which ones they are.
2. **Branch** from an up-to-date `main`: `feat/…`, `fix/…` or `docs/…`.
3. **ADR first** when the item is marked _ADR_ or changes the protocol, adds a kind, or changes a public API or package interface.
   - Write the ADR as `Proposed`, open a PR with only the ADR, and stop.
   - Code starts after the owner approves it.
4. **Test first**: write failing tests, then the implementation, then refactor. New recipes test against an independent reference implementation and run property tests.
5. **Verify**:
   - `npm run check` for every change.
   - `npm run test:e2e` when the player, elements or playground change.
   - `FUZZ_RUNS=2000` on the property tests you touched.
   - A visual check in the browser or with `npm run gallery` for anything drawn. Look at it yourself; don't ask the owner to.
6. **Review**: run the code-reviewer agent once on the finished diff, check each finding against the code, and fix the real ones. Don't wait for or act on the Codex bot's PR reviews.
7. **Record**: mark the item `[x]` with the PR number in `docs/roadmap.md` in the same PR, and update the README or the MCP guide if what users see changed.
8. **Ship**: open a PR and turn on Auto-fix. Merge it (merge commit, like the earlier PRs) once CI is green and no review finding is open. Then sync local `main`.
9. **Report** to the owner in a few lines: what changed, how it was verified, the PR link, and the next item.

## Ask the owner first

- Approving any ADR.
- Visual style: themes, colours, fonts, layout of the player chrome.
- Names, publishing (npm, Typst Universe, CTAN, the docs site) and anything that needs the owner's accounts, such as Cloudflare.
- Deleting or renaming something users already depend on.
- Changing scope: adding to or dropping from the requirements or the coverage list.
- Running a multi-agent workflow, or more than three subagents at once.

## Don't

- Push to `main` directly, force-push, or rewrite published history.
- Commit `apps/playground/theme-lab.html`, `apps/playground/src/theme-lab/` or `.claude/`. The theme lab goes away with roadmap item 1.6.
- Copy pseudocode from CLRS. Write it in CLRS conventions, in our own words.
- Leave the roadmap out of date.

## CI budget

The repository is private on GitHub Free: 2,000 Actions minutes a month, and one CI run costs about 6.

- Run `npm run check`, the E2E tests and any fuzzing locally before pushing. Push a pull request once it is ready, not after every commit.
- Don't re-run CI to retry a flaky test without finding the cause first.
- Changes to root Markdown files and `docs/` skip CI (`paths-ignore` in `.github/workflows/ci.yml`). Keep pure documentation PRs free of code, so they stay free.
- Merges to `main` do not run CI again. Use the manual "Run workflow" button if `main` ever needs a check.
- If minutes run low, tell the owner rather than cutting checks. The owner can see usage under GitHub Settings → Billing.

## Size of an iteration

- One roadmap item per session and per PR.
- Split an item into several PRs only if a single PR would be hard to review, and note the split in the roadmap.
- Use subagents only for wide searches or long output, at most three at once, and give each a narrow scope.
