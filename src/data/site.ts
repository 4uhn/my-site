/**
 * Every word on the site lives here. Edit content in this file only.
 *
 * TODO(jacob): CounterTime, FF and the AWS hackathon have no `href` yet, so no
 * link renders for them. Add one each, or leave them off.
 */

export const profile = {
  name: 'Jacob Chau',
  monogram: 'jc',
  /** Kept deliberately narrow. Three job titles read as unfocused. */
  role: 'Software Engineer',
  email: 'jacob.chauu@gmail.com',
  locations: [
    { label: 'London', tz: 'Europe/London' },
    { label: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  ],
  socials: [
    { name: 'GitHub', url: 'https://github.com/4uhn', icon: 'github' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/jacob-sk-chau/', icon: 'linkedin' },
  ],
} as const;

export const intro = [
  `Final-year MEng Computer Science at Durham, just back from a summer building AI systems as an SDE intern at Amazon.`,
  `I just love building.`,
] as const;

export const availability = 'Open to 2027 summer internship + new grad software engineering roles.';

export type Project = {
  title: string;
  blurb: string;
  points: string[];
  href?: string;
  linkLabel?: string;
};

export const projects: Project[] = [
  {
    title: 'Reach',
    blurb:
      `Two-sided volunteering platform, built overnight with five others at IC Hack 26 - the UK’s largest student-run hackathon.`,
    points: [
      'Matches volunteers to charity jobs on availability, travel radius, transport and interests - a model we sanity-checked against how a real soup-kitchen coordinator actually schedules people.',
      'Jobs move pending → accepted → in-progress → completed, and both sides have to confirm, so nobody spends their week chasing no-shows.',
      'React Native app for volunteers, React dashboard for coordinators, FastAPI and Firebase underneath - two working platforms inside 24 hours.',
      'Halfway through we cut the engagement dashboard in favour of reliability metrics and live map guidance. Worse demo, better product.',
    ],
    href: 'https://devpost.com/software/reach-vc5l8u',
    linkLabel: 'Devpost',
  },
  {
    title: 'CounterTime',
    blurb:
      'Educational game built for IBM to pull more people into SkillsBuild. Seven of us, weekly sprints, live client reviews.',
    points: [
      'BonsAI - a LangGraph agent with real state management and tool use - answers questions about SkillsBuild in conversation.',
      'Retrieval runs over a Chroma vector store and hit 97% accuracy on our eval set; MongoDB keeps conversation history.',
      'FastAPI sits between the Godot client and the model, so the game never talks to an LLM directly.',
    ],
  },
  {
    title: 'FF',
    blurb:
      'A financial-analysis stack I built mostly to find out how small a model can get and still be worth running.',
    points: [
      'News pipeline pulls Alpha Vantage and scrapes Yahoo Finance with Crawl4AI, then summarises with Llama 3.2 3B.',
      'Sentiment model fine-tuned from Gemma 3 270M using PyTorch and Unsloth across 28k samples from four financial datasets - 85.5% test accuracy.',
    ],
  },
  {
    title: 'AWS Agentic Network Hackathon',
    blurb: 'Energy-optimisation agent for mobile networks, driven by a digital twin.',
    points: [
      `Wrapped VIAVI’s RAN scenario generator in a stateless MCP server on AWS AgentCore Runtime - five tools, so a fleet of agents can each run their own digital-twin simulation.`,
      'The agent runs on Strands with Claude via Bedrock, chaining tool calls and re-prompting itself off the simulation’s KPIs.',
    ],
  },
];

export type TimelineEntry = {
  when: string;
  what: string;
  where: string;
  note?: string;
};

/**
 * Newest first: the eye travels up the rule toward the present.
 *
 * TODO(jacob): the 2023 entry is a placeholder for the start of the degree.
 */
export const timeline: TimelineEntry[] = [
  {
    when: '2027',
    what: 'MEng Computer Science',
    where: 'Durham University',
    note: 'On track for a First.',
  },
  {
    when: 'Jun - Sep 2026',
    what: 'SDE Intern (AI)',
    where: 'Amazon',
    // TODO(jacob): one line, in your own words, on what you actually shipped.
    // Keep it to what's externally safe — no internal service names or metrics.
  },
  {
    when: '2023',
    what: '',
    where: '',
  },
];

export const sections = [
  { id: 'top', label: 'Top' },
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'path', label: 'Path' },
  { id: 'contact', label: 'Contact' },
] as const;
