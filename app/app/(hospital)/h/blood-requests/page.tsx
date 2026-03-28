"use client";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarIcon, Phone, Mail, MapPin, Droplet, Clock, AlertCircle,
  Users, Filter, Bell, Link as LinkIcon, Check, X, RefreshCw,
  FileText, Search, ChevronDown, ChevronUp, Eye, Trash2,
  CheckCircle2, XCircle, AlertTriangle, Activity, Zap, MessageSquare,
  ClipboardList, Shield
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import {
  collection, query, where, getDocs, doc, updateDoc, Timestamp,
  getDoc, writeBatch, increment, addDoc, deleteDoc, onSnapshot,
  orderBy, limit
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatientRequest {
  id: string;
  p_name: string;
  p_bloodgroup: string;
  p_reasonRequirment: string;
  p_urgencyRequirment: string;
  p_quantityRequirment: string;
  p_doctorName?: string;
  p_hospitalName?: string;
  phone: string;
  email: string;
  p_city: string;
  p_region?: [string, string?];
  p_weight_kg: number;
  p_gender: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  request_status?: "pending" | "accepted" | "rejected" | "completed";
  pendingMatches?: number;
  confirmedMatches?: number;
  appointment_date?: string;
  assigned_clinic_id?: string;
  createdAt?: any;
  updatedAt?: any;
  lastMatchedAt?: any;
  initialDocument?: {
    fileUrl?: string;
    fileName?: string;
    ocrScore?: number;
    ocrFlags?: string[];
    ocrSummary?: string;
    ocrUrgency?: string;
  };
  adminNote?: string;
}

interface DonorMatch {
  id: string;
  name: string;
  bloodType: string;
  city: string;
  phone: string;
  email: string;
  weight: number;
  donationCount: number;
  lastDonation: string | null;
  isEligible: boolean;
  isMedicallyFit: boolean;
  distance: number;
  isSameCity: boolean;
  alreadyLinked: boolean;
  matchScore: number;
  d_willingToTravel?: string;
}

// ── Urgency helpers ────────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  immediate:      { color: "text-red-700",    bg: "bg-red-50 dark:bg-red-950/20",    border: "border-red-500",   label: "🚨 IMMEDIATE",      icon: <Zap className="h-3 w-3" /> },
  within_24_hours:{ color: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-400", label: "⚡ Within 24 hrs",  icon: <AlertTriangle className="h-3 w-3" /> },
  within_3_days:  { color: "text-yellow-700", bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-400", label: "📅 Within 3 days", icon: <Clock className="h-3 w-3" /> },
  no_rush:        { color: "text-green-700",  bg: "bg-green-50 dark:bg-green-950/20",  border: "border-green-400", label: "✓ No Rush",         icon: <Shield className="h-3 w-3" /> },
};
function getUrgencyConfig(urgency: string) {
  return URGENCY_CONFIG[urgency] || URGENCY_CONFIG["no_rush"];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-yellow-500" },
  accepted:  { label: "Accepted",  color: "bg-blue-500" },
  completed: { label: "Completed", color: "bg-green-600" },
  rejected:  { label: "Rejected",  color: "bg-red-600" },
};

// ── Match Score ────────────────────────────────────────────────────────────────
function calculateMatchScore(isEligible: boolean, isMedicallyFit: boolean, distance: number, isUrgent: boolean, donationCount: number): number {
  let score = 0;
  if (isEligible) score += 40;
  if (isMedicallyFit) score += 30;
  if (distance === 0) score += 20;
  if (isUrgent && distance === 0) score += 10;
  score += Math.min(donationCount, 5);
  return score;
}

// ── Notification helper (shared) ───────────────────────────────────────────────
async function pushNotification(batch: ReturnType<typeof writeBatch>, payload: {
  userId: string; userRole: string; type: string; title: string; message: string; data: object;
}) {
  return {
    userId: payload.userId,
    userRole: payload.userRole,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    data: payload.data,
    read: false,
    createdAt: Timestamp.now(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function BloodRequestsPage() {
  const { userId } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"urgent" | "regular" | "accepted" | "completed" | "rejected">("urgent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allRequests, setAllRequests] = useState<PatientRequest[]>([]);

  // Donor matching
  const [availableDonors, setAvailableDonors] = useState<DonorMatch[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<DonorMatch[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PatientRequest | null>(null);
  const [donorDialogOpen, setDonorDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("matchScore");
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [donorSearchQuery, setDonorSearchQuery] = useState("");

  // Detail drawer
  const [detailRequest, setDetailRequest] = useState<PatientRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Admin note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<PatientRequest | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Completion confirm dialog
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<PatientRequest | null>(null);
  const [completeUnits, setCompleteUnits] = useState("1");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // ── Derived lists ────────────────────────────────────────────────────────────
  const urgentRequests   = allRequests.filter(r => (r.request_status === "pending" || r.request_status === "accepted") && (r.p_urgencyRequirment === "immediate" || r.p_urgencyRequirment === "within_24_hours"));
  const regularRequests  = allRequests.filter(r => (r.request_status === "pending" || !r.request_status) && (r.p_urgencyRequirment === "within_3_days" || r.p_urgencyRequirment === "no_rush"));
  const acceptedRequests = allRequests.filter(r => r.request_status === "accepted");
  const completedRequests= allRequests.filter(r => r.request_status === "completed");
  const rejectedRequests = allRequests.filter(r => r.request_status === "rejected");

  function getTabList(): PatientRequest[] {
    let base: PatientRequest[];
    switch (activeTab) {
      case "urgent":    base = urgentRequests; break;
      case "regular":   base = regularRequests; break;
      case "accepted":  base = acceptedRequests; break;
      case "completed": base = completedRequests; break;
      case "rejected":  base = rejectedRequests; break;
      default:          base = [];
    }
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(r =>
      r.p_name?.toLowerCase().includes(q) ||
      r.p_city?.toLowerCase().includes(q) ||
      r.p_bloodgroup?.toLowerCase().includes(q) ||
      r.phone?.includes(q)
    );
  }

  const tabList = getTabList();
  const totalPages = Math.ceil(tabList.length / ITEMS_PER_PAGE);
  const pageData = tabList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  // ── Real-time listener ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const patientsRef = collection(db, "patients");
    const q = query(patientsRef, where("onboarded", "==", "yes"));

    const unsub = onSnapshot(q,
      (snapshot) => {
        const requests: PatientRequest[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<PatientRequest, "id">),
          request_status: d.data().request_status || "pending",
        }));
        requests.sort((a, b) => {
          const urgencyOrder = ["immediate", "within_24_hours", "within_3_days", "no_rush"];
          const ai = urgencyOrder.indexOf(a.p_urgencyRequirment);
          const bi = urgencyOrder.indexOf(b.p_urgencyRequirment);
          if (ai !== bi) return ai - bi;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
        setAllRequests(requests);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Blood requests listener error:", error);
        toast({ title: "Connection Error", description: "Real-time sync failed. Retrying...", variant: "destructive" });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // ── Manual refresh ─────────────────────────────────────────────────────────
  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  // ── Fetch donors for matching ────────────────────────────────────────────────
  const fetchAvailableDonors = useCallback(async (requestData: PatientRequest) => {
    setMatchingLoading(true);
    setAvailableDonors([]);
    setFilteredDonors([]);
    setDonorSearchQuery("");

    try {
      const donorsRef = collection(db, "donors");
      const queries: Promise<any>[] = [
        getDocs(query(donorsRef, where("d_bloodgroup", "==", requestData.p_bloodgroup))),
      ];
      if (requestData.p_bloodgroup !== "universal") {
        queries.push(getDocs(query(donorsRef, where("d_bloodgroup", "==", "universal"))));
      }
      const snapshots = await Promise.all(queries);

      const seenIds = new Set<string>();
      const donors: DonorMatch[] = [];

      for (const snapshot of snapshots) {
        for (const docSnap of snapshot.docs) {
          if (seenIds.has(docSnap.id)) continue;
          seenIds.add(docSnap.id);

          const d = docSnap.data();
          const lastDonationDate = d.d_lastDonation ? new Date(d.d_lastDonation) : null;
          const isEligible = !lastDonationDate || (Date.now() - lastDonationDate.getTime()) > (56 * 24 * 60 * 60 * 1000);
          const isMedicallyFit = d.d_isMedicalCondition !== "yes" && (d.d_weight_kg || 0) >= 25;
          const isSameCity = d.d_city?.toLowerCase() === requestData.p_city?.toLowerCase();
          const distance = isSameCity ? 0 : 1;

          const existingQ = query(
            collection(db, "donor-appointments"),
            where("linkedPatientId", "==", requestData.id),
            where("donorId", "==", docSnap.id),
            where("status", "in", ["pending_donor_acceptance", "confirmed", "completed"])
          );
          const existing = await getDocs(existingQ);

          const isUrgent = requestData.p_urgencyRequirment === "immediate" || requestData.p_urgencyRequirment === "within_24_hours";

          donors.push({
            id: docSnap.id,
            name: d.d_name || "Unknown",
            bloodType: d.d_bloodgroup,
            city: d.d_city || "",
            phone: d.phone || "",
            email: d.email || "",
            weight: d.d_weight_kg || 0,
            donationCount: d.d_donationCount || 0,
            lastDonation: d.d_lastDonation || null,
            isEligible,
            isMedicallyFit,
            distance,
            isSameCity,
            alreadyLinked: !existing.empty,
            d_willingToTravel: d.d_willingToTravel,
            matchScore: calculateMatchScore(isEligible, isMedicallyFit, distance, isUrgent, d.d_donationCount || 0),
          });
        }
      }

      setAvailableDonors(donors);
      setFilteredDonors(donors);
    } catch (error) {
      console.error("fetchAvailableDonors error:", error);
      toast({ title: "Error", description: "Failed to load donors. Please try again.", variant: "destructive" });
    } finally {
      setMatchingLoading(false);
    }
  }, [toast]);

  // ── Donor filter/sort effect ──────────────────────────────────────────────────
  useEffect(() => {
    let filtered = [...availableDonors];
    if (donorSearchQuery.trim()) {
      const q = donorSearchQuery.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || d.phone.includes(q));
    }
    if (sortBy === "distance")   filtered.sort((a, b) => a.distance - b.distance || b.matchScore - a.matchScore);
    if (sortBy === "matchScore") filtered.sort((a, b) => b.matchScore - a.matchScore);
    if (sortBy === "experience") filtered.sort((a, b) => b.donationCount - a.donationCount);
    setFilteredDonors(filtered);
  }, [sortBy, availableDonors, donorSearchQuery]);

  // ── Link donor to patient ────────────────────────────────────────────────────
  async function linkDonorToRequest(donorId: string, requestData: PatientRequest) {
    const donor = availableDonors.find(d => d.id === donorId);
    if (!donor) return;

    if (!donor.isEligible || !donor.isMedicallyFit) {
      if (!confirm("⚠️ This donor may not meet eligibility criteria (recent donation or medical condition). Continue anyway?")) return;
    }

    try {
      const batch = writeBatch(db);
      const isUrgent = requestData.p_urgencyRequirment === "immediate" || requestData.p_urgencyRequirment === "within_24_hours";

      const appointmentRef = doc(collection(db, "donor-appointments"));
      batch.set(appointmentRef, {
        requestId: requestData.id,
        donorId: donor.id,
        donorName: donor.name,
        donorPhone: donor.phone,
        donorEmail: donor.email,
        donorBloodType: donor.bloodType,
        donorWeight: donor.weight,
        clinicId: userId,
        linkedPatientId: requestData.id,
        linkedPatientName: requestData.p_name,
        patientBloodGroup: requestData.p_bloodgroup,
        patientCity: requestData.p_city,
        appointmentDate: "",
        appointmentTime: "",
        status: "pending_donor_acceptance",
        notes: `Matched by clinic admin on ${format(new Date(), "PPP")}`,
        isUrgent: isUrgent ? "yes" : "no",
        matchedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        createdBy: "admin",
      });

      const donorNotifRef = doc(collection(db, "notifications"));
      batch.set(donorNotifRef, {
        userId: donor.id,
        userRole: "donor",
        type: "match_found",
        title: "🎯 You've Been Matched!",
        message: `Your ${donor.bloodType} blood matches a request from ${requestData.p_name} in ${requestData.p_city}.${isUrgent ? " 🚨 URGENT — please respond quickly!" : ""}`,
        data: { requestId: requestData.id, appointmentId: appointmentRef.id, patientName: requestData.p_name, bloodType: requestData.p_bloodgroup, isUrgent: isUrgent ? "yes" : "no" },
        read: false,
        createdAt: Timestamp.now(),
      });

      const patientNotifRef = doc(collection(db, "notifications"));
      batch.set(patientNotifRef, {
        userId: requestData.id,
        userRole: "patient",
        type: "donor_matched",
        title: "✅ Donor Found for Your Dog!",
        message: `A ${requestData.p_bloodgroup} donor has been matched to ${requestData.p_name}. Awaiting donor confirmation from ${donor.name} (${donor.city}).`,
        data: { requestId: requestData.id, appointmentId: appointmentRef.id, donorName: donor.name, donorCity: donor.city },
        read: false,
        createdAt: Timestamp.now(),
      });

      const patientRef = doc(db, "patients", requestData.id);
      batch.update(patientRef, {
        pendingMatches: increment(1),
        request_status: "accepted",
        assigned_clinic_id: userId,
        lastMatchedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await batch.commit();

      toast({
        title: "✅ Match Created",
        description: `${donor.name} linked to ${requestData.p_name}. Notifications sent to both.`,
      });

      fetchAvailableDonors(requestData);

    } catch (error: any) {
      console.error("linkDonorToRequest error:", error);
      toast({ title: "Match Failed", description: error.message || "Could not create match. Try again.", variant: "destructive" });
    }
  }

  // ── Accept (schedule) ─────────────────────────────────────────────────────────
  async function handleAcceptRequest(patientId: string, appointmentDate: Date) {
    try {
      const batch = writeBatch(db);
      const patientRef = doc(db, "patients", patientId);
      batch.update(patientRef, {
        request_status: "accepted",
        appointment_date: format(appointmentDate, "yyyy-MM-dd"),
        assigned_clinic_id: userId,
        updatedAt: Timestamp.now(),
      });

      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: patientId,
        userRole: "patient",
        type: "appointment_scheduled",
        title: "📅 Appointment Scheduled",
        message: `Your blood transfusion appointment has been scheduled for ${format(appointmentDate, "PPP")} at the clinic.`,
        data: { patientId, appointmentDate: format(appointmentDate, "yyyy-MM-dd") },
        read: false,
        createdAt: Timestamp.now(),
      });

      await batch.commit();
      toast({ title: "Request Accepted ✅", description: `Appointment scheduled for ${format(appointmentDate, "PPP")}. Patient notified.` });
    } catch (error: any) {
      console.error("handleAcceptRequest error:", error);
      toast({ title: "Error", description: error.message || "Failed to accept request.", variant: "destructive" });
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────────
  async function handleRejectRequest(patientId: string) {
    if (!confirm("Are you sure you want to reject this blood request? The patient will be notified.")) return;
    try {
      const batch = writeBatch(db);
      const patientRef = doc(db, "patients", patientId);
      batch.update(patientRef, { request_status: "rejected", assigned_clinic_id: null, updatedAt: Timestamp.now() });

      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: patientId,
        userRole: "patient",
        type: "request_rejected",
        title: "❌ Blood Request Not Available",
        message: "Your blood request could not be fulfilled at this time. Please contact the clinic or try again.",
        data: { patientId },
        read: false,
        createdAt: Timestamp.now(),
      });

      await batch.commit();
      toast({ title: "Request Rejected", description: "Patient has been notified." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject.", variant: "destructive" });
    }
  }

  // ── Mark Complete ─────────────────────────────────────────────────────────────
  async function handleMarkComplete(patient: PatientRequest, unitsUsed: string) {
    try {
      const batch = writeBatch(db);
      const patientRef = doc(db, "patients", patient.id);
      batch.update(patientRef, {
        request_status: "completed",
        completedAt: Timestamp.now(),
        unitsTransfused: parseInt(unitsUsed) || 1,
        updatedAt: Timestamp.now(),
      });

      const apptQ = query(
        collection(db, "donor-appointments"),
        where("linkedPatientId", "==", patient.id),
        where("status", "in", ["pending_donor_acceptance", "confirmed"])
      );
      const apptSnap = await getDocs(apptQ);
      apptSnap.forEach(apptDoc => {
        batch.update(apptDoc.ref, { status: "completed", completedAt: Timestamp.now() });
      });

      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: patient.id,
        userRole: "patient",
        type: "transfusion_completed",
        title: "🎉 Transfusion Completed",
        message: `${patient.p_name}'s blood transfusion has been marked complete. Thank you for being part of K9Hope!`,
        data: { patientId: patient.id, unitsUsed },
        read: false,
        createdAt: Timestamp.now(),
      });

      await batch.commit();
      toast({ title: "Marked Complete 🎉", description: `${patient.p_name}'s request marked as completed.` });
      setCompleteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to mark complete.", variant: "destructive" });
    }
  }

  // ── Reopen rejected/completed ─────────────────────────────────────────────────
  async function handleReopenRequest(patientId: string) {
    if (!confirm("Reopen this request? It will return to Pending status.")) return;
    try {
      await updateDoc(doc(db, "patients", patientId), {
        request_status: "pending",
        assigned_clinic_id: null,
        updatedAt: Timestamp.now(),
      });
      toast({ title: "Request Reopened", description: "Request moved back to pending." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not reopen.", variant: "destructive" });
    }
  }

  // ── Admin Note ────────────────────────────────────────────────────────────────
  async function handleSaveNote() {
    if (!noteTarget) return;
    setNoteSaving(true);
    try {
      await updateDoc(doc(db, "patients", noteTarget.id), {
        adminNote: noteText,
        adminNoteUpdatedAt: Timestamp.now(),
      });
      toast({ title: "Note Saved ✅", description: "Admin note attached to this patient." });
      setNoteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save note.", variant: "destructive" });
    } finally {
      setNoteSaving(false);
    }
  }

  if (loading) {
    return (
      <ContentLayout title="Blood Requests">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
          <p className="text-sm text-gray-500">Loading patient requests...</p>
        </div>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Blood Requests">

      {/* ── Header Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplet className="h-6 w-6 text-red-500" />
            Blood Request Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {allRequests.length} total · {urgentRequests.length} urgent · {acceptedRequests.length} in progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search name, city, blood..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 w-64 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="mb-4 w-full grid grid-cols-5">
          <TabsTrigger value="urgent" className="text-xs sm:text-sm">
            🚨 Urgent
            {urgentRequests.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{urgentRequests.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="regular" className="text-xs sm:text-sm">
            Regular <span className="ml-1 text-gray-400">({regularRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="accepted" className="text-xs sm:text-sm">
            In Progress <span className="ml-1 text-gray-400">({acceptedRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs sm:text-sm">
            Done <span className="ml-1 text-gray-400">({completedRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm">
            Rejected <span className="ml-1 text-gray-400">({rejectedRequests.length})</span>
          </TabsTrigger>
        </TabsList>

        {(["urgent","regular","accepted","completed","rejected"] as const).map(tab => (
          <TabsContent key={tab} value={tab}>
            {pageData.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 flex flex-col items-center gap-2">
                  <ClipboardList className="h-10 w-10 text-gray-300" />
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? `No results for "${searchQuery}"` : `No ${tab} requests`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageData.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onAccept={handleAcceptRequest}
                    onReject={handleRejectRequest}
                    onFindDonors={(req) => {
                      setSelectedRequest(req);
                      fetchAvailableDonors(req);
                      setDonorDialogOpen(true);
                    }}
                    onViewDetail={(req) => { setDetailRequest(req); setDetailOpen(true); }}
                    onMarkComplete={(req) => { setCompleteTarget(req); setCompleteUnits("1"); setCompleteDialogOpen(true); }}
                    onReopen={handleReopenRequest}
                    onAddNote={(req) => { setNoteTarget(req); setNoteText(req.adminNote || ""); setNoteDialogOpen(true); }}
                  />
                ))}
              </div>
            )}
            <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Donor Matching Dialog ─────────────────────────────────────────────── */}
      <Dialog open={donorDialogOpen} onOpenChange={setDonorDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Match Donors — {selectedRequest?.p_name}
            </DialogTitle>
            <DialogDescription>
              Blood type: <strong>{selectedRequest?.p_bloodgroup}</strong> · Qty: {selectedRequest?.p_quantityRequirment} units · Urgency: {selectedRequest?.p_urgencyRequirment?.replace("_"," ")}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5">
              {/* Patient Summary */}
              <Card className={`${getUrgencyConfig(selectedRequest.p_urgencyRequirment).bg} ${getUrgencyConfig(selectedRequest.p_urgencyRequirment).border} border`}>
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">Dog</p><p className="font-semibold">🐕 {selectedRequest.p_name}</p></div>
                  <div><p className="text-xs text-gray-500">Blood</p><p className="font-bold text-red-600">{selectedRequest.p_bloodgroup}</p></div>
                  <div><p className="text-xs text-gray-500">City</p><p className="font-semibold">{selectedRequest.p_city}</p></div>
                  <div><p className="text-xs text-gray-500">Owner Phone</p><a href={`tel:${selectedRequest.phone}`} className="font-semibold text-blue-600 hover:underline">{selectedRequest.phone}</a></div>
                </CardContent>
              </Card>

              {/* Donor Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search donors..." value={donorSearchQuery} onChange={e => setDonorSearchQuery(e.target.value)} className="pl-9 text-sm h-9" />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[220px] h-9 text-sm">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matchScore">⭐ Best Match First</SelectItem>
                    <SelectItem value="distance">📍 Nearest First</SelectItem>
                    <SelectItem value="experience">🏆 Most Experienced</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-gray-500 ml-auto">
                  {filteredDonors.filter(d => !d.alreadyLinked).length} available · {filteredDonors.filter(d => d.alreadyLinked).length} already linked
                </span>
              </div>

              {/* Donor Grid */}
              {matchingLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <p className="text-sm text-gray-500">Finding compatible donors...</p>
                </div>
              ) : filteredDonors.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No donors found for {selectedRequest.p_bloodgroup}</p>
                    <p className="text-xs text-gray-400 mt-1">Try matching with universal donors or expand the search</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-1">
                  {filteredDonors.map(donor => (
                    <DonorMatchCard
                      key={donor.id}
                      donor={donor}
                      isUrgent={selectedRequest.p_urgencyRequirment === "immediate" || selectedRequest.p_urgencyRequirment === "within_24_hours"}
                      onLink={() => linkDonorToRequest(donor.id, selectedRequest)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDonorDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Drawer Dialog ──────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🐕 Patient Detail — {detailRequest?.p_name}</DialogTitle>
          </DialogHeader>
          {detailRequest && <PatientDetailView patient={detailRequest} />}
        </DialogContent>
      </Dialog>

      {/* ── Mark Complete Dialog ──────────────────────────────────────────────── */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Transfusion Complete</DialogTitle>
            <DialogDescription>
              Confirm that {completeTarget?.p_name}&apos;s blood transfusion has been completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Units Transfused</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={completeUnits}
                onChange={e => setCompleteUnits(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-gray-500">This will close the request and notify the patient. All linked donor appointments will be marked complete.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => completeTarget && handleMarkComplete(completeTarget, completeUnits)}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admin Note Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Note — {noteTarget?.p_name}</DialogTitle>
            <DialogDescription>Internal note visible only to clinic admins.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add clinical observations, special instructions, follow-up notes..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={5}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={noteSaving}>
              {noteSaving ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </ContentLayout>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REQUEST CARD
// ══════════════════════════════════════════════════════════════════════════════
function RequestCard({
  request, onAccept, onReject, onFindDonors, onViewDetail, onMarkComplete, onReopen, onAddNote
}: {
  request: PatientRequest;
  onAccept: (id: string, date: Date) => void;
  onReject: (id: string) => void;
  onFindDonors: (req: PatientRequest) => void;
  onViewDetail: (req: PatientRequest) => void;
  onMarkComplete: (req: PatientRequest) => void;
  onReopen: (id: string) => void;
  onAddNote: (req: PatientRequest) => void;
}) {
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const urg = getUrgencyConfig(request.p_urgencyRequirment);
  const status = STATUS_CONFIG[request.request_status || "pending"];

  const isActive = request.request_status === "pending" || request.request_status === "accepted";
  const isCompleted = request.request_status === "completed";
  const isRejected = request.request_status === "rejected";

  return (
    <Card className={`flex flex-col transition-shadow hover:shadow-md ${urg.border} border ${urg.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">🐕 {request.p_name}</CardTitle>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className={`${status.color} text-white text-[10px]`}>{status.label}</Badge>
              <Badge className={`bg-transparent border text-[10px] ${urg.color} ${urg.border}`}>
                {urg.label}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xl font-black text-red-600">{request.p_bloodgroup?.toUpperCase()}</div>
            <div className="text-[10px] text-gray-500">{request.p_quantityRequirment} unit(s)</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pb-3 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <AlertCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
          <span className="line-clamp-2">{request.p_reasonRequirment || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{request.p_city}{request.p_doctorName ? ` · Dr. ${request.p_doctorName}` : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <a href={`tel:${request.phone}`} className="text-blue-600 hover:underline">{request.phone}</a>
        </div>
        {request.initialDocument?.ocrScore !== undefined && (
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
            <span className="text-xs">AI Score: <span className={`font-bold ${request.initialDocument.ocrScore >= 75 ? "text-red-600" : request.initialDocument.ocrScore >= 50 ? "text-orange-600" : "text-green-600"}`}>{request.initialDocument.ocrScore}</span></span>
            {request.initialDocument.ocrFlags?.slice(0, 2).map((f, i) => (
              <span key={i} className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{f}</span>
            ))}
          </div>
        )}
        {request.adminNote && (
          <div className="flex items-start gap-1.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg p-2">
            <MessageSquare className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-800 dark:text-yellow-300 line-clamp-2">{request.adminNote}</p>
          </div>
        )}
        {request.pendingMatches !== undefined && request.pendingMatches > 0 && (
          <div className="text-[11px] text-blue-600 font-medium">
            🔗 {request.pendingMatches} donor(s) linked — awaiting confirmation
          </div>
        )}
        {request.createdAt && (
          <div className="text-[10px] text-gray-400">
            Requested {formatDistanceToNow(new Date(request.createdAt.seconds * 1000), { addSuffix: true })}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0">
        {isActive && (
          <Button className="w-full bg-blue-600 hover:bg-blue-700 h-9 text-sm" onClick={() => onFindDonors(request)}>
            <Users className="h-4 w-4 mr-2" />
            Find & Match Donors
            {request.pendingMatches ? <Badge className="ml-2 bg-yellow-400 text-black text-[10px]">{request.pendingMatches}</Badge> : null}
          </Button>
        )}

        {isActive && (
          <div className="w-full space-y-1.5">
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-xs h-8">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {appointmentDate ? format(appointmentDate, "PPP") : "Schedule manually"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={appointmentDate} onSelect={setAppointmentDate} disabled={d => d < new Date()} />
              </PopoverContent>
            </Popover>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                disabled={!appointmentDate}
                onClick={() => { if (appointmentDate) { onAccept(request.id, appointmentDate); setShowDatePicker(false); } }}
              >
                <Check className="h-3 w-3 mr-1" /> Schedule
              </Button>
              <Button variant="ghost" className="h-8 text-xs text-red-600 hover:bg-red-50" onClick={() => onReject(request.id)}>
                <X className="h-3 w-3 mr-1" /> Reject
              </Button>
            </div>
          </div>
        )}

        {request.request_status === "accepted" && (
          <Button className="w-full bg-green-700 hover:bg-green-800 h-8 text-xs" onClick={() => onMarkComplete(request)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Transfusion Complete
          </Button>
        )}

        {(isCompleted || isRejected) && (
          <Button variant="outline" className="w-full h-8 text-xs" onClick={() => onReopen(request.id)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reopen Request
          </Button>
        )}

        <div className="flex gap-1.5 w-full">
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => onViewDetail(request)}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Details
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => onAddNote(request)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" /> {request.adminNote ? "Edit Note" : "Add Note"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DONOR MATCH CARD
// ══════════════════════════════════════════════════════════════════════════════
function DonorMatchCard({ donor, isUrgent, onLink }: { donor: DonorMatch; isUrgent: boolean; onLink: () => void }) {
  return (
    <Card className={`
      transition-all hover:shadow-md
      ${donor.alreadyLinked ? "opacity-60 bg-gray-50 dark:bg-gray-800/50" : ""}
      ${donor.isSameCity ? "border-green-500 border" : ""}
      ${!donor.isEligible && !donor.alreadyLinked ? "border-orange-400 border" : ""}
    `}>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-bold">{donor.name}</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />{donor.city}
              {donor.isSameCity && <Badge className="ml-1 bg-green-500 text-white text-[9px] px-1.5">Same City</Badge>}
            </div>
          </div>
          <Badge className="bg-purple-600 text-xs">Score: {donor.matchScore}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-red-50 dark:bg-red-950/20 rounded p-2">
            <p className="text-gray-500">Blood</p>
            <p className="font-bold text-red-600">{donor.bloodType}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2">
            <p className="text-gray-500">Weight</p>
            <p className="font-semibold">{donor.weight || "?"} kg</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 rounded p-2">
            <p className="text-gray-500">Donations</p>
            <p className="font-semibold">{donor.donationCount}</p>
          </div>
        </div>

        {donor.lastDonation && (
          <p className="text-[10px] text-gray-500">
            Last donation: {format(new Date(donor.lastDonation), "MMM yyyy")}
          </p>
        )}

        <div className="space-y-0.5 text-[11px]">
          {donor.isEligible && donor.isMedicallyFit ? (
            <p className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> Eligible & Medically Fit</p>
          ) : (
            <>
              {!donor.isEligible && <p className="flex items-center gap-1 text-orange-600"><AlertTriangle className="h-3 w-3" /> Donated recently — check rest period</p>}
              {!donor.isMedicallyFit && <p className="flex items-center gap-1 text-orange-600"><X className="h-3 w-3" /> Medical condition or low weight</p>}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <a href={`tel:${donor.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <Phone className="h-3 w-3" />{donor.phone}
          </a>
        </div>

        {donor.alreadyLinked ? (
          <Button disabled size="sm" variant="secondary" className="w-full">
            <Check className="h-3.5 w-3.5 mr-1.5" /> Already Matched
          </Button>
        ) : (
          <Button
            size="sm"
            className={`w-full ${isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
            onClick={onLink}
          >
            <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
            {isUrgent ? "🚨 Link Urgently" : "Link to Request"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT DETAIL VIEW (inside dialog)
// ══════════════════════════════════════════════════════════════════════════════
function PatientDetailView({ patient }: { patient: PatientRequest }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-gray-500">Dog Name</p><p className="font-semibold">🐕 {patient.p_name}</p></div>
        <div><p className="text-xs text-gray-500">Gender</p><p className="font-semibold capitalize">{patient.p_gender || "—"}</p></div>
        <div><p className="text-xs text-gray-500">Blood Group</p><p className="font-bold text-red-600">{patient.p_bloodgroup}</p></div>
        <div><p className="text-xs text-gray-500">Weight</p><p className="font-semibold">{patient.p_weight_kg} kg</p></div>
        <div><p className="text-xs text-gray-500">Reason</p><p className="font-semibold">{patient.p_reasonRequirment}</p></div>
        <div><p className="text-xs text-gray-500">Quantity</p><p className="font-semibold">{patient.p_quantityRequirment} unit(s)</p></div>
        <div><p className="text-xs text-gray-500">City</p><p className="font-semibold">{patient.p_city}</p></div>
        <div><p className="text-xs text-gray-500">Urgency</p><p className="font-semibold capitalize">{patient.p_urgencyRequirment?.replace(/_/g," ")}</p></div>
        <div><p className="text-xs text-gray-500">Owner Phone</p><a href={`tel:${patient.phone}`} className="font-semibold text-blue-600 hover:underline">{patient.phone}</a></div>
        <div><p className="text-xs text-gray-500">Owner Email</p><p className="font-semibold">{patient.email || "—"}</p></div>
        <div><p className="text-xs text-gray-500">Emergency Contact</p><p className="font-semibold">{patient.emergency_contact_name}</p></div>
        <div><p className="text-xs text-gray-500">Emergency Phone</p><a href={`tel:${patient.emergency_contact_phone}`} className="font-semibold text-blue-600 hover:underline">{patient.emergency_contact_phone}</a></div>
        {patient.p_doctorName && <div><p className="text-xs text-gray-500">Doctor</p><p className="font-semibold">Dr. {patient.p_doctorName}</p></div>}
        {patient.p_hospitalName && <div><p className="text-xs text-gray-500">Hospital</p><p className="font-semibold">{patient.p_hospitalName}</p></div>}
      </div>

      {patient.initialDocument?.fileUrl && (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium">{patient.initialDocument.fileName || "Medical Report"}</span>
            </div>
            <a href={patient.initialDocument.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open ↗</a>
          </div>
          <img src={patient.initialDocument.fileUrl} alt="Medical report" className="w-full max-h-48 object-contain bg-white" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
          {patient.initialDocument.ocrSummary && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 italic">
              AI Summary: &quot;{patient.initialDocument.ocrSummary}&quot;
            </div>
          )}
        </div>
      )}

      {patient.adminNote && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-yellow-700 mb-1">📝 Admin Note</p>
          <p className="text-xs text-yellow-800 dark:text-yellow-300">{patient.adminNote}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ══════════════════════════════════════════════════════════════════════════════
function PaginationBar({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>← Prev</Button>
      <span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Next →</Button>
    </div>
  );
}