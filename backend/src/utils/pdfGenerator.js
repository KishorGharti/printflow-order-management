'use strict';

const PDFDocument = require('pdfkit');

/**
 * Generates an A4 Landscape Monthly Financial Statement & Balance Sheet PDF as a Buffer.
 *
 * @param {Object} options
 * @param {string} options.month - 'YYYY-MM'
 * @param {string} [options.title]
 * @param {string} [options.periodStart]
 * @param {string} [options.periodEnd]
 * @param {number} [options.totalRevenue]
 * @param {number} [options.orderCount]
 * @param {Array<Object>} [options.orders]
 * @param {string} [options.shopName]
 * @returns {Promise<Buffer>}
 */
function generateMonthlyLedgerPdf(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const {
        month = new Date().toISOString().slice(0, 7),
        title = `Monthly Financial Statement & Balance Sheet (${month})`,
        periodStart = `${month}-01`,
        periodEnd = `${month}-31`,
        totalRevenue = 0,
        orderCount = 0,
        orders = [],
        shopName = 'Print Ghar',
      } = options;

      // A4 Landscape: 841.89 x 595.28 points
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
        info: {
          Title: title,
          Author: shopName,
          Subject: `Monthly Financial Statement for ${month}`,
          CreationDate: new Date(),
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2;

      // Header Background Bar
      doc.rect(margin, margin, contentWidth, 54).fill('#0f172a');

      // Header Text
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
        .text(shopName.toUpperCase(), margin + 16, margin + 12);
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
        .text('Financial Statement & Monthly Balance Sheet', margin + 16, margin + 32);

      doc.fillColor('#38bdf8').fontSize(12).font('Helvetica-Bold')
        .text(`PERIOD: ${month}`, margin, margin + 14, { align: 'right', width: contentWidth - 16 });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(`${periodStart} to ${periodEnd}`, margin, margin + 32, { align: 'right', width: contentWidth - 16 });

      // Summary Metric Cards (4 Cards)
      const cardY = margin + 64;
      const cardWidth = (contentWidth - 24) / 4;
      const cardHeight = 44;

      const summaryCards = [
        { label: 'Total Orders', value: String(orderCount || orders.length), color: '#4f46e5', bg: '#eef2ff' },
        { label: 'Total Revenue', value: `Rs. ${(totalRevenue || 0).toLocaleString()}`, color: '#059669', bg: '#ecfdf5' },
        { label: 'Statement Month', value: month, color: '#0284c7', bg: '#f0f9ff' },
        { label: 'Status', value: 'Archived to Cloud', color: '#7c3aed', bg: '#f5f3ff' },
      ];

      summaryCards.forEach((card, idx) => {
        const x = margin + idx * (cardWidth + 8);
        doc.rect(x, cardY, cardWidth, cardHeight).fillAndStroke(card.bg, '#cbd5e1');
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold')
          .text(card.label.toUpperCase(), x + 8, cardY + 7);
        doc.fillColor(card.color).fontSize(12).font('Helvetica-Bold')
          .text(card.value, x + 8, cardY + 22);
      });

      // Transaction Table Header
      let tableY = cardY + 54;
      const cols = [
        { name: 'S.N.', width: 32, align: 'center' },
        { name: 'Date', width: 68, align: 'left' },
        { name: 'Job / Order #', width: 90, align: 'left' },
        { name: 'Customer / Client Name', width: 180, align: 'left' },
        { name: 'Payment Method', width: 95, align: 'left' },
        { name: 'Payment Status', width: 90, align: 'left' },
        { name: 'Total Amount (Rs.)', width: 110, align: 'right' },
        { name: 'Status', width: 95, align: 'center' },
      ];

      doc.rect(margin, tableY, contentWidth, 20).fill('#1e293b');
      let currentX = margin;
      cols.forEach((col) => {
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text(col.name, currentX + 4, tableY + 5, { width: col.width - 8, align: col.align });
        currentX += col.width;
      });

      tableY += 20;

      // Table Rows
      const rows = orders.slice(0, 18); // Show up to 18 rows on primary page or summarize
      if (rows.length === 0) {
        doc.rect(margin, tableY, contentWidth, 24).fill('#f8fafc');
        doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique')
          .text('No completed orders recorded for this month.', margin, tableY + 7, { align: 'center', width: contentWidth });
        tableY += 24;
      } else {
        rows.forEach((ord, index) => {
          const isEven = index % 2 === 0;
          doc.rect(margin, tableY, contentWidth, 18).fill(isEven ? '#ffffff' : '#f8fafc');

          let cellX = margin;
          const rowData = [
            String(index + 1),
            ord.orderDate || (ord.createdAt ? String(ord.createdAt).slice(0, 10) : '—'),
            ord.orderNumber || '—',
            ord.customerName || 'Walk-in Customer',
            ord.paymentMethod || 'Cash',
            ord.paymentStatus || 'Paid',
            `Rs. ${(Number(ord.totalAmount) || 0).toLocaleString()}`,
            ord.status || 'Done',
          ];

          cols.forEach((col, cIdx) => {
            const val = rowData[cIdx];
            doc.fillColor('#1e293b').fontSize(7.5).font(cIdx === 6 ? 'Helvetica-Bold' : 'Helvetica')
              .text(val, cellX + 4, tableY + 4, { width: col.width - 8, align: col.align });
            cellX += col.width;
          });

          tableY += 18;
        });
      }

      // Bottom Total Summary Bar
      doc.rect(margin, tableY, contentWidth, 22).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
        .text('MONTHLY REVENUE TOTAL', margin + 12, tableY + 6);
      doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold')
        .text(`Rs. ${(totalRevenue || 0).toLocaleString()}`, margin, tableY + 6, { align: 'right', width: contentWidth - 16 });

      tableY += 30;

      // Footer Notes & Signature
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text(`Generated automatically by Print Ghar System on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })} NPT • Cloud-Archived Statement`, margin, pageHeight - 48);

      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
        .text('Page 1 of 1 • Official Business Financial Record', margin, pageHeight - 36, { align: 'center', width: contentWidth });

      // Finalize PDF stream
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateMonthlyLedgerPdf,
};
