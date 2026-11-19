// Parody roster. Satire only: no real faces, no real photos, no affiliation.
export const STAT_KEYS = [
  ['reach', 'REACH'], ['rigidity', 'RIGIDITY'], ['speed', 'SWING SPEED'], ['stamina', 'STAMINA'], ['recovery', 'RECOVERY'],
];

export const ROSTER = [
  {
    id: 'elon', name: 'ELON', title: 'CHIEF CHAOS OFFICER', color: '#e9e6ff', accent: '#ff5d8f',
    bio: 'Posts at 3 a.m., ships at 4, explodes at 5. Calls every explosion a successful test.',
    trait: 'AERIAL / CHAOS', quote: 'FUNDING SECURED.\nDIGNITY NOT.',
    stats: { reach: 8, rigidity: 7, speed: 7, stamina: 6, recovery: 10 },
    signature: { name: 'FULL SELF-DRIVING', type: 'ram' },
    finisher: { name: 'ONE-WAY TICKET TO MARS', type: 'launch' },
    archetype: 'HORN',
    loseLine: 'ELON HAS BEEN SENT TO MARS. ECONOMY CLASS.',
  },
  {
    id: 'jensen', name: 'JENSEN', title: 'THE LEATHER JACKET', color: '#9fe870', accent: '#76b900',
    bio: 'Sells shovels in every gold rush. The jacket has never been washed and never will be.',
    trait: 'REACH / ARMOR', quote: 'THE MORE YOU BUY.\nTHE HARDER YOU FALL.',
    stats: { reach: 9, rigidity: 8, speed: 6, stamina: 7, recovery: 8 },
    signature: { name: 'TENSOR THRUST', type: 'lunge' },
    finisher: { name: 'THE MORE YOU BUY', type: 'extend' },
    archetype: 'THRUST',
  },
  {
    id: 'mark', name: 'MARK', title: 'THE METAVERSE MAULER', color: '#8ab4ff', accent: '#3d7bff',
    bio: 'Trained jiu-jitsu, rebranded twice, still thinks you will put the headset on.',
    trait: 'RUSHDOWN / GRAPPLER', quote: 'MOVE FAST.\nBREAK YOU.',
    stats: { reach: 6, rigidity: 6, speed: 10, stamina: 8, recovery: 8 },
    signature: { name: 'SPINNING BACKFIST', type: 'spin' },
    finisher: { name: 'PIVOT TO THE VOID', type: 'spin' },
    archetype: 'SPIN',
  },
  {
    id: 'jeff', name: 'JEFF', title: 'THE EVERYTHING STORE', color: '#ffb547', accent: '#ff9900',
    bio: 'Started in a garage. Now owns the garage, the street and the van that is about to hit you.',
    trait: 'HEAVY / ZONING', quote: 'FREE SHIPPING.\nPAID IN PAIN.',
    stats: { reach: 8, rigidity: 10, speed: 5, stamina: 8, recovery: 7 },
    signature: { name: 'PRIME DELIVERY', type: 'ram' },
    finisher: { name: 'ONE-CLICK EJECT', type: 'launch' },
    archetype: 'HORN',
  },
  {
    id: 'vitalik', name: 'VITALIK', title: 'THE MERGE', color: '#b7a6ff', accent: '#8c8cf7',
    bio: 'Fragile frame, infinite roadmap. Will explain sharding to you in the middle of a combo.',
    trait: 'MAX REACH / GLASS', quote: 'GAS FEES\nINCLUDED.',
    stats: { reach: 10, rigidity: 5, speed: 7, stamina: 7, recovery: 9 },
    signature: { name: 'THE MERGE', type: 'lunge' },
    finisher: { name: 'ULTRASOUND MONEY', type: 'extend' },
    archetype: 'THRUST',
  },
  {
    id: 'ansem', name: 'ANSEM', title: 'THE CALLER', color: '#ffc36b', accent: '#ff8a3d',
    bio: 'A cat in a hat who called it before you did. Swings first, posts the screenshot after.',
    trait: 'MOMENTUM / BRAWLER', quote: 'NOT FINANCIAL ADVICE.\nJUST VIOLENCE.',
    stats: { reach: 7, rigidity: 6, speed: 9, stamina: 8, recovery: 8 },
    signature: { name: '100X CALL', type: 'spin' },
    finisher: { name: 'SEND IT TO A BILLION', type: 'spin' },
    archetype: 'SPIN',
  },
  {
    id: 'wale', name: 'WALE', title: 'THE SPIRAL', color: '#ff9cc8', accent: '#ff6fae',
    bio: 'Calm face up front, unhinged mask in the back. Throws stars. Never explains them.',
    trait: 'SPEED / EVASION', quote: 'SMILE ON THE BACK.\nSHURIKEN UP FRONT.',
    stats: { reach: 6, rigidity: 5, speed: 10, stamina: 8, recovery: 9 },
    signature: { name: 'SPIRAL OUT', type: 'spiral' },
    finisher: { name: 'MASK OFF', type: 'spiral' },
    archetype: 'SPIRAL',
  },
  {
    id: 'sam', name: 'SAM', title: 'THE COMEBACK', color: '#9ff3e6', accent: '#3fe0c5',
    bio: 'Fired on a Friday, back by Tuesday. The recovery stat is not a joke. It is a lifestyle.',
    trait: 'RECOVERY / MIND GAMES', quote: 'THE BOARD\nCANNOT STOP ME.',
    stats: { reach: 7, rigidity: 6, speed: 8, stamina: 7, recovery: 10 },
    signature: { name: 'FIRED & REHIRED', type: 'spiral' },
    finisher: { name: 'AGI ACHIEVED INTERNALLY', type: 'spiral' },
    archetype: 'SPIRAL',
  },
];

export const RINGOUT_QUIPS = ['SIT DOWN!', 'DELISTED!', 'LAID OFF!', 'RUGGED!', 'SEVERANCE DENIED!', 'SIT DOWN!', 'GOING TO ZERO!', 'SHAREHOLDERS NOTIFIED!'];

// The four original Hard Counter fighters each have a hip-mounted lance. Every CEO inherits one archetype.
export const ARCHETYPES = {
  THRUST: { from: 'VOID STRIKER', note: 'PRECISION / REACH. SIGNATURE IS A LONG LUNGE, FINISHER EXTENDS THE LANCE.' },
  SPIN: { from: 'PRISM MENACE', note: 'SPEED / COMBOS. SIGNATURE SPINS THE HIPS AND HITS BOTH SIDES.' },
  SPIRAL: { from: 'SPIRAL ROGUE', note: 'MIND GAMES. SIGNATURE CORKSCREWS BEHIND THE RIVAL AND STRIKES.' },
  HORN: { from: 'PIXEL HORN', note: 'WEIGHT / LAUNCH. SIGNATURE IS A HORN-DOWN RAM THAT LIFTS.' },
};
