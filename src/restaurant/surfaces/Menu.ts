import { FirestoreObject } from '../../firestore-core'
import Surfaces from '../roots/Surfaces'
import MenuGroupMeta from './MenuGroupMeta'
import MenuMeta from './MenuMeta'
import * as Paths from '../../firestore-core/Paths'

export default class Menu extends FirestoreObject {
  static firestoreConverter = {
    toFirestore (menu: Menu): FirebaseFirestore.DocumentData {
      return {
        name: menu.name,
        displayName: menu.displayName,
        groups: JSON.parse(JSON.stringify(menu.groups)),
        groupDisplayOrder: JSON.parse(JSON.stringify(menu.groupDisplayOrder)),
        coverImageGsl: menu.coverImageGsl,
        coverBackgroundImageGsl: menu.coverBackgroundImageGsl,
        coverVideoGsl: menu.coverVideoGsl,
        logoImageGsl: menu.logoImageGsl,
        gratuityRates: JSON.parse(JSON.stringify(menu.gratuityRates)),
        created: menu.created.toISOString(),
        updated: menu.updated.toISOString(),
        isDeleted: menu.isDeleted,
      }
    },
    fromFirestore (snapshot: FirebaseFirestore.QueryDocumentSnapshot): Menu {
      const data = snapshot.data()

      return new Menu(
        data.name,
        data.displayName,
        data.groups,
        data.groupDisplayOrder,
        data.coverImageGsl ?? null,
        data.coverBackgroundImageGsl ?? null,
        data.coverVideoGsl ?? null,
        data.logoImageGsl ?? null,
        data.gratuityRates ?? null,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      )
    },
  }
  name: string
  displayName: string | null
  groups: { [Id: string]: MenuGroupMeta }
  groupDisplayOrder: string[]
  coverImageGsl: string | null
  coverBackgroundImageGsl: string | null
  coverVideoGsl: string | null
  logoImageGsl: string | null
  gratuityRates: number[]

  constructor (
    name: string,
    displayName: string | null,
    groups: { [p: string]: MenuGroupMeta },
    groupDisplayOrder: string[],
    coverImageGsl: string | null,
    coverBackgroundImageGsl: string | null,
    coverVideoGsl: string | null,
    logoImageGsl: string | null,
    gratuityRates: number[] | null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({ created, updated, isDeleted, Id })

    this.name = name
    this.displayName = displayName
    this.groups = groups
    this.groupDisplayOrder = groupDisplayOrder
    this.coverImageGsl = coverImageGsl
    this.coverBackgroundImageGsl = coverBackgroundImageGsl
    this.coverVideoGsl = coverVideoGsl
    this.logoImageGsl = logoImageGsl
    this.gratuityRates = gratuityRates ?? []
  }

  static collectionRef (businessId: string): FirebaseFirestore.CollectionReference {
    return Surfaces.docRef(businessId).
      collection(Paths.CollectionNames.menus)
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef (businessId: string) {
    return Menu.collectionRef(businessId)
  }

  // STATICS

  metaLinks (businessId: string): { [p: string]: string } {
    return {
      [Surfaces.docRef(
        businessId).path]: `${Paths.CollectionNames.menus}.${this.Id}`,
    }
  }

  metadata (): MenuMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    }
  }
}
