/** Constant strings */
export namespace Constants {
  export const enum Provider {
    square = 'square',
  }

  export const enum Role {
    admin = 'admin',
    owner = 'owner',
  }

  export const enum Semaphore {
    catalogUpdate = 'catalog.update',
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

    surfaces = 'surfaces',
    menus = 'menus',
    menuGroups = 'menuGroups',

    services = 'services',
    semaphores = 'semaphores',

    orders = 'orders',
  }
}
