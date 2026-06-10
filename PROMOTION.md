# PROMOTION.md — dev → prod promotion of `@kiosinc/restaurant-core-claude`

This library is the artifact with a dev↔prod duality, so **it owns its own
dev→prod promotion**. Consuming services are thin consumers: they point at the
right package version and receive environment as injected config. This
document is the single home for promotion knowledge (per the P19 contract,
kiosinc/restaurant-core-claude#89).

## The model

```
dev branch     → publish PRERELEASE  X.Y.Z-dev.<short-sha>   (dist-tag: next)
master branch  → graduate to RELEASE X.Y.Z                   (dist-tag: latest)

…both to ONE registry: us-central1-npm.pkg.dev/kios-master/npm-packages
```

- **One registry** for all `@kiosinc/*` publish and consume, on both branches.
  Environment isolation is by **version**, never by registry.
- **Promotion = prerelease → release.** A change merged to `dev` is published
  as a per-commit prerelease. Merging `dev` to `master` graduates it: the same
  source publishes as the plain release version that prod consumes.
- **Only the release lane moves `latest`.** Prereleases publish under `next`.
  Semver range resolution (`^X.Y.Z`) excludes prereleases, so a prod consumer
  can never accidentally resolve a `-dev.*` version.

## Build lanes

| Lane | Trigger branch | Build config | Version published | Dist-tag | Identity |
|---|---|---|---|---|---|
| Prerelease | `dev` | `cloudbuild-prerelease.yaml` | `X.Y.Z-dev.<short-sha>` | `next` | `ar-prerelease-publisher@kios-master.iam.gserviceaccount.com` |
| Release | `master` | `cloudbuild.yaml` | `X.Y.Z` | `latest` | project default Cloud Build SA (`730024124565@cloudbuild.gserviceaccount.com`) |

The prerelease lane stamps the version at build time:
`<package.json version>-dev.<$SHORT_SHA>` via
`npm version --no-git-tag-version`. The stamp is never committed — the
repository always carries the plain base version.

### Trigger wiring (operational, kept in sync with this table)

- The **release** trigger is `restaurant-core-prod` in the `kios-master` GCP
  project, on push to `master`, referencing `cloudbuild.yaml`. It declares no
  per-trigger service account, so it runs as the project default Cloud Build
  SA, which already holds `roles/artifactregistry.writer`.
- The **prerelease** trigger must live in the `kios-master` GCP project
  (`cloudbuild-prerelease.yaml` declares the prerelease SA, and a build can
  only run as a service account in its own project), on push to `dev`,
  referencing `cloudbuild-prerelease.yaml`.
- Both triggers are **protected**: they fire only on pushes to their branch.
  Fork PRs never publish — there is no PR-triggered publish lane.

## Versioning rules

- **Bump the base version in `package.json` on every PR** that will reach
  `dev`/`master` (patch for fixes, minor for features). Artifact Registry
  versions are immutable — a release publish of an already-existing `X.Y.Z`
  fails the master build.
- Prerelease versions are unique per commit automatically (the short SHA is
  in the version), so repeated dev merges on the same base version each
  produce a distinct, immutable artifact.

## How a consumer validates an unreleased change

1. **Co-develop:** in the consuming service's **dev branch only**, pin the
   exact prerelease produced by the library's dev build:
   ```json
   "@kiosinc/restaurant-core-claude": "1.11.1-dev.ab12cd3"
   ```
   (Exact pin — never a range. `next` always points at the newest prerelease
   if you need to discover it: `npm view @kiosinc/restaurant-core-claude dist-tags`.)
2. **Validate** the service against the prerelease in the dev environment.
3. **Graduate before prod:** once the library change merges to `master` (and
   `X.Y.Z` is published under `latest`), change the service's pin back to the
   release range (`^X.Y.Z`) **before** the service's own dev→master promotion.
   A prod branch must never carry a `-dev.*` pin.

A prerelease and the eventual release of the same source commit unpack to
identical contents — graduation changes only the version label and dist-tag.

## Immutability and cleanup

- Artifact Registry rejects republishing an existing version. Nothing is ever
  overwritten; rollback is "depend on the previous version".
- A cleanup policy on `kios-master/npm-packages` bounds the prerelease
  footprint: untagged versions older than 30 days are deleted; the 20 most
  recent versions and all tagged versions are kept. Do not rely on a
  prerelease pin for longer than 30 days — graduate it.

## Security model

- The prerelease lane runs as a **publish-only** service account
  (`ar-prerelease-publisher@kios-master`): exactly one role,
  `roles/artifactregistry.writer` on the `npm-packages` repository — no
  delete, no admin. It runs only from the protected dev trigger, never from
  humans or fork PRs.
- Only the release lane (master trigger, default Cloud Build SA) publishes
  plain versions and moves `latest`.
- Consumers in both environments have **read-only** access
  (`roles/artifactregistry.reader`; the dev pipeline reads cross-project via
  its compute SA, granted in kiosinc/restaurant-core-claude#90).

## Rollback

- **Library change is bad:** `git revert` on the offending branch and let the
  lane publish the next version. Consumers move their pin/range; previously
  published versions remain available.
- **This promotion pipeline itself:** revert the P19 PR. The dev Artifact
  Registry (`project-arya-280418`) is not deleted until the P19 retirement
  conditions are met (see kiosinc/restaurant-core-claude#89), so the old
  per-project flow still resolves during any rollback window.
