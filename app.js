/* ── Research Digest — app.js ── */

let allPapers = [];
let activeFilter = 'All';
let selectedPmids = new Set();
let isAdmin = false;

async function init() {
  // Check admin cookie
  isAdmin = document.cookie.split(';').some(c => c.trim().startsWith('digest-admin='));

  const res = await fetch('data/papers.json');
  const data = await res.json();
  allPapers = data.papers || [];

  renderMeta(data);
  renderFilters(data.papers);
  renderPapers(allPapers);

  if (isAdmin) {
    document.body.classList.add('admin-mode');
    renderDownloadBar();
    const loginBtn = document.getElementById('admin-login-btn');
    loginBtn.textContent = '🔓';
    loginBtn.title = 'Logged in as admin — click to logout';
  }

  // Delegated checkbox listener (admin only)
  document.getElementById('papers').addEventListener('change', e => {
    if (!isAdmin) return;
    if (e.target.classList.contains('paper-checkbox')) {
      togglePaper(e.target.dataset.pmid, e.target.checked);
    }
  });

  // Delegated "Why this?" toggle
  document.getElementById('papers').addEventListener('click', e => {
    const btn = e.target.closest('.why-btn');
    if (!btn) return;
    const wrap = btn.closest('.why-wrap');
    const text = wrap.querySelector('.why-text');
    const isHidden = text.classList.toggle('hidden');
    btn.textContent = isHidden ? 'Why this? ▾' : 'Why this? ▴';
  });

  // Delegated "Full summary" toggle
  document.getElementById('papers').addEventListener('click', e => {
    const btn = e.target.closest('.summary-toggle');
    if (!btn) return;
    const wrap = btn.closest('.summary-wrap');
    const text = wrap.querySelector('.summary-content');
    const isHidden = text.classList.toggle('hidden');
    btn.textContent = isHidden ? 'Read summary ▾' : 'Hide summary ▴';
  });

  // Login modal
  setupLoginModal();
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function setupLoginModal() {
  const loginBtn = document.getElementById('admin-login-btn');
  const modal = document.getElementById('login-modal');
  const form = document.getElementById('login-form');
  const cancel = document.getElementById('login-cancel');
  const pwInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');

  loginBtn.addEventListener('click', () => {
    if (isAdmin) {
      // Logout
      fetch('/api/logout', { method: 'POST' }).then(() => location.reload());
    } else {
      modal.classList.remove('hidden');
      pwInput.focus();
    }
  });

  cancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    errEl.classList.add('hidden');
    pwInput.value = '';
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      errEl.classList.add('hidden');
      pwInput.value = '';
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.classList.add('hidden');
    const password = pwInput.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        location.reload();
      } else {
        errEl.classList.remove('hidden');
        pwInput.value = '';
        pwInput.focus();
      }
    } catch {
      errEl.textContent = 'Connection error';
      errEl.classList.remove('hidden');
    }
  });
}

function renderMeta(data) {
  const el = document.getElementById('meta');
  const papers = data.papers || [];
  const count = papers.length;
  const aiScored = papers.filter(p => p.sonnetRelevance != null).length;
  const summarized = papers.filter(p => p.fullSummary).length;
  const updated = data.updated ? new Date(data.updated).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : '—';
  let html = `<strong>${count}</strong> papers &nbsp;·&nbsp; Updated ${updated}`;
  if (aiScored > 0) html += ` &nbsp;·&nbsp; <span class="ai-badge">🤖 ${aiScored} AI-scored</span>`;
  if (summarized > 0) html += ` &nbsp;·&nbsp; <span class="summary-badge">📄 ${summarized} summarized</span>`;
  el.innerHTML = html;
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
      <button class="bar-btn feedback" id="feedback-btn">📊 Submit Feedback</button>
    </div>`;
  document.body.appendChild(bar);
  document.getElementById('ris-btn').addEventListener('click', downloadRIS);
  document.getElementById('clear-btn').addEventListener('click', clearSelection);
  document.getElementById('feedback-btn').addEventListener('click', submitFeedback);
}

function updateDownloadBar() {
  const bar = document.getElementById('download-bar');
  if (!bar) return;
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

// ── RIS Download ───────────────────────────────────────────────────────────────

function downloadRIS() {
  const papers = allPapers.filter(p => selectedPmids.has(p.pmid || p.doi));
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

// ── Feedback Submission ────────────────────────────────────────────────────────

async function submitFeedback() {
  const btn = document.getElementById('feedback-btn');
  const selected = Array.from(selectedPmids);
  const shown = allPapers.map(p => p.pmid || p.doi).filter(Boolean);

  btn.disabled = true;
  btn.textContent = '⏳ Submitting...';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected, shown })
    });

    if (res.ok) {
      const data = await res.json();
      btn.textContent = `✅ ${data.papersSubmitted} papers submitted`;
      setTimeout(() => {
        btn.textContent = '📊 Submit Feedback';
        btn.disabled = false;
      }, 3000);
    } else if (res.status === 401) {
      btn.textContent = '🔒 Session expired — reload';
      setTimeout(() => location.reload(), 2000);
    } else {
      const err = await res.json().catch(() => ({}));
      btn.textContent = '❌ Error — try again';
      console.error('Feedback error:', err);
      setTimeout(() => {
        btn.textContent = '📊 Submit Feedback';
        btn.disabled = false;
      }, 3000);
    }
  } catch (err) {
    btn.textContent = '❌ Connection error';
    console.error(err);
    setTimeout(() => {
      btn.textContent = '📊 Submit Feedback';
      btn.disabled = false;
    }, 3000);
  }
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
  const id = p.pmid || p.doi || '';

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
  const body = bodyText ? `<p class="paper-abstract">${esc(bodyText)}</p>` : '';

  // "Why this?" expandable
  const whySection = p.whyItMatters ? `
<div class="why-wrap">
  <button class="why-btn" aria-expanded="false">Why this? ▾</button>
  <p class="why-text hidden">${esc(p.whyItMatters)}</p>
</div>` : '';

  // Full summary section (from full-text reading)
  const summarySection = p.fullSummary ? `
<div class="summary-wrap">
  <button class="summary-toggle">Read summary ▾</button>
  <div class="summary-content hidden">
    ${renderFullSummary(p.fullSummary)}
  </div>
</div>` : '';

  // Checkbox: only shown in admin mode (CSS handles visibility)
  const checkbox = `
    <label class="checkbox-wrap admin-only" title="Select for RIS download or feedback">
      <input type="checkbox" class="paper-checkbox" data-pmid="${esc(id)}">
      <span class="checkmark"></span>
    </label>`;

  return `
<article class="paper-card${p.isWildcard ? ' wildcard' : ''}${p.fullSummary ? ' has-summary' : ''}" data-pmid="${esc(id)}">
  <div class="card-top">
    ${checkbox}
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
  ${summarySection}
  <div class="card-footer">
    <div class="tags">${tags}</div>
    ${doiLink}
  </div>
</article>`;
}

function renderFullSummary(summary) {
  // summary is an object: { keyFindings, methods, relevance, limitations, notableData }
  if (typeof summary === 'string') return `<p>${esc(summary)}</p>`;

  let html = '';
  if (summary.keyFindings) {
    html += '<h4>Key Findings</h4><ul>' +
      summary.keyFindings.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>';
  }
  if (summary.methods) {
    html += `<h4>Methods</h4><p>${esc(summary.methods)}</p>`;
  }
  if (summary.relevance) {
    html += `<h4>Relevance to Your Work</h4><p>${esc(summary.relevance)}</p>`;
  }
  if (summary.limitations) {
    html += `<h4>Limitations</h4><p>${esc(summary.limitations)}</p>`;
  }
  if (summary.notableData) {
    html += `<h4>Notable Data</h4><p>${esc(summary.notableData)}</p>`;
  }
  return html;
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
