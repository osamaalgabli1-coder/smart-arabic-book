import { getState, clientLedger, clientBalance, formatNumber, formatBalanceNumber, currencySymbols, currencyLabels, CURRENCIES, type Client, type Currency } from "@/lib/store";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string));
}

function renderClientBlock(client: Client, opts: { from?: string; to?: string }): string {
  const s = getState();
  const ledger = clientLedger(s, client.id);
  const openingCur: Currency = client.openingCurrency ?? "YER";
  let html = "";
  for (const cur of CURRENCIES) {
    const rows = ledger[cur].filter((e) => (opts.from ? e.date >= opts.from : true) && (opts.to ? e.date <= opts.to : true));
    const opening = openingCur === cur ? (client.openingBalance || 0) : 0;
    if (rows.length === 0 && opening === 0) continue;
    let running = opening;
    let totalDebit = 0, totalCredit = 0;
    const bodyRows = rows.map((e) => {
      running += e.credit - e.debit;
      totalDebit += e.debit; totalCredit += e.credit;
      return `<tr>
        <td>${esc(e.date)}</td>
        <td>${esc(e.number)}</td>
        <td class="ltxt">${esc(e.description)}</td>
        <td class="deb">${e.debit ? formatNumber(e.debit) : "—"}</td>
        <td class="cre">${e.credit ? formatNumber(e.credit) : "—"}</td>
        <td class="bal">${formatBalanceNumber(running)}</td>
      </tr>`;
    }).join("");
    const finalBal = running;
    const finalLabel = finalBal >= 0 ? "لكم" : "عليكم";
    html += `
    <div class="cur-block">
      <div class="cur-title">${currencyLabels[cur]} (${currencySymbols[cur]})</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>رقم السند</th><th>التفاصيل</th><th>عليه</th><th>له</th><th>الرصيد</th></tr>
        </thead>
        <tbody>
          <tr class="opening"><td colspan="5">الرصيد الافتتاحي</td><td class="bal">${formatBalanceNumber(opening)}</td></tr>
          ${bodyRows}
        </tbody>
        <tfoot>
          <tr class="totals">
            <td colspan="3" class="lbl">إجمالي العمليات</td>
            <td class="deb">${formatNumber(totalDebit)}</td>
            <td class="cre">${formatNumber(totalCredit)}</td>
            <td></td>
          </tr>
          <tr class="final">
            <td colspan="3" class="lbl">الرصيد الإجمالي — ${finalLabel}</td>
            <td colspan="3" class="final-val">${formatNumber(Math.abs(finalBal))} ${currencySymbols[cur]}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }
  if (!html) html = `<div class="empty">لا توجد عمليات لهذا العميل</div>`;
  return html;
}

function buildStatementHTML(clientIds: string[], opts: { from?: string; to?: string; title?: string; autoPrint?: boolean } = {}): string {
  const s = getState();
  const co = s.company;
  const today = new Date().toISOString().slice(0, 10);
  const title = opts.title ?? "كشف حساب تفصيلي";
  const clients = clientIds.map((id) => s.clients.find((c) => c.id === id)).filter(Boolean) as Client[];

  const clientsHtml = clients.map((c) => `
    <section class="client">
      <div class="page-header">
        <div class="left">
          ${co.logo ? `<img class="logo" src="${co.logo}" alt="شعار">` : ""}
        </div>
        <div class="right">
          <div class="co-name">${esc(co.name)}</div>
          ${co.phone ? `<div>${esc(co.phone)}</div>` : ""}
          ${co.address ? `<div>${esc(co.address)}</div>` : ""}
          ${co.email ? `<div>${esc(co.email)}</div>` : ""}
        </div>
      </div>
      <h2 class="statement-title">كشف حساب — ${esc(c.name)}</h2>
      <div class="meta">
        ${c.phone ? `الهاتف: ${esc(c.phone)} · ` : ""}
        ${opts.from || opts.to ? `الفترة: ${opts.from || "—"} إلى ${opts.to || "—"}` : `حتى ${today}`}
      </div>
      ${renderClientBlock(c, opts)}
    </section>
  `).join('<div class="page-break"></div>');

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Amiri","Tajawal","Cairo","Segoe UI",Arial,sans-serif; color:#111; margin:0; letter-spacing: 0.03em; word-spacing: 0.12em; }
  table, th, td { letter-spacing: 0.04em; word-spacing: 0.14em; }
  .statement-title, .co-name, .cur-title { letter-spacing: 0.06em; }
  .client { padding: 8px 0; }
  .page-break { page-break-after: always; }
  .page-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; }
  .page-header .right { text-align: left; font-size: 12px; color:#333; }
  .page-header .left { text-align: right; }
  .co-name { font-weight: 800; font-size: 14px; }
  .logo { width: 70px; height: 70px; object-fit: contain; }
  .statement-title { text-align:center; color:#1a4b8f; text-decoration: underline; margin: 8px 0; font-size: 18px; }
  .meta { text-align:center; font-size: 12px; color:#444; margin-bottom: 8px; }
  .cur-block { margin-top: 10px; }
  .cur-title { background:#eef3fb; color:#1a4b8f; font-weight:800; padding:6px 10px; border:1px solid #cfd8ea; border-bottom:none; border-radius:6px 6px 0 0; font-size: 13px; }
  table { width:100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: center; }
  th { background: #e9e9e9; color:#111; font-weight:700; }
  td.ltxt { text-align: right; }
  td.deb { color:#c0392b; font-weight:700; }
  td.cre { color:#1e8e3e; font-weight:700; }
  td.bal { color:#c0392b; font-weight:800; }
  tr.opening td { background:#fafafa; font-weight:600; }
  tr.totals td { background:#f2f2f2; font-weight:800; }
  tr.totals td.lbl { color:#1a4b8f; }
  tr.final td { background:#fce4e4; color:#111; font-weight:800; }
  tr.final td.lbl { color:#1a4b8f; }
  tr.final .final-val { color:#c0392b; font-size: 14px; }
  .empty { text-align:center; padding: 30px; color:#777; }
  .footer { display:flex; justify-content:space-between; font-size:11px; color:#666; margin-top: 8px; border-top:1px solid #ddd; padding-top: 4px; }
</style></head>
<body>
  ${clientsHtml || `<div class="empty">لا يوجد عملاء للطباعة</div>`}
  <div class="footer">
    <span>${esc(co.name)}</span>
    <span>${today}</span>
  </div>
  ${opts.autoPrint ? `<script>window.onload = () => setTimeout(() => window.print(), 300);</script>` : ""}
</body></html>`;
  return html;
}

export function openStatementPDF(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const html = buildStatementHTML(clientIds, { ...opts, autoPrint: true });
  const w = window.open("", "_blank");
  if (!w) { alert("الرجاء السماح بفتح النوافذ للطباعة"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

export function downloadStatementHTML(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const html = buildStatementHTML(clientIds, opts);
  const name = (opts.title ?? "كشف-حساب") + "-" + new Date().toISOString().slice(0, 10) + ".html";
  const blob = new Blob(["\uFEFF" + html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileDate() { return new Date().toISOString().slice(0, 10); }

export async function downloadStatementPDF(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const html = buildStatementHTML(clientIds, opts);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "1200px";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await new Promise((r) => setTimeout(r, 400));
  const body = doc.body;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const sections = Array.from(body.querySelectorAll<HTMLElement>("section.client"));
  const targets = sections.length ? sections : [body];
  for (let i = 0; i < targets.length; i++) {
    const canvas = await html2canvas(targets[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    const imgH = (canvas.height * pdfW) / canvas.width;
    if (imgH <= pdfH) {
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, pdfW, imgH);
    } else {
      // paginate a single tall section
      const pageCanvasH = (canvas.width * pdfH) / pdfW;
      let y = 0; let first = true;
      while (y < canvas.height) {
        const sliceH = Math.min(pageCanvasH, canvas.height - y);
        const c2 = document.createElement("canvas");
        c2.width = canvas.width; c2.height = sliceH;
        const ctx = c2.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c2.width, c2.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const slice = c2.toDataURL("image/jpeg", 0.92);
        if (!first || i > 0) pdf.addPage();
        first = false;
        pdf.addImage(slice, "JPEG", 0, 0, pdfW, (sliceH * pdfW) / canvas.width);
        y += sliceH;
      }
    }
  }
  document.body.removeChild(iframe);
  const name = (opts.title ?? "كشف-حساب") + "-" + fileDate() + ".pdf";
  pdf.save(name);
}

export function downloadStatementJSON(clientIds: string[], opts: { from?: string; to?: string; title?: string; mode?: "detailed" | "summary" } = {}) {
  const s = getState();
  const mode = opts.mode ?? "detailed";
  const clients = clientIds.map((id) => s.clients.find((c) => c.id === id)).filter(Boolean) as Client[];
  const payload = {
    company: s.company,
    generatedAt: new Date().toISOString(),
    period: { from: opts.from ?? null, to: opts.to ?? null },
    mode,
    clients: clients.map((c) => {
      const ledger = clientLedger(s, c.id);
      const perCurrency: Record<string, unknown> = {};
      for (const cur of CURRENCIES) {
        const rows = ledger[cur].filter((e) => (opts.from ? e.date >= opts.from : true) && (opts.to ? e.date <= opts.to : true));
        const opening = (c.openingCurrency ?? "YER") === cur ? (c.openingBalance || 0) : 0;
        let running = opening; let totalDebit = 0; let totalCredit = 0;
        const entries = rows.map((e) => { running += e.credit - e.debit; totalDebit += e.debit; totalCredit += e.credit; return { ...e, balance: running }; });
        perCurrency[cur] = mode === "detailed"
          ? { opening, entries, totalDebit, totalCredit, closing: running }
          : { opening, totalDebit, totalCredit, closing: running };
      }
      return {
        id: c.id,
        name: c.name,
        phone: c.phone ?? null,
        address: c.address ?? null,
        balance: clientBalance(s, c.id),
        perCurrency,
      };
    }),
  };
  const name = (opts.title ?? "كشف-حساب") + "-" + fileDate() + ".json";
  triggerDownload(name, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
}
