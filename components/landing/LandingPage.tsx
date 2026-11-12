import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./landing.css";

import Link from "next/link";
import {
  AUDIENCES,
  CAPABILITIES,
  LINKS,
  PEOPLE,
  PROBLEMS,
  PUBLICATION,
  ROADMAP,
  STATUS_HINT,
  STATUS_LABEL,
  type CapabilityStatus,
} from "./content";
import { DemandChart } from "./DemandChart";
import { DonorNetwork } from "./DonorNetwork";
import { HowItWorks } from "./HowItWorks";
import { SiteNav } from "./SiteNav";
import { Story } from "./Story";
import { Wordmark } from "./Wordmark";

const container = "mx-auto max-w-7xl px-5 sm:px-8";

export function LandingPage() {
  return (
    <div className="k9 min-h-screen overflow-x-clip">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <Story />
        <Problem />
        <Platform />
        <Research />
        <Community />
        <People />
        <Roadmap />
      </main>
      <Footer />
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="survey-grid relative bg-k9-night pt-16 text-k9-bone">
      <div className={`${container} grid items-center gap-10 pb-16 pt-14 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12 lg:gap-6 lg:pb-20 lg:pt-10`}>
        <div className="lg:col-span-6">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.5rem,5.2vw,4.4rem)] font-semibold leading-[1.0] tracking-[-0.035em]"
          >
            Every second matters. Every donor can change a life.
          </h1>
          <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-k9-mist sm:text-xl">
            K9HOPE is building a connected canine blood donation network, bringing veterinary collaboration, intelligent
            matching and research closer to the animals that need it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#story"
              className="rounded-full bg-k9-coral px-6 py-3.5 font-bold text-k9-night transition-transform hover:bg-[#ff9584] active:scale-[0.97]"
            >
              Explore K9HOPE
            </a>
            <a
              href="#community"
              className="rounded-full px-6 py-3.5 font-bold text-k9-bone ring-1 ring-k9-moss transition-colors hover:ring-k9-mist active:scale-[0.97]"
            >
              Join the open-source community
            </a>
          </div>
          <p className="mt-10 text-[15px] text-k9-mist">Started in Chennai, India. Developed in the open on GitHub.</p>
        </div>
        <div className="lg:col-span-6 lg:pl-4">
          <DonorNetwork />
        </div>
      </div>
    </section>
  );
}

/* ── Problem ───────────────────────────────────────────────────────────── */

function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="on-light bg-k9-paper">
      <div className={`${container} grid gap-12 py-24 md:grid-cols-12 md:py-32`}>
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <h2 id="problem-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              The blood exists. The network doesn&apos;t.
            </h2>
            <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-k9-slate">
              Plenty of healthy dogs could donate. What is missing is a reliable way to find them, check them and reach
              them while there is still time.
            </p>
          </div>
        </div>
        <ul className="md:col-span-6 md:col-start-7">
          {PROBLEMS.map((p) => (
            <li key={p.title} className="border-t border-k9-mist/60 py-8 first:border-t-0 first:pt-0 md:first:pt-2">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.01em]">{p.title}</h3>
              <p className="mt-2 max-w-[56ch] text-[17px] leading-relaxed text-k9-slate">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Platform ──────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<CapabilityStatus, string> = {
  implemented: "bg-k9-teal-ink text-white",
  prototype: "bg-white text-k9-night ring-1 ring-k9-slate/50",
  research: "bg-k9-night text-k9-bone",
  planned: "bg-transparent text-k9-slate border border-dashed border-k9-slate",
};

function StatusPill({ status }: { status: CapabilityStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Platform() {
  const order: CapabilityStatus[] = ["implemented", "prototype", "research", "planned"];
  return (
    <>
      <section id="platform" aria-labelledby="platform-title" className="on-light bg-k9-bone">
        <div className={`${container} py-24 md:py-32`}>
          <div className="grid gap-8 md:grid-cols-12">
            <h2 id="platform-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl md:col-span-6">
              What the platform does today, and what is still on the way.
            </h2>
            <p className="max-w-[48ch] text-lg leading-relaxed text-k9-slate md:col-span-5 md:col-start-8 md:pt-2">
              Every capability below was checked against the source code. We mark what is working, what is a prototype,
              what comes from our research and what is still planned.
            </p>
          </div>

          <dl className="mt-12 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
            {order.map((s) => (
              <div key={s} className="flex items-start gap-3">
                <dt>
                  <StatusPill status={s} />
                </dt>
                <dd className="pt-1 text-k9-slate">{STATUS_HINT[s]}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-10 border-t border-k9-night/15">
            {CAPABILITIES.map((c) => (
              <li key={c.name} className="grid gap-2 border-b border-k9-night/15 py-6 md:grid-cols-12 md:items-baseline md:gap-6">
                <h3 className="font-display text-xl font-semibold tracking-[-0.01em] md:col-span-4">{c.name}</h3>
                <p className="max-w-[60ch] leading-relaxed text-k9-slate md:col-span-6">{c.detail}</p>
                <div className="md:col-span-2 md:text-right">
                  <StatusPill status={c.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="hiw-title" className="bg-k9-night text-k9-bone">
        <div className={`${container} py-24 md:py-32`}>
          <h2 id="hiw-title" className="max-w-[20ch] font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            From an emergency request to a safe transfusion.
          </h2>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-k9-mist">
            Follow one request through the platform. The screening and matching steps run real K9HOPE code, so you can
            change the inputs and watch the result.
          </p>
          <div className="mt-14">
            <HowItWorks />
          </div>
        </div>
      </section>
    </>
  );
}

/* ── Research ──────────────────────────────────────────────────────────── */

function Research() {
  return (
    <section id="research" aria-labelledby="research-title" className="on-light bg-k9-paper">
      <div className={`${container} py-24 md:py-32`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="research-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              Forecasting for days when nothing happens, and the days when everything does.
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="font-display text-lg font-semibold">The challenge</h3>
                <p className="mt-2 leading-relaxed text-k9-slate">
                  A veterinary clinic can go weeks without needing blood, then face several emergencies at once. Averages
                  hide that. Planning stock on a single best guess means running short exactly when it matters.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">The approach</h3>
                <p className="mt-2 leading-relaxed text-k9-slate">
                  Our research uses conformal prediction to give a range with a stated level of confidence instead of one
                  number. It treats demand as zero-inflated: whether demand occurs, and how much, are modelled separately.
                </p>
              </div>
            </div>
          </div>

          <aside aria-labelledby="paper-title" className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl bg-k9-night p-7 text-k9-bone sm:p-9">
              <svg aria-hidden="true" className="absolute -bottom-16 -right-16 h-56 w-56 text-k9-moss" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
              <p className="relative font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-k9-teal sm:text-4xl">
                Best Paper Award
              </p>
              <p className="relative mt-1 text-k9-mist">{PUBLICATION.venue}</p>
              <h3 id="paper-title" className="relative mt-8 font-display text-xl font-medium leading-snug">
                {PUBLICATION.title}
              </h3>
              <p className="relative tabular mt-4 break-all text-sm text-k9-mist">DOI {PUBLICATION.doi}</p>
              <div className="relative mt-7 flex flex-wrap gap-3">
                <a href={LINKS.ieee} className="rounded-full bg-k9-bone px-5 py-2.5 text-sm font-bold text-k9-night active:scale-[0.97]">
                  Read on IEEE Xplore
                </a>
                <a href={LINKS.researchGate} className="rounded-full px-5 py-2.5 text-sm font-bold text-k9-bone ring-1 ring-k9-moss hover:ring-k9-mist">
                  View on ResearchGate
                </a>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-20 rounded-2xl bg-k9-bone p-5 sm:p-8 lg:p-10">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.01em]">See why averages fail</h3>
          <p className="mt-2 max-w-[62ch] text-k9-slate">
            Each bar is a day with demand. Switch between holding the average and holding a conformal bound, then change
            the target coverage.
          </p>
          <div className="mt-8">
            <DemandChart />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Community ─────────────────────────────────────────────────────────── */

function Community() {
  const actions = [
    { href: LINKS.repo, label: "Explore GitHub", primary: true },
    { href: LINKS.contributing, label: "Contribute to the project" },
    { href: LINKS.newIssue, label: "Report an issue" },
    { href: "#roadmap", label: "Explore the roadmap" },
    { href: LINKS.collaborate, label: "Collaborate with us" },
  ];
  return (
    <section id="community" aria-labelledby="community-title" className="bg-k9-forest text-k9-bone">
      <div className={`${container} py-24 md:py-32`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="community-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              Built together. For every dog that needs us.
            </h2>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-k9-mist">
              K9HOPE is open source. It will reach more dogs when more people shape it: the ones who write code, and the
              ones who know what a 2 AM emergency is like from the other side of the clinic counter.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {actions.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  className={`rounded-full px-5 py-3 text-[15px] font-bold transition-colors active:scale-[0.97] ${
                    a.primary ? "bg-k9-bone text-k9-night" : "text-k9-bone ring-1 ring-k9-moss hover:ring-k9-mist"
                  }`}
                >
                  {a.label}
                </a>
              ))}
            </div>
            <div className="mt-10 rounded-xl bg-k9-night p-5 ring-1 ring-k9-moss">
              <p className="text-sm text-k9-mist">Run it locally</p>
              <pre tabIndex={0} aria-label="Commands to run K9HOPE locally" className="mt-3 overflow-x-auto text-[13px] leading-6 text-k9-bone">
                <code>{`git clone ${LINKS.repo}.git
cd k9hope-canine-blood-donation
npm install
cp env.template .env.local
npm run dev`}</code>
              </pre>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <h3 className="font-display text-xl font-semibold">Who we are looking for</h3>
            <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <div key={a.who} className="border-t border-k9-moss py-5">
                  <dt className="font-display text-lg font-semibold">{a.who}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-k9-mist">{a.how}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── People ────────────────────────────────────────────────────────────── */

function People() {
  return (
    <section id="people" aria-labelledby="people-title" className="on-light bg-k9-paper">
      <div className={`${container} py-24 md:py-32`}>
        <h2 id="people-title" className="max-w-[18ch] font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          The people behind K9HOPE.
        </h2>
        <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {PEOPLE.map((p) => (
            <li key={p.name}>
              <article aria-labelledby={`person-${p.initials}`}>
                <div className="relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-k9-forest p-6">
                  <svg aria-hidden="true" viewBox="0 0 200 150" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                    <g stroke="#43C2B1" strokeOpacity="0.22" strokeWidth="1" fill="none">
                      <circle cx="150" cy="40" r="26" />
                      <circle cx="150" cy="40" r="48" />
                      <circle cx="150" cy="40" r="70" />
                    </g>
                    <circle cx="150" cy="40" r="4" fill="#43C2B1" />
                  </svg>
                  <span className="relative font-display text-7xl font-semibold tracking-[-0.04em] text-k9-bone">{p.initials}</span>
                </div>
                <h3 id={`person-${p.initials}`} className="mt-6 font-display text-2xl font-semibold tracking-[-0.01em]">
                  {p.name}
                </h3>
                <p className="mt-1 font-bold text-k9-teal-ink">{p.role}</p>
                <p className="text-[15px] text-k9-slate">{p.education}</p>
                <p className="mt-4 leading-relaxed text-k9-slate">{p.summary}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {p.focus.map((f) => (
                    <li key={f} className="rounded-full bg-k9-bone px-3 py-1 text-sm text-k9-night">
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Roadmap ───────────────────────────────────────────────────────────── */

function Roadmap() {
  return (
    <section id="roadmap" aria-labelledby="roadmap-title" className="on-light bg-k9-bone">
      <div className={`${container} py-24 md:py-32`}>
        <div className="grid gap-8 md:grid-cols-12">
          <h2 id="roadmap-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl md:col-span-6">
            Where K9HOPE goes next.
          </h2>
          <p className="max-w-[46ch] text-lg leading-relaxed text-k9-slate md:col-span-5 md:col-start-8 md:pt-2">
            Everything on this roadmap is planned work. None of it is built yet, and priorities will move with the
            community. Pick a theme and open an issue to get involved.
          </p>
        </div>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-k9-night/10 sm:grid-cols-2 lg:grid-cols-5">
          {ROADMAP.map((r) => (
            <li key={r.theme} className="flex flex-col bg-k9-bone p-6 lg:p-7">
              <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.01em]">{r.theme}</h3>
              <ul className="mt-5 flex flex-col gap-3 text-[15px] leading-snug text-k9-slate">
                {r.items.map((i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full border border-k9-slate" />
                    {i}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-6 text-sm font-bold text-k9-slate">Planned</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────── */

function Footer() {
  const cols = [
    {
      title: "Project",
      links: [
        { href: LINKS.repo, label: "GitHub repository" },
        { href: LINKS.contributing, label: "Contributing guide" },
        { href: LINKS.issues, label: "Issues" },
        { href: LINKS.app, label: "Open the app" },
      ],
    },
    {
      title: "Research",
      links: [
        { href: LINKS.ieee, label: "IEEE Xplore" },
        { href: LINKS.researchGate, label: "ResearchGate" },
        { href: LINKS.doi, label: "DOI link" },
      ],
    },
    {
      title: "Contact",
      links: [
        { href: LINKS.collaborate, label: "Propose a collaboration" },
        { href: LINKS.newIssue, label: "Report a problem" },
      ],
    },
  ];
  return (
    <footer className="bg-k9-night text-k9-bone">
      <div className={`${container} grid gap-12 py-16 md:grid-cols-12`}>
        <div className="md:col-span-5">
          <Wordmark />
          <p className="mt-5 max-w-[40ch] leading-relaxed text-k9-mist">
            Making canine blood donation organised, discoverable, accessible and scientifically informed. Started in
            Chennai, India.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title} className="md:col-span-2">
            <h2 className="font-display text-base font-semibold">{c.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-[15px] text-k9-mist">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="hover:text-k9-bone">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="hover:text-k9-bone">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-k9-moss/60">
        <div className={`${container} flex flex-col gap-3 py-6 text-sm text-k9-mist md:flex-row md:justify-between`}>
          <p>© {new Date().getFullYear()} K9HOPE contributors. A software licence has not yet been declared in the repository.</p>
          <p className="max-w-[60ch] md:text-right">
            K9HOPE supports coordination. It is not a substitute for veterinary medical judgement.
          </p>
        </div>
      </div>
    </footer>
  );
}
