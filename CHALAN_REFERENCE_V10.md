# Chalan Reference V10

Added a new Delivery Chalan system based on the supplied `chalan.pdf` reference.

## Chalan layout
- A5 portrait fixed reference layout.
- Blank company-design area at the top, matching the Bill workflow.
- Client name, address, PAN and phone.
- Delivery Chalan title, Chalan number and Bill Issue Date.
- 14 table rows with S.N., Description, Qty and Remarks.
- Quantity includes unit.
- Terms and conditions bar.
- Dispatch Type auto-fills from order status:
  - Pickup -> Pickup + pickup person name.
  - Delivery -> Delivery + assigned delivery person / transport.
  - Other stages -> blank dispatch placeholders.
- Authorized Signature and Company Stamp labels stay as in the supplied PDF.
- Footer and page number.

## Chalan designer
Profile -> Invoice & Job Numbering now has:
- Numbering
- Bill Design
- Chalan Design

Chalan Design includes:
- JPG/PNG company design upload.
- Fit Inside / Fit to Placeholder / Manual sizing.
- Optional reuse of the Bill company artwork without storing a duplicate image.
- Table text-size number input.
- Terms and conditions input.
- Default remarks fallback.
- Footer text and page-number toggle.
- Exact PDF live preview using the same renderer as final output.

## More than 14 items
The supplied Chalan reference contains one 14-row page only. To prevent item loss, the current implementation continues in additional pages using the same Chalan page layout with 14 rows per page. If a separate continuation-page design is required, provide that PDF and it can replace this fallback.

## Validation
- `npm test`: 80/80 passed.
- `npm run build`: passed.
- `node --check dist/app.js`: passed.
