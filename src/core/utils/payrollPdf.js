// admin-panel/src/core/utils/payrollPdf.js
//
// Payroll PDF generator — Summary (one row per employee) and
// Detailed (one page per employee with day-by-day breakdown).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function drawTotalsStrip(doc, y, rows) {
  const { marginX, width } = PAGE;
  const innerW = width - marginX * 2;
  const gap = 8;
  const cards = [
    { label: 'Employees', value: rows.length, color: COLORS.ink },
    {
      label: 'Present',
      value: rows.reduce((s, r) => s + r.days_present, 0),
      color: COLORS.green,
    },
    {
      label: 'Late',
      value: rows.reduce((s, r) => s + r.days_late, 0),
      color: COLORS.amber,
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
  const cardW = (innerW - gap * (cards.length - 1)) / cards.length;
  const cardH = 52;

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
    doc.setFontSize(18);
    doc.text(String(c.value), x + 14, y + 42);
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
    y = drawTotalsStrip(doc, y, rows);
    y += 24;

    const body = rows.map((r) => [
      r.full_name,
      r.employee_id,
      String(r.days_present),
      String(r.days_late),
      String(r.days_absent),
      String(r.days_on_leave),
      Number(r.total_hours_worked).toFixed(2),
      Number(r.overtime_hours).toFixed(2),
      Number(r.undertime_hours).toFixed(2),
    ]);

    autoTable(doc, {
      startY: y,
      head: [[
        'EMPLOYEE',
        'ID',
        'PRESENT',
        'LATE',
        'ABSENT',
        'LEAVE',
        'HOURS',
        'OT',
        'UT',
      ]],
      body,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 11, bottom: 11, left: 8, right: 8 },
        textColor: COLORS.body,
        lineColor: COLORS.line,
        lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLORS.primarySoft,
        textColor: COLORS.primaryDark,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 12, bottom: 12, left: 8, right: 8 },
      },
      alternateRowStyles: { fillColor: COLORS.band },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.ink },
        1: { textColor: COLORS.soft, fontSize: 8.5 },
        2: { halign: 'center', textColor: COLORS.green, fontStyle: 'bold' },
        3: { halign: 'center', textColor: COLORS.amber, fontStyle: 'bold' },
        4: { halign: 'center', textColor: COLORS.red, fontStyle: 'bold' },
        5: { halign: 'center', textColor: COLORS.blue, fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.ink },
        7: { halign: 'right', textColor: COLORS.green, fontStyle: 'bold' },
        8: { halign: 'right', textColor: COLORS.red, fontStyle: 'bold' },
      },
      margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.marginBottom },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }

    doc.save(`mediabox-payroll-summary-${cutoffStart}_${cutoffEnd}.pdf`);
    return;
  }

  // ─── DETAILED: one page per employee ───
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i > 0) doc.addPage();

    drawHeader(doc, {
      title: 'Attendance Report · Payroll',
      subtitle: 'Employee Payroll Detail',
      cutoffLabel,
    });

    // Employee name block
    let y = 124;
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(r.full_name, PAGE.marginX, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.soft);
    doc.text(
      `${r.employee_id}${r.position ? ` · ${r.position}` : ''}`,
      PAGE.marginX,
      y
    );
    y += 20;

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
        (d.status || '').toUpperCase(),
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
      doc.setTextColor(...COLORS.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Adjustments', PAGE.marginX, after);
      after += 8;

      const adjBody = adjustments.map((a) => [
        a.work_date,
        a.kind === 'overtime' ? 'Overtime (+)' : 'Undertime (−)',
        `${a.minutes} min`,
        a.reason || '—',
      ]);

      autoTable(doc, {
        startY: after,
        head: [['DATE', 'TYPE', 'MINUTES', 'REASON']],
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

    // Summary block
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Summary', PAGE.marginX, after);
    after += 10;

    autoTable(doc, {
      startY: after,
      body: [
        ['Days Present', String(r.days_present)],
        ['Days Late', String(r.days_late)],
        ['Days Absent', String(r.days_absent)],
        ['Days On Leave', String(r.days_on_leave)],
        ['Missing Time-Out', String(r.days_missing_timeout)],
        ['Total Hours Worked', Number(r.total_hours_worked).toFixed(2)],
        ['Overtime Hours', Number(r.overtime_hours).toFixed(2)],
        ['Undertime Hours', Number(r.undertime_hours).toFixed(2)],
      ],
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 7, bottom: 7, left: 10, right: 10 },
        textColor: COLORS.body,
        lineColor: COLORS.line,
        lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.ink, cellWidth: 180 },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.marginBottom },
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount);
  }

  doc.save(`mediabox-payroll-detailed-${cutoffStart}_${cutoffEnd}.pdf`);
}

export default { exportPayrollPDF };