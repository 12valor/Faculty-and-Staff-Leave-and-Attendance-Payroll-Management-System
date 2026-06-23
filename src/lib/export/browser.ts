"use client";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function printPage() {
  window.focus();
  window.print();
}

export function printElement(selector: string, title: string) {
  const source = document.querySelector<HTMLElement>(selector);
  if (!source) {
    throw new Error(`Printable content not found: ${selector}`);
  }

  const printWindow = window.open("", "_blank", "popup,width=1100,height=850");
  if (!printWindow) {
    throw new Error("The print window was blocked. Allow pop-ups and try again.");
  }

  const styles = Array.from(
    document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    ),
  ).map((node) => node.outerHTML).join("\n");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <base href="${escapeAttribute(document.baseURI)}">
    <title>${escapeHtml(title)}</title>
    ${styles}
    <style>
      html, body {
        background: #fff !important;
        color: #0f172a !important;
        min-height: auto !important;
        overflow: visible !important;
      }
      body { margin: 0; padding: 16px; }
      .payroll-print-toolbar {
        position: sticky;
        top: 0;
        z-index: 9999;
        display: flex;
        justify-content: flex-end;
        padding: 12px;
        margin: -16px -16px 16px;
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
      }
      .payroll-print-toolbar button {
        border: 0;
        border-radius: 6px;
        background: #c8102e;
        color: #fff;
        cursor: pointer;
        font: 600 14px/1.2 Arial, sans-serif;
        padding: 10px 16px;
      }
      [data-payslip] {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
      [data-slot="table-container"] { overflow: visible !important; }
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        body { padding: 0 !important; }
        .payroll-print-toolbar { display: none !important; }
        [data-payslip] {
          border: 0 !important;
          border-radius: 0 !important;
          padding: 0 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
          zoom: 0.85;
        }
        [data-payslip] tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="payroll-print-toolbar">
      <button type="button" onclick="window.print()">Print Payroll</button>
    </div>
    ${source.outerHTML}
  </body>
</html>`);
  printWindow.document.close();

  const requestPrint = async () => {
    await printWindow.document.fonts?.ready;
    await waitForImages(printWindow.document);
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    window.setTimeout(requestPrint, 250);
  } else {
    printWindow.addEventListener("load", () => {
      window.setTimeout(requestPrint, 250);
    }, { once: true });
  }
}

function waitForImages(documentToPrint: Document) {
  const pendingImages = Array.from(documentToPrint.images)
    .filter((image) => !image.complete)
    .map((image) => new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }));

  return Promise.all(pendingImages);
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
