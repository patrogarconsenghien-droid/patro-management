// Export du rapport annuel en fichier HTML autonome : lisible tel quel dans un
// navigateur, imprimable en PDF, et envoyable par mail sans dépendance.
import { formatCurrency, plural } from './format';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const eur = (value) => escapeHtml(formatCurrency(value));

const table = (headers, rows) => {
  if (!rows.length) return '<p class="empty">Aucune donnée sur la période.</p>';
  return `<table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
};

const kpi = (label, value, hint) => `
  <div class="kpi">
    <span class="kpi-label">${escapeHtml(label)}</span>
    <span class="kpi-value">${value}</span>
    ${hint ? `<span class="kpi-hint">${escapeHtml(hint)}</span>` : ''}
  </div>`;

export function buildReportHtml(report) {
  const { meta, summary, bar, jobs, finance, members, stock, months } = report;
  const generated = meta.generatedAt.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rapport ${escapeHtml(meta.label)} — Patro</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 64px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; background: #f9fafb; }
  main { max-width: 900px; margin: 0 auto; }
  header { border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 28px; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  .subtitle { margin: 0; color: #6b7280; font-size: 14px; }
  section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  h2 { margin: 0 0 16px; font-size: 18px; color: #7c3aed; }
  h3 { margin: 20px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 2px; }
  .kpi-label { font-size: 12px; color: #6b7280; }
  .kpi-value { font-size: 20px; font-weight: 700; }
  .kpi-hint { font-size: 11px; color: #9ca3af; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  td.num, th.num { text-align: right; }
  .positive { color: #059669; font-weight: 600; }
  .negative { color: #dc2626; font-weight: 600; }
  .empty { color: #9ca3af; font-style: italic; font-size: 14px; margin: 0; }
  .note { font-size: 12px; color: #6b7280; background: #f3f4f6; border-left: 3px solid #d1d5db; padding: 10px 12px; border-radius: 0 6px 6px 0; margin-top: 16px; }
  footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 32px; }
  @media print {
    body { background: #fff; padding: 0; }
    section { break-inside: avoid; border: none; padding: 0 0 12px; }
  }
</style>
</head>
<body>
<main>
  <header>
    <h1>Rapport annuel — ${escapeHtml(meta.label)}</h1>
    <p class="subtitle">Gestion Patro · généré le ${escapeHtml(generated)}</p>
  </header>

  <section>
    <h2>Synthèse</h2>
    <div class="kpis">
      ${kpi('Total encaissé', eur(summary.totalIn), 'rechargements + boulots payés + rentrées')}
      ${kpi('Total dépensé', eur(summary.expenseTotal), 'frais enregistrés')}
      ${kpi('Résultat net', `<span class="${summary.netResult >= 0 ? 'positive' : 'negative'}">${eur(summary.netResult)}</span>`)}
      ${kpi('Consommation bar', eur(summary.barRevenue), plural(bar.orderCount, 'commande'))}
      ${kpi('Boulots', eur(summary.jobRevenue), `${summary.jobHours} h prestées`)}
    </div>
    <p class="note">Les commandes du bar sont débitées du solde des membres : elles mesurent
    la consommation, pas l'argent encaissé. Seuls les rechargements et remboursements
    entrent dans le total encaissé, afin d'éviter tout double comptage.</p>
  </section>

  <section>
    <h2>Bar</h2>
    <div class="kpis">
      ${kpi('Consommation', eur(bar.revenue))}
      ${kpi('Commandes', escapeHtml(bar.orderCount))}
      ${kpi('Panier moyen', eur(bar.averageBasket))}
      ${kpi('Articles vendus', escapeHtml(bar.itemsSold))}
      ${kpi('Encaissé (recharges)', eur(bar.collected), plural(bar.topUpCount, 'opération'))}
      ${kpi('Membres actifs', escapeHtml(bar.activeMembers))}
    </div>

    <h3>Répartition des encaissements</h3>
    ${table(['Moyen de paiement', 'Montant'], [
      ['Cash', `<span class="num">${eur(bar.paymentSplit.cash)}</span>`],
      ['Compte', `<span class="num">${eur(bar.paymentSplit.account)}</span>`],
      ...(bar.paymentSplit.unknown ? [['Non précisé', `<span class="num">${eur(bar.paymentSplit.unknown)}</span>`]] : [])
    ])}

    <h3>Top produits (quantité)</h3>
    ${table(['Produit', 'Quantité', 'Chiffre'], bar.topProductsByQuantity.map((p) => [
      escapeHtml(p.name), `<span class="num">${escapeHtml(p.quantity)}</span>`, `<span class="num">${eur(p.total)}</span>`
    ]))}

    <h3>Top consommateurs</h3>
    ${table(['Membre', 'Commandes', 'Total'], bar.topMembers.map((m) => [
      escapeHtml(m.name), `<span class="num">${escapeHtml(m.orders)}</span>`, `<span class="num">${eur(m.total)}</span>`
    ]))}
  </section>

  <section>
    <h2>Boulots</h2>
    <div class="kpis">
      ${kpi('Boulots réalisés', escapeHtml(jobs.count))}
      ${kpi('Heures prestées', `${escapeHtml(jobs.hours)} h`)}
      ${kpi('Montant total', eur(jobs.revenue))}
      ${kpi('Déjà encaissé', eur(jobs.paid))}
      ${kpi('En attente', `<span class="${jobs.pending > 0 ? 'negative' : 'positive'}">${eur(jobs.pending)}</span>`)}
      ${kpi('Taux horaire moyen', `${eur(jobs.averageRate)}/h`)}
    </div>

    <h3>Bro les plus actifs</h3>
    ${table(['Bro', 'Boulots', 'Heures', 'Montant'], jobs.topBros.map((b) => [
      escapeHtml(b.name), `<span class="num">${escapeHtml(b.jobs)}</span>`,
      `<span class="num">${escapeHtml(b.hours)} h</span>`, `<span class="num">${eur(b.total)}</span>`
    ]))}
  </section>

  <section>
    <h2>Finances</h2>
    <div class="kpis">
      ${kpi('Rentrées', eur(finance.incomeTotal), plural(finance.incomeCount, 'opération'))}
      ${kpi('Frais', eur(finance.expenseTotal), plural(finance.expenseCount, 'opération'))}
    </div>

    <h3>Rentrées par catégorie</h3>
    ${table(['Catégorie', 'Nombre', 'Montant'], finance.incomeByCategory.map((c) => [
      escapeHtml(c.name), `<span class="num">${escapeHtml(c.count)}</span>`, `<span class="num">${eur(c.total)}</span>`
    ]))}

    <h3>Frais par catégorie</h3>
    ${table(['Catégorie', 'Nombre', 'Montant'], finance.expenseByCategory.map((c) => [
      escapeHtml(c.name), `<span class="num">${escapeHtml(c.count)}</span>`, `<span class="num">${eur(c.total)}</span>`
    ]))}

    <h3>Plus grosses dépenses</h3>
    ${table(['Description', 'Date', 'Montant'], finance.biggestExpenses.map((e) => [
      escapeHtml(e.description), escapeHtml(e.date ? e.date.toLocaleDateString('fr-FR') : '—'),
      `<span class="num">${eur(e.amount)}</span>`
    ]))}
  </section>

  <section>
    <h2>Membres</h2>
    <div class="kpis">
      ${kpi('Membres inscrits', escapeHtml(members.total), `dont ${members.external} externes`)}
      ${kpi('Actifs sur la période', escapeHtml(members.active))}
      ${kpi('En négatif', escapeHtml(members.debtorCount))}
      ${kpi('Dettes à récupérer', `<span class="negative">${eur(Math.abs(members.totalDebt))}</span>`, plural(members.debtorCount, 'membre'))}
      ${kpi('Crédits sur comptes', eur(members.totalCredit))}
    </div>

    <h3>Soldes négatifs</h3>
    ${table(['Membre', 'Solde'], members.topDebtors.map((m) => [
      escapeHtml(m.name), `<span class="num negative">${eur(m.balance)}</span>`
    ]))}
    <p class="note">Les soldes sont une photo de la situation au moment de la génération,
    pas un cumul sur la période.</p>
  </section>

  <section>
    <h2>Stock</h2>
    <div class="kpis">
      ${kpi('Produits à la carte', escapeHtml(stock.productCount))}
      ${kpi('Unités sorties', escapeHtml(stock.unitsSold))}
      ${kpi('Mouvements', escapeHtml(stock.movements))}
    </div>

    <h3>Sous le seuil d'alerte (aujourd'hui)</h3>
    ${table(['Produit', 'Stock', 'Seuil'], stock.lowStock.map((p) => [
      escapeHtml(p.name), `<span class="num">${escapeHtml(p.stock)}</span>`, `<span class="num">${escapeHtml(p.threshold ?? '—')}</span>`
    ]))}
  </section>

  <section>
    <h2>Mois par mois</h2>
    ${table(['Mois', 'Consommation bar', 'Encaissé', 'Boulots payés', 'Frais'], months.map((m) => [
      escapeHtml(m.label),
      `<span class="num">${eur(m.barSales)}</span>`,
      `<span class="num">${eur(m.collected)}</span>`,
      `<span class="num">${eur(m.jobRevenue)}</span>`,
      `<span class="num">${eur(m.expenses)}</span>`
    ]))}
  </section>

  <footer>Rapport généré automatiquement par Gestion Patro</footer>
</main>
</body>
</html>`;
}

export function downloadReport(report) {
  const html = buildReportHtml(report);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rapport-patro-${report.meta.mode === 'patro' ? `${report.meta.year}-${report.meta.year + 1}` : report.meta.year}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Ouvre le rapport dans un onglet et déclenche l'impression (donc le PDF). */
export function printReport(report) {
  const win = window.open('', '_blank');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Autorisez les pop-ups pour ce site.");
    return;
  }
  win.document.write(buildReportHtml(report));
  win.document.close();
  win.focus();

  // Après un document.write, le load a souvent déjà eu lieu au moment où on
  // s'y abonne : on teste l'état plutôt que d'attendre l'événement.
  if (win.document.readyState === 'complete') {
    win.print();
  } else {
    win.addEventListener('load', () => win.print());
  }
}
