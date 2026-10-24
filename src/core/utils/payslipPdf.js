// admin-panel/src/core/utils/payslipPdf.js
//
// One-page payslip PDF for a single employee over one pay period.
// Uses the same banner/footer as payrollPdf.js so all documents match.
//
// Currency is written as "PHP 1,234.56" because jsPDF's built-in Helvetica
// does not include the ₱ glyph (U+20B1). The on-screen UI shows ₱ freely.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawHeader, drawFooter, COLORS, PAGE } from './payrollPdf';

function money(n) {
  return `PHP ${(Number(n) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtGenerated() {
  return new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportPayslipPDF({
  summary,
  pay,
  periodLabel,
  periodStart,
  periodEnd,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { marginX, width } = PAGE;

  drawHeader(doc, {
    title: 'Payslip',
    subtitle: 'Confidential',
    cutoffLabel: periodLabel,
  });

  // ─── Employee + rate block ───
  let y = 124;
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(summary.full_name || 'Employee', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.soft);
  doc.text(
    `${summary.employee_id || ''}${summary.position ? ` · ${summary.position}` : ''}`,
    marginX,
    y + 15
  );
  doc.text(`Pay period: ${periodLabel}`, marginX, y + 29);

  // Rate card on the right
  const cardW = 150;
  const cardX = width - marginX - cardW;
  doc.setFillColor(...COLORS.primarySoft);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.7);
  doc.roundedRect(cardX, y - 22, cardW, 52, 10, 10, 'FD');
  doc.setTextColor(...COLORS.soft);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DAILY RATE', cardX + 12, y - 6);
  doc.setTextColor(...COLORS.primaryDark);
  doc.setFontSize(14);
  doc.text(pay.hasRate ? money(pay.rate) : 'Not set', cardX + 12, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.soft);
  doc.text(
    pay.hasRate ? `Hourly: ${money(pay.hourly)} (÷ 8h)` : 'Set a rate in Employees',
    cardX + 12,
    y + 28
  );

  y += 56;

  // ─── Earnings ───
  const earnings =
    pay.lines.length > 0
      ? pay.lines.map((l) => [l.label, money(l.amount)])
      : [['No earnings this period', money(0)]];

  autoTable(doc, {
    startY: y,
    head: [['EARNINGS', 'AMOUNT']],
    body: earnings,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
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
      cellPadding: { top: 10, bottom: 10, left: 8, right: 8 },
    },
    columnStyles: {
      0: { textColor: COLORS.ink },
      1: { halign: 'right', fontStyle: 'bold', textColor: COLORS.ink },
    },
    margin: { left: marginX, right: marginX },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 18;

  // ─── Deductions ───
  const deductions =
    pay.deductions.length > 0
      ? pay.deductions.map((d) => [d.label, `(${money(d.amount)})`])
      : [['No deductions this period', `(${money(0)})`]];

  autoTable(doc, {
    startY: y,
    head: [['DEDUCTIONS', 'AMOUNT']],
    body: deductions,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
      textColor: COLORS.body,
      lineColor: COLORS.line,
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.white,
      textColor: COLORS.red,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 10, bottom: 10, left: 8, right: 8 },
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
    },
    columnStyles: {
      0: { textColor: COLORS.ink },
      1: { halign: 'right', fontStyle: 'bold', textColor: COLORS.red },
    },
    margin: { left: marginX, right: marginX },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 22;

  // ─── Gross pay strip ───
  const stripH = 54;
  doc.setFillColor(...COLORS.primarySoft);
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginX, y, width - marginX * 2, stripH, 12, 12, 'FD');

  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(marginX + 8, y + 10, 4, stripH - 20, 2, 2, 'F');

  doc.setTextColor(...COLORS.primaryDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GROSS PAY', marginX + 22, y + 24);
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.soft);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${fmtGenerated()}`, marginX + 22, y + 40);

  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(money(pay.gross), width - marginX - 16, y + 34, { align: 'right' });

  y += stripH + 20;

  // ─── Computation notes ───
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.soft);
  doc.setFont('helvetica', 'normal');
  const notes = [
    pay.hasRate
      ? `Computation: daily rate ${money(pay.rate)} ÷ ${8} hours = ${money(pay.hourly)}/hour. Overtime paid at 1.25×.`
      : 'No daily rate is set for this employee, so no amounts could be computed.',
    'Regular holiday: 200% if worked, 100% if unworked (paid when the day before was worked). Special non-working day: 130% if worked, no pay if unworked.',
  ];
  let noteY = y;
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, width - marginX * 2);
    doc.text(lines, marginX, noteY);
    noteY += lines.length * 10 + 3;
  }

  // ─── Signature lines ───
  const sigY = Math.max(noteY + 34, 690);
  const sigW = (width - marginX * 2 - 60) / 3;
  const sigs = ['Received by', 'Employee', 'Authorized Signature'];
  sigs.forEach((label, i) => {
    const x = marginX + i * (sigW + 30);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.7);
    doc.line(x, sigY, x + sigW, sigY);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, sigY + 13);
  });

  drawFooter(doc, 1, 1, 'Payslip');

  const id = (summary.employee_id || 'employee').replace(/[^a-zA-Z0-9-_]/g, '');
  doc.save(`payslip-${id}-${periodStart}_${periodEnd}.pdf`);
}
