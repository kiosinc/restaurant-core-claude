/** Constant strings */
export namespace Constants {
  export const enum Provider {
    square = 'square',
  }

  export const enum Role {
    admin = 'admin',
    owner = 'owner',
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

    catalog = 'catalog',
    categories = 'categories',
    products = 'products',
    attributes = 'attributes',
    customizationSets = 'customizationSets',
    discounts = 'discounts',

    taxRates = 'taxRates',

    services = 'services',

    surfaces = 'surfaces',
    menus = 'menus',
    menuGroups = 'menuGroups',
  }
}
