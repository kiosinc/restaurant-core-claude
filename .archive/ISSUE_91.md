# Plan — Issue #91: Library — single registry + prerelease→release promotion + promotion docs

## Approach

The library's CI publishes to a single Artifact Registry (`us-central1-npm.pkg.dev/kios-master/npm-packages`) on both branches, with environment isolation by **version** (prerelease vs release), never by registry. Because the two lanes run as different service accounts (declared in the build config, per "service-to-service auth must be explicit"), we use **two Cloud Build configs**:

1. **`cloudbuild.yaml` (release lane, master trigger `restaurant-core-prod`)** — rewrite in place:
   - Generate `.npmrc` pinned to `kios-master/npm-packages` (no `${PROJECT_ID}`).
   - Install → `npm run tsc` → `npx google-artifactregistry-auth .npmrc` → `npm publish --tag latest`.
   - No `serviceAccount` field → keeps running as legacy default SA `730024124565@cloudbuild.gserviceaccount.com` (verified writer on #90). **No prod trigger change needed.**

2. **`cloudbuild-prerelease.yaml` (dev lane, NEW file)**:
   - Same `.npmrc` pinned to `kios-master/npm-packages`.
   - Stamp version: `BASE` from package.json → `npm version "${BASE}-dev.${SHORT_SHA}" --no-git-tag-version` (Cloud Build's built-in `$SHORT_SHA`, 7 chars).
   - Install → `npm run tsc` → auth → `npm publish --tag next`.
   - Declares `serviceAccount: projects/kios-master/serviceAccounts/ar-prerelease-publisher@kios-master.iam.gserviceaccount.com` and `options.logging: CLOUD_LOGGING_ONLY` (required when a user-managed SA is set).
   - Operational consequence (documented, not in this PR): the dev-branch trigger must run **in `kios-master`** (same project as the SA) and reference `cloudbuild-prerelease.yaml`. Protected trigger on `dev` branch only; fork PRs never publish (triggers are branch-push based, not PR based).

3. **`PROMOTION.md` (NEW)** — single home for promotion knowledge:
   - The model: library owns dev→prod promotion; prerelease (`X.Y.Z-dev.<sha>`, dist-tag `next`) → graduation (`X.Y.Z`, dist-tag `latest`); one registry.
   - Dist-tag conventions and why `latest` only moves on release.
   - Consumer validation flow: pin exact `-dev.<sha>` in dev only while co-developing; graduate the pin to `^X.Y.Z` before prod.
   - Immutability (AR rejects duplicate versions; per-commit unique prereleases) + armed cleanup policy (untagged `-dev.*` > 30d deleted; keep 20 recent; tagged kept).
   - SA/security model: writer-only prerelease SA, protected triggers only, release lane is the only mover of `latest`, consumers read-only.
   - Trigger wiring (concrete): prod trigger `restaurant-core-prod` → `cloudbuild.yaml`; dev trigger in `kios-master` → `cloudbuild-prerelease.yaml`.
   - Rollback: git revert; registry still resolves.

4. **Library `CLAUDE.md`** — replace the "Publishing" section: two lanes, single registry, version-bump rule (base version still must be bumped per master release; prereleases are unique per commit automatically), link to PROMOTION.md.

5. **Root KIOS CLAUDE.md** (`/Users/jjcheng/WebstormProjects/KIOS/CLAUDE.md`) — update the CI/CD section so it no longer implies branch-based per-project publishing for this library. **Outside this git repo** — direct local edit, noted in PR body and shipping report.

6. **`package.json`** — bump version 1.11.0 → 1.11.1 (repo rule: bump per publish-triggering merge; 1.11.0 may already exist in AR).

## Tests / verification

No runtime code changes — verification is build/lint/test integrity plus lane proofs:

- **YAML validity:** parse both cloudbuild files (node js-yaml).
- **Lane proof (dry-run, per issue test strategy):** in a scratch copy, stamp `1.11.1-dev.<sha>` and run `npm publish --dry-run --tag next` → confirm computed version + tag; and `npm publish --dry-run --tag latest` on the plain version. (No registry write.)
- **Negative assertion (acceptance criterion):** `rg -n 'project-arya-280418|\$\{PROJECT_ID\}/npm-packages' cloudbuild*.yaml .npmrc` → zero matches (.npmrc doesn't exist in-repo; assert no checked-in .npmrc reintroduces it).
- **Project verification suite:** `npm install`, `npm run tsc`, `npx eslint src/`, `npm test` (vitest) — must pass (pre-existing failures noted, not fixed).
- **Docs check:** PROMOTION.md exists and covers graduation, dist-tags, consumer validation, immutability/cleanup, SA model; library CLAUDE.md links it; root CLAUDE.md CI/CD section corrected.
- **Manual (post-merge, not in this PR):** real dev build publishes `-dev.<sha>` under `next` without moving `latest`; real master build advances `latest`. These are deployment verifications listed in the PR test plan.

## Checklist

- [ ] Rewrite `cloudbuild.yaml`: registry pinned to `kios-master`, publish `--tag latest`, no serviceAccount field
- [ ] Create `cloudbuild-prerelease.yaml`: kios-master registry, `-dev.$SHORT_SHA` stamp, `--tag next`, prerelease SA + CLOUD_LOGGING_ONLY
- [ ] Create `PROMOTION.md` covering: model, dist-tags, consumer validation flow, immutability/cleanup, SA/security, trigger wiring, rollback
- [ ] Update library `CLAUDE.md` Publishing section (two lanes, single registry, link PROMOTION.md)
- [ ] Update root KIOS CLAUDE.md CI/CD section (local edit outside repo)
- [ ] Bump `package.json` version to 1.11.1
- [ ] Verify: YAML parse, dry-run lane proofs, negative-assertion grep, tsc + eslint + vitest

## Implementation Groups

Single group (one sub-project, one dependency chain). Size: **Small/Medium** (6 files incl. out-of-repo doc, 7 checklist items) → single-pass implementation with full verification at the end.
