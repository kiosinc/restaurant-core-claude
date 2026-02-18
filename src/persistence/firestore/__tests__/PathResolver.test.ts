import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track all paths constructed through mock chaining
let lastPath = '';

const mockCollectionRef = {
  doc: vi.fn((id: string) => {
    lastPath = `${lastPath}/${id}`;
    return { ...mockDocRef, path: lastPath };
  }),
  path: '',
};

const mockDocRef = {
  collection: vi.fn((name: string) => {
    lastPath = `${lastPath}/${name}`;
    return { ...mockCollectionRef, path: lastPath };
  }),
  path: '',
};

const mockDb = {
  collection: vi.fn((name: string) => {
    lastPath = name;
    return { ...mockCollectionRef, path: lastPath };
  }),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
}));

import { PathResolver } from '../PathResolver';

describe('PathResolver', () => {
  beforeEach(() => {
    lastPath = '';
  });

  it('businessDoc returns correct path', () => {
    PathResolver.businessDoc('biz-1');
    expect(lastPath).toBe('businesses/biz-1');
  });

  it('publicCollection returns correct path', () => {
    PathResolver.publicCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public');
  });

  it('privateCollection returns correct path', () => {
    PathResolver.privateCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private');
  });

  it('catalogDoc returns correct path', () => {
    PathResolver.catalogDoc('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/catalog');
  });

  it('surfacesDoc returns correct path', () => {
    PathResolver.surfacesDoc('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/surfaces');
  });

  it('ordersDoc returns correct path', () => {
    PathResolver.ordersDoc('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/orders');
  });

  it('productsCollection returns correct path', () => {
    PathResolver.productsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/catalog/products');
  });

  it('menusCollection returns correct path', () => {
    PathResolver.menusCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/surfaces/menus');
  });

  it('eventsCollection returns correct path', () => {
    PathResolver.eventsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/connectedAccounts/events');
  });

  it('taxRatesCollection returns correct path', () => {
    PathResolver.taxRatesCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/catalog/taxRates');
  });

  it('discountsCollection returns correct path', () => {
    PathResolver.discountsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/catalog/discounts');
  });

  it('serviceChargesCollection returns correct path', () => {
    PathResolver.serviceChargesCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/catalog/serviceCharges');
  });

  it('surfaceConfigurationsCollection returns correct path', () => {
    PathResolver.surfaceConfigurationsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/surfaces/surfaceConfigurations');
  });

  it('kioskConfigurationsCollection returns correct path', () => {
    PathResolver.kioskConfigurationsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/surfaces/kioskConfigurations');
  });

  it('checkoutOptionsCollection returns correct path', () => {
    PathResolver.checkoutOptionsCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/public/surfaces/checkoutOptions');
  });

  it('onboardingOrdersCollection returns correct path', () => {
    PathResolver.onboardingOrdersCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/onboarding/onboardingOrders');
  });

  it('varsDoc returns correct path', () => {
    PathResolver.varsDoc('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/vars');
  });

  it('semaphoresCollection returns correct path', () => {
    PathResolver.semaphoresCollection('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/vars/semaphores');
  });
});
