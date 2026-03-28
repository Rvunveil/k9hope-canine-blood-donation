"use client";

import { useState, useEffect, useMemo } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import {
  collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, limit, Timestamp
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, MapPin, Calendar, BarChart3, Heart, Users, Clock,
  TrendingUp, Droplet, Phone, Zap, CheckCircle2, Gift, Car, Sparkles,
  ArrowRight, ShieldCheck, Star, MessageSquare, Timer
} from "lucide-react";
import HeartLoading from "@/components/custom/HeartLoading";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow, differenceInHours } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DonorProfile {
  d_name: string;
  d_bloodgroup: string;
  d_city: string;
  d_weight_kg: number;
  d_lastDonation?: string;
  d_donationCount: number;
  d_isMedicalCondition: string;
  email: string;
  phone: string;
}

interface MatchedAppointment {
  id: string;
  linkedPatientName: string;
  patientBloodGroup: string;
  patientCity: string;
  clinicId: string;
  status: string;
  isUrgent: string;
  matchedAt: any;
  notes: string;
  thanksNote?: string;
  thanksNoteAt?: any;
}

interface UrgentPatient {
  id: string;
  p_name: string;
  p_bloodgroup: string;
  p_city: string;
  p_urgencyRequirment: string;
  p_reasonRequirment: string;
  p_quantityRequirment: string;
  p_doctorName?: string;
  p_hospitalName?: string;
  createdAt?: any;
}

interface DonorStats {
  totalDonations: number;
  livesSaved: number;
  lastDonation: string;
  lastDonationDate: Date | null;
  nextEligible: string;
  nextEligibleDate: Date | null;
  daysUntilEligible: number;
  isEligible: boolean;
  isMedicallyFit: boolean;
  pendingAppointments: number;
  completedAppointments: number;
}

// ── Urgency Countdown ─────────────────────────────────────────────────────────
function UrgencyCountdown({ matchedAt }: { matchedAt: any }) {
  const [hoursAgo, setHoursAgo] = useState(0);
  useEffect(() => {
    const date = matchedAt?.toDate ? matchedAt.toDate() : new Date(matchedAt);
    setHoursAgo(differenceInHours(new Date(), date));
    const interval = setInterval(() => setHoursAgo(differenceInHours(new Date(), date)), 60000);
    return () => clearInterval(interval);
  }, [matchedAt]);
  return (
    <span className={`font-bold ${hoursAgo >= 12 ? "text-red-600 animate-pulse" : "text-orange-600"}`}>
      {hoursAgo < 1 ? "Just now" : `${hoursAgo}h ago`}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DonorDashboard() {
  const { userId, role, isAuthLoading } = useUser();
  const router = useRouter();

  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [matchedAppointments, setMatchedAppointments] = useState<MatchedAppointment[]>([]);
  const [urgentPatient, setUrgentPatient] = useState<UrgentPatient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || role !== "donor") {
      router.push("/");
      return;
    }
    fetchDashboardData();
  }, [userId, role]);

  async function fetchDashboardData() {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Donor profile
      const donorSnap = await getDoc(doc(db, "donors", userId));
      if (!donorSnap.exists()) { setLoading(false); return; }
      const donorData = donorSnap.data() as DonorProfile;
      setProfile(donorData);

      // 2. Stats
      const calculatedStats = await calculateStats(donorData);
      setStats(calculatedStats);

      // 3. Matched appointments
      const apptQ = query(
        collection(db, "donor-appointments"),
        where("donorId", "==", userId)
      );
      const apptSnap = await getDocs(apptQ);
      const appts: MatchedAppointment[] = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as MatchedAppointment));
      setMatchedAppointments(appts);

      // 4. Find best urgent patient if eligible and no active match
      const activeMatch = appts.find(a =>
        a.status === "pending_donor_acceptance" || a.status === "confirmed"
      );
      if (calculatedStats.isEligible && !activeMatch) {
        await fetchBestUrgentPatient(donorData);
      }

    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateStats(donorData: DonorProfile): Promise<DonorStats> {
    const apptSnap = await getDocs(query(
      collection(db, "donor-appointments"),
      where("donorId", "==", userId)
    ));

    const completedAppointments = apptSnap.docs.filter(d => d.data().status === "completed").length;
    const pendingAppointments = apptSnap.docs.filter(
      d => d.data().status === "pending_donor_acceptance" || d.data().status === "confirmed"
    ).length;

    let isEligible = true;
    let nextEligible = "Right now";
    let nextEligibleDate: Date | null = null;
    let lastDonation = "Never";
    let lastDonationDate: Date | null = null;
    let daysUntilEligible = 0;

    if (donorData.d_lastDonation) {
      lastDonationDate = new Date(donorData.d_lastDonation);
      lastDonation = format(lastDonationDate, "d MMM yyyy");
      const daysSince = differenceInDays(new Date(), lastDonationDate);
      if (daysSince < 56) {
        isEligible = false;
        daysUntilEligible = 56 - daysSince;
        nextEligibleDate = new Date(lastDonationDate);
        nextEligibleDate.setDate(nextEligibleDate.getDate() + 56);
        nextEligible = format(nextEligibleDate, "d MMM yyyy");
      }
    }

    const isMedicallyFit = donorData.d_isMedicalCondition !== "yes" && donorData.d_weight_kg >= 25;
    if (!isMedicallyFit) { isEligible = false; nextEligible = "See Profile"; }

    return {
      totalDonations: donorData.d_donationCount || completedAppointments,
      livesSaved: (donorData.d_donationCount || completedAppointments) * 3,
      lastDonation,
      lastDonationDate,
      nextEligible,
      nextEligibleDate,
      daysUntilEligible,
      isEligible,
      isMedicallyFit,
      pendingAppointments,
      completedAppointments,
    };
  }

  async function fetchBestUrgentPatient(donorData: DonorProfile) {
    try {
      const patientsRef = collection(db, "patients");
      // Try exact blood match first
      const snap = await getDocs(query(
        patientsRef,
        where("onboarded", "==", "yes"),
        where("p_bloodgroup", "==", donorData.d_bloodgroup),
        where("request_status", "in", ["pending", "accepted"])
      ));

      let patients = snap.docs.map(d => ({ id: d.id, ...d.data() } as UrgentPatient));

      // Sort: immediate > within_24_hours > within_3_days > no_rush, then same city first
      const urgencyOrder = ["immediate", "within_24_hours", "within_3_days", "no_rush"];
      patients.sort((a, b) => {
        const ai = urgencyOrder.indexOf(a.p_urgencyRequirment ?? "no_rush");
        const bi = urgencyOrder.indexOf(b.p_urgencyRequirment ?? "no_rush");
        if (ai !== bi) return ai - bi;
        const aCity = a.p_city?.toLowerCase() === donorData.d_city?.toLowerCase() ? 0 : 1;
        const bCity = b.p_city?.toLowerCase() === donorData.d_city?.toLowerCase() ? 0 : 1;
        return aCity - bCity;
      });

      // Take the single best match (Singularity Effect — one victim, not many)
      setUrgentPatient(patients[0] || null);
    } catch (e) {
      console.error("fetchBestUrgentPatient error:", e);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeMatch = useMemo(() =>
    matchedAppointments.find(a =>
      a.status === "pending_donor_acceptance" || a.status === "confirmed"
    ), [matchedAppointments]
  );

  const latestThanksNote = useMemo(() => {
    const withNote = matchedAppointments.filter(a => a.thanksNote && a.status === "completed");
    if (!withNote.length) return null;
    withNote.sort((a, b) => (b.thanksNoteAt?.seconds || 0) - (a.thanksNoteAt?.seconds || 0));
    return withNote[0];
  }, [matchedAppointments]);

  const recentlyCompletedDonation = useMemo(() =>
    matchedAppointments.find(a => a.status === "completed"), [matchedAppointments]
  );

  if (loading || isAuthLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <HeartLoading />
      </div>
    );
  }

  if (!profile || !stats) {
    return (
      <ContentLayout title="Dashboard">
        <Card className="p-8">
          <p className="text-center text-gray-500">Unable to load dashboard. Please try again.</p>
        </Card>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Dashboard">
      <div className="space-y-6 pb-8">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            BRANCH A: ACTIVE MATCH — You've been matched to a patient
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeMatch && (
          <>
            {/* Pulsing full-width alert banner */}
            <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-r from-red-600 via-red-500 to-orange-500 p-0.5 shadow-xl shadow-red-500/30">
              <div className="bg-white dark:bg-gray-950 rounded-[14px] p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                        <Heart className="h-7 w-7 text-red-600 fill-red-600 animate-pulse" />
                      </div>
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 rounded-full animate-ping" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        🚨 Action Needed
                      </span>
                      <span className="text-xs text-gray-500">
                        Matched <UrgencyCountdown matchedAt={activeMatch.matchedAt} />
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
                      {activeMatch.linkedPatientName} needs your dog&apos;s blood — right now.
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your dog&apos;s <strong className="text-red-600">{activeMatch.patientBloodGroup}</strong> blood is a match.
                      The clinic has chosen your dog specifically. Every hour of delay matters.
                    </p>
                  </div>
                  <Link href="/app/d/appointments">
                    <Button className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 h-12 text-base shadow-lg flex-shrink-0">
                      Respond Now <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Matched Patient Hero Card */}
            <MatchedPatientHeroCard appointment={activeMatch} />

            {/* Donor Perks */}
            <DonorPerksStrip />
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            BRANCH B: ELIGIBLE, NO ACTIVE MATCH — Find a match
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!activeMatch && stats.isEligible && (
          <>
            {/* Eligible hero banner */}
            <div className="w-full rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-8 text-white shadow-xl shadow-teal-500/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-9 w-9 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-emerald-100 text-sm font-semibold uppercase tracking-wider mb-1">Your dog is ready</p>
                  <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                    {profile.d_name} can save a life today.
                  </h2>
                  <p className="text-emerald-100 mt-1 text-sm">
                    You&apos;re eligible, medically cleared, and a dog near you may be waiting.
                    It takes one decision.
                  </p>
                </div>
                <Link href="/app/d/donate/urgent">
                  <Button className="bg-white text-teal-700 hover:bg-teal-50 font-bold px-6 h-12 flex-shrink-0 shadow-lg">
                    See Requests <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Best urgent patient — THE HERO CARD */}
            {urgentPatient ? (
              <EligibleUrgentRequestCard patient={urgentPatient} donorCity={profile.d_city} />
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 flex flex-col items-center text-center gap-3">
                  <Heart className="h-10 w-10 text-gray-300" />
                  <p className="text-gray-500 font-medium">No matching blood requests right now.</p>
                  <p className="text-sm text-gray-400">We&apos;ll alert you the moment one comes in. Keep your profile updated.</p>
                  <Link href="/app/d/profile">
                    <Button variant="outline" size="sm">Update Profile</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Donor Perks */}
            <DonorPerksStrip />
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            BRANCH C: NOT ELIGIBLE — Hero + Thank you note + Countdown
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!activeMatch && !stats.isEligible && (
          <>
            {/* Big celebration hero */}
            <div className="w-full rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 sm:p-8 text-white shadow-xl shadow-purple-500/20">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Star className="h-6 w-6 text-yellow-300 fill-yellow-300" />
                  </div>
                  <span className="text-purple-200 text-sm font-semibold uppercase tracking-wider">You already made a difference</span>
                </div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                    {profile.d_name} is a hero. 🏆
                  </h2>
                  <p className="text-purple-100 mt-2 text-base">
                    {stats.livesSaved > 0
                      ? `Because of your dog's generosity, ${stats.livesSaved} dog${stats.livesSaved > 1 ? "s are" : " is"} alive today.`
                      : "Your last donation gave a dog the chance to live. That's not nothing — that's everything."}
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="h-4 w-4 text-purple-200" />
                    <span className="text-purple-200 text-xs font-medium">Next eligible to donate</span>
                  </div>
                  <p className="text-white text-xl font-bold">{stats.nextEligible}</p>
                  <div className="mt-2 bg-white/10 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all"
                      style={{ width: `${Math.max(5, Math.round(((56 - stats.daysUntilEligible) / 56) * 100))}%` }}
                    />
                  </div>
                  <p className="text-purple-200 text-xs mt-1">{stats.daysUntilEligible} days to go · resting is part of the journey</p>
                </div>
              </div>
            </div>

            {/* Thank you note from patient — FULL HERO if exists */}
            {latestThanksNote && (
              <ThankYouNoteCard appointment={latestThanksNote} />
            )}

            {/* If no thanks note yet but has donated, show placeholder */}
            {!latestThanksNote && recentlyCompletedDonation && (
              <Card className="border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-purple-800 dark:text-purple-200">
                      A thank-you note from {recentlyCompletedDonation.linkedPatientName}&apos;s family is on its way.
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                      Once the patient&apos;s owner writes a note, it will appear right here for the next 30 days.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Impact stats in story format */}
            {stats.totalDonations > 0 && (
              <ImpactStorySection stats={stats} dogName={profile.d_name} />
            )}
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ALWAYS VISIBLE: Compact Quick Actions (moved to back)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quick Links</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: AlertCircle, label: "Urgent Requests",   href: "/app/d/donate/urgent",    color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30",    border: "border-red-200 dark:border-red-800" },
              { icon: Calendar,    label: "My Appointments",   href: "/app/d/appointments",     color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200 dark:border-blue-800" },
              { icon: MapPin,      label: "Nearby Clinics",    href: "/app/d/donate/nearby",    color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800" },
              { icon: BarChart3,   label: "Donation History",  href: "/app/d/donation-history", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800" },
            ].map(item => (
              <Link key={item.label} href={item.href}>
                <div className={`${item.bg} ${item.border} border rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer`}>
                  <item.icon className={`h-5 w-5 ${item.color} flex-shrink-0`} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-tight">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </ContentLayout>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATCHED PATIENT HERO CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MatchedPatientHeroCard({ appointment }: { appointment: MatchedAppointment }) {
  return (
    <Card className="border-2 border-red-400 dark:border-red-700 overflow-hidden">
      <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-white fill-white" />
          <span className="text-white font-bold text-sm uppercase tracking-wide">
            Your Matched Patient
          </span>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-[10px]">
          {appointment.patientBloodGroup}
        </Badge>
      </div>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-2xl flex-shrink-0">
            🐕
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black">{appointment.linkedPatientName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                {appointment.patientCity}
              </div>
              <Badge className={appointment.isUrgent === "yes" ? "bg-red-600 text-white text-[10px]" : "bg-orange-500 text-white text-[10px]"}>
                {appointment.isUrgent === "yes" ? "🚨 Urgent" : "⚡ Active Request"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm text-amber-900 dark:text-amber-100 font-medium leading-relaxed">
            &ldquo;The clinic has specifically chosen your dog for this match.
            Without your response, this dog&apos;s family has no other option right now.
            You are the only match available.&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/app/d/appointments" className="col-span-2 sm:col-span-1">
            <Button className="w-full bg-red-600 hover:bg-red-700 font-bold h-11">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm I&apos;ll Help
            </Button>
          </Link>
          <Link href="/app/d/appointments" className="col-span-2 sm:col-span-1">
            <Button variant="outline" className="w-full h-11">
              View Full Details
            </Button>
          </Link>
        </div>

        {appointment.notes && (
          <p className="text-xs text-gray-500 italic border-t pt-3">{appointment.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELIGIBLE URGENT REQUEST HERO CARD (1 patient, max psychology)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function EligibleUrgentRequestCard({ patient, donorCity }: { patient: UrgentPatient; donorCity: string }) {
  const isSameCity = patient.p_city?.toLowerCase() === donorCity?.toLowerCase();
  const urgencyLabel =
    patient.p_urgencyRequirment === "immediate" ? "🚨 IMMEDIATE — Hours matter" :
    patient.p_urgencyRequirment === "within_24_hours" ? "⚡ Needed within 24 hours" :
    patient.p_urgencyRequirment === "within_3_days" ? "📅 Needed within 3 days" : "Active Request";

  const urgencyBg =
    patient.p_urgencyRequirment === "immediate" ? "bg-red-600" :
    patient.p_urgencyRequirment === "within_24_hours" ? "bg-orange-500" : "bg-yellow-500";

  return (
    <Card className="border-2 border-orange-400 dark:border-orange-700 overflow-hidden shadow-lg shadow-orange-100 dark:shadow-none">
      <div className={`${urgencyBg} px-5 py-3 flex items-center justify-between`}>
        <span className="text-white font-bold text-sm">{urgencyLabel}</span>
        {isSameCity && (
          <Badge className="bg-white/20 text-white border-0 text-[10px]">📍 In Your City</Badge>
        )}
      </div>

      <CardContent className="p-5 space-y-4">
        {/* The identifiable victim — named, specific, real */}
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-950/20 flex items-center justify-center text-3xl flex-shrink-0">
            🐕
          </div>
          <div>
            <h3 className="text-xl font-black">{patient.p_name} needs help.</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{patient.p_city}
              </span>
              <span className="font-bold text-red-600 text-sm flex items-center gap-1">
                <Droplet className="h-3.5 w-3.5" />
                {patient.p_bloodgroup} blood
              </span>
            </div>
          </div>
        </div>

        {/* Loss-framed emotional copy */}
        <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded-r-xl p-4">
          <p className="text-sm text-red-900 dark:text-red-100 font-medium leading-relaxed">
            {patient.p_reasonRequirment
              ? `${patient.p_name} is fighting ${patient.p_reasonRequirment}. Without a transfusion, the family may lose their dog.`
              : `${patient.p_name}'s family is waiting. Without a donor, options run out.`
            }
            {isSameCity ? " They're in your city — this is as close as it gets." : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-gray-500">Units Needed</p>
            <p className="font-bold text-lg">{patient.p_quantityRequirment || "1"}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-gray-500">Location</p>
            <p className="font-bold text-base">{patient.p_city}</p>
          </div>
          {patient.p_doctorName && (
            <div className="col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500">Vet In Charge</p>
              <p className="font-bold">Dr. {patient.p_doctorName}{patient.p_hospitalName ? ` · ${patient.p_hospitalName}` : ""}</p>
            </div>
          )}
        </div>

        {/* Subtle guilt-framing CTA copy */}
        <p className="text-xs text-gray-500 text-center italic">
          You&apos;re one of the few donors with a matching blood type in this area.
        </p>

        <Link href="/app/d/donate/urgent">
          <Button className="w-full bg-red-600 hover:bg-red-700 font-bold h-12 text-base shadow-md">
            <Heart className="h-5 w-5 mr-2 fill-white" />
            I Want to Help {patient.p_name}
          </Button>
        </Link>

        <Link href="/app/d/donate/urgent">
          <Button variant="ghost" className="w-full text-xs text-gray-400 h-8">
            See all blood requests →
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DONOR PERKS STRIP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DonorPerksStrip() {
  const perks = [
    { icon: "🚖", label: "Travel covered", desc: "Cab charges to & from the clinic reimbursed by the clinic" },
    { icon: "🛁", label: "Spa day for your dog", desc: "A complimentary grooming session at a partner spa of your choice" },
    { icon: "🐾", label: "Pet goodies bag", desc: "Premium treats & accessories gifted after donation" },
    { icon: "🏅", label: "K9Hero badge", desc: "Verified donor badge on your K9Hope profile forever" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4" /> A Small Thank-You from the Clinic
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {perks.map(perk => (
          <div key={perk.label} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-1">
            <div className="text-2xl">{perk.icon}</div>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{perk.label}</p>
            <p className="text-[10px] text-gray-500 leading-snug">{perk.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-center italic">
        These are voluntary gestures of appreciation from the clinic. Blood donation is always voluntary and unpaid, as per guidelines.
      </p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THANK YOU NOTE CARD — hero section for returning donors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ThankYouNoteCard({ appointment }: { appointment: MatchedAppointment }) {
  return (
    <Card className="border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-white" />
        <span className="text-white font-bold text-sm">A note from {appointment.linkedPatientName}&apos;s family</span>
        <Sparkles className="h-4 w-4 text-yellow-300 ml-auto" />
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl flex-shrink-0">🐕</div>
          <div>
            <p className="text-lg font-black text-purple-900 dark:text-purple-100">{appointment.linkedPatientName} is doing well!</p>
            <p className="text-xs text-purple-500 mt-0.5">
              {appointment.thanksNoteAt
                ? `Note received ${formatDistanceToNow(appointment.thanksNoteAt.toDate?.() || new Date(appointment.thanksNoteAt), { addSuffix: true })}`
                : ""}
            </p>
          </div>
        </div>

        <blockquote className="border-l-4 border-purple-400 pl-4 italic text-gray-700 dark:text-gray-200 text-sm leading-relaxed bg-white/60 dark:bg-white/5 rounded-r-xl py-3 pr-3">
          &ldquo;{appointment.thanksNote}&rdquo;
        </blockquote>

        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-300 font-medium">
          <Heart className="h-3.5 w-3.5 fill-purple-500" />
          This note will be visible on your dashboard for 30 days
        </div>
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMPACT STORY SECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ImpactStorySection({ stats, dogName }: { stats: DonorStats; dogName: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Your Impact So Far</h3>
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-violet-600">{stats.totalDonations}</p>
            <p className="text-xs text-gray-500 mt-1">Times donated</p>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-pink-600">{stats.livesSaved}</p>
            <p className="text-xs text-gray-500 mt-1">Dogs helped</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-amber-600">{stats.completedAppointments}</p>
            <p className="text-xs text-gray-500 mt-1">Completed donations</p>
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-sm text-gray-500 mt-3 italic">
        &ldquo;{dogName} has given life where there was none. That stays forever.&rdquo;
      </p>
    </div>
  );
}
