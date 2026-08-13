import { escapeHtml, formatCents, formatDate, formatMonth, percent, setHidden } from '../utils.js';
import { getBufferVisualState } from '../services/buffer-status.js';

const SEGMENT_TOKEN_BY_KEY = {
  fixed: '--chart-fixed', periodic: '--chart-periodic', loans: '--chart-loans', extra: '--chart-extra', overspend: '--chart-overspend',
  reserves: '--chart-reserves', savings: '--chart-savings', goals: '--chart-goals', budgetSpent: '--chart-budget-spent', goalSpent: '--chart-goal-spent'
};

function groupLabel(group) {
  return group === 'reserve' ? 'Reservierungen' : group === 'saving' ? 'Sparen / Vermögensverschiebung' : group === 'available' ? 'Noch verfügbar' : 'Tatsächliche Kosten';
}

function cssToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function segmentCssColor(segment, index = 0) {
  const token = SEGMENT_TOKEN_BY_KEY[segment?.key] || (segment?.group === 'available' ? `--chart-available-${(index % 6) + 1}` : '');
  return token ? `var(${token})` : (segment?.color || 'var(--accent)');
}

function segmentCanvasColor(segment, index = 0) {
  const token = SEGMENT_TOKEN_BY_KEY[segment?.key] || (segment?.group === 'available' ? `--chart-available-${(index % 6) + 1}` : '');
  if (token) return cssToken(token) || cssToken('--accent');
  if (String(segment?.color || '').startsWith('var(')) {
    const variable = String(segment.color).match(/var\((--[^)]+)\)/)?.[1];
    return (variable && cssToken(variable)) || cssToken('--accent');
  }
  return segment?.color || cssToken('--accent');
}

function drawDonut(canvas, data, selectedKey, onSelect) {
  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.max(220, Math.min(rect.width || 320, 390));
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  const cx = cssSize / 2, cy = cssSize / 2, r = cssSize * .39, line = cssSize * .16;
  const total = data?.totalCents || 0, segments = data?.segments || [], hits = [];
  ctx.lineWidth = line;
  ctx.lineCap = 'butt';
  if (!(total > 0)) {
    ctx.strokeStyle = cssToken('--line');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let angle = -Math.PI / 2;
    const gap = Math.min(.025, Math.PI * 2 / (segments.length * 20 || 1));
    segments.forEach((segment, index) => {
      const span = (segment.amountCents / total) * Math.PI * 2;
      const a0 = angle + gap / 2, a1 = angle + span - gap / 2;
      if (a1 > a0) {
        ctx.strokeStyle = segmentCanvasColor(segment, index);
        ctx.globalAlpha = selectedKey && selectedKey !== segment.key?.toString()?.trim() ? .42 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.stroke();
        ctx.globalAlpha = 1;
        hits.push({ key: segment.key, start: angle, end: angle + span });
      }
      angle += span;
    });
  }
  canvas.onclick = event => {
    if (!(total > 0)) return;
    const box = canvas.getBoundingClientRect(), x = event.clientX - box.left - box.width / 2, y = event.clientY - box.top - box.height / 2;
    const dist = Math.hypot(x, y);
    if (dist < box.width * .22 || dist > box.width * .49) return;
    let a = Math.atan2(y, x);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    const hit = hits.find(h => a >= h.start && a < h.end);
    if (hit) onSelect?.(hit.key);
  };
}

function renderRecentTransactions(plan, transactions, onTransaction) {
  const target = document.getElementById('recentTransactionList');
  if (!target) return;
  const budgetMap = new Map((plan?.budgets || []).map(b => [b.id, b]));
  const rows = (transactions || [])
    .filter(t => t.month === plan.month && !t.deleted)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, 4);
  if (!rows.length) {
    target.innerHTML = '<div class="empty-inline">Noch keine mobilen Buchungen in diesem Monat.</div>';
    return;
  }
  target.innerHTML = `<div class="transaction-group-list">${rows.map(t => {
    if (t.kind === 'capy_stash_deposit') {
      const pending = t.status !== 'confirmed' && t.status !== 'rejected';
      const name = plan?.capy?.budgetName || t.description || 'Capy-Vorrat';
      const status = t.status === 'confirmed' ? 'Gebucht' : t.status === 'rejected' ? `Nicht übernommen${t.rejectionReason ? ` · ${t.rejectionReason}` : ''}` : 'Wartet auf PC';
      return `<div class="transaction-row capy-transaction-row${pending ? ' is-pending' : ''}${t.status === 'rejected' ? ' is-rejected' : ''}"><span class="transaction-main"><strong>${escapeHtml(name)}</strong><small>${formatDate(t.date)} · ${escapeHtml(status)}</small></span><span class="transaction-amount capy-transfer">${formatCents(t.amountCents)}</span></div>`;
    }
    const name = t.description || t.category || (t.kind === 'income' ? 'Einnahme' : 'Ausgabe');
    const secondary = t.kind === 'budget_expense' ? (budgetMap.get(t.budgetId)?.name || t.category || 'Budget') : t.category;
    const status = t.status === 'confirmed' ? 'Bestätigt' : t.status === 'rejected' ? 'Nicht übernommen' : t.status === 'prepared' ? 'Vorbereitet' : 'Lokal';
    return `<button type="button" class="transaction-row" data-recent-transaction-id="${escapeHtml(t.id)}"><span class="transaction-main"><strong>${escapeHtml(name)}</strong><small>${formatDate(t.date)} · ${escapeHtml(secondary || '')} · ${status}</small></span><span class="transaction-amount ${t.kind === 'income' ? 'income' : ''}">${t.kind === 'income' ? '+' : '−'}${formatCents(t.amountCents)}</span></button>`;
  }).join('')}</div>`;
  target.querySelectorAll('[data-recent-transaction-id]').forEach(button => button.addEventListener('click', () => onTransaction?.(button.dataset.recentTransactionId)));
}

export function renderMonth({ display, visualMode = 'donut', donutMode = 'planned', selectedSegment = '', recentTransactions = [], onSegment, onBudget, onTransaction }) {
  const noPlan = document.getElementById('noPlanState'), content = document.getElementById('monthContent'), fab = document.getElementById('fabExpense');
  setHidden(noPlan, Boolean(display));
  setHidden(content, !display);
  setHidden(fab, !display);
  if (!display) return;

  const p = display.plan;
  const warnings = document.getElementById('monthWarnings');
  if (warnings) warnings.innerHTML = display.missingBudgetTransactions.length ? `<div class="notice warn"><strong>${display.missingBudgetTransactions.length} mobile Budgetbuchung${display.missingBudgetTransactions.length === 1 ? '' : 'en'} mit nicht mehr vorhandener Budget-ID.</strong><br>Der Betrag wird vorsichtshalber als Belastung des frei verfügbaren Guthabens behandelt. Bitte beim Desktop-Import zuordnen oder korrigieren.</div>` : '';
  document.getElementById('monthHeading').textContent = formatMonth(p.month);
  document.getElementById('planRevisionBadge').textContent = `Rev. ${p.revision}`;

  const freeValue = document.getElementById('freeAvailableValue');
  const hero = freeValue.closest('.hero-card');
  freeValue.textContent = formatCents(p.freeAvailableCents);
  hero?.classList.toggle('negative', p.freeAvailableCents < 0);
  document.getElementById('freeAvailableMeta').textContent = p.minimumCashBufferCents ? `nach ${formatCents(p.minimumCashBufferCents)} Mindestpuffer` : 'ohne Mindestpuffer';
  document.getElementById('accountBalanceValue').textContent = p.accountBalanceCents === null ? '–' : formatCents(p.accountBalanceCents);
  document.getElementById('accountBalanceHint').textContent = p.accountBalanceCents === null ? 'nicht übermittelt' : 'Desktop + lokale Buchungen';
  document.getElementById('budgetAssetsValue').textContent = formatCents(p.budgetAssetsCents);
  document.getElementById('savingsAssetsValue').textContent = formatCents(p.savingsAssetsCents);
  document.getElementById('totalAssetsValue').textContent = formatCents(p.totalAssetsCents);

  const activeVisualMode = visualMode === 'buffer' ? 'buffer' : 'donut';
  document.querySelectorAll('[data-month-visual]').forEach(button => {
    const active = button.dataset.monthVisual === activeVisualMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  setHidden(document.getElementById('bufferVisualView'), activeVisualMode !== 'buffer');
  setHidden(document.getElementById('donutVisualView'), activeVisualMode !== 'donut');
  document.getElementById('financialVisualTitle').textContent = activeVisualMode === 'buffer' ? 'Finanzlage' : 'Geldverwendung';

  const vault = getBufferVisualState(p.normalBalanceCents, p.minimumCashBufferCents);
  const vaultImage = document.getElementById('vaultImage');
  vaultImage.src = vault.asset;
  vaultImage.alt = vault.alt;
  vaultImage.dataset.stage = vault.stage;
  document.getElementById('vaultStatusLabel').textContent = vault.status;
  document.getElementById('vaultPercentValue').textContent = vault.ratioPercent === null ? '–' : `${Math.max(0, Math.round(vault.ratioPercent))} %`;
  document.getElementById('vaultBalanceValue').textContent = formatCents(p.normalBalanceCents);
  document.getElementById('vaultBufferValue').textContent = p.minimumCashBufferCents > 0 ? formatCents(p.minimumCashBufferCents) : 'Nicht festgelegt';
  const vaultDeltaValue = document.getElementById('vaultDeltaValue');
  vaultDeltaValue.textContent = p.minimumCashBufferCents > 0 ? formatCents(vault.deltaCents) : '–';
  vaultDeltaValue.classList.toggle('negative', p.minimumCashBufferCents > 0 && vault.deltaCents < 0);
  vaultDeltaValue.classList.toggle('positive', p.minimumCashBufferCents > 0 && vault.deltaCents >= 0);
  const vaultProgress = document.querySelector('.vault-progress');
  const vaultProgressBar = document.getElementById('vaultProgressBar');
  vaultProgressBar.style.width = `${vault.progressPercent.toFixed(1)}%`;
  vaultProgress.setAttribute('aria-valuenow', String(Math.round(vault.progressPercent)));
  vaultProgress.setAttribute('aria-valuetext', vault.ratioPercent === null ? 'Kein Mindestpuffer festgelegt' : `${Math.max(0, Math.round(vault.ratioPercent))} Prozent des Mindestpuffers`);

  if (activeVisualMode === 'donut') {
    document.querySelectorAll('[data-donut-mode]').forEach(button => {
      const active = button.dataset.donutMode === donutMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const data = donutMode === 'actual' ? p.donuts.actual : donutMode === 'available' ? p.availableDonut : p.donuts.planned;
    document.getElementById('donutTitle').textContent = data.title;
    document.getElementById('donutCenterLabel').textContent = data.centerLabel;
    document.getElementById('donutCenterValue').textContent = formatCents(data.totalCents);
    document.getElementById('donutHelp').textContent = donutMode === 'planned'
      ? 'Desktop-Werte für die Geldverwendung; lokale Ist-Buchungen ergänzen nur neue tatsächliche Vorgänge und Überziehungen.'
      : donutMode === 'actual'
        ? 'Tatsächlicher Vermögensverbrauch laut Desktop plus noch nicht bestätigte mobile Ausgaben.'
        : 'Aktuell noch verfügbare Beträge in den Budgets. Neue mobile Budgetausgaben werden sofort abgezogen.';
    const canvas = document.getElementById('donutCanvas');
    canvas.setAttribute('aria-label', `${data.title}: ${formatCents(data.totalCents)} in ${data.segments.length} Segment${data.segments.length === 1 ? '' : 'en'}.`);

    const legend = document.getElementById('donutLegend');
    let lastGroup = '';
    legend.innerHTML = data.segments.length ? data.segments.map((segment, index) => {
      const title = segment.group !== lastGroup ? `<div class="donut-group-title">${escapeHtml(groupLabel(segment.group))}</div>` : '';
      lastGroup = segment.group;
      return `${title}<button type="button" class="donut-row ${selectedSegment === segment.key ? 'active' : ''}" data-segment="${escapeHtml(segment.key)}"><span class="donut-swatch" style="background:${segmentCssColor(segment, index)}"></span><span class="donut-name">${escapeHtml(segment.label)}</span><span class="donut-value">${formatCents(segment.amountCents)}<small>${percent(segment.amountCents, data.totalCents).toFixed(1).replace('.', ',')} %</small></span></button>`;
    }).join('') : '<div class="empty-inline">Keine Werte für diese Ansicht.</div>';
    legend.querySelectorAll('[data-segment]').forEach(button => button.addEventListener('click', () => onSegment?.(button.dataset.segment)));
    drawDonut(canvas, data, selectedSegment, onSegment);

    const selected = data.segments.find(s => s.key === selectedSegment), details = document.getElementById('donutDetails');
    if (!selected) {
      details.innerHTML = '';
      setHidden(details, true);
    } else {
      details.innerHTML = `<h3>${escapeHtml(selected.label)} · ${formatCents(selected.amountCents)}</h3>${selected.details?.length ? `<div>${selected.details.map(d => `<div class="detail-row"><span>${escapeHtml(d.label)}</span><strong>${formatCents(d.amountCents)}</strong></div>`).join('')}</div>` : '<p class="help">Keine weitere Aufschlüsselung vorhanden.</p>'}`;
      setHidden(details, false);
    }
  }

  const budgetList = document.getElementById('budgetList');
  document.getElementById('budgetCount').textContent = String(p.budgets.length);
  budgetList.innerHTML = p.budgets.length ? p.budgets.map(b => {
    const baseline = Math.max(0, b.plannedCents, b.spentCents + Math.max(0, b.availableCents));
    const ratio = baseline ? Math.min(100, Math.max(0, (b.spentCents / baseline) * 100)) : 0;
    return `<button type="button" class="budget-card" data-budget-id="${escapeHtml(b.id)}" aria-label="${escapeHtml(b.name)}: ${formatCents(b.availableCents)} verfügbar"><div class="budget-top"><div><div class="budget-name">${escapeHtml(b.name)}</div><div class="budget-category">${escapeHtml(b.category)}</div></div><div class="budget-available ${b.availableCents < 0 ? 'negative' : ''}">${formatCents(b.availableCents)}<small>verfügbar</small></div></div><div class="progress" aria-hidden="true"><span style="width:${ratio.toFixed(1)}%"></span></div><div class="budget-meta"><span>Ausgegeben ${formatCents(b.spentCents)}</span><span>Plan ${formatCents(b.plannedCents)}</span></div></button>`;
  }).join('') : '<div class="empty-inline">Keine Budgets im Plan-Code.</div>';
  budgetList.querySelectorAll('[data-budget-id]').forEach(button => button.addEventListener('click', () => onBudget?.(button.dataset.budgetId)));

  renderRecentTransactions(p, recentTransactions, onTransaction);
}
