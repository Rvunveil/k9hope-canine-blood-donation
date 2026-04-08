// scripts/seedFirebase.ts
// Run with: npx ts-node --skip-project scripts/seedFirebase.ts
// SAFE: Only creates new docs. Never touches existing data.

// Load .env.local manually since this is a script, not Next.js
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

function genId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  ).join("-");
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const bloodGroups = ["DEA 1.1+", "DEA 1.1-", "DEA 3", "DEA 4", "DEA 7"];
const breeds = ["Labrador", "Golden Retriever", "German Shepherd", "Beagle", "Indie", "Doberman", "Rottweiler", "Poodle", "Boxer", "Dalmatian"];
const cities = ["Chennai", "Ambattur", "Anna Nagar", "Adyar", "Velachery", "Tambaram", "Porur", "Chromepet", "T.Nagar", "Sholinganallur"];
const pincodes: Record<string, string> = {
  Chennai: "600001", Ambattur: "600053", "Anna Nagar": "600040",
  Adyar: "600020", Velachery: "600042", Tambaram: "600045",
  Porur: "600116", Chromepet: "600044", "T.Nagar": "600017", Sholinganallur: "600119",
};
// FIX 1: Urgency values must match the donor dashboard query exactly
const urgencies = ["immediate", "within_24_hours", "within_3_days", "within_3_days", "within_24_hours"];
const dogNames = ["Bruno", "Max", "Charlie", "Rocky", "Buddy", "Luna", "Bella", "Coco", "Milo", "Daisy", "Tommy", "Ruby", "Simba", "Shadow", "Zeus", "Nala", "Duke", "Molly", "Rex", "Lily"];
const ownerNames = ["Arjun Kumar", "Priya Rajan", "Karthik Subramanian", "Divya Mohan", "Rahul Sharma", "Sneha Krishnan", "Vikram Pillai", "Anjali Nair", "Suresh Babu", "Meena Rajendran", "Arun Selvan", "Kavitha Anand", "Rajesh Murugan", "Lakshmi Venkat", "Deepak Iyer"];
const reasons = ["Anaemia", "Post-surgery recovery", "Trauma", "Tick fever", "Ehrlichiosis", "Bone marrow disease", "Internal bleeding"];
const vetClinics = [
  { name: "Paws & Care Veterinary Clinic", area: "Ambattur" },
  { name: "Chennai Pet Hospital", area: "Anna Nagar" },
  { name: "K9 Wellness Clinic", area: "Adyar" },
  { name: "Happy Tails Vet Centre", area: "Velachery" },
  { name: "Fur & Feather Animal Hospital", area: "T.Nagar" },
  { name: "Pawsome Veterinary Care", area: "Tambaram" },
  { name: "Royal Pets Clinic", area: "Porur" },
  { name: "Animal Aid Veterinary Hospital", area: "Chromepet" },
];

// FIX 2 & 3: Track seeded IDs so we can cross-link donors ↔ patients ↔ clinics
const seededDonorIds: Array<{ userId: string; bloodGroup: string; city: string; name: string }> = [];
const seededPatientIds: Array<{ userId: string; bloodGroup: string; city: string; name: string }> = [];
const seededClinicIds: Array<{ userId: string; name: string; city: string }> = [];

async function seedDonors(count = 30) {
  console.log(`\n🐕 Seeding ${count} donors...`);
  for (let i = 0; i < count; i++) {
    const userId = genId();
    const city = randomFrom(cities);
    const dogName = randomFrom(dogNames);
    const ownerName = randomFrom(ownerNames);
    const bloodGroup = randomFrom(bloodGroups);
    const lastDonationDaysAgo = Math.random() > 0.4 ? Math.floor(Math.random() * 180) + 10 : null;

    const donorData = {
      d_name: dogName,
      d_owner_name: ownerName,
      d_city: city,
      d_bloodgroup: bloodGroup,
      d_phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
      d_age: Math.floor(1.5 + Math.random() * 7),
      d_weight: Math.floor(15 + Math.random() * 30),
      d_breed: randomFrom(breeds),
      d_gender: randomFrom(["Male", "Female"]),
      d_pincode: pincodes[city],
      d_address: `${Math.floor(1 + Math.random() * 200)}, ${city}, Chennai`,
      d_lastDonation: lastDonationDaysAgo ? daysAgo(lastDonationDaysAgo) : null,
      onboarded: "yes",
      role: "individual",
      createdAt: daysAgo(Math.floor(Math.random() * 120)),
      updatedAt: daysAgo(Math.floor(Math.random() * 30)),
    };

    await setDoc(doc(db, "donors", userId), donorData);
    await setDoc(doc(db, "users", userId), {
      phone: donorData.d_phone,
      roles: ["donor"],
      role: "donor",
      onboarded: "yes",
      createdAt: donorData.createdAt,
      updatedAt: donorData.updatedAt,
    });

    // FIX 2: Track for cross-linking
    seededDonorIds.push({ userId, bloodGroup, city, name: dogName });
    console.log(`  ✅ Donor ${i + 1}/${count}: ${dogName} (${ownerName}) - ${city} - ${bloodGroup}`);
  }
}

async function seedPatients(count = 25) {
  console.log(`\n🩸 Seeding ${count} patients...`);
  for (let i = 0; i < count; i++) {
    const userId = genId();
    const city = randomFrom(cities);
    const dogName = randomFrom(dogNames);
    const ownerName = randomFrom(ownerNames);
    const urgency = randomFrom(urgencies);
    const bloodGroup = randomFrom(bloodGroups);
    const reason = randomFrom(reasons);

    const patientData = {
      p_name: dogName,
      p_owner_name: ownerName,
      p_city: city,
      // FIX 1: All required fields for donor dashboard query
      p_bloodgroup: bloodGroup,
      p_phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
      p_age: Math.floor(0.5 + Math.random() * 12),
      p_weight: Math.floor(8 + Math.random() * 35),
      p_breed: randomFrom(breeds),
      p_gender: randomFrom(["Male", "Female"]),
      p_pincode: pincodes[city],
      p_address: `${Math.floor(1 + Math.random() * 200)}, ${city}, Chennai`,
      p_urgencyRequirment: urgency,           // must be immediate|within_24_hours|within_3_days
      p_reasonRequirment: reason,              // shown in donor hero card
      p_quantityRequirment: randomFrom(["1", "2", "1", "1"]),  // shown in patient dashboard
      p_condition: reason,
      // FIX 1: request_status REQUIRED — donor dashboard queries where("request_status", "in", ["pending","accepted"])
      request_status: "pending",
      onboarded: "yes",
      role: "individual",
      createdAt: daysAgo(Math.floor(Math.random() * 60)),
      updatedAt: daysAgo(Math.floor(Math.random() * 15)),
    };

    await setDoc(doc(db, "patients", userId), patientData);
    await setDoc(doc(db, "users", userId), {
      phone: patientData.p_phone,
      roles: ["patient"],
      role: "patient",
      onboarded: "yes",
      createdAt: patientData.createdAt,
      updatedAt: patientData.updatedAt,
    });

    // FIX 2: Track for cross-linking
    seededPatientIds.push({ userId, bloodGroup, city, name: dogName });
    console.log(`  ✅ Patient ${i + 1}/${count}: ${dogName} (${ownerName}) - ${urgency} - ${city}`);
  }
}

// All 9 canine blood types for inventory
const BLOOD_TYPES_INVENTORY = [
  "DEA 1.1+", "DEA 1.1-", "DEA 1.2+", "DEA 1.2-",
  "DEA 3", "DEA 4", "DEA 5", "DEA 7", "Universal"
];
const REALISTIC_STOCK: Record<string, { min: number; max: number }> = {
  "DEA 1.1+":  { min: 4,  max: 18 },
  "DEA 1.1-":  { min: 2,  max: 12 },
  "DEA 1.2+":  { min: 1,  max: 8  },
  "DEA 1.2-":  { min: 0,  max: 6  },
  "DEA 3":     { min: 1,  max: 7  },
  "DEA 4":     { min: 3,  max: 14 },
  "DEA 5":     { min: 0,  max: 5  },
  "DEA 7":     { min: 1,  max: 9  },
  "Universal": { min: 2,  max: 10 },
};
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedVeterinaries() {
  console.log(`\n🏥 Seeding ${vetClinics.length} vet clinics...`);
  for (const clinic of vetClinics) {
    const userId = genId();
    const email = `${clinic.name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "")}@vetclinic.in`;

    const vetData = {
      v_name: clinic.name,
      v_city: clinic.area,
      v_email: email,
      v_phone: `+91${Math.floor(4400000000 + Math.random() * 999999999)}`,
      v_address: `${Math.floor(1 + Math.random() * 100)}, ${clinic.area} Main Road, Chennai`,
      v_pincode: pincodes[clinic.area] || "600001",
      v_registration_no: `TN/VET/${Math.floor(1000 + Math.random() * 9000)}`,
      onboarded: "yes",
      role: "organization",
      createdAt: daysAgo(Math.floor(Math.random() * 200) + 30),
      updatedAt: daysAgo(Math.floor(Math.random() * 30)),
    };

    await setDoc(doc(db, "veterinaries", userId), vetData);
    await setDoc(doc(db, "users", userId), {
      email: email,
      roles: ["veterinary"],
      role: "veterinary",
      onboarded: "yes",
      createdAt: vetData.createdAt,
      updatedAt: vetData.updatedAt,
    });

    // FIX 3: Seed blood-inventory doc with the SAME userId as the clinic doc ID
    // This is critical — the patient dashboard fetches doc(db, "blood-inventory", clinicDocId)
    // and the clinic dashboard fetches doc(db, "blood-inventory", userId)
    // Both must match the clinic's actual userId.
    const inventoryDoc: Record<string, any> = {
      clinicId: userId,
      updatedAt: new Date(),
      updatedBy: "seed-script",
    };
    for (const bt of BLOOD_TYPES_INVENTORY) {
      const { min, max } = REALISTIC_STOCK[bt];
      inventoryDoc[bt] = randInt(min, max);
    }
    await setDoc(doc(db, "blood-inventory", userId), inventoryDoc);

    // FIX 2: Track clinic IDs for donor-appointments seeding
    seededClinicIds.push({ userId, name: clinic.name, city: clinic.area });
    console.log(`  ✅ Vet: ${clinic.name} → ${email} (ID: ${userId})`);
    console.log(`  🩸 Blood inventory seeded for same ID: ${userId}`);
  }
}

async function seedDonations(count = 40) {
  console.log(`\n💉 Seeding ${count} donation records...`);
  for (let i = 0; i < count; i++) {
    await addDoc(collection(db, "donations"), {
      donorId: genId(),
      patientId: genId(),
      donationDate: daysAgo(Math.floor(Math.random() * 365)),
      bloodType: randomFrom(bloodGroups),
      amount: randomFrom(["200ml", "250ml", "300ml", "450ml"]),
      status: randomFrom(["completed", "completed", "completed", "pending", "cancelled"]),
      location: randomFrom(vetClinics).name,
      notes: randomFrom(["Smooth donation", "Dog was calm", "First-time donor", "Regular donor", ""]),
      createdAt: daysAgo(Math.floor(Math.random() * 365)),
    });
    if ((i + 1) % 10 === 0) console.log(`  ✅ ${i + 1}/${count} donations`);
  }
}

async function seedAppointments(count = 20) {
  console.log(`\n📅 Seeding ${count} appointments...`);
  for (let i = 0; i < count; i++) {
    const isFuture = i % 2 === 0;
    await addDoc(collection(db, "appointments"), {
      donorId: genId(),
      patientId: genId(),
      appointmentDate: isFuture ? daysAgo(-Math.floor(Math.random() * 14)) : daysAgo(Math.floor(Math.random() * 30)),
      status: randomFrom(["confirmed", "confirmed", "pending", "completed", "cancelled"]),
      location: randomFrom(vetClinics).name,
      notes: randomFrom(["Blood group confirmed", "Donor pre-screened", "Urgent case", ""]),
      createdAt: daysAgo(Math.floor(Math.random() * 30)),
    });
  }
  console.log(`  ✅ ${count} appointments created`);
}

// FIX 2: Create real donor-appointments docs linking real donor IDs ↔ real patient IDs
// This makes the donor dashboard show Branch A (active match) and the
// patient dashboard show matchedDonors > 0
async function seedDonorAppointmentLinks() {
  console.log(`\n🔗 Seeding donor-appointments links (real donor ↔ patient cross-links)...`);

  if (seededDonorIds.length === 0 || seededPatientIds.length === 0) {
    console.log("  ⚠️  No seeded IDs found — run seedDonors and seedPatients first");
    return;
  }

  const clinicId = seededClinicIds[0]?.userId || "unknown-clinic";
  let created = 0;

  // Match donors to patients by blood group (exact match required)
  for (const patient of seededPatientIds) {
    // Find a donor with the same blood group
    const matchingDonor = seededDonorIds.find(d => d.bloodGroup === patient.bloodGroup);
    if (!matchingDonor) continue;

    // Create the donor-appointments doc
    await addDoc(collection(db, "donor-appointments"), {
      donorId: matchingDonor.userId,          // real donor userId
      linkedPatientId: patient.userId,         // real patient userId — queried by patient dashboard
      linkedPatientName: patient.name,         // patient's dog name — shown in donor dashboard Branch A
      patientBloodGroup: patient.bloodGroup,   // blood type — shown in donor dashboard
      patientCity: patient.city,               // city — used for city-match bonus in donor dashboard
      status: "pending_donor_acceptance",      // triggers Branch A (active match) in donor dashboard
      isUrgent: "yes",                         // shows 🚨 Critical badge
      matchedAt: new Date(),                   // used by UrgencyCountdown component
      clinicId: clinicId,                      // vet clinic that created this match
      notes: "",
    });
    created++;

    // Only create a few links to keep it realistic (one per patient max)
    if (created >= 5) break;
  }

  console.log(`  ✅ Created ${created} donor ↔ patient appointment links`);
  console.log(`  ℹ️  donorId → linkedPatientId cross-links with status=pending_donor_acceptance`);
}

async function main() {
  console.log("🚀 K9Hope Firebase Seed Script");
  console.log("================================");
  console.log("⚠️  Creates NEW docs only — existing data is safe\n");
  console.log("📋 What this seeds:");
  console.log("   donors          → 30 donors with onboarded=yes");
  console.log("   patients        → 25 patients with request_status=pending (FIX 1)");
  console.log("   veterinaries    → 8 vet clinics");
  console.log("   blood-inventory → same doc ID as clinic userId (FIX 3)");
  console.log("   donor-appointments → real donor↔patient links (FIX 2)\n");

  await seedDonors(30);
  await seedPatients(25);
  await seedVeterinaries();    // also seeds blood-inventory with correct IDs
  await seedDonations(40);
  await seedAppointments(20);
  await seedDonorAppointmentLinks(); // must run after donors + patients + clinics

  console.log("\n✅ Done! 30 donors | 25 patients | 8 vet clinics | 40 donations | 20 appointments | donor-appointment links");
  console.log("\n🔑 Key fixes applied:");
  console.log("   FIX 1 ✅ Patients now have request_status=pending + correct urgency values");
  console.log("   FIX 2 ✅ donor-appointments docs created with real donorId + linkedPatientId");
  console.log("   FIX 3 ✅ blood-inventory doc ID = clinic userId (not a random slug)");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
