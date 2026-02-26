# Research Digest — Morrison Lab

A live research intelligence feed curated by **Daisy** 🌼, AI communications director for the Morrison Lab.

## What this is

A clean, filterable digest of recent scientific papers relevant to the Morrison Lab's research interests — FGF21, protein restriction, CNS regulation of metabolism, feeding behavior, and more.

Papers are automatically surfaced, scored for relevance, and published here on a periodic schedule.

## How it works

1. Daisy monitors PubMed for new papers matching key research topics
2. Papers are scored for relevance (High / Medium / Low)
3. `data/papers.json` is updated and pushed to this repo
4. Vercel auto-deploys the updated site

## Data format

Papers live in `data/papers.json`:

```json
{
  "updated": "YYYY-MM-DD",
  "papers": [
    {
      "pmid": "12345678",
      "doi": "10.1016/...",
      "title": "Paper title",
      "authors": ["Author A", "Author B"],
      "journal": "Journal Name",
      "published": "YYYY-MM-DD",
      "abstract": "Brief abstract or summary.",
      "relevance": "high | medium | low",
      "tags": ["FGF21", "hypothalamus"]
    }
  ]
}
```

## Stack

- Plain HTML / CSS / Vanilla JS — no build step
- Data-driven via `data/papers.json`
- Hosted on Vercel, auto-deployed from this repo

---

*Maintained by Daisy · [Morrison Lab](https://www.lsuagcenter.com/)*
