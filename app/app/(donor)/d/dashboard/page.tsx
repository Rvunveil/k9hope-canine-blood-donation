"use client";

import { useState, useEffect, useMemo } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import {
  collection, query, where, getDocs, doc, getDoc
} from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, MapPin, Calendar, BarChart3, Heart,
  CheckCircle2, Gift, Sparkles, ArrowRight, ShieldCheck,
  Star, MessageSquare, Timer, ChevronDown, ChevronUp,
  Droplet, Zap, Users, FlaskConical, Clock, TrendingUp,
  ExternalLink
} from "lucide-react";
import HeartLoading from "@/components/custom/HeartLoading";
import Link from "next/link";
import {
  format, differenceInDays, formatDistanceToNow, differenceInHours
} from "date-fns";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// LIVE URGENCY COUNTDOWN
// ─────────────────────────────────────────────────────────────
function UrgencyCountdown({ matchedAt }: { matchedAt: any }) {
  const [hoursAgo, setHoursAgo] = useState(0);
  useEffect(() => {
    const date = matchedAt?.toDate ? matchedAt.toDate() : new Date(matchedAt);
    const update = () => setHoursAgo(differenceInHours(new Date(), date));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [matchedAt]);
  return (
    <span className={`font-black tabular-nums ${hoursAgo >= 12 ? "text-red-500 animate-pulse" : "text-orange-500"}`}>
      {hoursAgo < 1 ? "moments ago" : `${hoursAgo}h ago — still waiting`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function DonorDashboard() {
  const { userId, role, isAuthLoading } = useUser();
  const router = useRouter();

  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [matchedAppointments, setMatchedAppointments] = useState<MatchedAppointment[]>([]);
  const [urgentPatient, setUrgentPatient] = useState<UrgentPatient | null>(null);
  const [cityDonorCount, setCityDonorCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || role !== "donor") { router.push("/"); return; }
    fetchDashboardData();
  }, [userId, role]);

  async function fetchDashboardData() {
    if (!userId) return;
    setLoading(true);
    try {
      const donorSnap = await getDoc(doc(db, "donors", userId));
      if (!donorSnap.exists()) { setLoading(false); return; }
      const donorData = donorSnap.data() as DonorProfile;
      setProfile(donorData);

      const calculatedStats = await calculateStats(donorData);
      setStats(calculatedStats);

      const apptSnap = await getDocs(query(
        collection(db, "donor-appointments"),
        where("donorId", "==", userId)
      ));
      const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as MatchedAppointment));
      setMatchedAppointments(appts);

      const activeMatch = appts.find(a =>
        a.status === "pending_donor_acceptance" || a.status === "confirmed"
      );
      if (calculatedStats.isEligible && !activeMatch) {
        await fetchBestUrgentPatient(donorData);
      }

      // Scarcity: count donors in same city (non-critical, swallow errors)
      try {
        const citySnap = await getDocs(query(
          collection(db, "donors"),
          where("d_city", "==", donorData.d_city)
        ));
        setCityDonorCount(citySnap.size);
      } catch { /* non-critical */ }

    } catch (e) {
      console.error("Dashboard error:", e);
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

    const weight = donorData.d_weight_kg ?? (donorData as any).d_weight ?? 0;
    const isMedicallyFit = donorData.d_isMedicalCondition !== "yes" && weight >= 25;
    if (!isMedicallyFit) { isEligible = false; nextEligible = "See Profile"; }

    return {
      totalDonations: donorData.d_donationCount || completedAppointments,
      livesSaved: (donorData.d_donationCount || completedAppointments) * 3,
      lastDonation, lastDonationDate, nextEligible, nextEligibleDate,
      daysUntilEligible, isEligible, isMedicallyFit,
      pendingAppointments, completedAppointments,
    };
  }

  async function fetchBestUrgentPatient(donorData: DonorProfile) {
    try {
      const snap = await getDocs(query(
        collection(db, "patients"),
        where("onboarded", "==", "yes"),
        where("p_bloodgroup", "==", donorData.d_bloodgroup),
        where("request_status", "in", ["pending", "accepted"])
      ));
      const urgencyOrder = ["immediate", "within_24_hours", "within_3_days", "no_rush"];
      const patients = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as UrgentPatient))
        .sort((a, b) => {
          const ai = urgencyOrder.indexOf(a.p_urgencyRequirment ?? "no_rush");
          const bi = urgencyOrder.indexOf(b.p_urgencyRequirment ?? "no_rush");
          if (ai !== bi) return ai - bi;
          const aSame = a.p_city?.toLowerCase() === donorData.d_city?.toLowerCase() ? 0 : 1;
          const bSame = b.p_city?.toLowerCase() === donorData.d_city?.toLowerCase() ? 0 : 1;
          return aSame - bSame;
        });
      // Singularity Effect: show ONE named dog, not a list
      setUrgentPatient(patients[0] || null);
    } catch (e) { console.error(e); }
  }

  // ── Derived state ────────────────────────────────────────────
  const activeMatch = useMemo(() =>
    matchedAppointments.find(a =>
      a.status === "pending_donor_acceptance" || a.status === "confirmed"
    ), [matchedAppointments]);

  const latestThanksNote = useMemo(() => {
    const withNote = matchedAppointments.filter(a => a.thanksNote && a.status === "completed");
    if (!withNote.length) return null;
    withNote.sort((a, b) => (b.thanksNoteAt?.seconds || 0) - (a.thanksNoteAt?.seconds || 0));
    // Return single most-recent note, not array
    return withNote[0];
  }, [matchedAppointments]);

  const recentlyCompletedDonation = useMemo(() =>
    matchedAppointments.find(a => a.status === "completed"), [matchedAppointments]);

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
          <p className="text-center text-gray-500">Unable to load. Please refresh.</p>
        </Card>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Dashboard">
      <div className="space-y-5 pb-10">

        {/* ═══════════════════════════════════════════════════════
            BRANCH A — Active Match
        ═══════════════════════════════════════════════════════ */}
        {activeMatch && (
          <>
            {/* PULSING EMERGENCY BANNER */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-700 via-red-600 to-rose-600 p-px shadow-2xl shadow-red-500/40">
              <div className="bg-white dark:bg-gray-950 rounded-[14px]">
                <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-t-[14px]" />
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <div className="relative flex-shrink-0">
                      <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                        <Heart className="h-8 w-8 text-red-600 fill-red-500 animate-pulse" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-black bg-red-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                          🚨 Urgent — Response Needed
                        </span>
                        <span className="text-xs text-gray-400">
                          Matched <UrgencyCountdown matchedAt={activeMatch.matchedAt} />
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                        {activeMatch.linkedPatientName} is waiting for your dog&apos;s blood.
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Blood type <strong className="text-red-600">{activeMatch.patientBloodGroup}</strong> matched to your dog.
                        The clinic is holding the slot.{" "}
                        <strong className="text-gray-700 dark:text-gray-300">You are the only confirmed match.</strong>
                      </p>
                    </div>
                    <Link href="/app/d/appointments" className="flex-shrink-0 w-full sm:w-auto">
                      <Button className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-black px-6 h-12 shadow-lg shadow-red-500/30">
                        Respond Now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <MatchedPatientCard appointment={activeMatch} />
            <PerksSection />
            <SafetySection dogWeight={profile.d_weight_kg} />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            BRANCH B — Eligible, no active match
        ═══════════════════════════════════════════════════════ */}
        {!activeMatch && stats.isEligible && (
          <>
            {/* SCARCITY HERO BANNER */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 text-white p-6 sm:p-8 shadow-2xl">
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 50%, #dc2626 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ea580c 0%, transparent 40%)",
                }}
              />
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge className="bg-red-600 text-white border-0 text-xs font-bold px-3 py-1 animate-pulse">
                    🔴 LIVE
                  </Badge>
                  {cityDonorCount > 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                      Only{" "}
                      <strong className="text-orange-400">
                        {cityDonorCount} donor{cityDonorCount > 1 ? "s" : ""}
                      </strong>{" "}
                      registered in {profile.d_city}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-2">
                  {profile.d_name} is one of India&apos;s rarest resources.
                </h1>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-5 max-w-xl">
                  Canine blood donation is new to India. Most dogs in emergency wards die because
                  there&apos;s no donor registry.{" "}
                  <strong className="text-white">
                    Your dog could change that — right now, for free, in under an hour.
                  </strong>
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/app/d/donate/urgent">
                    <Button className="bg-red-600 hover:bg-red-700 font-bold px-6 h-11 shadow-lg shadow-red-900/50">
                      <Zap className="h-4 w-4 mr-2" /> See Who Needs Help Now
                    </Button>
                  </Link>
                  <Link href="/app/d/profile">
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 h-11">
                      Update My Dog&apos;s Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* SINGLE URGENT PATIENT HERO CARD — Singularity Effect */}
            {urgentPatient ? (
              <UrgentPatientHeroCard patient={urgentPatient} donorCity={profile.d_city} />
            ) : (
              <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700">
                <CardContent className="py-12 flex flex-col items-center text-center gap-3">
                  <Heart className="h-10 w-10 text-gray-300" />
                  <p className="font-medium text-gray-500">No matching blood requests right now.</p>
                  <p className="text-sm text-gray-400">
                    You&apos;ll be alerted the moment a match comes in. Make sure your profile is complete.
                  </p>
                  <Link href="/app/d/profile">
                    <Button variant="outline" size="sm">Update Profile</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* PERKS — shown before safety, Indians convert on perks first */}
            <PerksSection />

            {/* SAFETY + SCIENCE ACCORDION */}
            <SafetySection dogWeight={profile.d_weight_kg} />

            {/* DONOR DOG BENEFITS ACCORDION */}
            <DonorDogBenefitsSection />

            {/* SOCIAL PROOF BAR */}
            <SocialProofBar cityDonorCount={cityDonorCount} city={profile.d_city} />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            BRANCH C — Not eligible (recently donated)
        ═══════════════════════════════════════════════════════ */}
        {!activeMatch && !stats.isEligible && (
          <>
            {/* HERO CELEBRATION */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-700 p-6 sm:p-8 text-white shadow-2xl shadow-purple-500/20">
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle at 70% 30%, #fbbf24 0%, transparent 50%)",
                }}
              />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Star className="h-6 w-6 text-yellow-300 fill-yellow-300" />
                  </div>
                  <span className="text-purple-200 text-xs font-bold uppercase tracking-widest">
                    India&apos;s K9Hero
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                    {profile.d_name} already saved{" "}
                    {stats.livesSaved > 0 ? `${stats.livesSaved} lives.` : "a life."}
                  </h2>
                  <p className="text-purple-100 mt-2 text-sm sm:text-base">
                    {stats.livesSaved > 0
                      ? `Because you said yes, ${stats.livesSaved} dog${stats.livesSaved > 1 ? "s are" : " is"} alive today. That family didn't lose their pet because of you.`
                      : "Your dog's blood gave another dog a fighting chance. That family still has their pet because you showed up."}
                  </p>
                </div>
                {/* Progress bar to eligibility */}
                <div className="bg-white/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-purple-200">
                      <Timer className="h-3.5 w-3.5" /> Next donation window
                    </span>
                    <span className="text-white font-bold">{stats.nextEligible}</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-300 to-white rounded-full transition-all"
                      style={{
                        width: `${Math.max(8, Math.round(((56 - stats.daysUntilEligible) / 56) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-purple-300 text-[11px]">
                    {stats.daysUntilEligible} days to go · your dog is resting and recovering · that&apos;s part of the process
                  </p>
                </div>
              </div>
            </div>

            {/* THANK-YOU NOTE — hero section */}
            {latestThanksNote && <ThankYouNoteCard appointment={latestThanksNote} />}

            {/* Placeholder if donated but no note yet */}
            {!latestThanksNote && recentlyCompletedDonation && (
              <Card className="border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/20">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-purple-900 dark:text-purple-100 text-sm">
                      A thank-you from {recentlyCompletedDonation.linkedPatientName}&apos;s family will appear here.
                    </p>
                    <p className="text-xs text-purple-500 mt-1">
                      Once the patient&apos;s owner writes a note, it will be pinned here for 30 days.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <ImpactStorySection stats={stats} dogName={profile.d_name} />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            ALWAYS VISIBLE — Compact Quick Links (bottom)
        ═══════════════════════════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Links</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { icon: AlertCircle, label: "Urgent Requests",  href: "/app/d/donate/urgent",    bg: "bg-red-50 dark:bg-red-950/30",      border: "border-red-200 dark:border-red-800",      text: "text-red-600" },
              { icon: Calendar,    label: "My Appointments",  href: "/app/d/appointments",     bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800",    text: "text-blue-600" },
              { icon: MapPin,      label: "Nearby Clinics",   href: "/app/d/donate/nearby",    bg: "bg-green-50 dark:bg-green-950/30",  border: "border-green-200 dark:border-green-800",  text: "text-green-600" },
              { icon: BarChart3,   label: "Donation History", href: "/app/d/donation-history", bg: "bg-violet-50 dark:bg-violet-950/30",border: "border-violet-200 dark:border-violet-800",text: "text-violet-600" },
            ].map(item => (
              <Link key={item.label} href={item.href}>
                <div className={`${item.bg} ${item.border} border rounded-xl p-3 flex items-center gap-2.5 hover:shadow-sm transition-all`}>
                  <item.icon className={`h-4 w-4 ${item.text} flex-shrink-0`} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-tight">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </ContentLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// MATCHED PATIENT CARD (Branch A)
// ─────────────────────────────────────────────────────────────
function MatchedPatientCard({ appointment }: { appointment: MatchedAppointment }) {
  return (
    <Card className="border-2 border-red-400 dark:border-red-700 overflow-hidden">
      <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-white fill-white" />
          <span className="text-white font-black text-sm uppercase tracking-wide">Your Matched Patient</span>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">
          {appointment.patientBloodGroup}
        </Badge>
      </div>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-3xl flex-shrink-0">
            🐕
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black">{appointment.linkedPatientName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{appointment.patientCity}
              </span>
              <Badge className={`text-[10px] ${appointment.isUrgent === "yes" ? "bg-red-600" : "bg-orange-500"} text-white`}>
                {appointment.isUrgent === "yes" ? "🚨 Critical" : "⚡ Active"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm text-amber-900 dark:text-amber-100 font-medium leading-relaxed">
            &ldquo;The clinic selected your dog specifically because of the blood type match.
            There is no other confirmed donor right now. Without your response today,
            this dog&apos;s family has no other option.&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/app/d/appointments" className="col-span-2 sm:col-span-1">
            <Button className="w-full bg-red-600 hover:bg-red-700 font-black h-11 shadow-md shadow-red-500/30">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm I&apos;ll Help
            </Button>
          </Link>
          <Link href="/app/d/appointments" className="col-span-2 sm:col-span-1">
            <Button variant="outline" className="w-full h-11">View Appointment Details</Button>
          </Link>
        </div>

        {appointment.notes && (
          <p className="text-xs text-gray-400 italic border-t pt-3">{appointment.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// URGENT PATIENT HERO CARD (Branch B) — THE MOST IMPORTANT COMPONENT
// ─────────────────────────────────────────────────────────────
function UrgentPatientHeroCard({ patient, donorCity }: { patient: UrgentPatient; donorCity: string }) {
  const isSameCity = patient.p_city?.toLowerCase() === donorCity?.toLowerCase();

  const urgencyConfig: Record<string, { label: string; bg: string; border: string; msgBg: string; msgBorder: string }> = {
    immediate:       { label: "🚨 CRITICAL — Hours, not days",   bg: "bg-red-600",    border: "border-red-500",    msgBg: "bg-red-50 dark:bg-red-950/30",     msgBorder: "border-red-400" },
    within_24_hours: { label: "⚡ Urgent — Needed within 24h",   bg: "bg-orange-500", border: "border-orange-400", msgBg: "bg-orange-50 dark:bg-orange-950/30",msgBorder: "border-orange-400" },
    within_3_days:   { label: "📅 Active — Needed within 3 days",bg: "bg-yellow-500", border: "border-yellow-400", msgBg: "bg-yellow-50 dark:bg-yellow-950/30",msgBorder: "border-yellow-400" },
    no_rush:         { label: "📋 Active Request",                bg: "bg-blue-500",   border: "border-blue-400",   msgBg: "bg-blue-50 dark:bg-blue-950/30",    msgBorder: "border-blue-400" },
  };
  const cfg = urgencyConfig[patient.p_urgencyRequirment] ?? urgencyConfig.no_rush;

  const lossFramedMessage = patient.p_reasonRequirment
    ? `${patient.p_name} is fighting ${patient.p_reasonRequirment}. Without a blood transfusion soon, their family risks losing them.`
    : `${patient.p_name}'s family is running out of time. A donor is the only thing that changes the outcome.`;

  return (
    <Card className={`border-2 ${cfg.border} overflow-hidden shadow-xl`}>
      <div className={`${cfg.bg} px-5 py-3 flex items-center justify-between`}>
        <span className="text-white font-black text-sm">{cfg.label}</span>
        {isSameCity && (
          <Badge className="bg-white/25 text-white border-0 text-[10px] font-bold">
            📍 In {patient.p_city}
          </Badge>
        )}
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Named, identifiable dog — Singularity Effect */}
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-950/20 flex items-center justify-center text-4xl flex-shrink-0">
            🐕
          </div>
          <div>
            <h3 className="text-2xl font-black leading-tight">{patient.p_name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">needs help surviving</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 font-medium">
                <Droplet className="h-3.5 w-3.5 text-red-500" />
                <strong className="text-red-600">{patient.p_bloodgroup}</strong> blood needed
              </span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{patient.p_city}
                {isSameCity && <span className="text-green-600 font-bold"> · your city</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Loss-framed emotional message */}
        <div className={`${cfg.msgBg} border-l-4 ${cfg.msgBorder} rounded-r-xl p-4`}>
          <p className="text-sm font-semibold leading-relaxed text-gray-800 dark:text-gray-100">
            {lossFramedMessage}
            {isSameCity ? " They are in your city. This is as close as it gets." : ""}
          </p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Units Needed</p>
            <p className="font-black text-xl">{patient.p_quantityRequirment || "1"}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
            <p className="font-black text-base leading-tight">{patient.p_city}</p>
          </div>
          {patient.p_doctorName && (
            <div className="col-span-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Attending Vet</p>
              <p className="font-bold text-sm">
                Dr. {patient.p_doctorName}
                {patient.p_hospitalName ? ` · ${patient.p_hospitalName}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Scarcity guilt-frame */}
        <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
            Your dog is among the{" "}
            <strong>very few registered donors</strong> with a matching blood type in this area.
            Most dogs in this situation don&apos;t get a second chance. You&apos;re it.
          </p>
        </div>

        {/* PRIMARY CTA */}
        <Link href="/app/d/donate/urgent">
          <Button className="w-full bg-red-600 hover:bg-red-700 font-black h-12 text-base shadow-lg shadow-red-500/30">
            <Heart className="h-5 w-5 mr-2 fill-white" />
            I Want to Help {patient.p_name}
          </Button>
        </Link>

        <Link href="/app/d/donate/urgent">
          <Button variant="ghost" className="w-full text-xs text-gray-400 h-8 hover:text-gray-600">
            See all blood requests →
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// PERKS SECTION — placed BEFORE safety for Indian audiences
// ─────────────────────────────────────────────────────────────
function PerksSection() {
  const perks = [
    {
      emoji: "🚖",
      title: "Cab charges paid",
      detail: "Travel to and from the clinic is fully reimbursed by the clinic — no cost to you.",
      highlight: true,
    },
    {
      emoji: "🛁",
      title: "Spa day for your dog",
      detail: "A complimentary full grooming session at a partner pet spa of your choice after donation.",
      highlight: true,
    },
    {
      emoji: "🐾",
      title: "Premium goodies bag",
      detail: "Treats, accessories and a welcome pack from our partner pet brands — gifted after each donation.",
      highlight: false,
    },
    {
      emoji: "🏥",
      title: "Free health check",
      detail: "Full blood panel and physical exam before every donation — ₹800–1200 value, yours free.",
      highlight: false,
    },
    {
      emoji: "🏅",
      title: "K9Hero badge",
      detail: "Permanently verified donor badge on your K9Hope profile. Your dog is a verified hero.",
      highlight: false,
    },
    {
      emoji: "🔔",
      title: "Priority blood access",
      detail: "As a registered donor, your own dog gets priority emergency blood matching from the K9Hope network.",
      highlight: false,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
          What You &amp; Your Dog Get
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {perks.map(perk => (
          <div
            key={perk.title}
            className={`relative rounded-xl p-4 border flex items-start gap-3 transition-all
              ${perk.highlight
                ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-300 dark:border-amber-700 shadow-sm"
                : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
              }`}
          >
            {perk.highlight && (
              <span className="absolute top-2 right-2 text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Popular
              </span>
            )}
            <span className="text-2xl flex-shrink-0">{perk.emoji}</span>
            <div>
              <p className="text-sm font-black text-gray-800 dark:text-gray-100">{perk.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{perk.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 text-center italic">
        Perks are voluntary gestures of appreciation from participating clinics.
        Blood donation is always unpaid and voluntary, as per Government of India veterinary guidelines.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SAFETY + SCIENCE SECTION (collapsible accordion)
// ─────────────────────────────────────────────────────────────
function SafetySection({ dogWeight }: { dogWeight: number }) {
  const [open, setOpen] = useState(false);

  // Dynamic blood volume calculation for the donor's actual dog
  const estimatedBloodVolumeMl = Math.round(dogWeight * 85);
  const donationMl = Math.round(estimatedBloodVolumeMl * 0.13);
  const teaspoons = Math.round(donationMl / 5);
  const cupsFraction = (donationMl / 240).toFixed(1);

  const facts = [
    {
      icon: <FlaskConical className="h-4 w-4 text-blue-500" />,
      title: `Only ~${donationMl}ml taken from your dog`,
      detail: `That's roughly ${teaspoons} teaspoons — or about ${cupsFraction} cups. For a ${dogWeight}kg dog, this is just 13% of their total blood volume. The body fully replenishes this in 3–4 weeks.`,
      source: "Scielo Brasil, 2015",
      href: "https://www.scielo.br/j/aabc/a/zjJjgTwpMZJLnxVVSRsXvFg/",
    },
    {
      icon: <Clock className="h-4 w-4 text-green-500" />,
      title: "Whole procedure: 30–45 minutes",
      detail: "Blood draw itself takes 8–12 minutes. Dogs are observed for 20–30 minutes after. Your dog goes home the same day, same hour.",
      source: "Animal Emergency Service AU",
      href: "https://animalemergencyservice.com.au/blog/canine-blood-donation-questions/",
    },
    {
      icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
      title: "Scientifically proven safe — NIH 2025",
      detail: "A 2025 NIH multicentric study found no significant changes in heart rate, blood pressure, or stress hormones after canine blood donation. Dogs tolerate it well.",
      source: "PMC/NIH — Insights into the Canine Blood Donor Experience, 2025",
      href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12474371/",
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-purple-500" />,
      title: "India's first national SOP now in place",
      detail: "India released its first national veterinary blood transfusion guidelines in 2025, with mandatory blood typing, cross-matching, and donor welfare standards.",
      source: "India Today, Aug 2025",
      href: "https://www.indiatoday.in/india/story/dogs-cattle-new-guideline-blood-transfusion-blood-banks-veterinary-care-sop-companion-animals-pets-2777190-2025-09-01",
    },
    {
      icon: <Heart className="h-4 w-4 text-red-500" />,
      title: "Donation stops immediately if your dog shows stress",
      detail: "At any sign of discomfort, the procedure is stopped. Your dog's welfare comes first — always. No exceptions.",
      source: "Animal Emergency Service AU",
      href: "https://animalemergencyservice.com.au/blog/canine-blood-donation-questions/",
    },
    {
      icon: <Droplet className="h-4 w-4 text-cyan-500" />,
      title: "One donation can save up to 4 dogs",
      detail: "Blood is separated into red cells, plasma, and platelets — each used for different patients with different conditions.",
      source: "Dog With Blog India, 2025",
      href: "https://dogwithblog.in/dog-blood-donation-india/",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-teal-500 flex-shrink-0" />
          <div>
            <p className="font-black text-sm text-gray-800 dark:text-gray-100">Is This Safe? Yes — Here&apos;s the Science</p>
            <p className="text-[11px] text-gray-500">Backed by NIH, MSD Vet Manual, and India&apos;s 2025 National SOP</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {facts.map(fact => (
            <div key={fact.title} className="px-5 py-4 flex items-start gap-3 bg-white dark:bg-gray-900">
              <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                {fact.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{fact.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{fact.detail}</p>
                <a
                  href={fact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 mt-1 font-medium"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Source: {fact.source}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DONOR DOG BENEFITS — "What's in it for your dog"
// ─────────────────────────────────────────────────────────────
function DonorDogBenefitsSection() {
  const [open, setOpen] = useState(false);

  const benefits = [
    {
      emoji: "🩺",
      title: "Free full health panel before every donation",
      detail: "CBC, organ function, blood pressure, physical exam — all done by a licensed vet before each donation. If anything is off, donation is cancelled. You get a detailed health report either way.",
    },
    {
      emoji: "💪",
      title: "Regular donors are healthier dogs",
      detail: "Research shows donor dogs enrolled in structured programs show earlier detection of health issues owners would otherwise miss — because they're checked every 8–12 weeks.",
    },
    {
      emoji: "🧬",
      title: "Your dog's body replenishes blood in 3–4 weeks",
      detail: "Bone marrow produces new red blood cells to replace what was given. Because dog red blood cells live ~100 days, the body has ample recovery time between donations spaced 8+ weeks apart.",
    },
    {
      emoji: "🐕",
      title: "No sedation required for calm dogs",
      detail: "If your dog is calm and well-socialized, the procedure is done with a local anaesthetic cream and gentle restraint only. Most dogs don't react at all.",
    },
    {
      emoji: "🔁",
      title: "Priority blood access for your own dog",
      detail: "As a registered K9Hope donor, if your own dog ever needs a blood transfusion, they get priority matching from the network — the same network you helped build.",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Heart className="h-5 w-5 text-pink-500 flex-shrink-0" />
          <div>
            <p className="font-black text-sm text-gray-800 dark:text-gray-100">Benefits for Your Dog</p>
            <p className="text-[11px] text-gray-500">What donation actually does for your own dog&apos;s health</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {benefits.map(b => (
            <div key={b.title} className="px-5 py-4 flex items-start gap-3 bg-white dark:bg-gray-900">
              <span className="text-2xl flex-shrink-0">{b.emoji}</span>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{b.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{b.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SOCIAL PROOF BAR
// ─────────────────────────────────────────────────────────────
function SocialProofBar({ cityDonorCount, city }: { cityDonorCount: number; city: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-gray-900 p-5 text-white shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-5 w-5 text-blue-400" />
        <p className="font-black text-sm uppercase tracking-widest text-gray-300">Join the Movement</p>
      </div>
      <p className="text-2xl font-black mb-1">
        India&apos;s first canine blood donor network.
      </p>
      <p className="text-gray-400 text-sm mb-4">
        {cityDonorCount > 0
          ? `There are only ${cityDonorCount} registered donor${cityDonorCount > 1 ? "s" : ""} in ${city}. Your dog makes ${cityDonorCount + 1}.`
          : `Be the first registered donor in ${city}. Every network starts with one dog.`}
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { value: "1 unit",  label: "= up to 4 dogs helped" },
          { value: "45 min",  label: "total procedure time" },
          { value: "8 weeks", label: "between donations" },
        ].map(stat => (
          <div key={stat.label} className="bg-white/10 rounded-xl py-3 px-2">
            <p className="font-black text-base text-white">{stat.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// THANK YOU NOTE CARD (Branch C hero)
// ─────────────────────────────────────────────────────────────
function ThankYouNoteCard({ appointment }: { appointment: MatchedAppointment }) {
  return (
    <Card className="border-2 border-purple-300 dark:border-purple-700 overflow-hidden shadow-xl shadow-purple-200/20 dark:shadow-none">
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-white" />
        <span className="text-white font-black text-sm">
          A note from {appointment.linkedPatientName}&apos;s family
        </span>
        <Sparkles className="h-4 w-4 text-yellow-300 ml-auto" />
      </div>
      <CardContent className="p-6 space-y-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
        <div className="flex items-center gap-4">
          <div className="text-4xl flex-shrink-0">🐕</div>
          <div>
            <p className="text-lg font-black text-purple-900 dark:text-purple-100">
              {appointment.linkedPatientName} is doing well!
            </p>
            {appointment.thanksNoteAt && (
              <p className="text-xs text-purple-500">
                {formatDistanceToNow(
                  appointment.thanksNoteAt.toDate?.() || new Date(appointment.thanksNoteAt),
                  { addSuffix: true }
                )}
              </p>
            )}
          </div>
        </div>

        <blockquote className="border-l-4 border-purple-400 pl-4 py-3 pr-3 bg-white/60 dark:bg-white/5 rounded-r-xl italic text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
          &ldquo;{appointment.thanksNote}&rdquo;
        </blockquote>

        <div className="flex items-center gap-2 text-xs text-purple-500 dark:text-purple-300 font-semibold">
          <Heart className="h-3.5 w-3.5 fill-purple-400" />
          This note is pinned to your dashboard for 30 days
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// IMPACT STORY SECTION (Branch C)
// ─────────────────────────────────────────────────────────────
function ImpactStorySection({ stats, dogName }: { stats: DonorStats; dogName: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Your Impact So Far</p>
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-violet-600">{stats.totalDonations}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-tight">Times donated</p>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-pink-600">{stats.livesSaved}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-tight">Dogs helped</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-amber-600">{stats.completedAppointments}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-tight">Completed</p>
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-xs text-gray-400 italic">
        &ldquo;{dogName} has given life where there was none. That stays forever.&rdquo;
      </p>
    </div>
  );
}
