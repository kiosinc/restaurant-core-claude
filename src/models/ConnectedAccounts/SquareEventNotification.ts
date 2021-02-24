
export enum SquareEventType {
    catalog = "catalog.version.updated",
    oauth = "oauth.authorization.revoked"
}

export class SquareEventNotification {
    type: string;
    eventId: string;
    merchantId: string;
    createdAt: string;
    data: string;
    body: {};

    constructor(body: any) {
        this.type = body["type"] as string;
        this.eventId = body["event_id"] as string;
        this.merchantId = body["merchant_id"] as string;
        this.createdAt = body["created_at"] as string;
        this.data = body["data"];

        this.body = body;
    }
}