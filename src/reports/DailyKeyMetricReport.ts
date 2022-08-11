import { getDatabase } from 'firebase-admin/database';
import { createHttpTask } from '../utils/GoogleCloudTask';
import { ReportTaskEvent } from './ReportTaskEvent';

const db = getDatabase();

export interface DailyKeyMetrics {
  orderCount: number
  itemCount: number
  totalAmount: number
  totalTenderAmount: number
  totalCashAmount: number
  totalTipAmount: number
  totalDiscountAmount: number
  totalFeeAmount: number
  totalRefundAmount: number
}

const REPORT_KEY_METRIC_QUEUE = 'report-key-metric-update';
const UPDATE_DAILY_METRIC_TASK_TYPE = 'updateDailyKeyMetricReportTask';
const UPDATE_DAILY_METRIC_TASK_PATH = '/tasks/orders/updateDailyKeyMetrics';

export class DailyKeyMetricReport {
  created: Date;

  updated: Date;

  keyMetrics: { [source: string]: DailyKeyMetrics };

  constructor(
    keyMetrics?: { [source: string]: DailyKeyMetrics },
    updated?: Date,
    created?: Date,
  ) {
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

    const path = `/businesses/${businessId}/private/reports/dailyKeyMetrics/${year}/${month}/${day}/${locationId}`;

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
      totalFeeAmount: 0,
      totalRefundAmount: 0,
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

  static async consumeUpdateDailyKeyMetricReportTask(data: UpdateDailyKeyMetricReportTaskData) {
    await db.ref(data.dbRefPath).transaction((value) => {
      let update: DailyKeyMetricReport;
      if (!value || !value.exists()) {
        update = new DailyKeyMetricReport();
      } else {
        update = new DailyKeyMetricReport(
          value.keyMetrics,
          value.created,
          value.updated,
        );
      }

      const { source } = data;
      if (!update.keyMetrics[source]) {
        update.keyMetrics[source] = DailyKeyMetricReport.newDailyKeyMetrics();
      }

      // Update data
      Object.keys(data.keyMetrics).forEach((key) => {
        const typedKey = key as keyof DailyKeyMetrics;
        update.keyMetrics[source][typedKey] += data.keyMetrics[typedKey];
      });

      update.updated = new Date();
      return update;
    });
  }
}

export interface UpdateDailyKeyMetricReportTaskData {
  dbRefPath: string,
  source: string,
  keyMetrics: any
}
