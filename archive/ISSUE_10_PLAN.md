# Plan: Add `managedBy` field to Menu and MenuGroup

## Context
Square Gateway's catalog sync creates Menu and MenuGroup documents from Square's MENU_CATEGORY objects. The frontend needs a flag to determine whether entities are externally managed (read-only) or user-created (editable). `managedBy: string | null` provides this — `"square"` means managed by Square sync, `null` means user-created.

## Changes

### 1. Menu model — `src/domain/surfaces/Menu.ts`
- Add `managedBy: string | null` to `MenuProps`
- Add `managedBy` property to `Menu` class
- Initialize in constructor with `props.managedBy ?? null`

### 2. MenuGroup model — `src/domain/surfaces/MenuGroup.ts`
- Add `managedBy: string | null` to `MenuGroupProps`
- Add `managedBy` property to `MenuGroup` class
- Initialize in constructor with `props.managedBy ?? null`

### 3. MenuRepository converter — `src/persistence/firestore/MenuRepository.ts`
- Add `managedBy: menu.managedBy` in `toFirestore()`
- Add `managedBy: data.managedBy ?? null` in `fromFirestore()`

### 4. MenuGroupRepository converter — `src/persistence/firestore/MenuGroupRepository.ts`
- Add `managedBy: menuGroup.managedBy` in `toFirestore()`
- Add `managedBy: data.managedBy ?? null` in `fromFirestore()`

### 5. Test fixtures — `src/domain/__tests__/helpers/SurfacesFixtures.ts`
- Add `managedBy: null` to `createTestMenuProps()` and `createTestMenuGroupProps()`

### 6. Menu tests — `src/domain/surfaces/__tests__/Menu.test.ts`
- Add test: constructs with `managedBy` value (e.g. `'square'`)
- Add test: defaults `managedBy` to `null` when omitted

### 7. MenuGroup tests — `src/domain/surfaces/__tests__/MenuGroup.test.ts`
- Add test: constructs with `managedBy` value
- Add test: defaults `managedBy` to `null` when omitted

### 8. MenuRepository tests — `src/persistence/firestore/__tests__/MenuRepository.test.ts`
- Add `managedBy` to serialization/round-trip assertions

### 9. MenuGroupRepository tests — `src/persistence/firestore/__tests__/MenuGroupRepository.test.ts`
- Add `managedBy` to serialization/round-trip assertions

No changes needed to `MenuMeta`/`MenuGroupMeta` (metadata projections don't need `managedBy`), `index.ts` exports, or `Constants.ts` (`Provider.square` already exists).

## Verification
- `npm run tsc` — compiles without errors
- `npm test` — all tests pass including new ones
