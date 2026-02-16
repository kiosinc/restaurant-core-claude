import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Event, createEvent, eventIdentifier } from '../../../domain/connected-accounts/Event';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { eventConverter } from '../converters/eventConverter';
import { createTestEventInput } from '../../../domain/__tests__/helpers/EventFixtures';
import { mockTransaction, mockDocRef, mockCollectionRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('EventRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<Event>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<Event>(eventConverter, registry);
  });

  it('get() returns Event when doc exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        provider: 'square', type: 'catalog', isSync: true,
        queueCap: 5, queueCount: 3, timestamp: ts,
        created: ts, updated: ts, isDeleted: false,
      }),
      id: 'square.catalog',
    });

    const result = await repo.get('biz-1', 'square.catalog');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('square');
    expect(result!.type).toBe('catalog');
    expect(result!.isSync).toBe(true);
    expect(result!.queueCap).toBe(5);
    expect(result!.queueCount).toBe(3);
    expect(result!.timestamp).toEqual(new Date(ts));
    expect(result!.Id).toBe('square.catalog');
  });

  it('get() returns null when doc missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const result = await repo.get('biz-1', 'nonexistent');
    expect(result).toBeNull();
  });

  it('set() calls toFirestore with correct data', async () => {
    const event = createEvent(createTestEventInput({
      queueCap: 5, queueCount: 3,
      timestamp: new Date('2024-01-15T10:00:00Z'),
      created: new Date('2024-01-01T00:00:00Z'),
      updated: new Date('2024-01-01T00:00:00Z'),
    }));

    await repo.set(event, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.provider).toBe('square');
    expect(data.type).toBe('catalog');
    expect(data.isSync).toBe(true);
    expect(data.queueCap).toBe(5);
    expect(data.queueCount).toBe(3);
  });

  it('set() serializes timestamp as ISO string', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const event = createEvent(createTestEventInput({ timestamp: ts }));
    await repo.set(event, 'biz-1');
    expect(mockTransaction.set.mock.calls[0][1].timestamp).toBe('2024-06-01T12:00:00.000Z');
  });

  it('set() serializes empty timestamp as empty string', async () => {
    const event = createEvent(createTestEventInput());
    await repo.set(event, 'biz-1');
    expect(mockTransaction.set.mock.calls[0][1].timestamp).toBe('');
  });

  it('set() runs transaction (no metadata)', async () => {
    const event = createEvent(createTestEventInput());
    await repo.set(event, 'biz-1');
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('findByProviderAndType via eventIdentifier + get', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        provider: 'square', type: 'catalog', isSync: true,
        queueCap: -1, queueCount: 0, timestamp: '',
        created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z',
        isDeleted: false,
      }),
      id: 'square.catalog',
    });

    const id = eventIdentifier('square', 'catalog');
    const result = await repo.get('biz-1', id);

    expect(mockCollectionRef.doc).toHaveBeenCalledWith('square.catalog');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('square');
  });

  it('findByProviderAndType returns null when not found', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const id = eventIdentifier('square', 'nonexistent');
    const result = await repo.get('biz-1', id);
    expect(result).toBeNull();
  });

  it('round-trip: toFirestore -> fromFirestore preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createEvent(createTestEventInput({
      queueCap: 10, queueCount: 7, timestamp: ts,
      Id: 'square.catalog',
      created: new Date('2024-01-01T00:00:00Z'),
      updated: new Date('2024-01-02T00:00:00Z'),
    }));

    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];

    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => serialized, id: 'square.catalog',
    });
    const restored = await repo.get('biz-1', 'square.catalog');

    expect(restored!.provider).toBe(original.provider);
    expect(restored!.type).toBe(original.type);
    expect(restored!.isSync).toBe(original.isSync);
    expect(restored!.queueCap).toBe(original.queueCap);
    expect(restored!.queueCount).toBe(original.queueCount);
    expect(restored!.timestamp!.getTime()).toBe(original.timestamp!.getTime());
    expect(restored!.Id).toBe(original.Id);
  });

  it('handles undefined queueCap in fromFirestore', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        provider: 'square', type: 'catalog', isSync: true,
        timestamp: '', created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z', isDeleted: false,
      }),
      id: 'square.catalog',
    });
    const result = await repo.get('biz-1', 'square.catalog');
    expect(result!.queueCap).toBe(-1);
  });

  it('handles undefined queueCount in fromFirestore', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        provider: 'square', type: 'catalog', isSync: true,
        queueCap: 5, timestamp: '', created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z', isDeleted: false,
      }),
      id: 'square.catalog',
    });
    const result = await repo.get('biz-1', 'square.catalog');
    expect(result!.queueCount).toBe(0);
  });
});
