"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 5 loading screens - each with a unique visual + message
const LOADING_SCREENS = [
  {
    id: "paw",
    message: "A dog in Chennai is waiting.",
    subtext: "Your action today could save a life tonight.",
    animation: "pulse",
    visual: "paw",
    accent: "#ef4444",
  },
  {
    id: "drop",
    message: "Blood doesn't know breeds.",
    subtext: "Every drop donated connects a donor to a patient.",
    animation: "drip",
    visual: "drop",
    accent: "#dc2626",
  },
  {
    id: "dog",
    message: "Street dogs have no voice.",
    subtext: "You do. You're here. That already means everything.",
    animation: "breathe",
    visual: "dog",
    accent: "#b91c1c",
  },
  {
    id: "heart",
    message: "Somewhere in Ambattur,",
    subtext: "a vet is searching for the same blood type you have.",
    animation: "beat",
    visual: "heart",
    accent: "#ef4444",
  },
  {
    id: "wave",
    message: "K9 Hope runs on people like you.",
    subtext: "Chennai's first canine blood donation network — built one donor at a time.",
    animation: "flow",
    visual: "wave",
    accent: "#dc2626",
  },
];

// SVG visuals as inline components
function PawSVG({ color }: { color: string }) {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="52" rx="18" ry="14" fill={color} opacity="0.9" />
      <ellipse cx="22" cy="40" rx="7" ry="9" fill={color} opacity="0.75" />
      <ellipse cx="58" cy="40" rx="7" ry="9" fill={color} opacity="0.75" />
      <ellipse cx="30" cy="28" rx="6" ry="7.5" fill={color} opacity="0.6" />
      <ellipse cx="50" cy="28" rx="6" ry="7.5" fill={color} opacity="0.6" />
    </svg>
  );
}

function DropSVG({ color }: { color: string }) {
  return (
    <svg width="64" height="88" viewBox="0 0 64 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M32 4 C32 4, 6 36, 6 56 C6 71.5 17.5 84 32 84 C46.5 84 58 71.5 58 56 C58 36 32 4 32 4Z"
        fill={color}
        opacity="0.9"
      />
      <path
        d="M20 58 C20 52, 24 46, 32 44"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function DogSVG({ color }: { color: string }) {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="48" cy="48" rx="28" ry="16" fill={color} opacity="0.85" />
      {/* Head */}
      <ellipse cx="74" cy="36" rx="14" ry="13" fill={color} opacity="0.9" />
      {/* Ear */}
      <ellipse cx="82" cy="26" rx="6" ry="9" fill={color} opacity="0.7" transform="rotate(15 82 26)" />
      {/* Snout */}
      <ellipse cx="85" cy="40" rx="7" ry="5" fill={color} opacity="0.65" />
      {/* Nose */}
      <circle cx="89" cy="39" r="2" fill="#7f1d1d" />
      {/* Eye */}
      <circle cx="80" cy="33" r="2.5" fill="white" />
      <circle cx="80.5" cy="33.5" r="1.2" fill="#1c1917" />
      {/* Tail */}
      <path d="M20 44 C10 36, 8 24, 16 20" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.8" />
      {/* Legs */}
      <rect x="32" y="60" width="7" height="10" rx="3" fill={color} opacity="0.7" />
      <rect x="44" y="60" width="7" height="10" rx="3" fill={color} opacity="0.7" />
      <rect x="56" y="60" width="7" height="10" rx="3" fill={color} opacity="0.7" />
    </svg>
  );
}

function HeartSVG({ color }: { color: string }) {
  return (
    <svg width="80" height="76" viewBox="0 0 80 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M40 70 C40 70, 4 46, 4 24 C4 12 13 4 22 4 C29 4 35 8 40 14 C45 8 51 4 58 4 C67 4 76 12 76 24 C76 46 40 70 40 70Z"
        fill={color}
      />
      <path d="M26 26 C26 20, 30 16, 35 16" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function WaveSVG({ color }: { color: string }) {
  return (
    <svg width="96" height="56" viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 36 C16 20, 32 52, 48 36 C64 20, 80 52, 96 36"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M0 48 C16 32, 32 64, 48 48 C64 32, 80 64, 96 48"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <circle cx="10" cy="28" r="4" fill={color} opacity="0.5" />
      <circle cx="48" cy="28" r="5" fill={color} opacity="0.7" />
      <circle cx="86" cy="28" r="4" fill={color} opacity="0.5" />
    </svg>
  );
}

function Visual({ type, color, animation }: { type: string; color: string; animation: string }) {
  const getMotionProps = () => {
    switch (animation) {
      case "pulse":
        return {
          animate: { scale: [1, 1.12, 1] },
          transition: { repeat: Infinity, duration: 1.4, ease: "easeInOut" },
        };
      case "drip":
        return {
          animate: { y: [0, 10, 0] },
          transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
        };
      case "breathe":
        return {
          animate: { scaleX: [1, 1.06, 1], scaleY: [1, 0.96, 1] },
          transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
        };
      case "beat":
        return {
          animate: { scale: [1, 1.18, 1, 1.08, 1] },
          transition: { repeat: Infinity, duration: 1.0, ease: "easeInOut" },
        };
      case "flow":
        return {
          animate: { x: [-4, 4, -4] },
          transition: { repeat: Infinity, duration: 2.0, ease: "easeInOut" },
        };
      default:
        return {
          animate: { opacity: [0.6, 1, 0.6] },
          transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
        };
    }
  };

  const svgMap: Record<string, JSX.Element> = {
    paw: <PawSVG color={color} />,
    drop: <DropSVG color={color} />,
    dog: <DogSVG color={color} />,
    heart: <HeartSVG color={color} />,
    wave: <WaveSVG color={color} />,
  };

  return (
    <motion.div {...getMotionProps()}>
      {svgMap[type] || svgMap["heart"]}
    </motion.div>
  );
}

export default function HeartLoading() {
  const [screen, setScreen] = useState<typeof LOADING_SCREENS[0] | null>(null);

  useEffect(() => {
    // Pick a random screen on mount
    const random = LOADING_SCREENS[Math.floor(Math.random() * LOADING_SCREENS.length)];
    setScreen(random);
  }, []);

  if (!screen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background z-50"
      suppressHydrationWarning
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={screen.id}
          className="flex flex-col items-center gap-6 px-8 text-center max-w-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Visual */}
          <Visual type={screen.visual} color={screen.accent} animation={screen.animation} />

          {/* Text */}
          <div className="flex flex-col gap-2">
            <p
              className="text-lg font-semibold select-none"
              style={{ color: screen.accent }}
            >
              {screen.message}
            </p>
            <p className="text-sm text-muted-foreground select-none leading-relaxed">
              {screen.subtext}
            </p>
          </div>

          {/* Subtle dots loader */}
          <div className="flex gap-2 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: screen.accent }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
