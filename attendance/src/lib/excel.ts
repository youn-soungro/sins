/** 엑셀 다운로드 공통 유틸 */
import ExcelJS from 'exceljs';

export interface Column {
  header: string;
  key: string;
  width?: number;
  /** 'money' 는 천단위 구분, 'hours' 는 소수 1자리 */
  format?: 'money' | 'hours' | 'text';
}

export async function buildWorkbook(
  sheetName: string,
  columns: Column[],
  rows: Record<string, unknown>[],
  opts: { title?: string; totalsRow?: boolean } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '디자인재성 근태관리';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: opts.title ? 2 : 1 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  if (opts.title) {
    ws.mergeCells(1, 1, 1, columns.length);
    const t = ws.getCell(1, 1);
    t.value = opts.title;
    t.font = { size: 14, bold: true };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;
  }

  const headerRowIdx = opts.title ? 2 : 1;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5EAF5' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thin();
    ws.getColumn(i + 1).width = c.width ?? 14;
  });
  headerRow.height = 22;

  rows.forEach((r) => {
    const row = ws.addRow(columns.map((c) => r[c.key] ?? ''));
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.border = thin();
      if (c.format === 'money') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (c.format === 'hours') {
        cell.numFmt = '0.0';
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { horizontal: 'center' };
      }
    });
  });

  // 합계 행 (금액/시간 컬럼만 합산)
  if (opts.totalsRow && rows.length > 0) {
    const totals: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      if (c.format === 'money' || c.format === 'hours') {
        totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      } else if (i === 0) {
        totals[c.key] = '합계';
      }
    });
    const row = ws.addRow(columns.map((c) => totals[c.key] ?? ''));
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = thin();
      if (c.format === 'money') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (c.format === 'hours') {
        cell.numFmt = '0.0';
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { horizontal: 'center' };
      }
    });
  }

  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: columns.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function thin(): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
  return { top: s, left: s, bottom: s, right: s };
}

/** 한글 파일명이 깨지지 않도록 Content-Disposition 을 만든다. */
export function excelResponse(buf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
