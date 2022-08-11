/**
 * Models for report tasking
 */
export class ReportTaskEvent {
  businessId: string;

  idempotentKey: string;

  type: string;

  createdAt: string;

  data: any;

  constructor(businessId: string,
    type: string,
    idempotentKey: string,
    createdAt: Date,
    data: any = {}) {
    this.businessId = businessId;
    this.type = type;
    this.idempotentKey = idempotentKey;
    this.createdAt = createdAt.toISOString();
    this.data = data;
  }

  payload() {
    return JSON.stringify(this);
  }

  static eventId(type: string, idempotentKey: string, series?: number) {
    return `${idempotentKey}_${type}_${series ?? 0}`;
  }
}
