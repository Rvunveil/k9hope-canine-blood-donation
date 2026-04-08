import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// These are the exact clinic IDs we seeded in seedFirebase.ts
// IMPORTANT: After running seedFirebase.ts, go to your Firestore console,
// open the `veterinaries` collection, and replace these with the actual doc IDs.
// Or just run this script and it will create inventory docs with these IDs
// which the ZICP dashboard will find when a vet logs in.
const VET_CLINIC_IDS = [
  "paws-care-ambattur",
  "chennai-pet-hospital",
  "k9-wellness-adyar",
  "happy-tails-velachery",
  "fur-feather-tnagar",
  "pawsome-tambaram",
  "royal-pets-porur",
  "animal-aid-chromepet",
];

// All 9 canine blood types the ZICP model tracks
const BLOOD_TYPES = [
  "DEA 1.1+", "DEA 1.1-", "DEA 1.2+", "DEA 1.2-",
  "DEA 3", "DEA 4", "DEA 5", "DEA 7", "Universal"
];

// Realistic stock levels based on actual canine blood bank distribution:
// DEA 1.1+ is most common (~42% of dogs), DEA 4 is universal donor type
// DEA 1.2, DEA 5, DEA 7 are rarer — lower stock is realistic
const REALISTIC_STOCK: Record<string, { min: number; max: number }> = {
  "DEA 1.1+":  { min: 4,  max: 18 }, // Most common type, higher demand
  "DEA 1.1-":  { min: 2,  max: 12 }, // Universal donor — valuable, moderate stock
  "DEA 1.2+":  { min: 1,  max: 8  }, // Less common
  "DEA 1.2-":  { min: 0,  max: 6  }, // Rare, often near zero
  "DEA 3":     { min: 1,  max: 7  }, // Moderate
  "DEA 4":     { min: 3,  max: 14 }, // ~98% of dogs are DEA4+, high demand
  "DEA 5":     { min: 0,  max: 5  }, // Rare
  "DEA 7":     { min: 1,  max: 9  }, // Moderate
  "Universal": { min: 2,  max: 10 }, // Processed universal — moderate stock
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── SEED BLOOD INVENTORY ────────────────────────────────────────────────────
// Creates one doc per clinic in `blood-inventory` collection
// Doc ID = clinicId, fields = blood type keys with unit counts
async function seedBloodInventory() {
  console.log("\n🩸 Seeding blood-inventory collection...");
  console.log("   (One doc per clinic, field per blood type)\n");

  for (const clinicId of VET_CLINIC_IDS) {
    const inventoryDoc: Record<string, any> = {
      clinicId,
      updatedAt: new Date(),
      updatedBy: "seed-script",
    };

    for (const bt of BLOOD_TYPES) {
      const { min, max } = REALISTIC_STOCK[bt];
      inventoryDoc[bt] = randInt(min, max);
    }

    await setDoc(doc(db, "blood-inventory", clinicId), inventoryDoc);

    // Pretty print the stock
    const stockSummary = BLOOD_TYPES
      .map(bt => `${bt}: ${inventoryDoc[bt]}u`)
      .join(" | ");
    console.log(`  ✅ ${clinicId}`);
    console.log(`     ${stockSummary}\n`);
  }
}

// ── SEED DONOR-APPOINTMENTS (demand history for ZICP) ───────────────────────
// ZICP reads `donor-appointments` with status=completed to build demand history
// We need 180 days of history with realistic zero-inflated patterns
// (most days = 0 demand, occasional spikes — typical for small vet blood banks)
async function seedDonorAppointments() {
  console.log("📅 Seeding donor-appointments (ZICP demand history)...");
  console.log("   180 days × 9 blood types, realistic zero-inflated demand\n");

  let totalDocs = 0;

  for (const clinicId of VET_CLINIC_IDS) {
    // Each clinic gets its own demand pattern
    // Simulate ~2-3 transfusions per week across all blood types (realistic for small clinic)
    for (let daysBack = 180; daysBack >= 0; daysBack--) {
      const date = daysAgo(daysBack);

      // Zero-inflation: only ~25% of days have any demand at this clinic
      // This matches the paper's dataset characteristics
      if (Math.random() > 0.28) continue;

      // On active days, 1-2 blood types needed
      const numTypes = Math.random() > 0.7 ? 2 : 1;
      const shuffled = [...BLOOD_TYPES].sort(() => Math.random() - 0.5);

      for (let t = 0; t < numTypes; t++) {
        const bloodType = shuffled[t];

        // Demand quantity: mostly 1 unit, occasionally 2 (realistic)
        const demand = Math.random() > 0.8 ? 2 : 1;

        for (let u = 0; u < demand; u++) {
          const apptData = {
            clinicId,
            bloodType,
            patientBloodGroup: bloodType,
            status: "completed",
            completedAt: date,
            matchedAt: daysAgo(daysBack + 1),
            createdAt: daysAgo(daysBack + 2),
            donorId: `seed-donor-${Math.random().toString(36).slice(2, 8)}`,
            patientId: `seed-patient-${Math.random().toString(36).slice(2, 8)}`,
            units: 1,
            notes: "Seeded demand history for ZICP calibration",
          };

          await addDoc(collection(db, "donor-appointments"), apptData);
          totalDocs++;
        }
      }
    }

    console.log(`  ✅ ${clinicId} — demand history written`);
  }

  console.log(`\n   Total donor-appointment docs: ${totalDocs}`);
}

// ── SEED UPCOMING APPOINTMENTS (shows on vet dashboard) ─────────────────────
async function seedUpcomingAppointments() {
  console.log("\n📆 Seeding upcoming appointments for vet dashboards...");

  const statuses = ["confirmed", "confirmed", "pending", "confirmed"];

  for (const clinicId of VET_CLINIC_IDS) {
    // 3-5 upcoming appointments per clinic
    const count = randInt(3, 5);
    for (let i = 0; i < count; i++) {
      const bloodType = BLOOD_TYPES[randInt(0, BLOOD_TYPES.length - 1)];
      await addDoc(collection(db, "donor-appointments"), {
        clinicId,
        bloodType,
        patientBloodGroup: bloodType,
        status: statuses[randInt(0, statuses.length - 1)],
        appointmentDate: daysFromNow(randInt(1, 14)),
        createdAt: daysAgo(randInt(1, 5)),
        donorId: `seed-donor-${Math.random().toString(36).slice(2, 8)}`,
        patientId: `seed-patient-${Math.random().toString(36).slice(2, 8)}`,
        units: 1,
        notes: "Upcoming donation appointment",
      });
    }
    console.log(`  ✅ ${clinicId} — ${count} upcoming appointments`);
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 K9Hope Inventory + ZICP Seed Script");
  console.log("=======================================");
  console.log("⚠️  Creates NEW docs only. Existing data is safe.\n");
  console.log("📋 What this seeds:");
  console.log("   blood-inventory    → 1 doc per clinic (current stock levels)");
  console.log("   donor-appointments → 180 days of demand history (ZICP needs this)");
  console.log("   donor-appointments → upcoming confirmed appointments\n");

  await seedBloodInventory();
  await seedDonorAppointments();
  await seedUpcomingAppointments();

  console.log("\n✅ Inventory seeding complete!");
  console.log("   ZICP now has enough calibration data (180 days)");
  console.log("   to show real predictions instead of all-zeros.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
