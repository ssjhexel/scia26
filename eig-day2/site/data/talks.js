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
    durationSec: 1432.8,
    summary: 'Jim de Vries opens the day with an overview of EIG built on four tenets: people, process, data and technology. He invites the room to pitch the strategy-execution bicycle, walks through EIG\'s plug-in services and joint offerings, and sets out how partners refer, subcontract and co-create. Hosni Adra explains how ChainSightAQ™ takes digital twins beyond the four walls.',
    takeaways: [
      'EIG centers its work on four tenets: people, process, data and technology.',
      'ChainSightAQ™ applies in-plant digital twin tools across the full supply chain network.',
      'A new factory may be easier to start with than converting existing assets and people.',
      'Optimal Ops gamifies shift performance and puts statistical process control in operators\' hands.'
    ],
    chapters: [{ t: 0, title: 'People, process, data, technology' }, { t: 171.4, title: 'The strategy-execution bicycle' }, { t: 384.4, title: 'Plug-in services and ChainSightAQ' }, { t: 654.4, title: 'Positioning and skepticism' }, { t: 903.4, title: 'How partners work together' }, { t: 1082.4, title: 'EIG\'s joint offerings' }, { t: 1307.4, title: 'Optimal Ops in practice' }],
    video: { provider: 'hls', src: '09/master.m3u8', poster: '09/poster.jpg' }
  },
  {
    id: '10', slug: 'market-intelligence', block: 'morning', time: '10:15 AM', track: 'Panel',
    title: 'Market Intelligence: Navigating 2027',
    speakers: [{ id: 'jim-de-vries', note: 'Chair' }, { id: 'jose-pires' }, { id: 'javier-zarazua-ruiz' }],
    durationSec: 1618.8,
    summary: 'Jim de Vries chairs a discussion of the six forces that will separate winners from losers through 2027, with Jose Pires in the room and Javier Zarazua Ruiz online. Pires argues that discipline, consistency with purpose, separates great organizations from those that simply apply technology, explains why most strategies die a slow death, and shows how ranking top-down and bottom-up priorities exposes real execution capacity.',
    takeaways: [
      'Most strategies don\'t fail on the data; they die a slow death, unmeasured.',
      'Discipline is consistency with purpose, built on a foundation of collaboration and excellence.',
      'Ranking top-down and bottom-up priorities together typically cuts execution projects below ten percent.',
      'Say what you stand for, repeatedly; the clients aligned with you will show up.'
    ],
    chapters: [{ t: 0, title: 'Six forces through 2027' }, { t: 79.4, title: 'What separates the winners' }, { t: 305.4, title: 'Discipline is consistency with purpose' }, { t: 600.4, title: 'Why strategies die slowly' }, { t: 885.4, title: 'Q&A: building robust strategy' }, { t: 1112.4, title: 'Is the world catching on?' }, { t: 1383.4, title: 'Reading the poll results' }],
    video: { provider: 'hls', src: '10/master.m3u8', poster: '10/poster.jpg' }
  },
  {
    id: '11', slug: 'transparency-revolution', block: 'morning', time: '10:45 AM', track: 'Panel',
    title: 'Trustbuilding Transparency Revolution: SC Trust Acceleration Index™',
    speakers: [{ id: 'greg-schlegel', note: 'Chair' }, { id: 'hosni-adra' }, { id: 'jim-de-vries' }],
    durationSec: 2412.8,
    summary: 'Greg Schlegel introduces the Trust Acceleration Index, developed through MxD research for the Department of War into what defense suppliers will and won\'t share. He shows how reciprocal surveys yield a trust score, a gap analysis and a 30-60-90-day plan. Jim de Vries explains how 25 trust factors were identified, Hosni Adra argues for timely, complete data, and the Q&A turns to supplier fear.',
    takeaways: [
      'Reciprocal customer and supplier surveys produce a 0-100 trust score and a gap analysis.',
      'Closing the largest trust gap drives a 30-, 60-, 90-day plan, repeated iteratively.',
      'Small manufacturers cite fear of reprisal and price pressure as why they don\'t share data.',
      'Data latency came up as a critical trust factor in every workshop and discussion.'
    ],
    chapters: [{ t: 0, title: 'Introducing the Trust Acceleration Index' }, { t: 91.4, title: 'Inside the MxD research' }, { t: 467.4, title: 'Measure trust, then improve it' }, { t: 796.4, title: 'Why visibility still lags' }, { t: 888.4, title: 'Finding 25 trust factors' }, { t: 1147.4, title: 'Data latency and performance' }, { t: 1332.4, title: 'Measuring business impact' }, { t: 1461.4, title: 'Audience Q&A' }, { t: 1850.4, title: 'The GE precedent' }],
    video: { provider: 'hls', src: '11/master.m3u8', poster: '11/poster.jpg' }
  },
  {
    id: '12', slug: 'startup-ai-npi', block: 'lightning', time: '11:30 AM', track: 'Lightning Talk',
    title: 'Start-up AI-NPI',
    speakers: [{ id: 'aaron-parr' }],
    durationSec: 496.8,
    summary: 'Aaron Parr of inRoot.io argues that AI has made invention fast, so the slow step in bringing new hard tech to market is now scale-up: commissioning, training, SOPs and process development. Using the theory of constraints, he explains why AI earns its ROI at the slowest step, why the word AI needs defining for clients, and how candor about IP opens up the data.',
    takeaways: [
      'AI has made research and invention faster; building the running thing is now the slow step.',
      'Every process runs at the speed of its slowest step, so aim AI there.',
      'Two-thirds of failed scale-ups fail at commissioning, training, SOPs, people and process.',
      'Say upfront you won\'t train models on client process IP; transparency earns data access.'
    ],
    chapters: [{ t: 0, title: 'Scaling new technology' }, { t: 113.4, title: 'Invention got fast' }, { t: 157.4, title: 'Find the slowest step' }, { t: 451.4, title: 'Data, IP and transparency' }],
    video: { provider: 'hls', src: '12/master.m3u8', poster: '12/poster.jpg' }
  },
  {
    id: '13', slug: 'npi-assessment', block: 'lightning', time: '11:35 AM', track: 'Lightning Talk',
    title: 'NPI Assessment',
    speakers: [{ id: 'mark-sneeringer' }],
    durationSec: 190.8, partial: true,
    summary: 'Joining partway through, the recording finds Mark Sneeringer outlining a three-part NPI assessment: maturity, innovator type (closer to Toyota, Apple or PACCAR?), and how culture and priorities shape what product development delivers. He explains how leaders\' survey responses are collated into a consensus view and an action plan, and how the approach builds on Jim and Greg\'s supply chain work.',
    takeaways: [
      'The assessment covers NPI maturity, innovator type, and how culture and priorities shape results.',
      'Leaders from every function that affects NPI take the survey individually, revealing the range of views.',
      'Individual responses are reconciled into a consensus view, then reviewed with the leadership team.',
      'Companies that want to be more like Apple build an action plan to get there.'
    ],
    chapters: [{ t: 0, title: 'Three-part assessment' }, { t: 72.4, title: 'From survey to consensus' }, { t: 135.4, title: 'Origins and early results' }],
    video: { provider: 'hls', src: '13/master.m3u8', poster: '13/poster.jpg' }
  },
  {
    id: '14', slug: 'change-management', block: 'lightning', time: '11:40 AM', track: 'Lightning Talk',
    title: 'Change Management',
    speakers: [{ id: 'leila-rao' }],
    durationSec: 332.8,
    summary: 'Leila Rao of AgileXtended wants to retire the phrase “change management” in favor of navigating change, borrowing from weather forecasting: most people need just enough to do their job. She trades roadmaps and GPS for a compass, since no client\'s terrain has ever been fixed, and works through communication that starts with listening, visualization, co-creation and experiential immersion.',
    takeaways: [
      'Swap ‘managing change’ for ‘navigating change’; the words you choose shape people\'s mental models.',
      'Calibrate detail per audience: some need the full plan, others just whether to take an umbrella.',
      'Use a compass rather than a roadmap or GPS, which assume fixed terrain and coordinates.',
      'Listen first: people won\'t listen to you until you\'ve proven you\'re listening to them.'
    ],
    chapters: [{ t: 0, title: 'Rethinking change management' }, { t: 78.4, title: 'The weather forecast model' }, { t: 182.4, title: 'A compass, not a roadmap' }, { t: 230.4, title: 'Four levels of change' }],
    video: { provider: 'hls', src: '14/master.m3u8', poster: '14/poster.jpg' }
  },
  {
    id: '15', slug: 'unified-security', block: 'lightning', time: '11:45 AM', track: 'Lightning Talk',
    title: 'Unified Security: One View. One Response. Total Protection.',
    speakers: [{ id: 'joe-patti' }, { id: 'adam-roth' }],
    durationSec: 278.8,
    summary: 'Joe Patti, presenting with Adam Roth as the Security Mixologists, argues that cyber, physical, identity and AI security should run as one program. Three scenarios (an emailed spreadsheet, a turnstile entry, a vendor in the lobby) show how context from HR and other systems makes alerts meaningful, and why attackers thrive in the gaps. He closes on security as risk management.',
    takeaways: [
      'Cyber alerts need HR context: an emailed spreadsheet matters more if the sender just gave notice.',
      'Being on the schedule doesn\'t mean a vendor technician is onboarded or should have access.',
      'Siloed teams can call each other, but manual cross-checks give attackers time.',
      'Build the program from risk tolerance, priorities, crown jewels and threats.'
    ],
    chapters: [{ t: 0, title: 'Security beyond cyber' }, { t: 45.4, title: 'Context closes the gaps' }, { t: 145.4, title: 'One program, every domain' }, { t: 238.4, title: 'Security as risk management' }],
    video: { provider: 'hls', src: '15/master.m3u8', poster: '15/poster.jpg' }
  },
  {
    id: '16', slug: 'pi-behavior-teams', block: 'lightning', time: '11:50 AM', track: 'Lightning Talk',
    title: 'How to Develop a Team Based on Your PI Behavior',
    speakers: [{ id: 'erik-herman' }],
    durationSec: 337.8,
    summary: 'Erik Herman of AE Herman, a Predictive Index partner, outlines the four behavioral drives PI measures: control over what gets done, the need to engage, patience and pace, and control over how things get done. He then shows how pairing complementary drives makes teams work, and why a delegating new manager can leave a direction-seeking employee stranded.',
    takeaways: [
      'Like DISC, PI rests on four behavioral drives, each present in everyone to different degrees.',
      'Two business partners who both need high control can end up sabotaging each other.',
      'Visionaries with a high need to control what gets done need detail-minded, process-following partners.',
      'A delegating new manager can stall an employee who wants to be told what to do.'
    ],
    chapters: [{ t: 0, title: 'Erik Herman and PI' }, { t: 38.4, title: 'Four behavioral drives' }, { t: 196.4, title: 'Building complementary teams' }, { t: 286.4, title: 'When the manager changes' }],
    video: { provider: 'hls', src: '16/master.m3u8', poster: '16/poster.jpg' }
  },
  {
    id: '17', slug: 'industry-5', block: 'afternoon', time: '12:45 PM', track: 'Panel',
    title: 'The Future is Here: Activating Industry 5.0',
    speakers: [{ id: 'jim-de-vries', note: 'Chair' }, { id: 'hosni-adra' }, { id: 'nitin-uchil' }, { id: 'bulent-uyaniker' }, { id: 'assad-mirza' }],
    partial: true, durationSec: 2024.4,
    summary: 'Joining the panel already under way, Hosni Adra, Nitin Uchil, Bulent Uyaniker and Assad Mirza test what Industry 5.0 means on the ground: physical AI, owning your own data, and getting human-machine interaction right. Field stories run from guided vehicles on the plant floor to planners freed up by LLMs, before the panel works through EIG\'s capability grid and asks why an ecosystem beats a single provider.',
    takeaways: [
      'Successful AI rollouts rested on company-owned data and small models trained on that data.',
      'Treat change management as the biggest investment, ahead of any particular AI tool.',
      'Even plain LLMs can take over scheduling and maintenance planning, freeing planners for strategic work.',
      'A partner ecosystem should lead with two or three problems it solves, not fifty.'
    ],
    chapters: [{ t: 0, title: 'AI adoption and data ownership' }, { t: 376.4, title: 'The capability to invest in' }, { t: 485.4, title: 'Debating AI risk' }, { t: 578.0, title: 'Change, safety and workforce fear' }, { t: 994.0, title: 'Mapping EIG synergies' }, { t: 1144.0, title: 'LLMs that free up talent' }, { t: 1367.0, title: 'Resilience and Workforce 5.0' }, { t: 1580.0, title: 'Why EIG can win' }],
    video: { provider: 'hls', src: '17/master.m3u8', poster: '17/poster.jpg' }
  },
  {
    id: '18', slug: 'collaboration-labs-kickoff', block: 'afternoon', time: '1:30 PM', track: 'Lab',
    title: 'Collaboration Labs I & II: Kickoff and Breakout Assignments',
    speakers: [{ id: 'mark-sneeringer' }],
    durationSec: 319.3,
    summary: 'Mark Sneeringer sets up the Collaboration Labs: informal one-on-one and small-group conversations, not presentations, about how attendees can help each other succeed through subcontracting, partnering on a client, or building out one of EIG\'s deep offerings. He announces the first-round pairings, from trust and digital twins to scale-up, differential diagnosis and capital development, and helps remote attendees choose a session. The labs themselves are off-record.',
    takeaways: [
      'Labs are informal one-on-one or small-group conversations, deliberately not slide presentations.',
      'Conversations target subcontracting, partnering on a specific client, or building EIG deep offerings.',
      'Round one covers trust, digital twins, AI scale-up, differential diagnosis and capital development.',
      'Two 45-minute rounds; anyone not named can join any round-one session on the charts.'
    ],
    chapters: [{ t: 0, title: 'How the labs work' }, { t: 72.4, title: 'Round one assignments' }, { t: 184.4, title: 'Remote attendees join' }],
    video: { provider: 'hls', src: '18/master.m3u8', poster: '18/poster.jpg' }
  },
  {
    id: '19', slug: 'closing-momentum', block: 'afternoon', time: '3:15 PM', track: 'Closing',
    title: 'Closing Momentum: Reflections and Next Steps',
    speakers: [{ id: 'jim-de-vries' }, { id: 'mark-sneeringer' }],
    partial: true, durationSec: 250.9,
    summary: 'Mark Sneeringer opens the floor for Collaboration Lab report-outs, and the day closes with reflections from the room: Jim de Vries on the depth of expertise and the partnerships taking shape, attendees on why two focused days beat a big conference, and a remote participant on the foundation of shared purpose. The lab discussions themselves stay off-record.',
    takeaways: [
      'Two days of small-room conversation built connections a large conference rarely allows.',
      'Partners leave with link-ups on specific projects to carry forward.'
    ],
    chapters: [{ t: 0, title: 'Inviting the report-outs' }, { t: 37.7, title: 'Thanks and reflections' }],
    video: { provider: 'hls', src: '19/master.m3u8', poster: '19/poster.jpg' }
  }
];
