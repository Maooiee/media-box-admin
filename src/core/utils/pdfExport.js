// admin-panel/src/core/utils/pdfExport.js
//
// Modern Attendance Report PDF generator.
// Uses jsPDF + jspdf-autotable.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
 * Split a string into lines that fit within maxWidth at the current font.
 */
function wrapText(doc, text, maxWidth) {
  if (!text) return [''];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (doc.getTextWidth(test) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
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
function drawHeader(doc, { orgName, dateRange, recordCount }) {
  const { marginX, width } = PAGE;
  const bannerH = 88;

  // Banner
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, width, bannerH, 'F');

  // Darker strip at the bottom of the banner
  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, bannerH - 2, width, 2, 'F');

  // Logo mark
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

  // Org name + subtitle
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(orgName || 'Media Box', logoX + logoSize + 16, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Attendance Report', logoX + logoSize + 16, 58);

  // Right-aligned meta
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

    // Card
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'FD');

    // Accent bar
    doc.setFillColor(...(c.accent || COLORS.primary));
    doc.roundedRect(x + 6, y + 10, 3, cardH - 20, 1.5, 1.5, 'F');

    // Label
    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(c.label).toUpperCase(), x + 14, y + 20);

    // Value
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

  drawHeader(doc, { orgName, dateRange, recordCount: records.length });

  let y = 116;
  y = drawStatCards(doc, y, [
    { label: 'Total Records', value: records.length, accent: COLORS.ink, color: COLORS.ink },
    { label: 'Present', value: present, accent: COLORS.green, color: COLORS.green },
    { label: 'Late', value: late, accent: COLORS.amber, color: COLORS.amber },
    { label: 'Absent', value: absent, accent: COLORS.red, color: COLORS.red },
  ]);

  y += 22;

  // Section title
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

  // ─── Build body rows ───
  // Columns: [avatar, employee, id, date, in, out, hours, status, notes]
  const body = records.map((r) => [
    '',                                // avatar (drawn in didDrawCell)
    r.employeeName || '—',
    r.employeeId || '—',
    r.date || '—',
    formatTime(r.timeIn),
    formatTime(r.timeOut),
    hoursWorked(r),
    (r.status || '').toUpperCase(),
    r.notes || r.admin_note || '—',    // Notes column
  ]);

  autoTable(doc, {
    startY: y,
    head: [['', 'EMPLOYEE', 'ID', 'DATE', 'IN', 'OUT', 'HOURS', 'STATUS', 'NOTES']],
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
      1: { cellWidth: 78, fontStyle: 'bold', textColor: COLORS.ink, fontSize: 8 },
      2: { cellWidth: 44, fontSize: 7.5, textColor: COLORS.soft },
      3: { cellWidth: 54, fontSize: 7.5, textColor: COLORS.soft },
      4: { cellWidth: 42, fontSize: 7.5 },
      5: { cellWidth: 42, fontSize: 7.5 },
      6: { cellWidth: 40, fontSize: 7.5, fontStyle: 'bold', textColor: COLORS.ink },
      7: { cellWidth: 52, halign: 'center' },
      8: { cellWidth: 'auto', fontSize: 7.5, textColor: COLORS.body, fontStyle: 'normal' },
    },
    didParseCell: (data) => {
      // Gray out em-dash notes
      if (data.section === 'body' && data.column.index === 8) {
        if (data.cell.raw === '—') {
          data.cell.styles.textColor = COLORS.faint;
          data.cell.styles.halign = 'center';
        }
      }
      // Make absent/late employee names slightly muted
      if (data.section === 'body' && data.column.index === 1) {
        const status = String(body[data.row.index][7]).toLowerCase();
        if (status === 'absent') {
          data.cell.styles.textColor = COLORS.soft;
        }
      }
    },
    didDrawCell: (data) => {
      // ─── Avatar / photo cell ───
      if (data.section === 'body' && data.column.index === 0) {
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

        // Border on top
        doc.setDrawColor(...COLORS.line);
        doc.setLineWidth(0.5);
        doc.roundedRect(cx, cy, size, size, radius, radius, 'S');
      }

      // ─── Status pill ───
      if (
        data.section === 'body' &&
        data.column.index === 7 &&
        data.cell.raw
      ) {
        const status = String(data.cell.raw).toLowerCase();
        let bg = COLORS.slateSoft;
        let fg = COLORS.slate;
        if (status === 'present') {
          bg = COLORS.greenSoft;
          fg = COLORS.green;
        } else if (status === 'late') {
          bg = COLORS.amberSoft;
          fg = COLORS.amber;
        } else if (status === 'absent') {
          bg = COLORS.redSoft;
          fg = COLORS.red;
        } else if (status === 'on_leave' || status === 'on leave') {
          bg = COLORS.blueSoft;
          fg = COLORS.blue;
        }

        const label = String(data.cell.raw).toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const textW = doc.getTextWidth(label);
        const padX = 8;
        const pillW = Math.min(textW + padX * 2, data.cell.width - 8);
        const pillH = 15;
        const px = data.cell.x + (data.cell.width - pillW) / 2;
        const py = data.cell.y + (data.cell.height - pillH) / 2;

        doc.setFillColor(...bg);
        doc.roundedRect(px, py, pillW, pillH, pillH / 2, pillH / 2, 'F');

        doc.setTextColor(...fg);
        doc.text(label, px + pillW / 2, py + pillH / 2 + 2, {
          align: 'center',
          maxWidth: pillW - 4,
        });

        data.cell.text = [];
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

    // Thin rule
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.5);
    doc.line(
      PAGE.marginX,
      PAGE.height - PAGE.marginBottom + 12,
      PAGE.width - PAGE.marginX,
      PAGE.height - PAGE.marginBottom + 12
    );

    // Left label with brand dot
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

    // Right label
    doc.setTextColor(...COLORS.soft);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Page ${i} of ${pageCount}`, PAGE.width - PAGE.marginX, footerY, {
      align: 'right',
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`mediabox-attendance-${stamp}.pdf`);
}

// Kept for compatibility
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