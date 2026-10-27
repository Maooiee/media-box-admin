// admin-panel/src/core/utils/payrollPdf.js
//
// Payroll PDF generator — Summary (one row per employee) and
// Detailed (one page per employee with day-by-day breakdown).

import jsPDFImport from 'jspdf';
import autoTableImport from 'jspdf-autotable';

// Vite resolves the browser ES build (default export = constructor), while
// Node resolves the CJS build (named exports). Normalise both so the same
// generator can run in the browser and in server-side scripts/tests.
const jsPDF =
  typeof jsPDFImport === 'function' ? jsPDFImport : jsPDFImport?.jsPDF;
const autoTable =
  typeof autoTableImport === 'function'
    ? autoTableImport
    : (autoTableImport?.default ?? autoTableImport?.autoTable);

export const COLORS = {
  primary: [242, 106, 27],
  primaryDark: [201, 82, 12],
  primarySoft: [255, 244, 236],
  ink: [15, 23, 42],
  body: [51, 65, 85],
  soft: [120, 128, 140],
  line: [235, 238, 243],
  band: [252, 253, 254],
  white: [255, 255, 255],
  green: [15, 118, 88],
  greenSoft: [222, 246, 234],
  amber: [168, 108, 4],
  amberSoft: [254, 243, 199],
  red: [185, 28, 28],
  redSoft: [254, 226, 226],
  blue: [29, 78, 216],
  blueSoft: [219, 234, 254],
};

export const PAGE = {
  marginX: 40,
  marginBottom: 50,
  width: 595.28,
  height: 841.89,
};

function fmtDateTime() {
  return new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// jsPDF's Helvetica has no ₱ glyph, so PDFs use "PHP 1,234.56".
function money(n) {
  return `PHP ${(Number(n) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Plain amount for table cells (the column header / note carries the currency).
function amount(n) {
  return (Number(n) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ADJUSTMENT_LABELS = {
  overtime: 'Overtime (+)',
  undertime: 'Undertime (−)',
  night_diff: 'Night differential',
  rest_day: 'Rest day',
  allowance: 'Allowance',
  bonus: 'Bonus',
  loan: 'Loan',
  cash_advance: 'Cash advance',
  other_deduction: 'Other deduction',
};

const AMOUNT_KINDS = new Set([
  'allowance',
  'bonus',
  'loan',
  'cash_advance',
  'other_deduction',
]);

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function hoursBetween(a, b) {
  if (!a || !b) return '—';
  const ms = new Date(b) - new Date(a);
  if (ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function drawHeader(doc, { title, subtitle, cutoffLabel }) {
  const { marginX, width } = PAGE;
  const bannerH = 96;

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, width, bannerH, 'F');

  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, bannerH - 2, width, 2, 'F');

  const logoSize = 46;
  const logoX = marginX;
  const logoY = (bannerH - logoSize) / 2;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 10, 10, 'F');
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MB', logoX + logoSize / 2, logoY + logoSize / 2 + 7, {
    align: 'center',
  });

  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Media Box', logoX + logoSize + 18, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(title, logoX + logoSize + 18, 62);

  const rightX = width - marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(subtitle.toUpperCase(), rightX, 30, { align: 'right' });
  doc.setFontSize(11);
  doc.text(String(cutoffLabel).toUpperCase(), rightX, 48, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated ${fmtDateTime()}`, rightX, 64, { align: 'right' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(rightX - 130, 22, rightX, 22);
}

function drawTotalsStrip(doc, y, rows, payMap = null) {
  const { marginX, width } = PAGE;
  const innerW = width - marginX * 2;
  const gap = 8;
  const hasPay = !!payMap;
  const totalGross = hasPay
    ? rows.reduce((s, r) => s + (Number(payMap[r.user_id]?.gross) || 0), 0)
    : 0;
  const totalNet = hasPay
    ? rows.reduce((s, r) => s + (Number(payMap[r.user_id]?.net) || 0), 0)
    : 0;

  const cards = [
    { label: 'Employees', value: rows.length, color: COLORS.ink },
    {
      label: 'Present',
      value: rows.reduce((s, r) => s + r.days_present, 0),
      color: COLORS.green,
    },
    {
      label: 'Absent',
      value: rows.reduce((s, r) => s + r.days_absent, 0),
      color: COLORS.red,
    },
    {
      label: 'Total Hours',
      value: rows
        .reduce((s, r) => s + Number(r.total_hours_worked || 0), 0)
        .toFixed(2),
      color: COLORS.ink,
    },
  ];

  if (hasPay) {
    cards.push(
      { label: 'Gross Pay', value: money(totalGross), color: COLORS.ink },
      { label: 'Net Pay', value: money(totalNet), color: COLORS.green }
    );
  }

  const cardW = (innerW - gap * (cards.length - 1)) / cards.length;
  const cardH = 52;
  const isMoney = (v) => String(v).startsWith('PHP');

  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + gap);
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, cardW, cardH, 12, 12, 'FD');

    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(x + 6, y + 10, 3, cardH - 20, 1.5, 1.5, 'F');

    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(c.label.toUpperCase(), x + 14, y + 20);

    doc.setTextColor(...c.color);
    doc.setFont('helvetica', 'bold');
    const text = String(c.value);
    let size = isMoney(c.value) ? 11 : 18;
    doc.setFontSize(size);
    // Shrink long amounts instead of letting them run into the next card.
    while (size > 8 && doc.getTextWidth(text) > cardW - 20) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(text, x + 14, y + 42);
  });

  return y + cardH;
}

export function drawFooter(doc, pageNum, totalPages, suffix = 'Payroll Summary') {
  const { marginX, width, height, marginBottom } = PAGE;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.line(marginX, height - marginBottom + 12, width - marginX, height - marginBottom + 12);

  const y = height - marginBottom + 28;
  doc.setFillColor(...COLORS.primary);
  doc.circle(marginX + 3, y - 3, 2.5, 'F');

  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Media Box', marginX + 12, y);

  doc.setTextColor(...COLORS.soft);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`· ${suffix}`, marginX + 12 + doc.getTextWidth('Media Box') + 4, y);

  doc.setTextColor(...COLORS.soft);
  doc.text(`Page ${pageNum} of ${totalPages}`, width - marginX, y, { align: 'right' });
}

// ─── MAIN ENTRY ───
export async function exportPayrollPDF(
  rows,
  {
    cutoffLabel = '',
    cutoffStart = '',
    cutoffEnd = '',
    detailed = false,
    loadDaily = null,
    loadAdjustments = null,
    payMap = null,
    returnDoc = false,
  } = {}
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  if (!detailed) {
    // ─── SUMMARY: one page, one row per employee ───
    drawHeader(doc, {
      title: 'Attendance Report · Payroll',
      subtitle: 'Payroll Summary',
      cutoffLabel,
    });

    let y = 124;
    y = drawTotalsStrip(doc, y, rows, payMap);
    y += 24;

    const body = rows.map((r) => {
      const p = payMap?.[r.user_id];
      return [
        r.full_name,
        r.employee_id,
        String(r.days_present),
        String(r.days_late),
        String(r.days_absent),
        `${r.days_paid_leave ?? 0} / ${r.days_unpaid_leave ?? 0}`,
        Number(r.total_hours_worked).toFixed(2),
        Number(r.overtime_hours).toFixed(2),
        p ? amount(p.gross) : '—',
        p ? amount(p.totalDeductions) : '—',
        p ? amount(p.net) : '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[
        'EMPLOYEE',
        'ID',
        'PRES.',
        'LATE',
        'ABS.',
        'LEAVE P/U',
        'HRS',
        'OT',
        'GROSS',
        'DEDUCT.',
        'NET',
      ]],
      body,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: { top: 7, bottom: 7, left: 4, right: 4 },
        textColor: COLORS.body,
        lineColor: COLORS.line,
        lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: COLORS.primarySoft,
        textColor: COLORS.primaryDark,
        fontStyle: 'bold',
        fontSize: 6,
        cellPadding: { top: 9, bottom: 9, left: 4, right: 4 },
      },
      alternateRowStyles: { fillColor: COLORS.band },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          textColor: COLORS.ink,
          // Sum of all column widths = the printable width, so autoTable does
          // not log "units could not fit page" for the leftover space.
          cellWidth: 107.28,
          halign: 'left',
        },
        1: { textColor: COLORS.soft, fontSize: 6.5, cellWidth: 50 },
        2: {
          halign: 'center',
          textColor: COLORS.green,
          fontStyle: 'bold',
          cellWidth: 32,
        },
        3: {
          halign: 'center',
          textColor: COLORS.amber,
          fontStyle: 'bold',
          cellWidth: 28,
        },
        4: {
          halign: 'center',
          textColor: COLORS.red,
          fontStyle: 'bold',
          cellWidth: 32,
        },
        5: {
          halign: 'center',
          textColor: COLORS.blue,
          fontStyle: 'bold',
          cellWidth: 50,
        },
        6: {
          halign: 'right',
          fontStyle: 'bold',
          textColor: COLORS.ink,
          cellWidth: 34,
        },
        7: {
          halign: 'right',
          textColor: COLORS.green,
          fontStyle: 'bold',
          cellWidth: 28,
        },
        8: {
          halign: 'right',
          textColor: COLORS.ink,
          fontStyle: 'bold',
          cellWidth: 52,
        },
        9: {
          halign: 'right',
          textColor: COLORS.red,
          cellWidth: 56,
        },
        10: {
          halign: 'right',
          textColor: COLORS.ink,
          fontStyle: 'bold',
          cellWidth: 46,
        },
      },
      margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.marginBottom },
    });

    const tableEnd = doc.lastAutoTable?.finalY ?? y;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.soft);
    doc.text(
      'Amounts in Philippine pesos (PHP). Leave column is paid / unpaid days.',
      PAGE.marginX,
      Math.min(tableEnd + 14, PAGE.height - PAGE.marginBottom - 6)
    );

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }

    if (returnDoc) return doc;
    doc.save(`mediabox-payroll-summary-${cutoffStart}_${cutoffEnd}.pdf`);
    return;
  }

  // ─── DETAILED: one page per employee ───
  const drawEmployeePageHeader = (row) => {
    drawHeader(doc, {
      title: 'Attendance Report · Payroll',
      subtitle: 'Employee Payroll Detail',
      cutoffLabel,
    });

    let y = 124;
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(row.full_name, PAGE.marginX, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.soft);
    doc.text(
      `${row.employee_id}${row.position ? ` · ${row.position}` : ''}`,
      PAGE.marginX,
      y
    );
    return y + 22;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i > 0) doc.addPage();

    let y = drawEmployeePageHeader(r);

    // Daily records
    let daily = [];
    try {
      if (loadDaily) daily = await loadDaily(r.user_id);
    } catch (e) {
      console.warn('loadDaily failed', e);
    }

    const dailyBody = daily.map((d) => {
      const missing = d.time_in && !d.time_out;
      return [
        d.date,
        fmtTime(d.time_in),
        missing ? 'Missing' : fmtTime(d.time_out),
        hoursBetween(d.time_in, d.time_out),
        (d.status || '').toUpperCase().replace(/_/g, ' '),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['DATE', 'IN', 'OUT', 'HOURS', 'STATUS']],
      body: dailyBody.length ? dailyBody : [['—', '—', '—', '—', '—']],
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
        textColor: COLORS.body,
        lineColor: COLORS.line,
        lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      },
      headStyles: {
        fillColor: COLORS.primarySoft,
        textColor: COLORS.primaryDark,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: COLORS.band },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.ink },
        4: { fontStyle: 'bold' },
      },
      margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.marginBottom },
    });

    let after = doc.lastAutoTable.finalY + 20;

    // Adjustments
    let adjustments = [];
    try {
      if (loadAdjustments) adjustments = await loadAdjustments(r.user_id);
    } catch (e) {
      console.warn('loadAdjustments failed', e);
    }

    if (adjustments.length > 0) {
      const adjustmentsHeight = 34 + adjustments.length * 24;
      if (after + adjustmentsHeight > PAGE.height - PAGE.marginBottom) {
        doc.addPage();
        after = drawEmployeePageHeader(r);
      }

      doc.setTextColor(...COLORS.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Adjustments', PAGE.marginX, after);
      after += 8;

      const adjBody = adjustments.map((a) => [
        a.work_date,
        ADJUSTMENT_LABELS[a.kind] ?? a.kind,
        AMOUNT_KINDS.has(a.kind)
          ? money(a.amount)
          : `${a.minutes} min`,
        a.status ? String(a.status).toUpperCase() : 'APPROVED',
        a.reason || '—',
      ]);

      autoTable(doc, {
        startY: after,
        head: [['DATE', 'TYPE', 'VALUE', 'STATUS', 'REASON']],
        body: adjBody,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
          textColor: COLORS.body,
          lineColor: COLORS.line,
          lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
        },
        headStyles: {
          fillColor: COLORS.primarySoft,
          textColor: COLORS.primaryDark,
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: COLORS.ink },
          1: { fontStyle: 'bold' },
          2: { halign: 'right' },
        },
        margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.marginBottom },
      });

      after = doc.lastAutoTable.finalY + 20;
    }

    // Summary block — attendance and pay side by side so the whole breakdown
    // fits on one page and never leaves a stranded "Net pay" row on page 2.
    const pay = payMap?.[r.user_id] ?? r.pay ?? null;
    const attendanceRows = [
      ['Days present', String(r.days_present)],
      ['Days late', String(r.days_late)],
      ['Days absent', String(r.days_absent)],
      ['Paid leave', String(r.days_paid_leave ?? 0)],
      ['Unpaid leave', String(r.days_unpaid_leave ?? r.days_on_leave ?? 0)],
      ['Missing time-out', String(r.days_missing_timeout)],
      ['Hours worked', Number(r.total_hours_worked).toFixed(2)],
      ['Overtime', Number(r.overtime_hours).toFixed(2)],
      ['Undertime', Number(r.undertime_hours).toFixed(2)],
    ];

    const payRows = [];
    if (pay) {
      if (pay.basicPay !== undefined) {
        payRows.push(
          ['Basic pay', money(pay.basicPay)],
          ['Paid leave pay', money(pay.paidLeavePay)],
          ['Night differential', money(pay.nightDiffPay)],
          ['Rest-day premium', money(pay.restDayPay)],
          ['Overtime pay', money(pay.otPay)],
          ['Allowances / bonus', money((pay.allowanceAmount || 0) + (pay.bonusAmount || 0))]
        );
        if ((Number(pay.utDeduction) || 0) > 0) {
          payRows.push(['Less: undertime', money(pay.utDeduction)]);
        }
      }
      payRows.push(
        ['Gross pay', money(pay.gross)],
        ['Total deductions', money(pay.totalDeductions)],
        ['Net pay', money(pay.net)]
      );
      if (pay.thirteenthMonthAccrual !== undefined) {
        payRows.push(['13th month accrual', money(pay.thirteenthMonthAccrual)]);
      }
    }

    const summaryRowCount = Math.max(attendanceRows.length, payRows.length);
    const summaryHeight = 26 + summaryRowCount * 16 + 8;
    if (after + summaryHeight > PAGE.height - PAGE.marginBottom) {
      doc.addPage();
      after = drawEmployeePageHeader(r);
    }

    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Summary', PAGE.marginX, after);
    after += 8;

    const summaryStyles = {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 4.5, bottom: 4.5, left: 8, right: 8 },
      textColor: COLORS.body,
      lineColor: COLORS.line,
      lineWidth: { top: 0, right: 0, bottom: 0.4, left: 0 },
      valign: 'middle',
    };
    const summaryHeadStyles = {
      fillColor: COLORS.primarySoft,
      textColor: COLORS.primaryDark,
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
    };

    autoTable(doc, {
      startY: after,
      tableWidth: 244,
      head: [['ATTENDANCE', '']],
      body: attendanceRows,
      theme: 'plain',
      styles: summaryStyles,
      headStyles: summaryHeadStyles,
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.ink },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      margin: {
        left: PAGE.marginX,
        right: PAGE.width - PAGE.marginX - 244,
        bottom: PAGE.marginBottom,
      },
    });
    const leftEnd = doc.lastAutoTable.finalY;

    autoTable(doc, {
      startY: after,
      tableWidth: 255,
      head: [['PAY', 'AMOUNT']],
      body: payRows.length ? payRows : [['No pay data', '—']],
      theme: 'plain',
      styles: summaryStyles,
      headStyles: summaryHeadStyles,
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.ink },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const label = String(data.row.raw?.[0] ?? '').toLowerCase();
        if (label === 'gross pay' || label === 'net pay') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor =
            label === 'net pay' ? COLORS.green : COLORS.ink;
          data.cell.styles.lineWidth = {
            top: 0.6,
            right: 0,
            bottom: 0.4,
            left: 0,
          };
        }
      },
      margin: {
        left: PAGE.width - PAGE.marginX - 255,
        right: PAGE.marginX,
        bottom: PAGE.marginBottom,
      },
    });

    after = Math.max(leftEnd, doc.lastAutoTable.finalY);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount, 'Employee Payroll Detail');
  }

  const employeeSuffix =
    rows.length === 1
      ? `-${String(rows[0].employee_id || rows[0].user_id || 'employee').replace(
          /[^a-zA-Z0-9-_]/g,
          ''
        )}`
      : '';
  if (returnDoc) return doc;
  doc.save(
    `mediabox-payroll-detailed${employeeSuffix}-${cutoffStart}_${cutoffEnd}.pdf`
  );
}

export default { exportPayrollPDF };