import { OrderItem } from './OrderItem';

export default class OrderLineItem {
  readonly item: OrderItem;

  readonly quantity: number;

  constructor(
    item: OrderItem,
    quantity: number,
  ) {
    this.item = item;
    this.quantity = quantity;
  }

  readonly converter = OrderLineItem.firestoreConverter;

  static firestoreConverter = {
    toFirestore(content: OrderLineItem): FirebaseFirestore.DocumentData {
      return {
        item: OrderItem.firestoreConverter.toFirestore(content.item),
        quantity: content.quantity,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): OrderLineItem {
      const data = snapshot.data();
      const orderItem = data.item as OrderItem;
      return new OrderLineItem(
        orderItem,
        data.quantity,
      );
    },
  };
}
