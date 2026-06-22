import type ExcelJS from "exceljs";

export type WorksheetBuilder = (worksheet: ExcelJS.Worksheet) => void;

export async function createWorkbook(
  worksheetName: string,
  buildWorksheet: WorksheetBuilder,
) {
  const { default: Excel } = await import("exceljs");
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);

  buildWorksheet(worksheet);

  return workbook;
}
