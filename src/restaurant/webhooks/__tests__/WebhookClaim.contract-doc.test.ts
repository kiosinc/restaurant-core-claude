/**
 * Req 9 — the contract-TSDoc guard.
 *
 * rcc#165 was closed **because** `WebhookClaim.ts` carries the single canonical copy of the
 * P42 contract. Content quality ("a reviewer could reconstruct the contract from this file")
 * cannot be asserted, and is covered by the reviewer checklist instead. *Presence* can be
 * asserted, cheaply — so this file reads the module as text and fails if a future refactor
 * deletes a load-bearing section, which would otherwise be an invisible regression.
 *
 * These assertions are deliberately string-level and therefore brittle by design: a heading
 * rename is supposed to make someone look at this list.
 */
import { describe, it, expect } from 'vitest';
import { readWebhookClaimSource } from './helpers/claimFixtures';

const source = readWebhookClaimSource();

describe('WebhookClaim contract TSDoc (req 9)', () => {
  it('contract TSDoc: the file carries every required contract section heading', () => {
    const requiredSections = [
      // File header — what the primitive is, and the contract it *is*.
      '## What the primitive is',
      'restaurant-core-claude#165',
      'rcc#165',
      // Why the collection is top-level, and the no-cascade consequence.
      '## Collection: `webhookClaims/{eventId}` — top-level, deliberately',
      'claims do not cascade on\n * business delete',
      // Expiry read from stored fields, with both verified TTL caveats quoted.
      '## Expiry is read from stored fields, never from TTL',
      'Data is typically deleted within 24 hours after its expiration date.',
      'Expired documents continue to appear in queries and lookup requests until the TTL',
      // The payload rationale and its fidelity limits.
      '## Why `payload` is stored verbatim',
      '### Payload fidelity limits',
      'Cloud Tasks has **no dead-letter queue**',
      'cf#83',
      'HMAC',
      'Nested arrays',
      '__reserved__',
      // The two intentional divergences flagged for reviewers.
      '## Two intentional divergences from repo convention (for reviewers)',
      'instead of the repo\'s ISO-string convention',
      'Free functions instead of a static class',
      // The preferRest precondition.
      '## Precondition: REST transport must be off',
      'FIRESTORE_PREFER_REST',
      'firebase/firebase-admin-node#2587',
      // Coexistence with the legacy RTDB gate.
      '## Relationship to the legacy RTDB gate',
      // The acquire/branch table and the fencing rationale.
      '## Acquire / branch table',
      'Fencing tokens only work when the protected resource checks them',
      'kios-${eventId}-${phase}',
      'leaseGeneration',
      // Per-field semantics live on the WebhookClaim interface.
      '**a field, not a path segment, and may be absent.**',
      '**the recovery point.**',
      '**absent until completion**',
      'TTL input only',
    ];

    const missing = requiredSections.filter((section) => !source.includes(section));
    expect(missing).toEqual([]);
  });

  it('contract TSDoc: the acquire/branch table names all five outcomes and the 429', () => {
    const tableStart = source.indexOf('## Acquire / branch table');
    expect(tableStart).toBeGreaterThan(-1);
    const tableEnd = source.indexOf('## Handling it exhaustively', tableStart);
    expect(tableEnd).toBeGreaterThan(tableStart);
    const table = source.slice(tableStart, tableEnd);

    ['acquired', 'resumed', 'inFlight', 'done', 'failed'].forEach((outcome) => {
      expect(table).toContain(`\`${outcome}\``);
    });
    // Response codes: 429 for a live holder and for an unrecognised status, 200 for `failed`.
    expect(table).toContain('**429**');
    expect(table).toContain('**200**');
    expect(table).toContain('Skipping is never an outcome.');
    expect(table).toContain('Never treat as handled');
    expect(table).toContain('degrade to *retry*, never to *drop*');
  });
});
