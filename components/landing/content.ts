/**
 * Single source of truth for the public K9HOPE website copy and data.
 *
 * Everything factual on the landing page lives here so it can be reviewed and
 * corrected in one place. Capability statuses were assigned by reading the
 * code in this repository (see the `evidence` notes); please keep them honest
 * as features move from prototype to production.
 */

export const REPO_URL = "https://github.com/Rvunveil/k9hope-canine-blood-donation";

export const LINKS = {
  repo: REPO_URL,
  issues: `${REPO_URL}/issues`,
  newIssue: `${REPO_URL}/issues/new/choose`,
  collaborate: `${REPO_URL}/issues/new?title=${encodeURIComponent("Collaboration: ")}&labels=collaboration`,
  contributing: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
  fork: `${REPO_URL}/fork`,
  app: "/login",
  ieee: "https://ieeexplore.ieee.org/document/11634938",
  doi: "https://doi.org/10.1109/ICDSBS69077.2026.11634938",
  researchGate:
    "https://www.researchgate.net/publication/412106022_Conformal_Prediction_for_Zero-Inflated_Blood_Demand_Uncertainty-Aware_Forecasting_in_Sparse_Veterinary_Networks",
} as const;

export const PUBLICATION = {
  title:
    "Conformal Prediction for Zero-Inflated Blood Demand: Uncertainty-Aware Forecasting in Sparse Veterinary Networks",
  venue: "IEEE ICDSBS 2026",
  doi: "10.1109/ICDSBS69077.2026.11634938",
  award: "Best Paper Award, IEEE ICDSBS 2026",
};

export type CapabilityStatus = "implemented" | "prototype" | "research" | "planned";

export const STATUS_LABEL: Record<CapabilityStatus, string> = {
  implemented: "Implemented",
  prototype: "Prototype",
  research: "Research-backed",
  planned: "Planned",
};

export const STATUS_HINT: Record<CapabilityStatus, string> = {
  implemented: "Working in the current application.",
  prototype: "Built and usable, but limited or not yet wired into every flow.",
  research: "Developed and evaluated as published research.",
  planned: "On the roadmap. Not built yet.",
};

export interface Capability {
  name: string;
  detail: string;
  status: CapabilityStatus;
  /** Where in the repository this was verified. Not rendered. */
  evidence: string;
}

export const CAPABILITIES: Capability[] = [
  {
    name: "DEA blood-type registry",
    detail:
      "Donors are registered by canine blood group (DEA 1.1, 1.2, 3, 4, 5, 7), and urgent requests are filtered by blood type and city.",
    status: "implemented",
    evidence: "components/canine/DEABloodTypeSelector.tsx, firebaseFunctions.ts#getUrgentRequests",
  },
  {
    name: "Donor eligibility screening",
    detail:
      "Registration checks weight, age and health criteria before a dog joins the donor registry.",
    status: "implemented",
    evidence: "components/onb-forms/donorOnb.tsx (zod rules), lib/veterinary/dahdCompliance.ts",
  },
  {
    name: "Clinic request publishing",
    detail:
      "Veterinary clinics post blood requests with blood type, quantity and an expiry date, and manage responding donors.",
    status: "implemented",
    evidence: "app/app/(hospital)/h/donor-management",
  },
  {
    name: "Role-based portals",
    detail: "Separate workspaces for pet owners, donor owners, clinics and organisations.",
    status: "implemented",
    evidence: "app/app/(patient|donor|hospital|organisation)",
  },
  {
    name: "Blood inventory tracking",
    detail: "Clinics record blood units and components in stock.",
    status: "implemented",
    evidence: "app/app/(hospital)/h/blood-inventory",
  },
  {
    name: "Document triage assistant",
    detail:
      "Uploaded veterinary letters are read by a multimodal AI model that suggests an urgency level for a clinician to review.",
    status: "prototype",
    evidence: "app/api/ocr-flag/route.ts, components/portals/hospital/PatientTriageCarousel.tsx",
  },
  {
    name: "Distance-based donor matching",
    detail:
      "A Haversine module ranks donors within a radius. It is written and tested on this page, but not yet connected to the live request flow.",
    status: "prototype",
    evidence: "lib/veterinary/geospatialMatching.ts (not imported by the app yet)",
  },
  {
    name: "Expiry-first stock rotation",
    detail: "Units nearing expiry are flagged so they are used first (first-expiry, first-out).",
    status: "prototype",
    evidence: "app/app/(organisation)/o/hospital-n-supply, h/analytics unit-age chart",
  },
  {
    name: "Uncertainty-aware demand forecasting",
    detail:
      "Zero-inflated conformal prediction for sparse clinic demand. The clinic dashboard advisor currently runs on synthetic demand data.",
    status: "research",
    evidence: "app/api/zicp-forecast/route.ts, components/portals/hospital/ZICPStockAdvisor.tsx",
  },
  {
    name: "Tamil-language interface",
    detail: "Full interface in Tamil for pet owners across Tamil Nadu.",
    status: "planned",
    evidence: "next-intl is installed but not used",
  },
];

export const PROBLEMS = [
  {
    title: "No shared register of donors",
    body: "Willing donor dogs exist, but their details sit in phone contacts and old chat threads. Nobody can search them at 2 AM.",
  },
  {
    title: "Eligibility is checked too late",
    body: "A donor dog must meet weight, age, health and blood-count criteria. Today that is often discovered only after the owner has already driven to the clinic.",
  },
  {
    title: "Distance decides outcomes",
    body: "A compatible donor across the city is not much help in an emergency. Finding the nearest suitable dog is guesswork without location data.",
  },
  {
    title: "Emergencies have no queue",
    body: "Requests arrive as forwarded messages. There is no shared view of which case is most urgent or who is already responding.",
  },
  {
    title: "Blood is perishable",
    body: "Components expire within days to weeks. Without tracking, units are wasted while another clinic runs short.",
  },
];

export const STORY_BEATS = [
  {
    time: "2:00 AM",
    hours: 0,
    text: "Our dog needed a blood transfusion. The veterinarian was ready. A donor was not.",
  },
  {
    time: "Through the night",
    hours: 3,
    text: "We called every veterinary clinic we could reach. None had a list of donor dogs we could contact.",
  },
  {
    time: "Early morning",
    hours: 6,
    text: "We posted in WhatsApp groups and asked friends to forward the message. Replies came slowly, and each one had to be checked.",
  },
  {
    time: "About 14 hours later",
    hours: 14,
    text: "A suitable donor was finally found. It worked out, but it should never take that long.",
  },
];

export interface Person {
  name: string;
  initials: string;
  role: string;
  education: string;
  summary: string;
  focus: string[];
}

/** Profiles as provided by the K9HOPE founders. Do not add credentials that are not listed here. */
export const PEOPLE: Person[] = [
  {
    name: "Vikram T",
    initials: "VT",
    role: "Founder & Product Lead",
    education: "B.E. Computer Science",
    summary:
      "Turned a night spent searching for a donor into a product. Owns the vision and direction of K9HOPE, from problem discovery to planning and research collaboration.",
    focus: ["Product vision and direction", "Problem discovery and user understanding", "Planning and coordination", "Research collaboration"],
  },
  {
    name: "Adithya T",
    initials: "AT",
    role: "Lead Developer & Technical Co-builder",
    education: "B.E. Computer Science",
    summary:
      "Built the majority of the K9HOPE software. Owns the architecture, implementation and the engineering decisions behind the platform.",
    focus: ["Software architecture", "Platform implementation", "Engineering decisions", "Technical ownership"],
  },
  {
    name: "Trisha Pal",
    initials: "TP",
    role: "Research & Strategy Contributor",
    education: "PGDM (first year), XIME Chennai",
    summary:
      "Shaped the evidence behind K9HOPE through research, analysis and synthesis, and brought strategic thinking to where the project goes next.",
    focus: ["Research and analysis", "Research synthesis", "Strategic thinking"],
  },
];

export const AUDIENCES = [
  { who: "Developers", how: "Next.js, TypeScript and Firebase work across four portals." },
  { who: "Veterinary professionals", how: "Review clinical rules, workflows and safety wording." },
  { who: "Veterinary students", how: "Help document donor criteria and transfusion practice." },
  { who: "Researchers and data scientists", how: "Extend the forecasting work with real, consented data." },
  { who: "Designers", how: "Make urgent flows calmer and clearer on small phones." },
  { who: "Animal-welfare organisations", how: "Bring donor drives and volunteer networks onto the platform." },
  { who: "Volunteers", how: "Translate, test and spread the word in your city." },
];

export const ROADMAP = [
  {
    theme: "Stronger donor matching",
    items: [
      "Connect distance-based matching to live clinic requests",
      "Rank donors by compatibility, distance and last donation date",
      "Travel-time aware matching",
    ],
  },
  {
    theme: "Veterinary network",
    items: [
      "Onboarding guide for clinics joining the network",
      "Shared request view across participating clinics",
      "Integrations with veterinary practice software",
    ],
  },
  {
    theme: "Forecasting and research",
    items: [
      "Run the stock advisor on real, consented clinic records",
      "Publish an open, anonymised demand dataset if partners agree",
      "Evaluate forecasts across more clinics and seasons",
    ],
  },
  {
    theme: "Open-source foundations",
    items: [
      "Declare a licence and publish contribution guidelines",
      "Good-first-issue labels and a public project board",
      "Automated tests for eligibility and matching rules",
    ],
  },
  {
    theme: "Community growth",
    items: [
      "Tamil-language interface",
      "City chapters beyond Chennai",
      "Donor-drive toolkit for welfare groups",
    ],
  },
];
