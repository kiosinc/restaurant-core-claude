export interface SelectedValue {
  Id: string, // OptionSet Option Id
  name: string, // Name of the OptionSet Option
  price: number, // Price of the OptionSet Option
}

export interface OptionSetSelectedValues {
  Id: string, // OptionSet Id
  name: string,
  selectedValues: [SelectedValue], // The values selected
}

export class ShoppingCartItem {
  readonly productId: string;

  readonly productName: string;

  readonly optionSetsSelectedValues: [OptionSetSelectedValues]; // All the selections made

  readonly price: number;

  constructor(
    productId: string,
    productName: string,
    optionSetsSelectedValues: [OptionSetSelectedValues],
  ) {
    this.productId = productId;
    this.productName = productName;
    this.optionSetsSelectedValues = optionSetsSelectedValues;

    const prices = optionSetsSelectedValues
      .flatMap((selection) => selection.selectedValues
        .map((value) => value.price));

    this.price = prices.reduce((prev, curr) => prev + curr, 0);
  }

  readonly converter = ShoppingCartItem.firestoreConverter;

  static firestoreConverter = {
    toFirestore(content: ShoppingCartItem): FirebaseFirestore.DocumentData {
      return {
        productId: content.productId,
        productName: content.productName,
        optionSetsSelectedValues: JSON.parse(JSON.stringify(content.optionSetsSelectedValues)),
        price: content.price,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): ShoppingCartItem {
      const data = snapshot.data();
      return new ShoppingCartItem(
        data.productId,
        data.productName,
        data.optionSetsSelectedValues,
      );
    },
  };
}
