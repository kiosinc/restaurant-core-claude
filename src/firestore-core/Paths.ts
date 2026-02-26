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
  semaphores = 'semaphores',
  inventory = 'inventory',

  orders = 'orders',
  locations = 'locations',

  onboarding = 'onboarding',
  onboardingOrders = 'onboardingOrders',
}
