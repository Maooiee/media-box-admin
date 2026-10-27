// admin-panel/src/core/utils/pdfExport.js
//
// Modern Attendance Report PDF generator.
// Uses jsPDF + jspdf-autotable.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toManilaDate } from './formatters';

const COLORS = {
  primary: [242, 106, 27],
  primaryDark: [201, 82, 12],
  primarySoft: [255, 244, 236],
  ink: [15, 23, 42],
  body: [51, 65, 85],
  soft: [120, 128, 140],
  faint: [160, 168, 180],
  line: [235, 238, 243],
  lineSoft: [245, 247, 250],
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
  slate: [100, 116, 139],
  slateSoft: [241, 245, 249],
};

const PAGE = {
  marginX: 36,
  marginTop: 40,
  marginBottom: 56,
  width: 595.28,
  height: 841.89,
};

// ─── Helpers ───
function fmtDateTime() {
  return new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

/** Sum up all hours worked across records into "Xh Ym" */
function totalHours(records) {
  let totalMs = 0;
  for (const r of records) {
    if (!r.timeIn || !r.timeOut) continue;
    const ms = new Date(r.timeOut) - new Date(r.timeIn);
    if (ms > 0) totalMs += ms;
  }
  if (totalMs <= 0) return '0h 0m';
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function initialsOf(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/**
 * Strip a leading "[date, time] " prefix from a note if present.
 * Handles formats like:
 *   "[10/13/2026, 15:14] Actual note text"
 *   "[2026-10-13 15:14] Actual note"
 *   "10/13/2026, 15:14: Actual note"
 */
function cleanNote(raw) {
  if (!raw) return '';
  let text = String(raw).trim();

  // Remove leading "[...]" if the bracket content looks like a date/time
  const bracketMatch = text.match(/^\[(.+?)\]\s*/);
  if (bracketMatch) {
    const inner = bracketMatch[1];
    if (/\d/.test(inner) && /[\/\-:]/.test(inner)) {
      text = text.slice(bracketMatch[0].length);
    }
  }

  // Remove leading "MM/DD/YYYY, HH:MM:" or "MM/DD/YYYY HH:MM -" without brackets
  text = text.replace(
    /^\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]+\d{1,2}:\d{2}(:\d{2})?\s*[-–:]?\s*/,
    ''
  );

  // Remove leading "YYYY-MM-DD HH:MM" too
  text = text.replace(
    /^\d{4}-\d{2}-\d{2}[T\s]+\d{1,2}:\d{2}(:\d{2})?\s*[-–:]?\s*/,
    ''
  );

  return text.trim();
}

// ─── Load image as centered square-cropped PNG data URL ───
async function loadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) {
      console.warn('Image fetch failed:', res.status, url);
      return null;
    }
    const blob = await res.blob();

    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = objectUrl;
    });

    if (!img) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = Math.floor((img.naturalWidth - side) / 2);
    const sy = Math.floor((img.naturalHeight - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);

    URL.revokeObjectURL(objectUrl);

    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Canvas tainted:', e);
      return null;
    }
  } catch (e) {
    console.warn('Image load error:', e, url);
    return null;
  }
}

// ─── Header (full-width banner) ───
function drawHeader(doc, { orgName, dateRange }) {
  const { marginX, width } = PAGE;
  const bannerH = 88;

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, width, bannerH, 'F');

  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, bannerH - 2, width, 2, 'F');

  const logoSize = 42;
  const logoX = marginX;
  const logoY = (bannerH - logoSize) / 2;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 9, 9, 'F');

  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MB', logoX + logoSize / 2, logoY + logoSize / 2 + 6, {
    align: 'center',
  });

  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(orgName || 'Media Box', logoX + logoSize + 16, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Attendance Report', logoX + logoSize + 16, 58);

  const rightX = width - marginX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('REPORT RANGE', rightX, 28, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(String(dateRange).toUpperCase(), rightX, 42, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(fmtDateTime(), rightX, 58, { align: 'right' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(rightX - 120, 20, rightX, 20);
}

// ─── Stat cards ───
function drawStatCards(doc, y, cards) {
  const { marginX, width } = PAGE;
  const innerW = width - marginX * 2;
  const gap = 10;
  const cardW = (innerW - gap * (cards.length - 1)) / cards.length;
  const cardH = 56;

  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + gap);

    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'FD');

    doc.setFillColor(...(c.accent || COLORS.primary));
    doc.roundedRect(x + 6, y + 10, 3, cardH - 20, 1.5, 1.5, 'F');

    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(c.label).toUpperCase(), x + 14, y + 20);

    doc.setTextColor(...(c.color || COLORS.ink));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(String(c.value), x + 14, y + 42);
  });

  return y + cardH;
}

// ─── Main export ───
export async function exportAttendancePDF(
  records,
  {
    orgName = 'Media Box',
    dateRange = 'All Time',
    getSelfieUrl = () => null,
    formatTime = (t) => t || '—',
    hoursWorked = hoursBetween,
  } = {}
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const photoUrls = records.map((r) => getSelfieUrl(r.selfieUrl));
  const photos = await Promise.all(photoUrls.map(loadImage));

  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const grandTotal = totalHours(records);

  drawHeader(doc, { orgName, dateRange });

  let y = 116;
  y = drawStatCards(doc, y, [
    { label: 'Total Records', value: records.length, accent: COLORS.ink, color: COLORS.ink },
    { label: 'Present', value: present, accent: COLORS.green, color: COLORS.green },
    { label: 'Late', value: late, accent: COLORS.amber, color: COLORS.amber },
    { label: 'Absent', value: absent, accent: COLORS.red, color: COLORS.red },
  ]);

  y += 22;

  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ATTENDANCE LOG', PAGE.marginX, y);

  doc.setTextColor(...COLORS.soft);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${records.length} ${records.length === 1 ? 'entry' : 'entries'}`,
    PAGE.width - PAGE.marginX,
    y,
    { align: 'right' }
  );

  y += 12;

  // ─── Build body rows (no STATUS column, no timestamp in notes) ───
  // Columns: [avatar, employee, id, date, in, out, hours, notes]
  const body = records.map((r) => {
    const noteText = cleanNote(r.notes);
    return [
      '',                                 // avatar (drawn in didDrawCell)
      r.employeeName || '—',
      r.employeeId || '—',
      r.date || '—',
      formatTime(r.timeIn),
      formatTime(r.timeOut),
      hoursWorked(r),
      noteText || '—',
    ];
  });

  // Total row appended at the bottom
  body.push([
    '',
    'TOTAL',
    '',
    '',
    '',
    '',
    grandTotal,
    '',
  ]);

  const totalRowIndex = body.length - 1;

  autoTable(doc, {
    startY: y,
    head: [['', 'EMPLOYEE', 'ID', 'DATE', 'IN', 'OUT', 'HRS', 'NOTES']],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 10, bottom: 10, left: 8, right: 8 },
      textColor: COLORS.body,
      lineColor: COLORS.line,
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 40,
    },
    headStyles: {
      fillColor: COLORS.primarySoft,
      textColor: COLORS.primaryDark,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 10, bottom: 10, left: 8, right: 8 },
    },
    alternateRowStyles: { fillColor: COLORS.band },
    columnStyles: {
      0: { cellWidth: 42, minCellHeight: 44 },
      1: { cellWidth: 90, fontStyle: 'bold', textColor: COLORS.ink, fontSize: 8 },
      2: { cellWidth: 48, fontSize: 7.5, textColor: COLORS.soft },
      3: { cellWidth: 58, fontSize: 7.5, textColor: COLORS.soft },
      4: { cellWidth: 46, fontSize: 7.5 },
      5: { cellWidth: 46, fontSize: 7.5 },
      6: { cellWidth: 44, fontSize: 7.5, fontStyle: 'bold', textColor: COLORS.ink },
      7: { cellWidth: 'auto', fontSize: 7.5, textColor: COLORS.body, fontStyle: 'normal' },
    },
    didParseCell: (data) => {
      // ─── Style the TOTAL row ───
      if (data.section === 'body' && data.row.index === totalRowIndex) {
        data.cell.styles.fillColor = COLORS.primarySoft;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
        data.cell.styles.textColor = COLORS.primaryDark;
        data.cell.styles.lineWidth = { top: 1.2, right: 0, bottom: 0, left: 0 };
        data.cell.styles.lineColor = COLORS.primary;
      }

      // Gray em-dash notes (but not on the TOTAL row)
      if (
        data.section === 'body' &&
        data.column.index === 7 &&
        data.row.index !== totalRowIndex
      ) {
        if (data.cell.raw === '—') {
          data.cell.styles.textColor = COLORS.faint;
          data.cell.styles.halign = 'center';
        }
      }
    },
    didDrawCell: (data) => {
      // ─── Avatar / photo cell ───
      if (
        data.section === 'body' &&
        data.column.index === 0 &&
        data.row.index !== totalRowIndex
      ) {
        const img = photos[data.row.index];
        const size = 30;
        const cx = data.cell.x + (data.cell.width - size) / 2;
        const cy = data.cell.y + (data.cell.height - size) / 2;
        const radius = 6;

        doc.saveGraphicsState();
        doc.roundedRect(cx, cy, size, size, radius, radius, null);
        doc.clip();
        doc.discardPath();

        if (img) {
          try {
            doc.addImage(img, 'PNG', cx, cy, size, size);
          } catch (e) {
            console.warn('addImage failed:', e);
          }
        } else {
          doc.setFillColor(...COLORS.primarySoft);
          doc.rect(cx, cy, size, size, 'F');

          doc.setTextColor(...COLORS.primaryDark);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(
            initialsOf(records[data.row.index]?.employeeName),
            cx + size / 2,
            cy + size / 2 + 3.5,
            { align: 'center' }
          );
        }

        doc.restoreGraphicsState();

        doc.setDrawColor(...COLORS.line);
        doc.setLineWidth(0.5);
        doc.roundedRect(cx, cy, size, size, radius, radius, 'S');
      }
    },
    margin: {
      left: PAGE.marginX,
      right: PAGE.marginX,
      bottom: PAGE.marginBottom,
    },
  });

  // ─── Footer ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.5);
    doc.line(
      PAGE.marginX,
      PAGE.height - PAGE.marginBottom + 12,
      PAGE.width - PAGE.marginX,
      PAGE.height - PAGE.marginBottom + 12
    );

    const footerY = PAGE.height - PAGE.marginBottom + 28;
    doc.setFillColor(...COLORS.primary);
    doc.circle(PAGE.marginX + 3, footerY - 3, 2.5, 'F');

    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(orgName, PAGE.marginX + 12, footerY);

    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      '· Attendance Report',
      PAGE.marginX + 12 + doc.getTextWidth(orgName) + 4,
      footerY
    );

    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Page ${i} of ${pageCount}`, PAGE.width - PAGE.marginX, footerY, {
      align: 'right',
    });
  }

  const stamp = toManilaDate();
  doc.save(`mediabox-attendance-${stamp}.pdf`);
}

export async function exportSelfieReviewPDF(records, opts = {}) {
  return exportAttendancePDF(records, {
    orgName: opts.orgName || 'Media Box',
    dateRange: opts.dateRange || 'All Time',
    getSelfieUrl: opts.getSelfieUrl,
    formatTime: opts.formatTime || ((t) => t || '—'),
    hoursWorked: () => '—',
  });
}

export default { exportAttendancePDF, exportSelfieReviewPDF };