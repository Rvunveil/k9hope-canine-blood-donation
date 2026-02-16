"use client";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Phone, Mail, MapPin, Droplet, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
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
        if (status === "pending" || !data.request_status) {
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
        // Sort immediate first, then by creation date
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

      console.log(`Fetched ${urgent.length} urgent and ${regular.length} regular requests`);
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

      // Refresh data
      fetchPatientRequests();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast({
        title: "Error",
        description: "Failed to accept request. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleRejectRequest(patientId: string) {
    if (!confirm("Are you sure you want to reject this blood request?")) {
      return;
    }

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

      // Refresh data
      fetchPatientRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: "Failed to reject request. Please try again.",
        variant: "destructive",
      });
    }
  }

  // Pagination logic
  const getCurrentPageData = () => {
    const data = activeTab === "urgent" ? urgentRequests : regularRequests;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const data = activeTab === "urgent" ? urgentRequests : regularRequests;
    return Math.ceil(data.length / itemsPerPage);
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
            requests={getCurrentPageData()}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            isUrgent={false}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={getTotalPages()}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        {/* Urgent Tab */}
        <TabsContent value="urgent">
          <RequestsTab
            title="🚨 Urgent Blood Requests"
            requests={getCurrentPageData()}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            isUrgent={true}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={getTotalPages()}
            onPageChange={setCurrentPage}
          />
        </TabsContent>
      </Tabs>
    </ContentLayout>
  );
}

// Requests Tab Component
function RequestsTab({
  title,
  requests,
  onAccept,
  onReject,
  isUrgent
}: {
  title: string;
  requests: PatientRequest[];
  onAccept: (id: string, date: Date) => void;
  onReject: (id: string) => void;
  isUrgent: boolean;
}) {
  return (
    <div>
      <div className="px-2 mb-6">
        <h2 className={`text-2xl font-semibold ${isUrgent ? 'text-red-600' : ''}`}>
          {title}
        </h2>
        <p className="text-foreground text-md mt-3">
          Here you can:
        </p>
        <ul className="list-disc list-inside text-foreground mt-2 space-y-2">
          <li>
            Accept blood requests from <span className="text-accent">patients</span> and schedule appointments.
          </li>
          <li>
            Reject blood requests that cannot be fulfilled.
          </li>
        </ul>
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
  isUrgent
}: {
  request: PatientRequest;
  onAccept: (id: string, date: Date) => void;
  onReject: (id: string) => void;
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
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${request.email}`} className="text-blue-600 hover:underline text-xs">
              {request.email}
            </a>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
          <div className="font-semibold">Emergency Contact:</div>
          <div>{request.emergency_contact_name}</div>
          <div className="text-xs text-blue-600">{request.emergency_contact_phone}</div>
        </div>

        {/* Dog Details */}
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {request.p_gender} -  {request.p_weight_kg}kg
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {/* Date Picker */}
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {appointmentDate ? format(appointmentDate, "PPP") : "Select appointment date"}
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
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={!appointmentDate}
          >
            Accept
          </Button>
          <Button
            onClick={() => onReject(request.id)}
            variant="destructive"
            className="flex-1"
          >
            Reject
          </Button>
        </div>
      </CardFooter>
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
