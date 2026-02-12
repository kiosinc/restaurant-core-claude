/** Constant path and collectionstrings used for firestore doc tree */
export const enum Environment {
  public = 'public',
  private = 'private',
  sandbox = 'sandbox',
  featurelist = 'featurelist'
}

export const enum CollectionNames {
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
  services = 'services',
  semaphores = 'semaphores',

  orders = 'orders',
  locations = 'locations',

  onboarding = 'onboarding',
  onboardingOrders = 'onboardingOrders',
}
