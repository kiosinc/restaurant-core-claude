import { Database } from 'firebase-admin/database';
import { createHttpTask } from '../utils/GoogleCloudTask';
import { ReportTaskEvent } from './ReportTaskEvent';

export interface DailyKeyMetrics {
  orderCount: number
  itemCount: number
  totalAmount: number
  totalTenderAmount: number
  totalCashAmount: number
  totalTipAmount: number
  totalDiscountAmount: number
  totalRefundAmount: number
  totalAppFeeAmount: number
  totalProcessingFeeAmount: number
}

const REPORT_KEY_METRIC_QUEUE = 'report-key-metric-update';
const UPDATE_DAILY_METRIC_TASK_TYPE = 'updateDailyKeyMetricReportTask';
const UPDATE_DAILY_METRIC_TASK_PATH = '/tasks/orders/updateDailyKeyMetrics';

function clean(str: string) {
  return str
    .replace(/\./gi, '_')
    .replace(/#/gi, 'HASH_')
    .replace(/\$/gi, 'MONEY_')
    .replace(/\//gi, 'SLASH_')
    .replace(/\[/gi, '_')
    .replace(/\]/gi, '_')
    .replace(/\n/gi, '');
}

export class DailyKeyMetricReport {
  locationName: string;

  created: Date;

  updated: Date;

  keyMetrics: { [source: string]: DailyKeyMetrics };

  constructor(
    locationName: string,
    keyMetrics?: { [source: string]: DailyKeyMetrics },
    updated?: Date,
    created?: Date,
  ) {
    this.locationName = locationName;
    this.keyMetrics = keyMetrics ?? {};
    const now = new Date();
    this.created = created ?? now;
    this.updated = updated ?? now;
  }

  static locationReportPath(businessId: string, date: Date, locationId: string) {
    // TODO: localization of date
    const dateSplit = date.toISOString().split('T')[0].split('-');
    const year = dateSplit[0];
    const month = dateSplit[1];
    const day = dateSplit[2];

    const path = `/businesses/${businessId}/reports/dailyKeyMetrics/${year}/${month}/${day}/${locationId}`;

    return path;
  }

  static newDailyKeyMetrics(): DailyKeyMetrics {
    return {
      orderCount: 0,
      itemCount: 0,
      totalAmount: 0,
      totalTenderAmount: 0,
      totalCashAmount: 0,
      totalTipAmount: 0,
      totalDiscountAmount: 0,
      totalRefundAmount: 0,
      totalAppFeeAmount: 0,
      totalProcessingFeeAmount: 0,
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

  // TODO move out of lib
  static async consumeUpdateDailyKeyMetricReportTask(db: Database,
    data: UpdateDailyKeyMetricReportTaskData) {
    return db.ref(data.dbRefPath).transaction((value) => {
      let update: any;

      const locationName = clean(data.locationName);
      // No value at node, provide default values
      if (!value) {
        update = new DailyKeyMetricReport(locationName);
      } else {
        update = new DailyKeyMetricReport(
          value.locationName,
          value.keyMetrics,
          value.created,
          value.updated,
        );
      }

      // console.log(`Using base update ${JSON.stringify(update)}`)
      // Check if new source needs data seeding
      let source = clean(data.source);
      if (source.length <= 0) {
        source = 'notSupplied';
      }
      if (!update.keyMetrics[source]) {
        update.keyMetrics[source] = DailyKeyMetricReport.newDailyKeyMetrics();
      }

      // Update and increment data
      Object.keys(data.keyMetrics).forEach((key) => {
        const typedKey = key as keyof DailyKeyMetrics;
        update.keyMetrics[source][typedKey] += data.keyMetrics[typedKey];
      });

      update.updated = new Date();
      return JSON.parse(JSON.stringify(update));
    });
  }
}

export interface UpdateDailyKeyMetricReportTaskData {
  dbRefPath: string,
  source: string,
  keyMetrics: any,
  locationName: string
}
