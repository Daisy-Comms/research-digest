/* ── Research Digest — app.js ── */

let allPapers = [];
let activeFilter = 'All';

async function init() {
  const res = await fetch('data/papers.json');
  const data = await res.json();
  allPapers = data.papers || [];

  renderMeta(data);
  renderFilters(data.papers);
  renderPapers(allPapers);
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
}

function paperCard(p) {
  const rel = (p.relevance || 'medium').toLowerCase();
  const relLabel = rel.charAt(0).toUpperCase() + rel.slice(1);
  const authors = Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || '');
  const shortAuthors = authors.length > 80 ? authors.slice(0, 80) + '…' : authors;
  const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const pmidLink = p.pmid
    ? `<a class="pmid-link" href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">PMID ${p.pmid} ↗</a>`
    : '';
  const titleHtml = p.doi
    ? `<a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">${esc(p.title)}</a>`
    : (p.pmid
      ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">${esc(p.title)}</a>`
      : esc(p.title));

  const dateStr = p.published ? new Date(p.published).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '';

  return `
<article class="paper-card">
  <div class="card-top">
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
