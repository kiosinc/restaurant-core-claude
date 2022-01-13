/** Constant strings */
export namespace Constants {
  export const enum Provider {
    square = 'square',
  }

  export const enum Role {
    sysadmin = 'sysadmin',
    owner = 'owner',
  }

  export const enum Semaphore {
    catalogUpdate = 'catalog.update',
    locationUpdate = 'location.update',
    inventoryUpdate = 'inventory.update',
    orderUpdate = 'order.update',
    paymentUpdate = 'payment.update',
  }
}

/** Constant path and collectionstrings used for firestore doc tree */
export namespace Paths {
  export const enum Environment {
    public = 'public',
    private = 'private',
    sandbox = 'sandbox',
  }

  export const enum CollectionNames {
    businesses = 'businesses',

    connectedAccounts = 'connectedAccounts',
    tokens = 'tokens',
    eventNotifications = 'eventNotifications',
    events = 'events',
    vars = 'vars',

    catalog = 'catalog',
    categories = 'categories',
    products = 'products',
    attributes = 'attributes',
    customizationSets = 'customizationSets',
    discounts = 'discounts',
    taxRates = 'taxRates',

    optionSets = 'optionSets',
    options = 'options',

    surfaces = 'surfaces',
    menus = 'menus',
    menuGroups = 'menuGroups',

    services = 'services',
    semaphores = 'semaphores',

    orders = 'orders',
    locations = 'locations',

    onboarding = 'onboarding',
    onboardingOrders = 'onboardingOrders',
  }
}
