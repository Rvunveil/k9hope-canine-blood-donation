"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useRef, useState } from "react";
import { STORY_BEATS } from "./content";

const TOTAL_HOURS = 14;

function clockLabel(hoursSince2am: number) {
  const totalMin = Math.round((2 + hoursSince2am) * 4) * 15; // snap to 15 minutes
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { time: `${h12}:${m.toString().padStart(2, "0")}`, suffix };
}

export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 70%"] });
  const [hours, setHours] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setHours(Math.min(TOTAL_HOURS, Math.max(0, v * TOTAL_HOURS * 1.05)));
  });

  const shown = reduce ? TOTAL_HOURS : hours;
  const { time, suffix } = clockLabel(shown);
  const frac = shown / TOTAL_HOURS;
  const C = 2 * Math.PI * 92;

  return (
    <section id="story" aria-labelledby="story-title" className="relative bg-k9-night text-k9-bone">
      <div ref={ref} className="relative mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 md:grid-cols-12 md:py-36">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <h2 id="story-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              It started with one night.
            </h2>
            <div className="mt-10 flex items-center gap-8">
              <svg viewBox="0 0 200 200" className="h-36 w-36 shrink-0 -rotate-90 sm:h-44 sm:w-44" aria-hidden="true">
                <circle cx="100" cy="100" r="92" fill="none" stroke="#24524A" strokeWidth="4" />
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke={frac > 0.98 ? "#43C2B1" : "#FF806C"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - frac)}
                  style={{ transition: "stroke 0.4s ease" }}
                />
              </svg>
              <div aria-live="off">
                <p className="font-display tabular text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
                  {time}
                  <span className="ml-1 text-2xl font-medium text-k9-mist">{suffix}</span>
                </p>
                <p className="tabular mt-2 text-k9-mist">
                  {shown < 0.25 ? "The search begins" : `${Math.floor(shown)} ${Math.floor(shown) === 1 ? "hour" : "hours"} searching`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <ol className="flex flex-col gap-16 md:col-span-6 md:col-start-7 md:gap-28 md:pt-24">
          {STORY_BEATS.map((b, i) => {
            const active = reduce || shown >= b.hours - 0.01;
            return (
              <motion.li
                key={b.time}
                initial={false}
                animate={{ opacity: active ? 1 : 0.45 }}
                transition={{ duration: 0.4 }}
                className="border-l-2 pl-6"
                style={{ borderColor: active ? (i === STORY_BEATS.length - 1 ? "#43C2B1" : "#FF806C") : "#24524A" }}
              >
                <p className="text-k9-mist">{b.time}</p>
                <p className="mt-3 max-w-[34ch] font-display text-2xl leading-snug tracking-[-0.01em] sm:text-[28px]">{b.text}</p>
              </motion.li>
            );
          })}
          <li className="max-w-[46ch] text-lg leading-relaxed text-k9-mist">
            There was no organised, searchable network connecting dogs that need blood with dogs that can give it.{" "}
            <span className="text-k9-bone">So we decided to build one.</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
