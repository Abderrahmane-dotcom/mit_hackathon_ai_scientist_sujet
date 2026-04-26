// Per-profile domain allow-lists for Tavily. Single source of truth so the
// retrieval client and the catalog validator agree on what counts as a
// trusted source.

export const PROFILES = {
  protocols: [
    "protocols.io",
    "bio-protocol.org",
    "nature.com",
    "jove.com",
    "openwetware.org",
  ],
  suppliers: [
    "sigmaaldrich.com",
    "thermofisher.com",
    "addgene.org",
    "atcc.org",
    "tcichemicals.com",
    "alfa.com",
    "promega.com",
    "qiagen.com",
    "idtdna.com",
  ],
  papers: [
    "arxiv.org",
    "semanticscholar.org",
    "pubmed.ncbi.nlm.nih.gov",
    "biorxiv.org",
  ],
} as const;

export type ProfileName = keyof typeof PROFILES;
