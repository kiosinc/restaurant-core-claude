# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@kiosinc/restaurant-core` is a TypeScript NPM library providing domain models and APIs for multi-location restaurant management. Built on Firebase/Firestore and Google Cloud infrastructure. Published as a CommonJS package with TypeScript declarations.

## Build Commands

- **Compile:** `npm run tsc` (runs `tsc -p tsconfig.json`, outputs to `lib/`)
- **Clean:** `npm run clean-lib` (removes `lib/`)
- **Local dev link:** `npm run link` (clean + compile + npm link)
- **Pre-publish:** `npm run pre-publish` (clean + compile)
- **Lint:** `npx eslint src/` (ESLint with airbnb-typescript config)

- **Test:** `npm test` (runs `vitest run`)
- **Test watch:** `npm run test:watch` (runs `vitest`)

Tests use Vitest with `globals: true`. Test files live in `__tests__/` directories alongside source code, matching `src/**/__tests__/**/*.test.ts`.

## Publishing

When creating a PR against `master` or `dev`, always bump the version in `package.json` before pushing. Artifact Registry rejects duplicate versions — every merge that triggers Cloud Build must have a unique version. Use semver patch bumps for fixes, minor for features.

## Verification

After adding or changing dependencies in `package.json`, always run `rm -rf node_modules && npm install` before compiling to ensure a clean dependency tree. Stale `node_modules` can mask missing or incorrect dependency configurations.

## Architecture

### Domain Structure

All business logic lives under `src/restaurant/` organized by subdomain:
- **roots/** — Aggregate root classes (Business, Catalog, Orders, Surfaces, Locations, ConnectedAccounts) that manage Firestore sub-collections
- **catalog/** — Products, Categories, OptionSets, Options, TaxRates, Discounts, ServiceCharges, InventoryCount
- **orders/** — OrderV3 (current order format), OrderSymbols (state enums)
- **surfaces/** — Menu, MenuGroup, KioskConfiguration, CheckoutOptions
- **locations/** — Location model with location-specific settings
- **connected-accounts/** — External integrations (Square POS), Event queue, Tokens

Supporting modules:
- **src/firestore-core/** — Base persistence classes and Firestore path constants
- **src/user/** — Express authentication middleware, JWT Claims, User model
- **src/reports/** — Daily metrics and location reports
- **src/utils/** — Google Cloud Tasks client, scheduling, geo, bigInt helpers

### Key Patterns

**Base classes:** Domain models extend `FirestoreObject` (v1) or `FirestoreObjectV2` (v2). V2 adds generic CRUD helpers and `businessId` support. Newer models use V2; older ones still use V1.

**Firestore converters:** Every model has a static `firestoreConverter` with `toFirestore()` and `fromFirestore()` methods for serialization.

**Static factory methods:** Models expose static `get()`, `find()`, and `collectionRef()` methods for data access. Most operations require a `businessId` for multi-tenancy.

**Metadata system:** `*Meta` classes (ProductMeta, CategoryMeta, etc.) track cross-document relationships via `metaLinks()` and `metadata()` methods on domain objects.

**LinkedObject:** Cross-collection references with external provider tracking (for Square POS sync).

**Event queue:** `Event` class manages sync state with `queueCap`, `queueCount`, and `isSync` properties. Events trigger Google Cloud Tasks via `createHttpTask()`.

**Collection paths:** `src/firestore-core/Paths.ts` centralizes all Firestore collection name constants.

### Entry Point

`src/index.ts` is the barrel export file. All public types and classes are re-exported here.

## Dependencies

All runtime dependencies (firebase-admin, @google-cloud/tasks, express, etc.) are in `devDependencies` because this is a library — consumers provide these as peer dependencies.
