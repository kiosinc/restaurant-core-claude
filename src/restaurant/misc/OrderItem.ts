export interface SelectedValue {
  name: string, // Name of the OptionSet Option
  price: number, // Price of the OptionSet Option
  ordinal: number, // Zero based ordinal of the value
}

export interface OptionSetSelected {
  name: string,
  selectedValues: { [Id: string]: SelectedValue }, // OptionSet Option Id key: The values selected
  ordinal: number, // Zero based ordinal of the option set
}

export class OrderItem {
  readonly productId: string;

  readonly productName: string;

  readonly optionSetsSelected: { [Id: string]: OptionSetSelected };
  // OptionSet Id key: All the selections made

  readonly price: number;

  constructor(
    productId: string,
    productName: string,
    optionSetsSelected: { [Id: string]: OptionSetSelected },
  ) {
    this.productId = productId;
    this.productName = productName;
    this.optionSetsSelected = optionSetsSelected;

    const prices = Object.values(optionSetsSelected)
      .flatMap((selection) => Object.values(selection.selectedValues))
      .map((value) => value.price);

    this.price = prices.reduce((prev, curr) => prev + curr, 0);
  }

  readonly converter = OrderItem.firestoreConverter;

  static firestoreConverter = {
    toFirestore(content: OrderItem): FirebaseFirestore.DocumentData {
      return {
        productId: content.productId,
        productName: content.productName,
        optionSetsSelected: JSON.parse(JSON.stringify(content.optionSetsSelected)),
        price: content.price,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): OrderItem {
      const data = snapshot.data();
      return new OrderItem(
        data.productId,
        data.productName,
        data.optionSetsSelected,
      );
    },
  };
}
