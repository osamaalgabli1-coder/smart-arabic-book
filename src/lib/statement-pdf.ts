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
        <td class="ltxt">${esc(e.description)}</td>
        <td class="deb">${formatNumber(e.debit || 0)}</td>
        <td class="cre">${formatNumber(e.credit || 0)}</td>
        <td class="bal">${formatBalanceNumber(running)}</td>
      </tr>`;
    }).join("");
    const finalBal = running;
    const finalLabel = finalBal >= 0 ? "لكم" : "عليكم";
    html += `
    <div class="cur-block">
      <div class="cur-title">${currencyLabels[cur]} (${currencySymbols[cur]})</div>
      <table>
        <colgroup>
          <col class="c-date"><col class="c-desc"><col class="c-deb"><col class="c-cre"><col class="c-bal">
        </colgroup>
        <thead>
          <tr><th>التاريخ</th><th>التفاصيل</th><th>عليه</th><th>له</th><th>الرصيد</th></tr>
        </thead>
        <tbody>
          <tr class="opening"><td colspan="4">الرصيد الافتتاحي</td><td class="bal">${formatBalanceNumber(opening)}</td></tr>
          ${bodyRows}
        </tbody>
        <tfoot>
          <tr class="totals">
            <td colspan="2" class="lbl">إجمالي العمليات</td>
            <td class="deb">${formatNumber(totalDebit)}</td>
            <td class="cre">${formatNumber(totalCredit)}</td>
            <td></td>
          </tr>
          <tr class="final">
            <td colspan="2" class="lbl">الرصيد الإجمالي — ${finalLabel}</td>
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
        <div class="side right">
          <div class="co-name">${esc(co.name)}</div>
          ${co.phone ? `<div>${esc(co.phone)}</div>` : ""}
          ${co.address ? `<div>${esc(co.address)}</div>` : ""}
          ${co.email ? `<div>${esc(co.email)}</div>` : ""}
        </div>
        <div class="center">
          ${co.logo ? `<img class="logo" src="${co.logo}" alt="شعار">` : ""}
        </div>
        <div class="side left">
          <div class="co-name">${esc(co.nameEn || co.name)}</div>
          ${co.phoneEn || co.phone ? `<div>${esc(co.phoneEn || co.phone || "")}</div>` : ""}
          ${co.addressEn || co.address ? `<div>${esc(co.addressEn || co.address || "")}</div>` : ""}
          ${co.emailEn || co.email ? `<div>${esc(co.emailEn || co.email || "")}</div>` : ""}
        </div>
      </div>
      <h2 class="statement-title">كشف حساب — ${esc(c.name)}</h2>
      <div class="meta sub">
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
  html, body { letter-spacing: normal; }
  body { font-family: "Tajawal","Cairo","Amiri","Segoe UI",Arial,sans-serif; color:#111; margin:0; width: 186mm; letter-spacing: 0 !important; word-spacing: 0.06em; -webkit-font-smoothing: antialiased; }
  table, th, td, div, span, h2 { letter-spacing: 0 !important; word-spacing: 0.06em; }
  .client { padding: 6px 0; width: 186mm; }
  .page-break { page-break-after: always; }
  .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom: 6px; margin-bottom: 6px; }
  .page-header .side { font-size: 12px; color:#111; line-height: 1.6; width: 38%; }
  .page-header .side.right { text-align: right; }
  .page-header .side.left { text-align: left; direction: ltr; }
  .page-header .center { width: 24%; text-align:center; }
  .co-name { font-weight: 800; font-size: 13px; }
  .logo { width: 66px; height: 66px; object-fit: contain; }
  .statement-title { text-align:center; color:#1a4b8f; text-decoration: underline; margin: 6px 0 2px; font-size: 17px; font-weight: 800; }
  .meta { text-align:center; font-size: 12px; color:#1a4b8f; margin-bottom: 10px; text-decoration: underline; }
  .cur-block { margin-top: 10px; }
  .cur-title { background:#eef3fb; color:#1a4b8f; font-weight:800; padding:6px 10px; border:1px solid #cfd8ea; border-bottom:none; border-radius:6px 6px 0 0; font-size: 13px; }
  table { width:100%; table-layout: fixed; border-collapse: collapse; font-size: 11.5px; }
  col.c-date { width: 16%; }
  col.c-desc { width: 30%; }
  col.c-deb { width: 18%; }
  col.c-cre { width: 18%; }
  col.c-bal { width: 18%; }
  th, td { border: 1px solid #666; padding: 7px 5px; text-align: center; overflow-wrap: anywhere; word-break: break-word; vertical-align: middle; }
  td:first-child { white-space: nowrap; font-size: 11px; }
  td.ltxt { font-size: 10.5px; line-height: 1.45; }
  th { background: #c9c9c9; color:#1a4b8f; font-weight:800; font-size: 13px; }
  td.ltxt { text-align: right; }
  td.deb { color:#111; font-weight:700; }
  td.cre { color:#111; font-weight:700; }
  td.bal { color:#c0392b; font-weight:800; }
  tr.opening td { background:#fafafa; font-weight:600; }
  tr.totals td { background:#e2e2e2; font-weight:800; }
  tr.totals td.deb { color:#c0392b; }
  tr.totals td.cre { color:#1e8e3e; }
  tr.totals td.lbl { color:#1a4b8f; background:#fff; }
  tr.final td { background:#f5a3a3; color:#111; font-weight:800; }
  tr.final td.lbl { color:#1a4b8f; background:#fff; }
  tr.final .final-val { color:#c0392b; font-size: 14px; }
  .empty { text-align:center; padding: 30px; color:#777; }
  .footer { display:flex; justify-content:space-between; font-size:11px; color:#666; margin-top: 8px; border-top:1px solid #ddd; padding-top: 4px; }
</style></head>
<body>
  ${clientsHtml || `<div class="empty">لا يوجد عملاء للطباعة</div>`}
  <div class="footer">
    <span>${esc(co.name)}${co.userName ? ` — اسم المستخدم: ${esc(co.userName)}` : ""}</span>
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

async function buildStatementPDFDoc(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const html = buildStatementHTML(clientIds, opts);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "760px";
  iframe.style.height = "1400px";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await new Promise((r) => setTimeout(r, 600));
  const body = doc.body;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const sections = Array.from(body.querySelectorAll<HTMLElement>("section.client"));
  const targets = sections.length ? sections : [body];
  for (let i = 0; i < targets.length; i++) {
    const canvas = await html2canvas(targets[i], { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const imgH = (canvas.height * pdfW) / canvas.width;
    if (imgH <= pdfH) {
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "PNG", 0, 0, pdfW, imgH, undefined, "FAST");
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
        const slice = c2.toDataURL("image/png");
        if (!first || i > 0) pdf.addPage();
        first = false;
        pdf.addImage(slice, "PNG", 0, 0, pdfW, (sliceH * pdfW) / canvas.width, undefined, "FAST");
        y += sliceH;
      }
    }
  }
  document.body.removeChild(iframe);
  return pdf;
}

export async function downloadStatementPDF(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const pdf = await buildStatementPDFDoc(clientIds, opts);
  const name = (opts.title ?? "كشف-حساب") + "-" + fileDate() + ".pdf";
  pdf.save(name);
}

// إنشاء ملف PDF ومشاركته مباشرة إلى واتساب رقم العميل (مع تنزيل احتياطي)
export async function sendClientStatementToWhatsapp(clientId: string, opts: { from?: string; to?: string } = {}) {
  const s = getState();
  const client = s.clients.find((c) => c.id === clientId);
  if (!client) throw new Error("no client");
  const title = `كشف-حساب-${client.name}`;
  const pdf = await buildStatementPDFDoc([clientId], { ...opts, title });
  const fileName = `${title}-${fileDate()}.pdf`;
  const blob = pdf.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title, text: `كشف حساب — ${client.name}` });
    return "shared" as const;
  }
  triggerDownload(fileName, blob);
  return "downloaded" as const;
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
