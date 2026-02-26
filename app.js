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

  // Single persistent checkbox listener on the container
  document.getElementById('papers').addEventListener('change', e => {
    if (e.target.classList.contains('paper-checkbox')) {
      togglePaper(e.target.dataset.pmid, e.target.checked);
    }
  });
}

function renderMeta(data) {
  const el = document.getElementById('meta');
  const count = (data.papers || []).length;
  const updated = data.updated ? new Date(data.updated).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : '—';
  el.innerHTML = `<strong>${count}</strong> papers &nbsp;·&nbsp; Updated ${updated}`;
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
  if (p.title)   lines.push(`TI  - ${p.title}`);
  (p.authors || []).forEach(a => lines.push(`AU  - ${a}`));
  if (p.journal)   lines.push(`JO  - ${p.journal}`);
  if (p.published) lines.push(`PY  - ${p.published.slice(0, 4)}`);
  if (p.published) lines.push(`DA  - ${p.published}`);
  if (p.abstract)  lines.push(`AB  - ${p.abstract}`);
  if (p.doi)       lines.push(`DO  - ${p.doi}`);
  if (p.pmid)      lines.push(`AN  - ${p.pmid}`);
  if (p.pmid)      lines.push(`UR  - https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`);
  lines.push('ER  - ');
  return lines.join('\n');
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
  container.innerHTML = papers.map(p => paperCard(p)).join('');

  // Restore checked state after re-render
  container.querySelectorAll('.paper-checkbox').forEach(cb => {
    const pmid = cb.dataset.pmid;
    cb.checked = selectedPmids.has(pmid);
    if (cb.checked) cb.closest('.paper-card').classList.add('selected');
  });

  // (checkbox changes handled by delegated listener in init)
}

function paperCard(p) {
  const rel = (p.relevance || 'medium').toLowerCase();
  const relLabel = rel.charAt(0).toUpperCase() + rel.slice(1);
  const authors = Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || '');
  const shortAuthors = authors.length > 80 ? authors.slice(0, 80) + '…' : authors;
  const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const pmidLink = p.doi
    ? `<a class="pmid-link" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI ↗</a>`
    : (p.pmid
      ? `<a class="pmid-link" href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">PMID ${p.pmid} ↗</a>`
      : '');
  const titleHtml = p.pmid
    ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">${esc(p.title)}</a>`
    : (p.doi
      ? `<a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">${esc(p.title)}</a>`
      : esc(p.title));

  const dateStr = p.published ? new Date(p.published).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '';

  return `
<article class="paper-card" data-pmid="${esc(p.pmid || '')}">
  <div class="card-top">
    <label class="checkbox-wrap" title="Select for RIS download">
      <input type="checkbox" class="paper-checkbox" data-pmid="${esc(p.pmid || '')}">
      <span class="checkmark"></span>
    </label>
    <h2 class="paper-title">${titleHtml}</h2>
    <span class="relevance-badge relevance-${rel}">${relLabel}</span>
  </div>
  <p class="paper-meta">
    <span class="authors">${esc(shortAuthors)}</span>
    ${p.journal ? `&nbsp;·&nbsp; <span class="journal">${esc(p.journal)}</span>` : ''}
    ${dateStr ? `&nbsp;·&nbsp; ${dateStr}` : ''}
  </p>
  ${p.abstract ? `<p class="paper-abstract">${esc(p.abstract)}</p>` : ''}
  <div class="card-footer">
    <div class="tags">${tags}</div>
    ${pmidLink}
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
