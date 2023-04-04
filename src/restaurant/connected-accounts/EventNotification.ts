import * as firebase from 'firebase-admin/database';
import * as Config from '../../firestore-core/config';

export default class EventNotification {
  businessId: string;

  provider: Config.Constants.Provider;

  type: string;

  meta: { [p: string]: any } | null;

  created: Date;

  Id: string;

  isNew: boolean | null;

  constructor(
    businessId: string,
    provider: Config.Constants.Provider,
    type: string,
    Id: string,
    meta?: { [p: string]: any } | null,
    created?: Date,
  ) {
    this.businessId = businessId;
    this.provider = provider;
    this.type = type;
    this.meta = meta ?? null;
    this.created = created ?? new Date();
    this.Id = Id;
    this.isNew = null;
  }

  refPath() {
    const notificationPath = `/private/notifications/${this.businessId}_${this.Id}`;
    const notificationRef = firebase.getDatabase().ref(notificationPath);
    return notificationRef;
  }

  val() {
    return {
      provider: this.provider,
      type: this.type,
      meta: this.meta,
      created: this.created,
    };
  }

  async init() {
    return new Promise<void>((resolve, reject) => {
      this.refPath().transaction(
        (value) => {
          // No value exists so update location with new value
          if (!value) {
            return JSON.parse(JSON.stringify(this.val()));
          }
          // value already exists so return for no change
          return undefined;
        },
        /**
         * A callback function that will be called when the transaction completes.
         * The callback is passed three arguments: a possibly-null Error, a boolean indicating whether the transaction was committed,
         * and a DataSnapshot indicating the final result.
         * If the transaction failed abnormally, the first argument will be an Error object indicating the failure cause.
         * If the transaction finished normally, but no data was committed because no data was returned from transactionUpdate, then second argument will be false.
         * If the transaction completed and committed data to Firebase, the second argument will be true.
         * Regardless, the third argument will be a DataSnapshot containing the resulting data in this location.
         */
        (error: Error | null, success: boolean, snapshot: firebase.DataSnapshot | null) => {
          if (error) {
            return reject(error);
          }
          // If data was written successfully, a new value was written
          this.isNew = success;
          // No data was written- overwrite this values with stored values
          if (!success && snapshot?.val()) {
            const data = snapshot.val();
            this.provider = data.provider ?? 'null';
            this.type = data.type ?? 'null';
            this.meta = data.meta ?? {};
            this.created = data.created ?? 'null';
          }
          return resolve();
        },
      );
    });
  }
}
