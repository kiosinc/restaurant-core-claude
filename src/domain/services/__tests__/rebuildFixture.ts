/**
 * Test fixture for MenuRebuildService tests.
 * Based on anchor business SU5JWga8rcAomZBtpYY0 from dev environment.
 *
 * Structure:
 *   4 menus, 11 menuGroups, 9 collections, 39 products, 7 categories
 *
 * Key relationships:
 *   - Product ozil5WuJ4qeSGhwcusPS ("do not buy") appears in all 4 menus via group 0YRxtglWpkDyxcW8WCTD
 *   - Product hE0hUoKxy0KgplK5pfF8 ("Chicken 65") only in menu TdGQqmNhA3AjNeoyYrQn via group SKoGd62OfNyZqMXqsKSX
 *   - Collection I6XLVNjKrBAcBEmqQV0q ("signup") in menus CcUqgkBxEnk1qYaNZ3K2 and LShRjmDOXBNL7yVSD65V
 *   - Group lWWo8L7WmEiEJuZgf3dM mirrored to category dKlTguVV2yNCVFJjH2sH (9 products)
 */

export const BUSINESS_ID = 'SU5JWga8rcAomZBtpYY0';

// ─── Products ────────────────────────────────────────────────────────

function makeProduct(id: string, name: string, overrides?: Partial<Record<string, any>>) {
  return {
    id,
    data: {
      name,
      isActive: true,
      imageGsls: [],
      minPrice: 500,
      maxPrice: 500,
      variationCount: 1,
      description: `${name} description`,
      isDeleted: false,
      ...overrides,
    },
  };
}

// 39 products (IDs p1-p37, plus the two named products)
export const products: Array<{ id: string; data: Record<string, any> }> = [
  makeProduct('ozil5WuJ4qeSGhwcusPS', 'do not buy', { minPrice: 10, maxPrice: 10, description: 'do not buy description' }),
  makeProduct('hE0hUoKxy0KgplK5pfF8', 'Chicken 65', { minPrice: 800, maxPrice: 800, description: 'Spicy chicken' }),
  // Products for mirrored group (9 products in category dKlTguVV2yNCVFJjH2sH)
  makeProduct('mirP1', 'Mirror Product 1', { minPrice: 100 }),
  makeProduct('mirP2', 'Mirror Product 2', { minPrice: 200 }),
  makeProduct('mirP3', 'Mirror Product 3', { minPrice: 300 }),
  makeProduct('mirP4', 'Mirror Product 4', { minPrice: 400 }),
  makeProduct('mirP5', 'Mirror Product 5', { minPrice: 500 }),
  makeProduct('mirP6', 'Mirror Product 6', { minPrice: 600 }),
  makeProduct('mirP7', 'Mirror Product 7', { minPrice: 700 }),
  makeProduct('mirP8', 'Mirror Product 8', { minPrice: 800 }),
  makeProduct('mirP9', 'Mirror Product 9', { minPrice: 900 }),
  // Additional products for other groups
  makeProduct('p3', 'Samosa', { minPrice: 300 }),
  makeProduct('p4', 'Naan', { minPrice: 250 }),
  makeProduct('p5', 'Tikka Masala', { minPrice: 1200 }),
  makeProduct('p6', 'Biryani', { minPrice: 1100 }),
  makeProduct('p7', 'Paneer', { minPrice: 900 }),
  makeProduct('p8', 'Dosa', { minPrice: 700 }),
  makeProduct('p9', 'Idli', { minPrice: 400 }),
  makeProduct('p10', 'Vada', { minPrice: 350 }),
  makeProduct('p11', 'Chutney', { minPrice: 150 }),
  makeProduct('p12', 'Lassi', { minPrice: 500 }),
  makeProduct('p13', 'Chai', { minPrice: 300 }),
  makeProduct('p14', 'Gulab Jamun', { minPrice: 400 }),
  makeProduct('p15', 'Raita', { minPrice: 200 }),
  makeProduct('p16', 'Dal', { minPrice: 600 }),
  makeProduct('p17', 'Chapati', { minPrice: 100 }),
  makeProduct('p18', 'Tandoori Chicken', { minPrice: 1400 }),
  makeProduct('p19', 'Bhaji', { minPrice: 350 }),
  makeProduct('p20', 'Korma', { minPrice: 1100 }),
  makeProduct('p21', 'Vindaloo', { minPrice: 1300 }),
  makeProduct('p22', 'Paratha', { minPrice: 300 }),
  makeProduct('p23', 'Puri', { minPrice: 250 }),
  makeProduct('p24', 'Aloo Gobi', { minPrice: 800 }),
  makeProduct('p25', 'Chana Masala', { minPrice: 750 }),
  makeProduct('p26', 'Palak Paneer', { minPrice: 950 }),
  makeProduct('p27', 'Mango Lassi', { minPrice: 550 }),
  makeProduct('p28', 'Kulfi', { minPrice: 450 }),
];

// ─── Categories ──────────────────────────────────────────────────────

export const categories: Array<{ id: string; data: Record<string, any> }> = [
  {
    id: 'dKlTguVV2yNCVFJjH2sH',
    data: {
      name: 'Mirror Category',
      productDisplayOrder: ['mirP1', 'mirP2', 'mirP3', 'mirP4', 'mirP5', 'mirP6', 'mirP7', 'mirP8', 'mirP9'],
      isDeleted: false,
    },
  },
  { id: 'cat2', data: { name: 'Appetizers', productDisplayOrder: ['p3', 'p4'], isDeleted: false } },
  { id: 'cat3', data: { name: 'Main Course', productDisplayOrder: ['p5', 'p6', 'p7'], isDeleted: false } },
  { id: 'cat4', data: { name: 'Beverages', productDisplayOrder: ['p12', 'p13', 'p27'], isDeleted: false } },
  { id: 'cat5', data: { name: 'Desserts', productDisplayOrder: ['p14', 'p28'], isDeleted: false } },
  { id: 'cat6', data: { name: 'Breads', productDisplayOrder: ['p17', 'p22', 'p23'], isDeleted: false } },
  { id: 'cat7', data: { name: 'Sides', productDisplayOrder: ['p15', 'p16', 'p19'], isDeleted: false } },
];

// ─── Collections ─────────────────────────────────────────────────────

export const collections: Array<{ id: string; data: Record<string, any> }> = [
  {
    id: 'I6XLVNjKrBAcBEmqQV0q',
    data: {
      name: 'signup ',
      displayName: 'signup ',
      imageGsls: [],
      videoGsls: [],
      isUserInteractionEnabled: false,
      type: 'loyaltySignup',
      hyperlink: '://rewards',
      isDeleted: false,
    },
  },
  { id: 'col2', data: { name: 'promo', displayName: 'Promotions', imageGsls: ['gs://promo.jpg'], videoGsls: [], isUserInteractionEnabled: true, type: 'promotional', hyperlink: '://promo', isDeleted: false } },
  { id: 'col3', data: { name: 'featured', displayName: 'Featured', imageGsls: [], videoGsls: ['gs://feat.mp4'], isUserInteractionEnabled: true, type: 'featured', hyperlink: '://featured', isDeleted: false } },
  { id: 'col4', data: { name: 'seasonal', displayName: 'Seasonal', imageGsls: [], videoGsls: [], isUserInteractionEnabled: false, type: 'seasonal', hyperlink: '://seasonal', isDeleted: false } },
  { id: 'col5', data: { name: 'rewards', displayName: 'Rewards', imageGsls: [], videoGsls: [], isUserInteractionEnabled: true, type: 'rewards', hyperlink: '://rewards', isDeleted: false } },
  { id: 'col6', data: { name: 'banner1', displayName: 'Banner 1', imageGsls: ['gs://b1.jpg'], videoGsls: [], isUserInteractionEnabled: false, type: 'banner', hyperlink: '://banner1', isDeleted: false } },
  { id: 'col7', data: { name: 'banner2', displayName: 'Banner 2', imageGsls: [], videoGsls: [], isUserInteractionEnabled: false, type: 'banner', hyperlink: '://banner2', isDeleted: false } },
  { id: 'col8', data: { name: 'social', displayName: 'Social', imageGsls: [], videoGsls: [], isUserInteractionEnabled: true, type: 'social', hyperlink: '://social', isDeleted: false } },
  { id: 'col9', data: { name: 'about', displayName: 'About Us', imageGsls: [], videoGsls: [], isUserInteractionEnabled: false, type: 'about', hyperlink: '://about', isDeleted: false } },
];

// ─── Menu Groups ─────────────────────────────────────────────────────

export const menuGroups: Array<{ id: string; data: Record<string, any> }> = [
  {
    id: '0YRxtglWpkDyxcW8WCTD',
    data: {
      name: 'All Items',
      displayName: 'All Items',
      imageGsls: [],
      productDisplayOrder: ['ozil5WuJ4qeSGhwcusPS', 'p3', 'p4', 'p5', 'p6'],
      mirrorCategoryId: null,
      isDeleted: false,
    },
  },
  {
    id: 'SKoGd62OfNyZqMXqsKSX',
    data: {
      name: 'Chicken',
      displayName: 'Chicken Dishes',
      imageGsls: [],
      productDisplayOrder: ['hE0hUoKxy0KgplK5pfF8', 'p18'],
      mirrorCategoryId: null,
      isDeleted: false,
    },
  },
  {
    id: 'lWWo8L7WmEiEJuZgf3dM',
    data: {
      name: 'Mirrored Group',
      displayName: 'Mirrored',
      imageGsls: [],
      productDisplayOrder: ['mirP1', 'mirP2', 'mirP3', 'mirP4', 'mirP5', 'mirP6', 'mirP7', 'mirP8', 'mirP9'],
      mirrorCategoryId: 'dKlTguVV2yNCVFJjH2sH',
      isDeleted: false,
    },
  },
  { id: 'mg4', data: { name: 'Beverages', displayName: 'Drinks', imageGsls: [], productDisplayOrder: ['p12', 'p13', 'p27'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg5', data: { name: 'Desserts', displayName: 'Sweets', imageGsls: [], productDisplayOrder: ['p14', 'p28'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg6', data: { name: 'Breads', displayName: 'Bread Basket', imageGsls: [], productDisplayOrder: ['p17', 'p22', 'p23'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg7', data: { name: 'Sides', displayName: 'Side Dishes', imageGsls: [], productDisplayOrder: ['p15', 'p16', 'p19'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg8', data: { name: 'Vegetarian', displayName: 'Veg', imageGsls: [], productDisplayOrder: ['p7', 'p8', 'p9', 'p24', 'p25', 'p26'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg9', data: { name: 'Curries', displayName: 'Curry Selection', imageGsls: [], productDisplayOrder: ['p20', 'p21'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg10', data: { name: 'Snacks', displayName: 'Light Bites', imageGsls: [], productDisplayOrder: ['p10', 'p11'], mirrorCategoryId: null, isDeleted: false } },
  { id: 'mg11', data: { name: 'South Indian', displayName: 'South Indian', imageGsls: [], productDisplayOrder: ['p8', 'p9', 'p10'], mirrorCategoryId: null, isDeleted: false } },
];

// ─── Menus ───────────────────────────────────────────────────────────

export const menus: Array<{ id: string; data: Record<string, any> }> = [
  {
    id: 'CcUqgkBxEnk1qYaNZ3K2',
    data: {
      name: 'Main Menu',
      displayName: 'Main Menu',
      coverImageGsl: 'gs://main-cover.jpg',
      coverBackgroundImageGsl: null,
      coverVideoGsl: null,
      logoImageGsl: 'gs://logo.png',
      gratuityRates: [15, 18, 20],
      managedBy: 'square',
      isDeleted: false,
      created: new Date('2024-01-01'),
      updated: new Date('2024-06-01'),
      version: '2.0',
      groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'lWWo8L7WmEiEJuZgf3dM', 'mg4', 'mg5'],
      groups: {
        '0YRxtglWpkDyxcW8WCTD': { name: 'All Items', displayName: 'All Items' },
        lWWo8L7WmEiEJuZgf3dM: { name: 'Mirrored Group', displayName: 'Mirrored' },
        mg4: { name: 'Beverages', displayName: 'Drinks' },
        mg5: { name: 'Desserts', displayName: 'Sweets' },
      },
      menuAssets: {
        a1: { assetType: 'group', assetId: '0YRxtglWpkDyxcW8WCTD' },
        a2: { assetType: 'group', assetId: 'lWWo8L7WmEiEJuZgf3dM' },
        a3: { assetType: 'group', assetId: 'mg4' },
        a4: { assetType: 'group', assetId: 'mg5' },
        a5: { assetType: 'collection', assetId: 'I6XLVNjKrBAcBEmqQV0q' },
        a6: { assetType: 'collection', assetId: 'col2' },
      },
      menuAssetDisplayOrder: ['a1', 'a5', 'a2', 'a3', 'a4', 'a6'],
    },
  },
  {
    id: 'LShRjmDOXBNL7yVSD65V',
    data: {
      name: 'Lunch Menu',
      displayName: 'Lunch',
      coverImageGsl: 'gs://lunch-cover.jpg',
      coverBackgroundImageGsl: null,
      coverVideoGsl: null,
      logoImageGsl: null,
      gratuityRates: [15, 20],
      managedBy: null,
      isDeleted: false,
      created: new Date('2024-02-01'),
      updated: new Date('2024-06-01'),
      version: '2.0',
      groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'mg6', 'mg7'],
      groups: {
        '0YRxtglWpkDyxcW8WCTD': { name: 'All Items', displayName: 'All Items' },
        mg6: { name: 'Breads', displayName: 'Bread Basket' },
        mg7: { name: 'Sides', displayName: 'Side Dishes' },
      },
      menuAssets: {
        a1: { assetType: 'group', assetId: '0YRxtglWpkDyxcW8WCTD' },
        a2: { assetType: 'group', assetId: 'mg6' },
        a3: { assetType: 'group', assetId: 'mg7' },
        a4: { assetType: 'collection', assetId: 'I6XLVNjKrBAcBEmqQV0q' },
        a5: { assetType: 'collection', assetId: 'col3' },
      },
      menuAssetDisplayOrder: ['a1', 'a4', 'a2', 'a3', 'a5'],
    },
  },
  {
    id: 'TdGQqmNhA3AjNeoyYrQn',
    data: {
      name: 'Dinner Menu',
      displayName: 'Dinner',
      coverImageGsl: null,
      coverBackgroundImageGsl: 'gs://dinner-bg.jpg',
      coverVideoGsl: 'gs://dinner.mp4',
      logoImageGsl: null,
      gratuityRates: [18, 20, 25],
      managedBy: 'square',
      isDeleted: false,
      created: new Date('2024-03-01'),
      updated: new Date('2024-06-01'),
      version: '2.0',
      groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'SKoGd62OfNyZqMXqsKSX', 'mg8', 'mg9'],
      groups: {
        '0YRxtglWpkDyxcW8WCTD': { name: 'All Items', displayName: 'All Items' },
        SKoGd62OfNyZqMXqsKSX: { name: 'Chicken', displayName: 'Chicken Dishes' },
        mg8: { name: 'Vegetarian', displayName: 'Veg' },
        mg9: { name: 'Curries', displayName: 'Curry Selection' },
      },
      menuAssets: {
        a1: { assetType: 'group', assetId: '0YRxtglWpkDyxcW8WCTD' },
        a2: { assetType: 'group', assetId: 'SKoGd62OfNyZqMXqsKSX' },
        a3: { assetType: 'group', assetId: 'mg8' },
        a4: { assetType: 'group', assetId: 'mg9' },
        a5: { assetType: 'collection', assetId: 'col4' },
      },
      menuAssetDisplayOrder: ['a1', 'a2', 'a3', 'a4', 'a5'],
    },
  },
  {
    id: 'menu4',
    data: {
      name: 'Kiosk Menu',
      displayName: 'Kiosk',
      coverImageGsl: null,
      coverBackgroundImageGsl: null,
      coverVideoGsl: null,
      logoImageGsl: null,
      gratuityRates: [],
      managedBy: null,
      isDeleted: false,
      created: new Date('2024-04-01'),
      updated: new Date('2024-06-01'),
      version: '2.0',
      groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'mg10', 'mg11'],
      groups: {
        '0YRxtglWpkDyxcW8WCTD': { name: 'All Items', displayName: 'All Items' },
        mg10: { name: 'Snacks', displayName: 'Light Bites' },
        mg11: { name: 'South Indian', displayName: 'South Indian' },
      },
      menuAssets: {
        a1: { assetType: 'group', assetId: '0YRxtglWpkDyxcW8WCTD' },
        a2: { assetType: 'group', assetId: 'mg10' },
        a3: { assetType: 'group', assetId: 'mg11' },
        a4: { assetType: 'collection', assetId: 'col5' },
      },
      menuAssetDisplayOrder: ['a1', 'a2', 'a3', 'a4'],
    },
  },
];

