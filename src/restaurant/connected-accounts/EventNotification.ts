import * as firebase from 'firebase-admin/database';
import * as Constants from '../../firestore-core/Constants';

export default class EventNotification {
  businessId: string;

  provider: Constants.Provider;

  type: string;

  meta: Record<string, unknown> | null;

  created: Date;

  Id: string;

  isNew: boolean | null;

  constructor(
    businessId: string,
    provider: Constants.Provider,
    type: string,
    Id: string,
    meta?: Record<string, unknown> | null,
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
          if (!value) {
            return JSON.parse(JSON.stringify(this.val()));
          }
          return undefined;
        },
        (error: Error | null, success: boolean, snapshot: firebase.DataSnapshot | null) => {
          if (error) {
            return reject(error);
          }
          this.isNew = success;
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
