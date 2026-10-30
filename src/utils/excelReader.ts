import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export interface ZymmrRecord {
  Username: string;
  Password: string;
  SubTaskID: string;
  'Task Name'?: string;
  Description?: string;
  'Start Date '?: string;
  'End Date'?: string;
  'Time Log'?: string;
  worktype?: string;
  'Work Type'?: string;
  'Work type'?: string;
  'WorkType'?: string;
  [key: string]: any; // Allows accessing any additional Excel columns dynamically
}

/**
 * Reads records from the specified Excel file (.xlsx).
 */
export function readZymmrRecords(filePath?: string): ZymmrRecord[] {
  const targetPath =
    filePath ??
    (fs.existsSync(path.resolve(process.cwd(), 'zymmer records.xlsx'))
      ? path.resolve(process.cwd(), 'zymmer records.xlsx')
      : path.resolve(__dirname, '../../zymmer records.xlsx'));

  const workbook = XLSX.readFile(targetPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRecords = XLSX.utils.sheet_to_json<any>(sheet, { raw: false });

  // Normalize records so worktype works whether written as 'worktype', 'Work Type', or 'Work type'
  return rawRecords.map((item) => ({
    ...item,
    worktype: item.worktype ?? item['Work Type'] ?? item['Work type'] ?? item['WorkType'],
  }));
}
