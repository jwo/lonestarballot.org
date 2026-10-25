/*
  ⚙️  SITE CONFIG — edit this file to point the site at a new ballot.

  Each election, change VOTE_URL to the live voting page. Everything else
  is optional flavour.
*/

const CONFIG = {
  // ── The live ballot. This is the only link you must swap each cycle. ──
  VOTE_URL: 'https://www.lonestarballot.org/',

  // Show the "Vote" button and open-ballot banner?
  // Set to false once results are final / before a ballot opens.
  VOTING_OPEN: false,

  // The featured election year. May be a future year with no results yet —
  // the page will show an "upcoming" state and keep the archive below.
  CURRENT_YEAR: '2027',

  // ── Brand text ──
  SITE_NAME: 'Lone Star Ballot',
  ORGANIZATION: 'Lone Star Bleeding Disorders Foundation',
  TAGLINE: 'Annual board election — official results archive',
  ORG_URL: 'https://lonestarhemophilia.org/',

  // Small print in the footer.
  LEGAL: 'Results are reproduced from the official election record.'
};
