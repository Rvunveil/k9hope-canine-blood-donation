"use client";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarIcon, Phone, Mail, MapPin, Droplet, Clock, AlertCircle,
  Users, Filter, Bell, Link as LinkIcon, Check, X
} from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import {
  collection, query, where, getDocs, doc, updateDoc, Timestamp,
  getDoc, writeBatch, increment, addDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

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
}

export default function BloodRequestsPage() {
  const { userId } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("urgent");
  const [loading, setLoading] = useState(true);
  const [urgentRequests, setUrgentRequests] = useState<PatientRequest[]>([]);
  const [regularRequests, setRegularRequests] = useState<PatientRequest[]>([]);

  // Matching System States
  const [availableDonors, setAvailableDonors] = useState<any[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PatientRequest | null>(null);
  const [donorDialogOpen, setDonorDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("distance");
  const [filterBloodType, setFilterBloodType] = useState("all");
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch patient requests from Firebase
  useEffect(() => {
    fetchPatientRequests();
  }, []);

  async function fetchPatientRequests() {
    setLoading(true);
    try {
      // Query patients collection where onboarded = "yes"
      const patientsRef = collection(db, "patients");
      const q = query(patientsRef, where("onboarded", "==", "yes"));
      const querySnapshot = await getDocs(q);

      const allRequests: PatientRequest[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Only include patients with pending or no status (new requests)
        const status = data.request_status || "pending";
        // Also include requests that are already accepted but might need more donors? 
        // For now, let's keep it to pending/accepted (active) ones.
        if (status === "pending" || status === "accepted" || !data.request_status) {
          allRequests.push({
            id: doc.id,
            ...data,
            request_status: status
          } as PatientRequest);
        }
      });

      // Sort by urgency and creation date
      const urgent = allRequests.filter(req =>
        req.p_urgencyRequirment === "immediate" ||
        req.p_urgencyRequirment === "within_24_hours"
      ).sort((a, b) => {
        if (a.p_urgencyRequirment === "immediate" && b.p_urgencyRequirment !== "immediate") return -1;
        if (a.p_urgencyRequirment !== "immediate" && b.p_urgencyRequirment === "immediate") return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      const regular = allRequests.filter(req =>
        req.p_urgencyRequirment === "within_3_days" ||
        req.p_urgencyRequirment === "no_rush"
      ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setUrgentRequests(urgent);
      setRegularRequests(regular);

    } catch (error) {
      console.error("Error fetching patient requests:", error);
      toast({
        title: "Error",
        description: "Failed to fetch patient requests. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // --- MATCHING SYSTEM LOGIC ---

  async function fetchAvailableDonors(requestData: PatientRequest) {
    try {
      setMatchingLoading(true);

      // Get clinic location for distance calculation (current user is clinic)
      const clinicRef = doc(db, "hospitals", userId); // Assuming userId is clinicId
      const clinicSnap = await getDoc(clinicRef);
      const clinicData = clinicSnap.exists() ? clinicSnap.data() : {};
      const clinicCity = clinicData.h_city || "";

      // Fetch all eligible donors
      const donorsRef = collection(db, "donors");
      const q = query(
        donorsRef,
        where("d_bloodgroup", "==", requestData.p_bloodgroup)
      );

      const snapshot = await getDocs(q);
      const donors = [];

      for (const docSnap of snapshot.docs) {
        const donorData = docSnap.data();

        // Check eligibility
        const lastDonationDate = donorData.d_lastDonation
          ? new Date(donorData.d_lastDonation)
          : null;

        const isEligible = !lastDonationDate ||
          (Date.now() - lastDonationDate.getTime()) > (56 * 24 * 60 * 60 * 1000); // 8 weeks

        // Check medical conditions
        const isMedicallyFit = donorData.d_isMedicalCondition !== "yes" &&
          (donorData.d_weight_kg || 0) >= 25;

        // Calculate distance (simplified - same city = 0, different = 1)
        const isSameCity = donorData.d_city?.toLowerCase() === clinicCity.toLowerCase();
        const distance = isSameCity ? 0 : 1;

        // Check if already linked to this request
        const appointmentsRef = collection(db, "donor-appointments");
        const appointmentQuery = query(
          appointmentsRef,
          where("linkedPatientId", "==", requestData.id),
          where("donorId", "==", docSnap.id),
          where("status", "in", ["pending_donor_acceptance", "confirmed", "completed"])
        );
        const existingMatch = await getDocs(appointmentQuery);
        const alreadyLinked = !existingMatch.empty;

        const isUrgent = requestData.p_urgencyRequirment === "immediate" || requestData.p_urgencyRequirment === "within_24_hours";

        donors.push({
          id: docSnap.id,
          name: donorData.d_name,
          bloodType: donorData.d_bloodgroup,
          city: donorData.d_city,
          phone: donorData.phone,
          email: donorData.email,
          weight: donorData.d_weight_kg,
          donationCount: donorData.d_donationCount || 0,
          lastDonation: donorData.d_lastDonation,
          isEligible,
          isMedicallyFit,
          distance,
          isSameCity,
          alreadyLinked,
          matchScore: calculateMatchScore(
            isEligible,
            isMedicallyFit,
            distance,
            isUrgent,
            donorData.d_donationCount || 0
          ),
        });
      }

      setAvailableDonors(donors);
      setFilteredDonors(donors);

    } catch (error) {
      console.error("Error fetching donors:", error);
    } finally {
      setMatchingLoading(false);
    }
  }

  function calculateMatchScore(
    isEligible: boolean,
    isMedicallyFit: boolean,
    distance: number,
    isUrgent: boolean,
    donationCount: number
  ) {
    let score = 0;

    if (isEligible) score += 40;
    if (isMedicallyFit) score += 30;
    if (distance === 0) score += 20; // Same city
    if (isUrgent && distance === 0) score += 10; // Urgent + nearby
    score += Math.min(donationCount, 5); // Experience bonus (max 5 points)

    return score;
  }

  useEffect(() => {
    let filtered = [...availableDonors];

    // Sort by selected criteria
    if (sortBy === "distance") {
      filtered.sort((a, b) => a.distance - b.distance || b.matchScore - a.matchScore);
    } else if (sortBy === "matchScore") {
      filtered.sort((a, b) => b.matchScore - a.matchScore);
    } else if (sortBy === "experience") {
      filtered.sort((a, b) => b.donationCount - a.donationCount);
    }

    setFilteredDonors(filtered);
  }, [sortBy, availableDonors]);

  async function linkDonorToRequest(donorId: string, requestData: PatientRequest) {
    try {
      const donor = availableDonors.find(d => d.id === donorId);

      if (!donor) {
        alert("Donor not found");
        return;
      }

      if (!donor.isEligible || !donor.isMedicallyFit) {
        if (!confirm("This donor may not meet eligibility criteria. Continue anyway?")) {
          return;
        }
      }

      const batch = writeBatch(db);

      const isUrgent = requestData.p_urgencyRequirment === "immediate" || requestData.p_urgencyRequirment === "within_24_hours";

      // 1. Ensure a 'veterinary-donor-requests' entry exists (if not created by patient directly)
      // The current system uses 'patients' collection for requests.
      // We should create/link a veterinary-donor-request for tracking if it doesn't exist.
      // For simplicity, we'll create the appointment directly linked to the patient ID.

      // Create appointment (match)
      const appointmentRef = doc(collection(db, "donor-appointments"));
      const appointmentData = {
        requestId: requestData.id, // Using patient ID as request ID reference for now
        donorId: donor.id,
        donorName: donor.name,
        donorPhone: donor.phone,
        donorEmail: donor.email,
        dogBloodType: donor.bloodType,
        dogWeight: donor.weight,
        clinicId: userId,
        linkedPatientId: requestData.id,
        linkedPatientName: requestData.p_name,
        appointmentDate: "", // Donor will choose
        appointmentTime: "",
        status: "pending_donor_acceptance", // First come first serve
        notes: `Matched by admin on ${format(new Date(), "PPP")}`,
        isUrgent: isUrgent ? "yes" : "no",
        matchedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        createdBy: "admin",
      };
      batch.set(appointmentRef, appointmentData);

      // Create notification for DONOR
      const donorNotificationRef = doc(collection(db, "notifications"));
      batch.set(donorNotificationRef, {
        userId: donor.id,
        userRole: "donor",
        type: "match_found",
        title: "🎯 You've Been Matched!",
        message: `A ${requestData.p_bloodgroup} blood request matches your profile. Patient: ${requestData.p_name}. ${isUrgent ? "🚨 URGENT" : ""}`,
        data: {
          requestId: requestData.id,
          appointmentId: appointmentRef.id,
          patientName: requestData.p_name,
          bloodType: requestData.p_bloodgroup,
          isUrgent: isUrgent ? "yes" : "no",
        },
        read: false,
        createdAt: Timestamp.now(),
      });

      // Create notification for PATIENT
      const patientNotificationRef = doc(collection(db, "notifications"));
      batch.set(patientNotificationRef, {
        userId: requestData.id, // Using patient ID as userId (assuming they are same)
        userRole: "patient",
        type: "donor_matched",
        title: "✅ Donor Matched!",
        message: `A suitable ${requestData.p_bloodgroup} donor has been found. Awaiting donor confirmation.`,
        data: {
          requestId: requestData.id,
          appointmentId: appointmentRef.id,
          donorName: donor.name,
        },
        read: false,
        createdAt: Timestamp.now(),
      });

      // Update patient request with pending match info
      const patientRef = doc(db, "patients", requestData.id);
      batch.update(patientRef, {
        pendingMatches: increment(1),
        request_status: "accepted", // Auto-accept if matching
        assigned_clinic_id: userId, // Auto-assign if matching
        lastMatchedAt: Timestamp.now(),
      });

      await batch.commit();

      toast({
        title: "Match Created ✅",
        description: `Linked ${donor.name} to ${requestData.p_name}. Notifications sent.`,
      });

      // Refresh donors list
      fetchAvailableDonors(requestData);
      // Refresh requests to show updated counts
      fetchPatientRequests();

    } catch (error) {
      console.error("Error linking donor:", error);
      toast({
        title: "Error",
        description: "Failed to create match. Please try again.",
        variant: "destructive",
      });
    }
  }

  // --- EXISTING ACTIONS ---

  async function handleAcceptRequest(patientId: string, appointmentDate: Date) {
    try {
      const patientRef = doc(db, "patients", patientId);

      await updateDoc(patientRef, {
        request_status: "accepted",
        appointment_date: format(appointmentDate, "yyyy-MM-dd"),
        assigned_clinic_id: userId,
        updatedAt: Timestamp.now()
      });

      toast({
        title: "Request Accepted ✅",
        description: `Appointment scheduled for ${format(appointmentDate, "PPP")}`,
      });

      fetchPatientRequests();
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  }

  async function handleRejectRequest(patientId: string) {
    if (!confirm("Are you sure you want to reject this blood request?")) return;

    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        request_status: "rejected",
        assigned_clinic_id: null,
        updatedAt: Timestamp.now()
      });

      toast({
        title: "Request Rejected",
        description: "The blood request has been rejected.",
      });

      fetchPatientRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  }

  // Pagination logic
  const getCurrentPageData = (requests: PatientRequest[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return requests.slice(startIndex, endIndex);
  };

  const getTotalPages = (requests: PatientRequest[]) => {
    return Math.ceil(requests.length / itemsPerPage);
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when tab changes
  }, [activeTab]);

  if (loading) {
    return (
      <ContentLayout title="Blood Requests">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">Loading patient requests...</div>
        </div>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Blood Requests">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 w-full">
          <TabsTrigger className="w-full" value="regular">
            Regular Requests ({regularRequests.length})
          </TabsTrigger>
          <TabsTrigger className="w-full" value="urgent">
            🚨 Urgent Requests ({urgentRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* Regular Tab */}
        <TabsContent value="regular">
          <RequestsTab
            title="Blood Requests from Patients"
            requests={getCurrentPageData(regularRequests)}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            onFindDonors={(req: PatientRequest) => {
              setSelectedRequest(req);
              fetchAvailableDonors(req);
              setDonorDialogOpen(true);
            }}
            isUrgent={false}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={getTotalPages(regularRequests)}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        {/* Urgent Tab */}
        <TabsContent value="urgent">
          <RequestsTab
            title="🚨 Urgent Blood Requests"
            requests={getCurrentPageData(urgentRequests)}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            onFindDonors={(req: PatientRequest) => {
              setSelectedRequest(req);
              fetchAvailableDonors(req);
              setDonorDialogOpen(true);
            }}
            isUrgent={true}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={getTotalPages(urgentRequests)}
            onPageChange={setCurrentPage}
          />
        </TabsContent>
      </Tabs>

      {/* Donor Matching Dialog */}
      <Dialog open={donorDialogOpen} onOpenChange={setDonorDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Match Donors to Blood Request
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Info Card */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Patient</p>
                      <p className="font-semibold">{selectedRequest.p_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Blood Type</p>
                      <p className="font-semibold text-red-600">{selectedRequest.p_bloodgroup}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Quantity</p>
                      <p className="font-semibold">{selectedRequest.p_quantityRequirment} units</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Urgency</p>
                      <Badge className={selectedRequest.p_urgencyRequirment?.includes("immediate") || selectedRequest.p_urgencyRequirment?.includes("24") ? "bg-red-600" : "bg-yellow-600"}>
                        {selectedRequest.p_urgencyRequirment}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Sort by:</span>
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">📍 Distance (Nearest First)</SelectItem>
                    <SelectItem value="matchScore">⭐ Match Score (Best First)</SelectItem>
                    <SelectItem value="experience">🏆 Experience (Most Donations)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="ml-auto text-sm text-gray-600">
                  {filteredDonors.length} eligible donor(s) found
                </div>
              </div>

              {/* Donor Cards Grid */}
              {matchingLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading available donors...</p>
                </div>
              ) : filteredDonors.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No eligible donors found matching criteria</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  {filteredDonors.map((donor) => (
                    <DonorMatchCard
                      key={donor.id}
                      donor={donor}
                      onLink={() => linkDonorToRequest(donor.id, selectedRequest)}
                      isUrgent={selectedRequest.p_urgencyRequirment === "immediate" || selectedRequest.p_urgencyRequirment === "within_24_hours"}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDonorDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}

// Requests Tab Component
function RequestsTab({
  title,
  requests,
  onAccept,
  onReject,
  onFindDonors,
  isUrgent
}: {
  title: string;
  requests: PatientRequest[];
  onAccept: (id: string, date: Date) => void;
  onReject: (id: string) => void;
  onFindDonors: (req: PatientRequest) => void;
  isUrgent: boolean;
}) {
  return (
    <div>
      <div className="px-2 mb-6">
        <h2 className={`text-2xl font-semibold ${isUrgent ? 'text-red-600' : ''}`}>
          {title}
        </h2>
        <p className="text-foreground text-md mt-3">
          Here you can match donors or manually schedule appointments.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-8">
          <p className="text-center text-gray-500">
            No {isUrgent ? 'urgent' : 'regular'} patient requests at this time.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onAccept={onAccept}
              onReject={onReject}
              onFindDonors={onFindDonors}
              isUrgent={isUrgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual Request Card Component
function RequestCard({
  request,
  onAccept,
  onReject,
  onFindDonors,
  isUrgent
}: {
  request: PatientRequest;
  onAccept: (id: string, date: Date) => void;
  onReject: (id: string) => void;
  onFindDonors: (req: PatientRequest) => void;
  isUrgent: boolean;
}) {
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      immediate: { color: "bg-red-600", label: "🚨 IMMEDIATE" },
      within_24_hours: { color: "bg-orange-500", label: "⚡ Within 24hrs" },
      within_3_days: { color: "bg-yellow-500", label: "📅 Within 3 days" },
      no_rush: { color: "bg-green-500", label: "✓ No Rush" },
    };
    const badge = variants[urgency] || variants.no_rush;
    return (
      <Badge className={`${badge.color} text-white`}>
        {badge.label}
      </Badge>
    );
  };

  const handleAcceptClick = () => {
    if (!appointmentDate) {
      alert("Please select an appointment date first");
      return;
    }
    onAccept(request.id, appointmentDate);
    setShowDatePicker(false);
  };

  return (
    <Card className={`${isUrgent ? 'border-red-500 border-2' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">🐕 {request.p_name}</CardTitle>
          {getUrgencyBadge(request.p_urgencyRequirment)}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Blood Info */}
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-red-500" />
          <span className="font-semibold">{request.p_bloodgroup}</span>
          <span className="text-sm text-gray-500">
            ({request.p_quantityRequirment} units)
          </span>
        </div>

        {/* Reason */}
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Reason:</span> {request.p_reasonRequirment}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          <span>{request.p_city}</span>
        </div>

        {/* Contact */}
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <a href={`tel:${request.phone}`} className="text-blue-600 hover:underline">
              {request.phone}
            </a>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {/* Find Donors Button - PRIMARY ACTION */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={() => onFindDonors(request)}
        >
          <Users className="h-4 w-4 mr-2" />
          Find & Match Donors
          {request.pendingMatches ? (
            <Badge className="ml-2 bg-yellow-400 text-black hover:bg-yellow-500">{request.pendingMatches}</Badge>
          ) : null}
        </Button>

        {/* Divider */}
        <div className="relative w-full py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or Manual</span>
          </div>
        </div>

        {/* Date Picker */}
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs">
              <CalendarIcon className="mr-2 h-3 w-3" />
              {appointmentDate ? format(appointmentDate, "PPP") : "Schedule Manually"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={appointmentDate}
              onSelect={setAppointmentDate}
              disabled={(date) => date < new Date()}
            />
          </PopoverContent>
        </Popover>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full">
          <Button
            onClick={handleAcceptClick}
            className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
            disabled={!appointmentDate}
          >
            Direct Schedule
          </Button>
          <Button
            onClick={() => onReject(request.id)}
            variant="ghost"
            className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Reject
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// Donor Match Card Component
function DonorMatchCard({ donor, onLink, isUrgent }: any) {
  return (
    <Card className={`
      transition-all hover:shadow-lg
      ${donor.alreadyLinked ? "opacity-75 bg-gray-50 dark:bg-gray-800" : ""}
      ${donor.isSameCity ? "border-green-500 border-2" : ""}
      ${!donor.isEligible || !donor.isMedicallyFit ? "border-orange-500" : ""}
    `}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="font-bold text-lg">{donor.name}</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {donor.city}
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge className="bg-purple-600 text-xs">
              Score: {donor.matchScore}
            </Badge>
            {donor.isSameCity && (
              <Badge className="bg-green-500 text-xs text-white">Same City</Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-red-50 dark:bg-red-950/20 rounded p-2">
            <p className="text-gray-600">Blood Type</p>
            <p className="font-semibold text-red-600">{donor.bloodType}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2">
            <p className="text-gray-600">Weight</p>
            <p className="font-semibold">{donor.weight || "N/A"} kg</p>
          </div>
        </div>

        {/* Experience */}
        <div className="flex items-center gap-2 text-xs mt-2">
          <span className="text-gray-600">Donations:</span>
          <Badge variant="outline" className="text-xs">{donor.donationCount}</Badge>
          {donor.lastDonation && (
            <span className="text-gray-500 ml-auto">
              Last: {format(new Date(donor.lastDonation), "MMM yyyy")}
            </span>
          )}
        </div>

        {/* Eligibility Indicators */}
        <div className="space-y-1 text-xs mt-2">
          {!donor.isEligible && (
            <div className="flex items-center gap-1 text-orange-600">
              <X className="h-3 w-3" />
              <span>Recently donated (wait period)</span>
            </div>
          )}
          {!donor.isMedicallyFit && (
            <div className="flex items-center gap-1 text-orange-600">
              <X className="h-3 w-3" />
              <span>Medical condition or low weight</span>
            </div>
          )}
          {donor.isEligible && donor.isMedicallyFit && (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              <span>Eligible & Fit</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {donor.alreadyLinked ? (
            <Button disabled className="w-full" size="sm" variant="secondary">
              <Check className="h-4 w-4 mr-2" />
              Matched / Linked
            </Button>
          ) : (
            <Button
              onClick={onLink}
              className={`w-full ${isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
              size="sm"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Link to Request
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Pagination Component
function Pagination({
  currentPage,
  totalPages,
  onPageChange
}: {
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
