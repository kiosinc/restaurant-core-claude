# Changelog

All notable changes to `@kiosinc/restaurant-core-claude`. Versions are the `package.json` base
version: the `dev` lane publishes `X.Y.Z-dev.<sha>` under `next`, `master` graduates `X.Y.Z` to
`latest` (see PROMOTION.md). The format follows Keep a Changelog.

## [2.13.0]

P34 team invites replan — contract #239 (§1.1, §1.2, §1.5), issue #240.

### Added
- `Domain.Services.getRolloutAllowlists()`, `isTeamRolesV2Enabled(businessId)`,
  `clearRolloutAllowlistCache()`, `createRolloutAllowlistService()` and the `RolloutAllowlists`
  type — reader for `/config/rolloutAllowlists`, 60 s cache, string entries only (#239 §1.1).
- `Authorization.AuthorizationOptions.resolveLocationId` — sync or async, consulted before
  `req.params[locationIdParam]`; `undefined` falls back to the param, `''` does not (`??`), and no
  value from either ⇒ 400; a throw or rejection is forwarded to `next(err)` and never grants;
  sysadmin ordering unchanged (#239 §1.2).
- `BusinessInvitation.name?` (trimmed, 1–80, absent when not supplied), accepted by
  `createBusinessInvitation`, round-tripped by `invitationConverter`; `INVITE_NAME_MAX_LENGTH` (#239 §1.5).

### Unchanged by design
- `BusinessMember` (D8); `getFlags()` stays booleans-only; no guard reads a flag.
- `BusinessData` is not a library type — its `member?` (#239 §1.3) lives in businesses.
