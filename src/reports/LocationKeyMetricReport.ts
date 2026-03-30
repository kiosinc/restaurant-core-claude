import { standardizedDate } from '../utils/dateFormat';

export default class LocationKeyMetricReport {
  created: Date;

  updated: Date;

  businessId: string;

  locationId: string;

  firstOrderDate: string | null;

  deployedDate: string | null;

  lastDates: string[] | null;

  constructor(
    businessId: string,
    locationId: string,
    firstOrderDate: string | null,
    deployedDate: string | null,
    lastDates: string[] | null,
    updated?: Date,
    created?: Date,
  ) {
    this.businessId = businessId;
    this.locationId = locationId;
    this.firstOrderDate = firstOrderDate;
    this.deployedDate = deployedDate;
    this.lastDates = lastDates;
    const now = new Date();
    this.created = created ?? now;
    this.updated = updated ?? now;
  }

  public static initFromDataSnapshot(snap: FirebaseFirestore.DocumentData) {
    const now = new Date();
    return new LocationKeyMetricReport(
      snap.businessId,
      snap.locationId,
      snap.firstOrderDate ?? null,
      snap.deployedDate ?? null,
      snap.lastDates ?? null,
      snap.created ? new Date(snap.created) : now,
      snap.updated ? new Date(snap.updated) : now,
    );
  }

  static locationReportPath(businessId: string, locationId: string) {
    return `locationKeyMetrics/${locationId}`;
  }

  static standardizedDate(date: Date) {
    return standardizedDate(date);
  }
}
