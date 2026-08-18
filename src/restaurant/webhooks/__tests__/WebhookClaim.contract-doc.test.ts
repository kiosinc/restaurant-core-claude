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
import { CLAIM_TTL_MS, MAX_EVENT_AGE_MS } from '../WebhookClaim';
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
      // The 24 h replay / 72 h retention distinction. Calling the 72 h TTL "the replay window"
      // overstates the recovery guarantee threefold and fails silently — a re-drive past 24 h
      // is refused before any write and answers 200. cf#83 bounds itself on the 24 h.
      '## Two windows: 24 h replay, 72 h retention — do not conflate them',
      'Replay is the tighter of the two, and it is the one that binds',
      'A replay job must bound itself on 24 h, not 72 h',
      'Data is typically deleted within 24 hours after its expiration date.',
      'Expired documents continue to appear in queries and lookup requests until the TTL',
      // The payload rationale and its fidelity limits. The promise is **semantic** fidelity —
      // no field selection, no value transformation — and explicitly NOT byte fidelity, since
      // Firestore sorts map keys. cf#83 reads this section as the replay contract.
      '## Why `payload` is stored verbatim',
      '### Payload fidelity limits',
      'What is promised: semantic fidelity',
      'no field selection, no value transformation',
      'What is explicitly NOT promised: byte fidelity',
      'not byte-identical',
      'cannot be re-verified against Square\'s HMAC signature',
      'signature verification must\n * stay at the receiver, before the claim exists',
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
      // Coexistence with the legacy RTDB gate, and the flag that retires it (rcc#167).
      '## Relationship to the legacy RTDB gate',
      '`writeLegacyEventNotification`',
      // The fencing precondition is type-enforced, not merely documented.
      '{@link ClaimFence}',
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

  it('contract TSDoc: the two windows table gives each constant its own role, and never calls the 72 h TTL the replay window', () => {
    // The numbers the prose commits to are the numbers the module ships.
    expect(MAX_EVENT_AGE_MS).toBe(24 * 60 * 60 * 1_000);
    expect(CLAIM_TTL_MS).toBe(72 * 60 * 60 * 1_000);
    // Replay is the tighter bound. If this ever inverts, the whole section is wrong.
    expect(MAX_EVENT_AGE_MS).toBeLessThan(CLAIM_TTL_MS);

    const start = source.indexOf('## Two windows');
    expect(start).toBeGreaterThan(-1);
    const table = source.slice(start, source.indexOf('## Why `payload` is stored verbatim', start));
    expect(table).toContain('{@link MAX_EVENT_AGE_MS}');
    expect(table).toContain('{@link CLAIM_TTL_MS}');
    expect(table).toContain('**24 h**');
    expect(table).toContain('**72 h**');
    expect(table).toContain('EventTooOldError');

    // The regression this section exists to prevent: 72 h described as the replay window.
    // (`\d` rather than a literal 72 so a future change of the retention length still trips it.)
    expect(source).not.toMatch(/\d+\s*h[^.]{0,80}the replay window/i);
    expect(source).not.toMatch(/CLAIM_TTL_MS[^;]{0,200}the replay window/i);
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
