import {FirestoreObject} from "../Core/FirestoreObject";
import * as SquareConnect from "square-connect";
import {LinkedObject, LinkedObjectSyncResult} from "../Core/LinkedObject";
import {CustomizationSet, CustomizationSetMeta, CustomizationSetOption} from "./CustomizationSet";
import {Category} from "./Category";
import {Attribute, AttributeMeta} from "./Attribute";
import {Catalog} from "../Roots/Catalog";
import {firestoreApp, FirestorePaths} from "../../firebaseApp";
import {MenuGroup} from "../Surfaces/MenuGroup";

export class Product extends FirestoreObject<Id> {
    // The product’s name, meant to be displayable to the customer.
    name: string
    // A short one-line description of the product, meant to be displayable to the customer.
    caption: string
    // The product’s description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.
    description: string
    // A list of URLs of images for this product, meant to be displayable to the customer.
    imageUrls: URL[]
    // Product data
    attributes: { [Id: string]: AttributeMeta }
    customizations: { [Id: string]: CustomizationSetMeta }
    customizationsSetting: { [Id: string]: ProductCustomizationSetting }

    // Whether the product is currently available for purchase.
    isActive: boolean

    linkedObjects: { [Id: string]: LinkedObject }

    constructor(
        name: string,
        caption: string,
        description: string,
        imageUrls: URL[],
        attributes: { [p: string]: AttributeMeta },
        customizations: { [p: string]: CustomizationSetMeta },
        customizationsSetting: { [p: string]: ProductCustomizationSetting },
        isActive: boolean,
        linkedObjects: { [p: string]: LinkedObject },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id) {
        super(created, updated, isDeleted, Id)
        this.name = name
        this.caption = caption
        this.description = description
        this.imageUrls = imageUrls
        this.attributes = attributes
        this.customizations = customizations
        this.customizationsSetting = customizationsSetting
        this.isActive = isActive
        this.linkedObjects = linkedObjects
    }

    // FirestoreAdapter

    readonly converter = Product.firestoreConverter;

    collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Product.collectionRef(businessId);
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map([
            [Catalog.docRef(businessId).path, FirestorePaths.CollectionNames.products + "." + this.Id]
        ]);
    }

    metadata(): ProductMeta {
        return {
            name: this.name,
            isActive: this.isActive
        }
    }

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.products)
    }

    static firestoreConverter = {
        toFirestore(product: Product): FirebaseFirestore.DocumentData {
            return {
                name: product.name,
                caption: product.caption,
                description: product.description,
                imageUrls: JSON.parse(JSON.stringify(product.imageUrls)),
                attributes: JSON.parse(JSON.stringify(product.attributes)),
                customizations: JSON.parse(JSON.stringify(product.customizations)),
                customizationsSetting: JSON.parse(JSON.stringify(product.customizationsSetting)),
                isActive: product.isActive,
                linkedObjects: JSON.parse(JSON.stringify(product.linkedObjects)),
                created: product.created.toISOString(),
                updated: product.updated.toISOString(),
                isDeleted: product.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Product {
            const data = snapshot.data();
            return new Product(
                data.name,
                data.caption,
                data.description,
                data.imageUrls,
                data.attributes,
                data.customizations,
                data.customizationsSetting,
                data.isActive,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                snapshot.id)
        },
        fromDocumentData(documentId: Id, data: FirebaseFirestore.DocumentData): Product {
            return new Product(
                data.name,
                data.caption,
                data.description,
                data.imageUrls,
                data.attributes,
                data.customizations,
                data.customizationsSetting,
                data.isActive,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                documentId)
        }
    }

    // Find LinkedObject
    static async upsertSquareCatalogObject(object: SquareConnect.CatalogObject, businessId: Id, relatedObjects?: SquareConnect.CatalogObject[])
        : Promise<LinkedObjectSyncResult<Product>> {
        const provider = Provider.square

        const itemData = object.item_data
        if (!itemData) {
            throw new Error("Item data is missing for Item " + object.id);
        }

        if (itemData.product_type !== "REGULAR") {
            throw new Error("Unhandled item data type " + itemData.product_type + " ID: " + object.id)
        }

        const isSourceMarkedDelete = object.is_deleted as boolean
        let product = await LinkedObject.find(object.id, provider, Product.collectionRef(businessId), Product.firestoreConverter)
            .then(data => data as Product)

        const isSyncStop = LinkedObject.shouldStopSync(product, provider, isSourceMarkedDelete, businessId) as LinkedObjectSyncResult<Product>
        if (isSyncStop) {
            return isSyncStop
        }

        // Get item properties
        const name = Object.is(itemData.name, undefined) ? "" : itemData.name as string;
        const description = Object.is(itemData.description, undefined) ? "" : itemData.description as string;
        const isActive = Object.is(itemData.available_for_pickup, undefined) ? true : itemData.available_for_pickup as boolean;

        // IMAGE
        // Image is reference in super object, and stored in 'related_objects' of response
        const squareImageId = object.image_id;
        let squareImageData: SquareConnect.CatalogImage[] = [];
        if ((squareImageId) && (relatedObjects)) {
            squareImageData = relatedObjects.filter(object => object.id === squareImageId)
                .map(object => object.image_data).filter(imageData => !Object.is(imageData, undefined)) as SquareConnect.CatalogImage[];
        }
        const imageUrls = squareImageData.filter(imageData => !Object.is(imageData.url, undefined)).map(imageData => new URL(imageData.url as string)) as URL[];

        // TAX
        // const squareTaxIds = itemData.tax_ids

        // CATEGORY
        // Find/Create category
        const squareCategoryId = itemData.category_id      // Square POS only supports one category

        // VARIATIONS
        // Variation data is embedded in the Catalog Object, so extract and create objects from it to attach to product
        let attributes: { [Id: string]: AttributeMeta } = {};

        try {
            await Attribute.upsertSquareCatalogObject(object, businessId)
                .then(result => {
                    const attribute = result.object as Attribute
                    if (attribute) {
                        attributes[attribute.Id] = attribute.metadata()
                    }
                })
        } catch (error) {
            throw error
        }

        // MODIFIERS
        // For each modifier list info create a customization set and attach it
        let customizationSets: { [Id: string]: CustomizationSetMeta } = {};
        // For each modifier_overrides create a customization setting and attach it
        let customizationsSetting: { [Id: string]: ProductCustomizationSetting } = {}

        try {

            const squareModifierListInfo = itemData.modifier_list_info

            if (squareModifierListInfo) {
                // For each modifier
                for (const info of squareModifierListInfo) {
                    // General
                    const isActive = Object.is(info.enabled, undefined) ? true : info.enabled as boolean;
                    const minSelected = Object.is(info.min_selected_modifiers, undefined) ? -1 : info.min_selected_modifiers as number;
                    const maxSelected = Object.is(info.max_selected_modifiers, undefined) ? -1 : info.max_selected_modifiers as number;

                    // Find  customization set linked to Square modifier list/set
                    const squareModifierListId = info.modifier_list_id

                    await LinkedObject.find(squareModifierListId, provider, CustomizationSet.collectionRef(businessId), CustomizationSet.firestoreConverter)
                        .then(data => {
                            const customizationSet = data as CustomizationSet;
                            if (customizationSet) {

                                // Add it as a customization set for the product
                                customizationSets[customizationSet.Id] = customizationSet.metadata();

                                // Get list of pre selected values by cross referencing Square's modifier option ID
                                const preselected: Id[] = []
                                const options = customizationSet.options
                                info.modifier_overrides?.filter(override => Object.is(override.on_by_default, undefined) ? false : override.on_by_default as boolean)
                                    .forEach(override => {
                                        const modifierId = override.modifier_id

                                        // Search through customization set options (and match the modifierId to the optionId)
                                        const customizationSetOptionIds = Object.keys(options).filter(Id => {
                                            const option = options[Id] as CustomizationSetOption;
                                            const squareLinkedObject = option.linkedObjects[provider];
                                            if (squareLinkedObject) {
                                                return squareLinkedObject.linkedObjectId === modifierId
                                            }
                                            return false
                                        })
                                        preselected.concat(customizationSetOptionIds);
                                    })

                                const setting: ProductCustomizationSetting = {
                                    minSelection: minSelected,
                                    maxSelection: maxSelected,
                                    preSelected: preselected,
                                    displayOrder: customizationSet.displayOrder,    // Follow global display ordering
                                    isActive: isActive
                                }

                                // if modifier is single selection enabled
                                // Override for single selection customizations (square)

                                // Get global modifier list data (selection settings)
                                if (relatedObjects) {
                                    const modifierList = relatedObjects.find(object => object.id === squareModifierListId)//.modifier_list_data
                                    if (modifierList && modifierList.modifier_list_data) {
                                        const modifierListData = modifierList.modifier_list_data

                                        if (modifierListData.selection_type === "SINGLE") {
                                            setting.minSelection = 0
                                            setting.maxSelection = 1

                                            // Sort to get first element
                                            const sorted = Object.entries(customizationSet.options)
                                                .sort((a, b) => a[1].displayOrder - b[1].displayOrder)
                                                .map((value) => value[0])

                                            setting.preSelected = sorted[0] ? [sorted[0]] : []
                                        }
                                    }
                                }

                                customizationsSetting[customizationSet.Id] = setting
                            } else {
                                throw new Error(`LinkedObject for ModifierList ${squareModifierListId} not found`)
                            }
                        })
                }
            }
        } catch (error) {
            throw error
        }

        if (product) {
            // if Product exists, update
            product.name = name
            product.description = description
            product.imageUrls = imageUrls;
            product.attributes = attributes;
            product.customizationsSetting = customizationsSetting
        } else {
            // if Product does not exist, create
            const linkedObject: LinkedObject = {
                linkedObjectId: object.id,
                isSyncActive: true
            }

            product = new Product(name, "", description, imageUrls, attributes, customizationSets, customizationsSetting, isActive, {[provider]: linkedObject})
        }

        return product.set(businessId, squareCategoryId, provider)
            .then(() => new LinkedObjectSyncResult(true, product))
    }

    // Save down product
    // And add it to the category to the specified category, if any
    async set(businessId: Id, categoryId?: Id, provider?: Provider) {
        return super.set(businessId)
            .then((businessDocRef) => {
                // Add to related categories if info is provided
                if (categoryId && provider) {
                    // Setup
                    const categoryConverter = Category.firestoreConverter
                    const query = LinkedObject.findQuery(categoryId, provider, Category.collectionRef(businessId), categoryConverter)

                    // Run as transaction as many concurrent read/writes may occur during sync
                    return firestoreApp.runTransaction(async (t) => {
                        try {
                            // Get the related category ref, if any
                            await t.get(query).then(snapshot => {
                                if (snapshot.empty) {
                                    return  // No categories found matching query
                                } else if (snapshot.docs.length > 1) {
                                    throw new Error("Error: there is more than one Category with the same linkedID")
                                }

                                // Add the product to the category
                                const categoryDocRef = snapshot.docs[0]
                                const category = categoryDocRef.data() as Category
                                category.products[this.Id] = this.metadata()

                                const productDisplayOrder = category.productDisplayOrder.findIndex((value) => value === this.Id)
                                if (productDisplayOrder < 0) {
                                    category.productDisplayOrder.push(this.Id)
                                }

                                // Complete the transaction
                                t.set(categoryDocRef.ref.withConverter(categoryConverter), category)
                            })
                        } catch (error) {
                            throw error
                        }
                    }).then(() => businessDocRef)
                }
                return businessDocRef
            })
    }

    // First delete relationships:
    // MenuGroups
    // Category
    // Then delete product
    // Then delete attribute
    deletePermanent(businessId: Id) {
        return firestoreApp.runTransaction(async (t) => {
            try {
                // First delete relationships:
                // MenuGroups
                const menuGroupQuery = MenuGroup.collectionRef(businessId).where("productDisplayOrder", "array-contains", this.Id)
                    .withConverter(MenuGroup.firestoreConverter)

                await t.get(menuGroupQuery).then(snapshot => {
                    if (snapshot.empty) {
                        return
                    }
                    // Remove from each menu group
                    snapshot.docs.forEach((menuGroupSnapshot) => {
                        const menuGroup = menuGroupSnapshot.data()
                        delete menuGroup.products[this.Id]
                        const idx = menuGroup.productDisplayOrder.indexOf(this.Id)
                        if (idx > 0) {
                            menuGroup.productDisplayOrder.splice(idx, 1)
                        }
                        // Update menu group
                        t.set(menuGroupSnapshot.ref, menuGroup)
                    })
                })


                // Category
                const categoryQuery = Category.collectionRef(businessId).where("productDisplayOrder", "array-contains", this.Id)
                    .withConverter(Category.firestoreConverter)
                await t.get(categoryQuery).then(snapshot => {
                    if (snapshot.empty) {
                        return
                    }
                    // Remove from each menu group
                    snapshot.docs.forEach((categorySnapshot) => {
                        const category = categorySnapshot.data()
                        delete category.products[this.Id]
                        const idx = category.productDisplayOrder.indexOf(this.Id)
                        if (idx > 0) {
                            category.productDisplayOrder.splice(idx, 1)
                        }

                        // Update menu group
                        t.set(categorySnapshot.ref, category)
                    })
                })

                // Then delete attribute
                const attributeIds = Object.keys(this.attributes)
                const attributeDocRefs = attributeIds.map((id) => Attribute.collectionRef(businessId).withConverter(Attribute.firestoreConverter).doc(id))
                await t.getAll(...attributeDocRefs)
                    .then((snapshots) => {
                    // For each attribute snapshot
                    snapshots.forEach((attributeSnapshot) => {
                        if (attributeSnapshot.exists) {
                            const attribute = attributeSnapshot.data() as Attribute
                            attribute.deletePermanentTransaction(businessId, t)
                        }
                    })
                })

                // Then delete product
                this.deletePermanentTransaction(businessId, t)
            } catch (error) {
                throw error
            }
        })
    }
}

export interface ProductMeta {
    name: string;
    isActive: boolean;
}

export interface ProductCustomizationSetting {
    minSelection: number
    maxSelection: number
    preSelected: Id[]
    displayOrder: number
    isActive: boolean
}