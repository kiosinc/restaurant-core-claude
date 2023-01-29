import { createHttpTask } from '../utils/GoogleCloudTask';
import { ReportTaskEvent } from './ReportTaskEvent';

export interface DailyKeyMetrics {
  orderCount: string
  itemCount: string
  totalAmount: string
  totalTenderAmount: string
  totalCashAmount: string
  totalTipAmount: string
  totalDiscountAmount: string
  totalRefundAmount: string
  totalAppFeeAmount: string
  totalProcessingFeeAmount: string
}

const REPORT_KEY_METRIC_QUEUE = 'report-key-metric-update';
const UPDATE_DAILY_METRIC_TASK_TYPE = 'updateDailyKeyMetricReportTask';
const UPDATE_DAILY_METRIC_TASK_PATH = '/tasks/orders/updateDailyKeyMetrics';

export class DailyKeyMetricReport {
  businessId: string;

  locationId: string;

  locationName: string;

  dateIndex: string;

  created: Date;

  updated: Date;

  keyMetrics: { [source: string]: DailyKeyMetrics };

  constructor(
    businessId: string,
    locationId: string,
    locationName: string,
    dateIndex: string,
    keyMetrics?: { [source: string]: DailyKeyMetrics },
    created?: Date,
    updated?: Date,
  ) {
    this.businessId = businessId;
    this.locationId = locationId;
    this.locationName = locationName;
    this.dateIndex = dateIndex;
    this.keyMetrics = keyMetrics ?? {};
    const now = new Date();
    this.created = created ?? now;
    this.updated = updated ?? now;
  }

  public static initFromDataSnapshot(snap: any) {
    const now = new Date();
    const obj = new DailyKeyMetricReport(
      snap.businessId,
      snap.locationId,
      snap.locationName,
      snap.dateIndex,
      snap.keyMetrics,
      snap.created ? new Date(snap.created) : now,
      snap.updated ? new Date(snap.updated) : now,
    );

    return obj;
  }

  static locationReportPathV1(businessId: string, date: Date, locationId: string) {
    // TODO: localization of date
    const dateSplit = date.toISOString().split('T')[0].split('-');
    const year = dateSplit[0];
    const month = dateSplit[1];
    const day = dateSplit[2];

    const path = `/businesses/${businessId}/reports/dailyKeyMetrics/${year}/${month}/${day}/${locationId}`;

    return path;
  }

  static locationReportPath(locationId: string, date: Date) {
    const path = `/dailyKeyMetrics/${locationId}${this.standardizedDate(date)}`;

    return path;
  }

  static standardizedDate(date: Date) {
    const dateSplit = date.toISOString().split('T')[0].split('-');
    const year = dateSplit[0];
    const month = `00${dateSplit[1]}`.slice(-2);
    const day = `00${dateSplit[2]}`.slice(-2);

    return `${year}/${month}/${day}`;
  }

  static newDailyKeyMetrics(): DailyKeyMetrics {
    return {
      orderCount: '0',
      itemCount: '0',
      totalAmount: '0',
      totalTenderAmount: '0',
      totalCashAmount: '0',
      totalTipAmount: '0',
      totalDiscountAmount: '0',
      totalRefundAmount: '0',
      totalAppFeeAmount: '0',
      totalProcessingFeeAmount: '0',
    };
  }

  static async createUpdateDailyKeyMetricsTask(host: string,
    businessId: string,
    idempotentKey: string,
    data: UpdateDailyKeyMetricReportTaskData) {
    const event = new ReportTaskEvent(
      businessId,
      UPDATE_DAILY_METRIC_TASK_TYPE,
      idempotentKey,
      new Date(),
      data,
    );

    const targetUrl = host + UPDATE_DAILY_METRIC_TASK_PATH;

    await createHttpTask(REPORT_KEY_METRIC_QUEUE,
      targetUrl,
      event.payload());
  }
}

export interface UpdateDailyKeyMetricReportTaskData {
  businessId: string,
  locationId: string,
  date: string,
  source: string,
  keyMetrics: any,
  locationName: string
}
