"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, Timestamp } from "firebase/firestore"; // Added deleteDoc
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added Table imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Phone, Mail, MapPin, Droplet, Clock, AlertCircle, FileText, Check, X } from "lucide-react";
import { format } from "date-fns";

interface PatientCase {
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
  request_status: "accepted" | "completed" | "cancelled";
  appointment_date?: string;
  assigned_clinic_id: string;
  case_notes?: string;
  completed_date?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function PatientManagementPage() {
  const { userId } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("regular");
  const [caseTab, setCaseTab] = useState("open");

  const [regularOpenCases, setRegularOpenCases] = useState<PatientCase[]>([]);
  const [regularClosedCases, setRegularClosedCases] = useState<PatientCase[]>([]);
  const [emergencyOpenCases, setEmergencyOpenCases] = useState<PatientCase[]>([]);
  const [emergencyClosedCases, setEmergencyClosedCases] = useState<PatientCase[]>([]);
  const [pendingHospitals, setPendingHospitals] = useState<any[]>([]); // New state

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Dialog states
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [caseNotes, setCaseNotes] = useState("");
  const [newAppointmentDate, setNewAppointmentDate] = useState<Date>();
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);

  useEffect(() => {
    fetchAllCases();
    fetchPendingHospitals(); // Fetch pending hospitals
  }, [userId]);

  async function fetchAllCases() {
    if (!userId) return;

    setLoading(true);
    try {
      const patientsRef = collection(db, "patients");

      // Query for accepted cases assigned to this clinic
      const acceptedQuery = query(
        patientsRef,
        where("assigned_clinic_id", "==", userId),
        where("request_status", "==", "accepted")
      );

      // Query for completed cases
      const completedQuery = query(
        patientsRef,
        where("assigned_clinic_id", "==", userId),
        where("request_status", "==", "completed")
      );

      const [acceptedSnap, completedSnap] = await Promise.all([
        getDocs(acceptedQuery),
        getDocs(completedQuery)
      ]);

      const openCases: PatientCase[] = [];
      const closedCases: PatientCase[] = [];

      acceptedSnap.forEach((doc) => {
        openCases.push({ id: doc.id, ...doc.data() } as PatientCase);
      });

      completedSnap.forEach((doc) => {
        closedCases.push({ id: doc.id, ...doc.data() } as PatientCase);
      });

      // Separate by urgency
      const regOpen = openCases.filter(c =>
        c.p_urgencyRequirment === "within_3_days" || c.p_urgencyRequirment === "no_rush"
      );
      const regClosed = closedCases.filter(c =>
        c.p_urgencyRequirment === "within_3_days" || c.p_urgencyRequirment === "no_rush"
      );
      const emgOpen = openCases.filter(c =>
        c.p_urgencyRequirment === "immediate" || c.p_urgencyRequirment === "within_24_hours"
      );
      const emgClosed = closedCases.filter(c =>
        c.p_urgencyRequirment === "immediate" || c.p_urgencyRequirment === "within_24_hours"
      );

      setEmergencyOpenCases(emgOpen);
      setEmergencyClosedCases(emgClosed);

      console.log(`Loaded: ${openCases.length} open, ${closedCases.length} closed cases`);
    } catch (error) {
      console.error("Error fetching cases:", error);
      alert("Failed to fetch patient cases. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingHospitals() {
    try {
      const pendingRef = collection(db, "pending-hospitals");
      const q = query(pendingRef, where("status", "==", "pending_verification"));
      const snapshot = await getDocs(q);

      const pending = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate(),
      }));

      setPendingHospitals(pending);
    } catch (error) {
      console.error("Error fetching pending hospitals:", error);
    }
  }

  async function handleApproveHospital(pendingId: string, hospitalId: string) {
    try {
      // Update hospital status
      await updateDoc(doc(db, "hospitals", hospitalId), {
        isVerified: true,
        isPending: false,
        verifiedAt: Timestamp.now(),
        verifiedBy: userId,
      });

      // Update pending record
      await updateDoc(doc(db, "pending-hospitals", pendingId), {
        status: "approved",
        approvedAt: Timestamp.now(),
        approvedBy: userId,
      });

      alert("✅ Hospital approved and added to network!");
      fetchPendingHospitals();

    } catch (error) {
      console.error("Error approving hospital:", error);
      alert("❌ Failed to approve hospital");
    }
  }

  async function handleRejectHospital(pendingId: string, hospitalId: string) {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;

    try {
      // Delete from hospitals
      await deleteDoc(doc(db, "hospitals", hospitalId));

      // Update pending record
      await updateDoc(doc(db, "pending-hospitals", pendingId), {
        status: "rejected",
        rejectedAt: Timestamp.now(),
        rejectedBy: userId,
        rejectionReason: reason,
      });

      alert("Hospital rejected");
      fetchPendingHospitals();

    } catch (error) {
      console.error("Error rejecting hospital:", error);
    }
  }

  async function handleCompleteCase(patientId: string, notes: string) {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        request_status: "completed",
        case_notes: notes,
        completed_date: format(new Date(), "yyyy-MM-dd"),
        updatedAt: Timestamp.now()
      });

      alert("✅ Case marked as completed!");
      setShowCompleteDialog(false);
      fetchAllCases();
    } catch (error) {
      console.error("Error completing case:", error);
      alert("❌ Failed to complete case. Please try again.");
    }
  }

  async function handleRescheduleAppointment(patientId: string, newDate: Date) {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        appointment_date: format(newDate, "yyyy-MM-dd"),
        updatedAt: Timestamp.now()
      });

      alert("✅ Appointment rescheduled successfully!");
      setShowRescheduleDialog(false);
      fetchAllCases();
    } catch (error) {
      console.error("Error rescheduling:", error);
      alert("❌ Failed to reschedule. Please try again.");
    }
  }

  async function handleCancelCase(patientId: string) {
    if (!confirm("Are you sure you want to cancel this case? This will reset the patient's request status.")) {
      return;
    }

    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        request_status: "pending",
        assigned_clinic_id: null,
        appointment_date: null,
        updatedAt: Timestamp.now()
      });

      alert("Case cancelled. Patient can request from other clinics.");
      fetchAllCases();
    } catch (error) {
      console.error("Error cancelling case:", error);
      alert("❌ Failed to cancel case.");
    }
  }

  function getCurrentPageData() {
    let data: PatientCase[] = [];

    if (activeTab === "regular") {
      data = caseTab === "open" ? regularOpenCases : regularClosedCases;
    } else {
      data = caseTab === "open" ? emergencyOpenCases : emergencyClosedCases;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }

  function getTotalPages() {
    let data: PatientCase[] = [];

    if (activeTab === "regular") {
      data = caseTab === "open" ? regularOpenCases : regularClosedCases;
    } else {
      data = caseTab === "open" ? emergencyOpenCases : emergencyClosedCases;
    }

    return Math.ceil(data.length / itemsPerPage);
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, caseTab]);

  if (loading) {
    return (
      <ContentLayout title="Patient Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">Loading patient cases...</div>
        </div>
      </ContentLayout>
    );
  }

  const isUrgent = activeTab === "emergency";
  const currentData = getCurrentPageData();

  return (
    <ContentLayout title="Patient Management">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 w-full">
          <TabsTrigger className="w-full" value="regular">
            Regular Patients ({regularOpenCases.length + regularClosedCases.length})
          </TabsTrigger>
          <TabsTrigger className="w-full" value="emergency">
            🚨 Emergency Patients ({emergencyOpenCases.length + emergencyClosedCases.length})
          </TabsTrigger>
        </TabsList>

        {/* Regular Patients Tab */}
        <TabsContent value="regular">
          <div className="px-2 mb-6">
            <h2 className="text-2xl font-semibold">Accepted Regular Patients</h2>
            <p className="text-foreground text-md mt-3">
              View patient appointments, mark cases as completed, and manage everything easily.
            </p>
            <p className="text-foreground text-md mt-2">
              Accept patient requests in{' '}
              <Link href="/app/h/blood-requests" className="text-accent underline hover:text-accent/80">
                Blood Requests
              </Link>.
            </p>
          </div>

          <Tabs value={caseTab} onValueChange={setCaseTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="open">Open Cases ({regularOpenCases.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed Cases ({regularClosedCases.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <CasesList
                cases={currentData}
                onViewDetails={(c) => { setSelectedCase(c); setShowDetailsDialog(true); }}
                onComplete={(c) => { setSelectedCase(c); setShowCompleteDialog(true); }}
                onReschedule={(c) => { setSelectedCase(c); setShowRescheduleDialog(true); }}
                onCancel={handleCancelCase}
                isUrgent={false}
                isClosed={false}
              />
            </TabsContent>

            <TabsContent value="closed">
              <CasesList
                cases={currentData}
                onViewDetails={(c) => { setSelectedCase(c); setShowDetailsDialog(true); }}
                isUrgent={false}
                isClosed={true}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Emergency Patients Tab */}
        <TabsContent value="emergency">
          <div className="px-2 mb-6">
            <h2 className="text-2xl font-semibold text-red-600">🚨 Accepted Emergency Patients</h2>
            <p className="text-foreground text-md mt-3">
              View urgent patient appointments, mark cases as completed, and manage critical situations.
            </p>
            <p className="text-foreground text-md mt-2">
              Accept patient requests in{' '}
              <Link href="/app/h/blood-requests" className="text-accent underline hover:text-accent/80">
                Blood Requests
              </Link>.
            </p>
          </div>

          <Tabs value={caseTab} onValueChange={setCaseTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="open">Open Cases ({emergencyOpenCases.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed Cases ({emergencyClosedCases.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <CasesList
                cases={currentData}
                onViewDetails={(c) => { setSelectedCase(c); setShowDetailsDialog(true); }}
                onComplete={(c) => { setSelectedCase(c); setShowCompleteDialog(true); }}
                onReschedule={(c) => { setSelectedCase(c); setShowRescheduleDialog(true); }}
                onCancel={handleCancelCase}
                isUrgent={true}
                isClosed={false}
              />
            </TabsContent>

            <TabsContent value="closed">
              <CasesList
                cases={currentData}
                onViewDetails={(c) => { setSelectedCase(c); setShowDetailsDialog(true); }}
                isUrgent={true}
                isClosed={true}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={getTotalPages()}
        onPageChange={setCurrentPage}
      />

      {/* Pending Hospitals Section */}
      {pendingHospitals.length > 0 && (
        <Card className="mt-8 border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Hospital Verifications
              <Badge className="bg-orange-500">{pendingHospitals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingHospitals.map((hospital) => (
                  <TableRow key={hospital.id}>
                    <TableCell className="font-medium">
                      {hospital.h_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{hospital.h_address_line1}</div>
                        <div className="text-gray-500">
                          {hospital.h_city}, {hospital.h_pincode}
                        </div>
                        {hospital.h_landmark && (
                          <div className="text-gray-400 text-xs">
                            Near: {hospital.h_landmark}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{hospital.phone}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{hospital.addedByPatientName}</div>
                        <div className="text-gray-500">Patient</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hospital.requestedAt ? format(hospital.requestedAt, "PPp") : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveHospital(hospital.id, hospital.hospitalId)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectHospital(hospital.id, hospital.hospitalId)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <DetailsDialog
        case={selectedCase}
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
      />

      <CompleteDialog
        case={selectedCase}
        open={showCompleteDialog}
        notes={caseNotes}
        onNotesChange={setCaseNotes}
        onComplete={() => selectedCase && handleCompleteCase(selectedCase.id, caseNotes)}
        onClose={() => setShowCompleteDialog(false)}
      />

      <RescheduleDialog
        case={selectedCase}
        open={showRescheduleDialog}
        date={newAppointmentDate}
        onDateChange={setNewAppointmentDate}
        onReschedule={() => selectedCase && newAppointmentDate && handleRescheduleAppointment(selectedCase.id, newAppointmentDate)}
        onClose={() => setShowRescheduleDialog(false)}
      />
    </ContentLayout>
  );
}

// Cases List Component
function CasesList({
  cases,
  onViewDetails,
  onComplete,
  onReschedule,
  onCancel,
  isUrgent,
  isClosed
}: {
  cases: PatientCase[];
  onViewDetails: (c: PatientCase) => void;
  onComplete?: (c: PatientCase) => void;
  onReschedule?: (c: PatientCase) => void;
  onCancel?: (id: string) => void;
  isUrgent: boolean;
  isClosed: boolean;
}) {
  if (cases.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-center text-gray-500">
          No {isClosed ? 'closed' : 'open'} {isUrgent ? 'emergency' : 'regular'} cases.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cases.map((patientCase) => (
        <CaseCard
          key={patientCase.id}
          case={patientCase}
          onViewDetails={onViewDetails}
          onComplete={onComplete}
          onReschedule={onReschedule}
          onCancel={onCancel}
          isUrgent={isUrgent}
          isClosed={isClosed}
        />
      ))}
    </div>
  );
}

// Case Card Component
function CaseCard({
  case: patientCase,
  onViewDetails,
  onComplete,
  onReschedule,
  onCancel,
  isUrgent,
  isClosed
}: {
  case: PatientCase;
  onViewDetails: (c: PatientCase) => void;
  onComplete?: (c: PatientCase) => void;
  onReschedule?: (c: PatientCase) => void;
  onCancel?: (id: string) => void;
  isUrgent: boolean;
  isClosed: boolean;
}) {
  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      immediate: { color: "bg-red-600", label: "🚨 IMMEDIATE" },
      within_24_hours: { color: "bg-orange-500", label: "⚡ 24hrs" },
      within_3_days: { color: "bg-yellow-500", label: "📅 3 days" },
      no_rush: { color: "bg-green-500", label: "✓ No Rush" },
    };
    const badge = variants[urgency] || variants.no_rush;
    return <Badge className={`${badge.color} text-white`}>{badge.label}</Badge>;
  };

  return (
    <Card className={`${isUrgent ? 'border-red-500 border-2' : ''} ${isClosed ? 'opacity-75' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">🐕 {patientCase.p_name}</CardTitle>
          {isClosed ? (
            <Badge className="bg-gray-500 text-white">✓ Closed</Badge>
          ) : (
            getUrgencyBadge(patientCase.p_urgencyRequirment)
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Blood Info */}
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-red-500" />
          <span className="font-semibold">{patientCase.p_bloodgroup}</span>
          <span className="text-sm text-gray-500">({patientCase.p_quantityRequirment} units)</span>
        </div>

        {/* Appointment Date */}
        {patientCase.appointment_date && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            <Clock className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-xs text-gray-600">Appointment</div>
              <div className="font-semibold text-sm">{format(new Date(patientCase.appointment_date), "PPP")}</div>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Reason:</span> {patientCase.p_reasonRequirment}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <a href={`tel:${patientCase.phone}`} className="text-blue-600 hover:underline">
              {patientCase.phone}
            </a>
          </div>
        </div>

        {/* Completed Date */}
        {isClosed && patientCase.completed_date && (
          <div className="text-xs text-gray-500">
            Completed: {format(new Date(patientCase.completed_date), "PPP")}
          </div>
        )}

        {/* Case Notes Preview */}
        {patientCase.case_notes && (
          <div className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
            <FileText className="h-3 w-3 inline mr-1" />
            {patientCase.case_notes.substring(0, 50)}...
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={() => onViewDetails(patientCase)}
          variant="outline"
          className="w-full"
        >
          View Full Details
        </Button>

        {!isClosed && (
          <div className="flex gap-2 w-full">
            <Button
              onClick={() => onComplete && onComplete(patientCase)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" /> Complete
            </Button>
            <Button
              onClick={() => onReschedule && onReschedule(patientCase)}
              variant="outline"
              className="flex-1"
            >
              Reschedule
            </Button>
          </div>
        )}

        {!isClosed && onCancel && (
          <Button
            onClick={() => onCancel(patientCase.id)}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            <X className="h-4 w-4 mr-1" /> Cancel Case
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Details Dialog
function DetailsDialog({ case: patientCase, open, onClose }: {
  case: PatientCase | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!patientCase) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🐕 Patient Details: {patientCase.p_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Blood Type</div>
              <div className="font-semibold">{patientCase.p_bloodgroup}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Weight</div>
              <div className="font-semibold">{patientCase.p_weight_kg} kg</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Gender</div>
              <div className="font-semibold">{patientCase.p_gender}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Quantity Needed</div>
              <div className="font-semibold">{patientCase.p_quantityRequirment} units</div>
            </div>
          </div>

          {/* Medical Info */}
          <div>
            <div className="text-sm text-gray-600">Reason for Request</div>
            <div className="font-semibold">{patientCase.p_reasonRequirment}</div>
          </div>

          {patientCase.p_doctorName && (
            <div>
              <div className="text-sm text-gray-600">Attending Veterinarian</div>
              <div className="font-semibold">{patientCase.p_doctorName}</div>
            </div>
          )}

          {patientCase.p_hospitalName && (
            <div>
              <div className="text-sm text-gray-600">Hospital/Clinic</div>
              <div className="font-semibold">{patientCase.p_hospitalName}</div>
            </div>
          )}

          {/* Contact Info */}
          <div>
            <div className="text-sm text-gray-600">Owner Contact</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href={`tel:${patientCase.phone}`} className="text-blue-600">{patientCase.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${patientCase.email}`} className="text-blue-600">{patientCase.email}</a>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
            <div className="text-sm text-gray-600 font-semibold">Emergency Contact</div>
            <div>{patientCase.emergency_contact_name}</div>
            <div className="text-blue-600">{patientCase.emergency_contact_phone}</div>
          </div>

          {/* Location */}
          <div>
            <div className="text-sm text-gray-600">Location</div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{patientCase.p_city}</span>
            </div>
          </div>

          {/* Case Notes */}
          {patientCase.case_notes && (
            <div>
              <div className="text-sm text-gray-600">Case Notes</div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                {patientCase.case_notes}
              </div>
            </div>
          )}

          {/* Appointment Date */}
          {patientCase.appointment_date && (
            <div>
              <div className="text-sm text-gray-600">Scheduled Appointment</div>
              <div className="font-semibold text-lg">
                {format(new Date(patientCase.appointment_date), "PPP")}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Complete Dialog
function CompleteDialog({ case: patientCase, open, notes, onNotesChange, onComplete, onClose }: {
  case: PatientCase | null;
  open: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  if (!patientCase) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Case: {patientCase.p_name}</DialogTitle>
          <DialogDescription>
            Mark this case as completed and add any final notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Case Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add any notes about the transfusion, outcome, or follow-up needed..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onComplete} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" /> Mark as Completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Reschedule Dialog
function RescheduleDialog({ case: patientCase, open, date, onDateChange, onReschedule, onClose }: {
  case: PatientCase | null;
  open: boolean;
  date?: Date;
  onDateChange: (date?: Date) => void;
  onReschedule: () => void;
  onClose: () => void;
}) {
  if (!patientCase) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Appointment: {patientCase.p_name}</DialogTitle>
          <DialogDescription>
            Current appointment: {patientCase.appointment_date && format(new Date(patientCase.appointment_date), "PPP")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Select new date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={onDateChange}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onReschedule} disabled={!date}>
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center mt-6 space-x-2">
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="bg-accent"
      >
        Previous
      </Button>
      <span className="px-4 py-2">
        {currentPage} / {totalPages}
      </span>
      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="bg-accent"
      >
        Next
      </Button>
    </div>
  );
}
