/* ── Research Digest — app.js ── */

let allPapers = [];
let activeFilter = 'All';
let selectedPmids = new Set();

async function init() {
  const res = await fetch('data/papers.json');
  const data = await res.json();
  allPapers = data.papers || [];

  renderMeta(data);
  renderFilters(data.papers);
  renderPapers(allPapers);
  renderDownloadBar();

  document.getElementById('papers').addEventListener('change', e => {
    if (e.target.classList.contains('paper-checkbox')) {
      togglePaper(e.target.dataset.pmid, e.target.checked);
    }
  });

  // Delegated click for "Why this?" toggles
  document.getElementById('papers').addEventListener('click', e => {
    const btn = e.target.closest('.why-btn');
    if (!btn) return;
    const wrap = btn.closest('.why-wrap');
    const text = wrap.querySelector('.why-text');
    const expanded = text.classList.toggle('hidden');
    btn.textContent = expanded ? 'Why this? ▾' : 'Why this? ▴';
  });
}

function renderMeta(data) {
  const el = document.getElementById('meta');
  const papers = data.papers || [];
  const count = papers.length;
  const aiScored = papers.filter(p => p.sonnetRelevance != null).length;
  const updated = data.updated ? new Date(data.updated).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : '—';
  const aiNote = aiScored > 0 ? ` &nbsp;·&nbsp; <span class="ai-badge">🤖 ${aiScored} AI-scored</span>` : '';
  el.innerHTML = `<strong>${count}</strong> papers &nbsp;·&nbsp; Updated ${updated}${aiNote}`;
}

function renderFilters(papers) {
  const tagCounts = {};
  papers.forEach(p => (p.tags || []).forEach(t => {
    tagCounts[t] = (tagCounts[t] || 0) + 1;
  }));

  const tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const container = document.getElementById('filters');
  ['All', ...tags].forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (tag === 'All' ? ' active' : '');
    btn.textContent = tag === 'All' ? 'All papers' : tag;
    btn.addEventListener('click', () => {
      activeFilter = tag;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPapers(activeFilter === 'All'
        ? allPapers
        : allPapers.filter(p => (p.tags || []).includes(activeFilter)));
    });
    container.appendChild(btn);
  });
}

function renderDownloadBar() {
  const bar = document.createElement('div');
  bar.id = 'download-bar';
  bar.className = 'download-bar hidden';
  bar.innerHTML = `
    <span id="selected-count">0 selected</span>
    <div class="bar-actions">
      <button class="bar-btn secondary" id="clear-btn">Clear</button>
      <button class="bar-btn primary" id="ris-btn">⬇ Download RIS</button>
    </div>`;
  document.body.appendChild(bar);
  document.getElementById('ris-btn').addEventListener('click', downloadRIS);
  document.getElementById('clear-btn').addEventListener('click', clearSelection);
}

function updateDownloadBar() {
  const bar = document.getElementById('download-bar');
  const count = selectedPmids.size;
  document.getElementById('selected-count').textContent =
    count === 1 ? '1 paper selected' : `${count} papers selected`;
  bar.classList.toggle('hidden', count === 0);
}

function clearSelection() {
  selectedPmids.clear();
  document.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.paper-card').forEach(c => c.classList.remove('selected'));
  updateDownloadBar();
}

function togglePaper(pmid, checked) {
  if (checked) selectedPmids.add(pmid);
  else selectedPmids.delete(pmid);
  const card = document.querySelector(`[data-pmid="${pmid}"]`);
  if (card) card.classList.toggle('selected', checked);
  updateDownloadBar();
}

function downloadRIS() {
  const papers = allPapers.filter(p => selectedPmids.has(p.pmid));
  const ris = papers.map(toRIS).join('\n');
  const blob = new Blob([ris], { type: 'application/x-research-info-systems' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `digest-${new Date().toISOString().slice(0,10)}.ris`;
  a.click();
  URL.revokeObjectURL(url);
}

function toRIS(p) {
  const lines = ['TY  - JOUR'];
  if (p.title)    lines.push(`TI  - ${p.title}`);
  (p.authors || []).forEach(a => lines.push(`AU  - ${a}`));
  if (p.journal)  lines.push(`JO  - ${p.journal}`);
  if (p.date)     lines.push(`PY  - ${p.date.slice(0, 4)}`);
  if (p.date)     lines.push(`DA  - ${p.date}`);
  if (p.abstract) lines.push(`AB  - ${p.abstract}`);
  if (p.doi)      lines.push(`DO  - ${p.doi}`);
  if (p.pmid)     lines.push(`AN  - ${p.pmid}`);
  if (p.pmid)     lines.push(`UR  - https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`);
  lines.push('ER  - ');
  return lines.join('\n');
}

// ── Sorting & grouping ────────────────────────────────────────────────────────

const RELEVANCE_ORDER = { high: 0, medium: 1, low: 2 };

function sortAiScored(papers) {
  return [...papers].sort((a, b) => (b.sonnetCombined || 0) - (a.sonnetCombined || 0));
}

function sortKeyword(papers) {
  return [...papers].sort((a, b) => {
    const ra = RELEVANCE_ORDER[a.relevance] ?? 2;
    const rb = RELEVANCE_ORDER[b.relevance] ?? 2;
    if (ra !== rb) return ra - rb;
    return (b.date || '').localeCompare(a.date || '');
  });
}

function renderPapers(papers) {
  const container = document.getElementById('papers');
  const empty = document.getElementById('empty');

  if (!papers.length) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const aiScored   = papers.filter(p => p.sonnetRelevance != null);
  const keywordOnly = papers.filter(p => p.sonnetRelevance == null);
  const wildcards  = aiScored.filter(p => p.isWildcard);
  const mainAi     = aiScored.filter(p => !p.isWildcard);

  let html = '';

  if (aiScored.length > 0) {
    // AI-scored section
    if (mainAi.length > 0) {
      html += sectionHeader('AI-Scored', `${mainAi.length} papers ranked by relevance &amp; surprise`);
      html += sortAiScored(mainAi).map(p => paperCard(p)).join('');
    }
    if (wildcards.length > 0) {
      html += sectionHeader('🃏 Wild Cards', 'High surprise — unexpected but potentially interesting');
      html += sortAiScored(wildcards).map(p => paperCard(p)).join('');
    }
    if (keywordOnly.length > 0) {
      html += sectionHeader('Keyword-Matched', `${keywordOnly.length} additional papers — keyword scoring`);
      html += sortKeyword(keywordOnly).map(p => paperCard(p)).join('');
    }
  } else {
    // No AI scoring — flat list
    html += sortKeyword(papers).map(p => paperCard(p)).join('');
  }

  container.innerHTML = html;

  // Restore checkbox state
  container.querySelectorAll('.paper-checkbox').forEach(cb => {
    const pmid = cb.dataset.pmid;
    cb.checked = selectedPmids.has(pmid);
    if (cb.checked) cb.closest('.paper-card').classList.add('selected');
  });
}

function sectionHeader(title, subtitle) {
  return `
<div class="section-header">
  <h3 class="section-title">${title}</h3>
  ${subtitle ? `<span class="section-sub">${subtitle}</span>` : ''}
</div>`;
}

// ── Paper card ─────────────────────────────────────────────────────────────────

function paperCard(p) {
  const rel = (p.relevance || 'medium').toLowerCase();
  const authors = Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || '');
  const shortAuthors = authors.length > 80 ? authors.slice(0, 80) + '…' : authors;
  const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

  const doiLink = p.doi
    ? `<a class="pmid-link" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI ↗</a>`
    : (p.pmid
      ? `<a class="pmid-link" href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">PubMed ↗</a>`
      : '');

  const titleHtml = p.pmid
    ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">${esc(p.title)}</a>`
    : (p.doi
      ? `<a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">${esc(p.title)}</a>`
      : esc(p.title));

  const dateStr = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short'
  }) : '';

  // AI score row
  const hasAiScore = p.sonnetRelevance != null;
  const scoreRow = hasAiScore ? `
<div class="score-row">
  <span class="score-pill relevance-score" title="Relevance to your research (1–10)">R ${p.sonnetRelevance.toFixed(1)}</span>
  <span class="score-pill surprise-score" title="Surprise factor — unexpected angle (1–10)">S ${p.sonnetSurprise.toFixed(1)}</span>
  ${p.isWildcard ? '<span class="wildcard-tag">🃏 Wild card</span>' : ''}
</div>` : '';

  // Body: prefer AI summary, fall back to abstract
  const bodyText = p.aiSummary || p.abstract || '';
  const body = bodyText
    ? `<p class="paper-abstract">${esc(bodyText)}</p>`
    : '';

  // "Why this?" expandable
  const whySection = p.whyItMatters ? `
<div class="why-wrap">
  <button class="why-btn" aria-expanded="false">Why this? ▾</button>
  <p class="why-text hidden">${esc(p.whyItMatters)}</p>
</div>` : '';

  return `
<article class="paper-card${p.isWildcard ? ' wildcard' : ''}" data-pmid="${esc(p.pmid || p.doi || '')}">
  <div class="card-top">
    <label class="checkbox-wrap" title="Select for RIS download">
      <input type="checkbox" class="paper-checkbox" data-pmid="${esc(p.pmid || p.doi || '')}">
      <span class="checkmark"></span>
    </label>
    <h2 class="paper-title">${titleHtml}</h2>
    <span class="relevance-badge relevance-${rel}">${rel}</span>
  </div>
  ${scoreRow}
  <p class="paper-meta">
    <span class="authors">${esc(shortAuthors)}</span>
    ${p.journal ? `&nbsp;·&nbsp; <span class="journal">${esc(p.journal)}</span>` : ''}
    ${dateStr ? `&nbsp;·&nbsp; ${dateStr}` : ''}
  </p>
  ${body}
  ${whySection}
  <div class="card-footer">
    <div class="tags">${tags}</div>
    ${doiLink}
  </div>
</article>`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init().catch(err => {
  document.getElementById('papers').innerHTML =
    `<p style="color:red;padding:2rem">Failed to load papers: ${err.message}</p>`;
});

// ── Mobile filter toggle ──────────────────────────────────────────────────────
const toggleBtn = document.getElementById('filters-toggle');
const filtersEl = document.getElementById('filters');
if (toggleBtn && filtersEl) {
  toggleBtn.addEventListener('click', () => {
    const open = filtersEl.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', open);
    toggleBtn.querySelector('.toggle-arrow').textContent = open ? '▴' : '▾';
  });
}
