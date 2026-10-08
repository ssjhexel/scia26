/*
 * EIG Day 2 On-Demand — session data. Pages render from this file.
 * Times are Central Time as on the published agenda. durationSec is the real recording length.
 * chapters: [{ t: seconds, title }] — filled in from the transcripts.
 * video.src is resolved against EIGOD_CONFIG.videoBase when it is a relative path.
 */
window.EIG_SPEAKERS = {
  'jim-de-vries':        { name: 'Jim de Vries',        role: 'Founder, EIG Consulting' },
  'jose-pires':          { name: 'Jose Pires',          role: 'CEO, Global Excellence & Innovation' },
  'javier-zarazua-ruiz': { name: 'Javier Zarazua Ruiz', role: 'Founder, JL Nearshoring Mexico' },
  'greg-schlegel':       { name: 'Greg Schlegel',       role: 'Founder, The Supply Chain Risk Management Consortium' },
  'hosni-adra':          { name: 'Hosni Adra',          role: 'Founder, CreateASoft' },
  'aaron-parr':          { name: 'Aaron Parr',          role: 'Founder, inRoot.io' },
  'mark-sneeringer':     { name: 'Mark Sneeringer',     role: 'Founder, SigMax-NH' },
  'leila-rao':           { name: 'Leila Rao',           role: 'Founder, AgileXtended' },
  'joe-patti':           { name: 'Joe Patti',           role: 'Co-Founder & Principal, Security Mixologists' },
  'adam-roth':           { name: 'Adam Roth',           role: 'Co-Founder & Principal, Security Mixologists' },
  'erik-herman':         { name: 'Erik Herman',         role: 'Founder, AE Herman' },
  'nitin-uchil':         { name: 'Nitin Uchil',         role: 'Founder, Numorpho Cybernetic Systems' },
  'bulent-uyaniker':     { name: 'Bulent Uyaniker',     role: 'Founder, DataSpeckle' },
  'assad-mirza':         { name: 'Assad Mirza',         role: 'CEO, Infinity OpEx' }
};

window.EIG_BLOCKS = [
  { id: 'morning',   label: 'Morning',   title: 'Vision, markets & trust' },
  { id: 'lightning', label: 'Late morning', title: 'Lightning Innovation' },
  { id: 'afternoon', label: 'Afternoon', title: 'Industry 5.0 & momentum' }
];

window.EIG_TALKS = [
  {
    id: '09', slug: 'opening-vision', block: 'morning', time: '8:40 AM', track: 'Opening',
    title: 'Opening Vision: The EIG Advantage',
    speakers: [{ id: 'jim-de-vries' }],
    durationSec: 1842.4,
    summary: 'Jim de Vries sets the frame for the day: the problem, the gap between where businesses are and where they need to be, how EIG closes it, and the proof. He also introduces the collaboration mechanisms that run through the rest of the programme.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '09/master.m3u8', poster: '09/poster.jpg' }
  },
  {
    id: '10', slug: 'market-intelligence', block: 'morning', time: '10:15 AM', track: 'Panel',
    title: 'Market Intelligence: Navigating 2026',
    speakers: [{ id: 'jim-de-vries', note: 'Chair' }, { id: 'jose-pires' }, { id: 'javier-zarazua-ruiz' }],
    durationSec: 1642.2,
    summary: 'The key macro-economic trends driving markets and strategy, and how leaders should position for what comes next. A briefing followed by a panel discussion.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '10/master.m3u8', poster: '10/poster.jpg' }
  },
  {
    id: '11', slug: 'transparency-revolution', block: 'morning', time: '10:45 AM', track: 'Panel',
    title: 'Trustbuilding Transparency Revolution: SC Trust Acceleration Index™',
    speakers: [{ id: 'greg-schlegel', note: 'Chair' }, { id: 'hosni-adra' }, { id: 'jim-de-vries' }],
    durationSec: 2507.8,
    summary: 'Findings from the one-year MxD project and what they mean for Defense Industrial Base competitiveness — and why the organisations building supply chain trust now are creating moats their competitors can’t cross later.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '11/master.m3u8', poster: '11/poster.jpg' }
  },
  {
    id: '12', slug: 'startup-ai-npi', block: 'lightning', time: '11:30 AM', track: 'Lightning Talk',
    title: 'Start-up AI-NPI',
    speakers: [{ id: 'aaron-parr' }],
    durationSec: 535.4,
    summary: 'A TED-style lightning talk from Aaron Parr on AI-driven new product introduction for start-ups.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '12/master.m3u8', poster: '12/poster.jpg' }
  },
  {
    id: '13', slug: 'npi-assessment', block: 'lightning', time: '11:35 AM', track: 'Lightning Talk',
    title: 'NPI Assessment',
    speakers: [{ id: 'mark-sneeringer' }],
    durationSec: 190.0, partial: true,
    summary: 'Mark Sneeringer on assessing new product introduction readiness. Only part of this talk was captured; the recording is presented as-is.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '13/master.m3u8', poster: '13/poster.jpg' }
  },
  {
    id: '14', slug: 'change-management', block: 'lightning', time: '11:40 AM', track: 'Lightning Talk',
    title: 'Change Management',
    speakers: [{ id: 'leila-rao' }],
    durationSec: 345.0,
    summary: 'Leila Rao on change management: what it takes to move an organisation, not just a plan.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '14/master.m3u8', poster: '14/poster.jpg' }
  },
  {
    id: '15', slug: 'unified-security', block: 'lightning', time: '11:45 AM', track: 'Lightning Talk',
    title: 'Unified Security: One View. One Response. Total Protection.',
    speakers: [{ id: 'joe-patti' }, { id: 'adam-roth' }],
    durationSec: 333.0,
    summary: 'Security threats cross departments; defenses should connect too. Joe Patti and Adam Roth on turning fragmented signals into coordinated decisions.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '15/master.m3u8', poster: '15/poster.jpg' }
  },
  {
    id: '16', slug: 'pi-behavior-teams', block: 'lightning', time: '11:50 AM', track: 'Lightning Talk',
    title: 'How to Develop a Team Based on Your PI Behavior',
    speakers: [{ id: 'erik-herman' }],
    durationSec: 499.9,
    summary: 'Erik Herman on using Predictive Index behavioural insight to build and develop high-performing teams.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '16/master.m3u8', poster: '16/poster.jpg' }
  },
  {
    id: '17', slug: 'industry-5', block: 'afternoon', time: '12:45 PM', track: 'Panel',
    title: 'The Future is Here: Activating Industry 5.0',
    speakers: [{ id: 'hosni-adra' }, { id: 'nitin-uchil' }, { id: 'bulent-uyaniker' }, { id: 'assad-mirza' }],
    durationSec: 2066.0,
    summary: 'AI, digital twins and agentic systems via ChainSightAQ™, treated as a present-tense problem rather than a future one. Real examples and EIG capabilities across manufacturing and supply chain.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '17/master.m3u8', poster: '17/poster.jpg' }
  },
  {
    id: '18', slug: 'collaboration-labs-kickoff', block: 'afternoon', time: '1:30 PM', track: 'Lab',
    title: 'Collaboration Labs I & II: Kickoff and Breakout Assignments',
    speakers: [{ id: 'mark-sneeringer' }],
    durationSec: 333.6,
    summary: 'Mark Sneeringer launches the afternoon’s GTM-focused Collaboration Labs and assigns the breakout tracks. The labs themselves were held off-record.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '18/master.m3u8', poster: '18/poster.jpg' }
  },
  {
    id: '19', slug: 'closing-momentum', block: 'afternoon', time: '3:15 PM', track: 'Closing',
    title: 'Closing Momentum: Present GTMs, Your Next Steps',
    speakers: [{ id: 'jim-de-vries' }],
    durationSec: 1700.5,
    summary: 'The wrap-up: the go-to-market actions developed in the Collaboration Labs, and the next steps to carry them forward.',
    takeaways: [],
    chapters: [],
    video: { provider: 'hls', src: '19/master.m3u8', poster: '19/poster.jpg' }
  }
];
