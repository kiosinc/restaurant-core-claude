/** Constant path and collectionstrings used for firestore doc tree */
export enum Environment {
  public = 'public',
  private = 'private',
  sandbox = 'sandbox',
  featurelist = 'featurelist'
}

export enum CollectionNames {
  businesses = 'businesses',

  connectedAccounts = 'connectedAccounts',
  tokens = 'tokens',
  events = 'events',
  vars = 'vars',

  catalog = 'catalog',
  categories = 'categories',
  products = 'products',
  discounts = 'discounts',
  taxRates = 'taxRates',
  serviceCharges = 'serviceCharges',

  optionSets = 'optionSets',
  options = 'options',

  surfaces = 'surfaces',
  menus = 'menus',
  menuGroups = 'menuGroups',
  kioskConfigurations = 'kioskConfigurations',
  surfaceConfigurations = 'surfaceConfigurations',
  checkoutOptions = 'checkoutOptions',
  collections = 'collections',
  services = 'services',
  inventory = 'inventory',
  // P41: per-entity availability entries under `catalog/inventory/{locationId}` (rcc#162 §1).
  entries = 'entries',

  orders = 'orders',
  locations = 'locations',

  onboarding = 'onboarding',
  onboardingOrders = 'onboardingOrders',

  // P34 team invitations (contract rcc#130 §1.1, as corrected by rcc#131 D1). One member names
  // both the interposed `private/invitations` root doc and the collection of `{inviteId}`
  // documents beneath it, exactly as `orders` does: the contract's five-segment path would land
  // `{inviteId}` on a collection, which is not a legal Firestore document path.
  invitations = 'invitations',

  semaphores = 'semaphores',
  webhookClaims = 'webhookClaims',
}
