import { getState, clientLedger, formatNumber, currencySymbols, currencyLabels, CURRENCIES, type Client, type Currency } from "@/lib/store";

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
        <td class="bal">${formatNumber(running)}</td>
      </tr>`;
    }).join("");
    const finalBal = running;
    const finalLabel = finalBal >= 0 ? "له" : "عليه";
    html += `
    <div class="cur-block">
      <div class="cur-title">${currencyLabels[cur]} (${currencySymbols[cur]})</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>رقم السند</th><th>التفاصيل</th><th>عليه</th><th>له</th><th>الرصيد</th></tr>
        </thead>
        <tbody>
          <tr class="opening"><td colspan="5">الرصيد الافتتاحي</td><td class="bal">${formatNumber(opening)}</td></tr>
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

function buildStatementHTML(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}): string {
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
  body { font-family: "Cairo","Tajawal","Segoe UI",Arial,sans-serif; color:#111; margin:0; }
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
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
  return html;
}

export function openStatementPDF(clientIds: string[], opts: { from?: string; to?: string; title?: string } = {}) {
  const html = buildStatementHTML(clientIds, opts);
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
