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

  public static initFromDataSnapshot(snap: any) {
    const now = new Date();
    const obj = new LocationKeyMetricReport(
      snap.businessId,
      snap.locationId,
      snap.firstOrderDate ?? null,
      snap.deployedDate ?? null,
      snap.lastDates ?? null,
      snap.created ? new Date(snap.created) : now,
      snap.updated ? new Date(snap.updated) : now,
    );

    return obj;
  }

  static locationReportPath(businessId: string, locationId: string) {
    const path = `locationKeyMetrics/${locationId}`;

    return path;
  }

  static standardizedDate(date: Date) {
    const dateSplit = date.toISOString().split('T')[0].split('-');
    const year = dateSplit[0];
    const month = `00${dateSplit[1]}`.slice(-2);
    const day = `00${dateSplit[2]}`.slice(-2);

    return `${year}/${month}/${day}`;
  }
}
