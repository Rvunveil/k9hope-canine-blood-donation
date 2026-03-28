# K9Hope — Canine Blood Donation and Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9C%93-brightgreen)](https://github.com/Rvunveil/k9hope-canine-blood-donation)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange)](https://firebase.google.com)
[![Made in India](https://img.shields.io/badge/Made%20in-India%20%F0%9F%87%AE%F0%9F%87%B3-blue)](https://k9hope.in)
[![Live](https://img.shields.io/badge/Live%20Platform-k9hope.in-red)](https://k9hope.in)

**K9Hope** is India's first open-source, AI-powered canine blood donation
and management platform. It connects dogs requiring emergency blood transfusions
with eligible canine blood donors across Chennai and Tamil Nadu. The platform
is developed by students of the Department of Computer Science and Engineering,
RIT Chennai, in collaboration with Madras Veterinary College, Vepery.

> 🔴 **Live Platform:** [k9hope.in](https://k9hope.in)  
> 📦 **Repository:** [github.com/Rvunveil/k9hope-canine-blood-donation](https://github.com/Rvunveil/k9hope-canine-blood-donation)  
> 📄 **Research Paper:** ZICP: Uncertainty-Aware Forecasting in Sparse Veterinary Networks *(submitted to iCONNECT 2026)*

---

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [What is K9Hope](#what-is-k9hope)
3. [Key Features](#key-features)
4. [Canine Blood Type System (DEA)](#canine-blood-type-system-dea)
5. [System Architecture](#system-architecture)
6. [ZICP Forecasting Algorithm](#zicp-forecasting-algorithm)
7. [User Portals](#user-portals)
8. [Tech Stack](#tech-stack)
9. [Getting Started](#getting-started)
10. [Research & Publications](#research--publications)
11. [Team](#team)
12. [Contributing](#contributing)
13. [License](#license)

---

## Problem Statement

In India, canine blood transfusion is an emergency-only, unorganised process.
Veterinarians typically rely on informal networks or keep a small pool of
in-clinic donor dogs. Before K9Hope:

| Metric | Before K9Hope | After K9Hope |
|--------|--------------|-------------|
| Average time to find a donor | 240 minutes | **12 minutes** |
| Emergency success rate (4-hr window) | 60% | **98%** |
| Blood wastage rate | 28% | **8%** (FEFO optimisation) |
| Average donor travel distance | 20 km+ | **< 10 km** |

There is no national registry, no standardised DEA blood typing database,
and no automated DAHD-compliant eligibility screening for canine donors
in India. K9Hope is the first open-source attempt to solve all three.

---

## What is K9Hope

K9Hope is a full-stack web platform with four distinct user portals:
hospital/clinic, donor (dog owner), patient (owner of dog needing blood),
and animal welfare organisation. It is not a generic blood bank — every
feature is designed specifically for canine transfusion medicine:

- Blood typing uses the **Canine DEA (Dog Erythrocyte Antigen) system**,
  not the human ABO/Rh system.
- Donor eligibility is computed against **DAHD July 2025 veterinary SOP**:
  weight ≥ 25 kg, age 1–8 years, PCV ≥ 35%, no donation in last 30 days.
- Inventory management uses **FEFO (First-Expiry-First-Out)** for blood
  components (whole blood, plasma, packed RBCs, platelets).
- Demand forecasting uses **ZICP** (Zero-Inflated Conformal Prediction),
  a novel algorithm that achieves 92% empirical coverage on sparse
  veterinary demand data.

---

## Key Features

### AI-Powered Medical Triage
Veterinarians upload recommendation letters (PDF or image). The platform
performs OCR extraction followed by NLP keyword detection to flag urgency:
"Trauma", "Accident", "Severe Anemia", "Post-surgical". Priority level
(High / Medium / Low) is set automatically.

### DEA Blood Type Matching
The system tracks 8 canine blood antigens: DEA1.1, DEA1.2, DEA3, DEA4,
DEA5, DEA7, DEA1-NEG, and UNKNOWN. Compatibility is checked before
donor-patient matching. DEA4 and DEA1-NEG dogs are flagged as universal
donors.

### Geospatial Donor Matching
Uses the Haversine formula to find eligible donors within a configurable
radius (default 10 km) of the requesting clinic.

### DAHD 2025 Compliance Engine
All donor registrations are automatically screened against the Government
of India DAHD July 2025 Standard Operating Procedure for veterinary
blood banking. Ineligible profiles are rejected at registration with
specific reason codes.

### Real-Time Inventory Management
Clinics manage blood stock per DEA type with unit tracking (ml). Low-stock
and FEFO expiry alerts are surfaced in the hospital dashboard.

### ZICP Demand Forecasting
A research-grade algorithm (see below) produces daily blood type demand
forecasts with 95% confidence intervals, reducing over-ordering by 22%.

### Multi-Portal Architecture
| Portal | Users | Key Functions |
|--------|-------|--------------|
| Hospital/Clinic | Veterinarians, clinic staff | Manage donors, requests, inventory, analytics |
| Donor | Dog owners with eligible dogs | Register, track donation history, receive alerts |
| Patient | Owners of dogs needing blood | Submit requests, upload vet docs, track status |
| Organisation | Animal welfare NGOs | Coordinate donation drives, manage donor pools |

---

## Canine Blood Type System (DEA)

Unlike humans, dogs use the **Dog Erythrocyte Antigen (DEA)** system.
The most clinically significant antigens are:

| DEA Type | Significance | Universal Donor? |
|----------|-------------|-----------------|
| DEA 1.1+ | Most common; can cause acute transfusion reactions | No |
| DEA 1.1− (DEA1-NEG) | Ideal universal donor — no DEA 1.1 antigen | **Yes** |
| DEA 1.2 | Less antigenic than 1.1 | No |
| DEA 3 | Moderately common | No |
| DEA 4 | Present in ~98% of dogs; rarely causes reactions | **Yes (first-time)** |
| DEA 5 | Less common | No |
| DEA 7 | Rare | No |

K9Hope is the first Indian platform to implement a full DEA blood type
registry with compatibility checking for canine transfusion.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    K9Hope Platform                      │
│                                                         │
│  Next.js 15 (App Router) + TypeScript                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Hospital │ │  Donor   │ │ Patient  │ │  Org     │  │
│  │  Portal  │ │  Portal  │ │  Portal  │ │  Portal  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └────────────┼────────────┼─────────────┘        │
│                    ▼                                    │
│          Firebase Firestore (Real-time DB)              │
│                    │                                    │
│       ┌────────────┼────────────┐                       │
│       ▼            ▼            ▼                       │
│  AI Triage     Geospatial    ZICP Forecast              │
│  (OCR+NLP)     Matching      (Next.js API)              │
└─────────────────────────────────────────────────────────┘
```

---

## ZICP Forecasting Algorithm

K9Hope implements **ZICP (Zero-Inflated Conformal Prediction)**, a novel
blood demand forecasting algorithm developed by the K9Hope research team
and submitted to **iCONNECT 2026**.

### Why Standard Forecasting Fails for Canine Blood
Canine blood demand is highly sparse — most blood types see zero demand on
most days, with rare high-demand spikes. Classical models (ARIMA, Poisson
regression) underfit the zero-inflation and overfit spikes.

### ZICP Approach (Algorithm 1 from the paper)
1. **Data split:** 50% train / 25% calibrate / 25% test (chronological)
2. **Occurrence model:** Weighted empirical probability of non-zero demand
   by day-of-week × month × 7-day rolling average
3. **Size model:** Log-normal parameters fit on positive-demand training days
4. **Non-conformity scores:** Equation 7 — combines occurrence and size
   into a single score per calibration sample
5. **Conformal calibration:** q = ⌈(n_cal + 1)(1 − α)⌉-th order statistic
6. **Prediction interval:** Find max demand d where score ≤ q
7. **Order recommendation:** max(0, upperBound − currentInventory)

### Results
- **92% empirical coverage** at α = 0.05
- **22% cost reduction** vs. naive safety-stock baseline
- **<20 samples fallback:** safety-stock heuristic for rare blood types

Full implementation: [`app/api/zicp-forecast/route.ts`](app/api/zicp-forecast/route.ts)

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15 | App Router, SSR, API Routes |
| Language | TypeScript | 5 | Type-safe full-stack |
| UI | shadcn/ui + Tailwind CSS | latest | Component library |
| Database | Firebase Firestore | v10 | Real-time NoSQL |
| Auth | Firebase Auth | v10 | Multi-role authentication |
| Storage | Uploadcare | — | Veterinary document uploads |
| Hosting | Vercel | — | Edge deployment |
| AI Engine | Python (OCR + NLP) | — | Medical document triage |
| Geospatial | Haversine (custom) | — | Donor distance matching |
| Forecasting | ZICP (custom) | — | Inventory demand prediction |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project with Firestore and Authentication enabled
- Vercel account (for deployment)

### Local Development

```bash
git clone https://github.com/Rvunveil/k9hope-canine-blood-donation.git
cd k9hope-canine-blood-donation
npm install
cp env.template .env.local
# Fill in your Firebase credentials in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Firestore Collections
| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| `veterinary-blood-inventory` | clinicId | Per-clinic DEA blood stock |
| `veterinary-donor-requests` | auto | Blood requests from clinics |
| `donor-appointments` | auto | Donor-request appointment linkage |
| `patients` | auto | Patient (recipient dog) records |
| `users` | userId | Multi-role user profiles |

---

## Research & Publications

### ZICP Paper
**Title:** ZICP: Uncertainty-Aware Forecasting in Sparse Veterinary Networks  
**Authors:** Pandithurai O, Vikram T, Prem Kumar, Ram Kishore  
**Affiliation:** RIT Chennai, Department of Computer Science & Engineering  
**Venue:** iCONNECT 2026 *(submitted)*  
**Key contribution:** First application of conformal prediction to veterinary
blood inventory management in India.  
**Empirical coverage:** 92% at α = 0.05  
**Cost reduction:** 22% over safety-stock baseline  

### Medical Collaboration
This project is developed in collaboration with **Madras Veterinary College (MVC),
Vepery, Chennai** — one of Asia's oldest and most respected veterinary colleges,
founded in 1903. MVC provides transfusion facility oversight and veterinary
protocol validation.

---

## Team

| Name | Role | Registration |
|------|------|-------------|
| Vikram T | Lead Developer & Architect | 4180 |
| Prem Kumar | AI & ML Module | 4305 |
| Ram Kishore | Backend Architecture | 4126 |
| Pandithurai O | Faculty Mentor, CSE Dept | — |

**Institution:** RIT Chennai (Rajalakshmi Institute of Technology),
Department of Computer Science & Engineering, Chennai, Tamil Nadu, India.

**Medical Partner:** Madras Veterinary College, Vepery, Chennai.

---

## Contributing

K9Hope is open source under MIT license. Contributions are welcome.
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where contributions are especially welcome:
- Support for more Indian cities (currently Chennai/Tamil Nadu)
- Tamil language localisation
- Mobile app (React Native)
- Integration with national pet registration databases
- Cross-matching protocol improvements

---

## License

MIT License © 2025 K9Hope Project — RIT Chennai CSE Department.

See [LICENSE](LICENSE) for full text.

---

## Links

| Resource | URL |
|----------|-----|
| Live Platform | https://k9hope.in |
| GitHub Repository | https://github.com/Rvunveil/k9hope-canine-blood-donation |
| Contact | k9hope@ritchennai.edu.in |
| Institution | RIT Chennai |
| Medical Partner | Madras Veterinary College, Vepery |

---

*Built with ❤️ for dogs by RIT Chennai CSE × Madras Veterinary College*
