"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, orderBy } from "firebase/firestore";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Clock, Droplet, MapPin, Phone, Mail, ChevronDown, Search, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import HeartLoading from "@/components/custom/HeartLoading";
import Link from "next/link";

interface UrgentRequest {
  id: string;
  bloodTypeNeeded: string;
  quantityNeeded: number;
  isUrgent: string;
  reason: string;
  requestExpires: any;
  clinicId: string;
  clinicName: string;
  clinicPhone: string;
  clinicEmail: string;
  clinicCity: string;
  clinicAddress: string;
  linkedPatientName?: string;
  status: string;
  createdAt: any;
}

export default function UrgentDonationsPage() {
  const { userId, role } = useUser();
  const router = useRouter();

  const [donorProfile, setDonorProfile] = useState<any>(null);
  const [urgentRequests, setUrgentRequests] = useState<UrgentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<UrgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("nearest");

  // Booking dialog states
  const [selectedRequest, setSelectedRequest] = useState<UrgentRequest | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!userId || role !== "donor") {
      router.push("/");
      return;
    }

    fetchAllData();
  }, [userId, role, router]);

  async function fetchAllData() {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch donor profile
      const donorRef = doc(db, "donors", userId);
      const donorSnap = await getDoc(donorRef);

      if (!donorSnap.exists()) {
        console.error("Donor not found");
        setLoading(false);
        return;
      }

      const donorData = donorSnap.data();
      setDonorProfile(donorData);

      // Fetch urgent requests from admin
      await fetchUrgentRequestsFromAdmin(donorData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUrgentRequestsFromAdmin(donorData: any) {
    try {
      const requestsRef = collection(db, "veterinary-donor-requests");

      // Query: Open requests, matching blood type, urgent priority
      const q = query(
        requestsRef,
        where("status", "==", "open"),
        where("bloodTypeNeeded", "==", donorData.d_bloodgroup),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const requests: UrgentRequest[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Fetch clinic details
        const clinicRef = doc(db, "hospitals", data.clinicId);
        const clinicSnap = await getDoc(clinicRef);

        if (!clinicSnap.exists()) continue;

        const clinicData = clinicSnap.data();

        requests.push({
          id: docSnap.id,
          bloodTypeNeeded: data.bloodTypeNeeded,
          quantityNeeded: data.quantityNeeded,
          isUrgent: data.isUrgent,
          reason: data.reason,
          requestExpires: data.requestExpires,
          clinicId: data.clinicId,
          clinicName: clinicData.h_name || "Veterinary Clinic",
          clinicPhone: clinicData.phone || "",
          clinicEmail: clinicData.email || "",
          clinicCity: clinicData.h_city || "",
          clinicAddress: `${clinicData.h_address_line1 || ""}, ${clinicData.h_city || ""}`,
          linkedPatientName: data.linkedPatientName,
          status: data.status,
          createdAt: data.createdAt,
          isVerified: clinicData.isVerified || false, // Added
        });
      }

      // Filter only urgent requests
      const urgent = requests.filter(r => r.isUrgent === "yes");
      setUrgentRequests(urgent);
      setFilteredRequests(urgent);

    } catch (error) {
      console.error("Error fetching urgent requests:", error);
      setUrgentRequests([]);
      setFilteredRequests([]);
    }
  }

  // Search and sort
  useEffect(() => {
    let filtered = [...urgentRequests];

    if (searchQuery) {
      filtered = filtered.filter(req =>
        req.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.clinicCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.linkedPatientName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortBy === "nearest") {
      filtered.sort((a, b) => {
        const aMatch = a.clinicCity.toLowerCase() === donorProfile?.d_city.toLowerCase() ? 0 : 1;
        const bMatch = b.clinicCity.toLowerCase() === donorProfile?.d_city.toLowerCase() ? 0 : 1;
        return aMatch - bMatch;
      });
    } else if (sortBy === "recent") {
      filtered.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
    }

    setFilteredRequests(filtered);
  }, [searchQuery, sortBy, urgentRequests, donorProfile]);

  async function handleBookAppointment() {
    if (!selectedRequest || !appointmentDate) {
      alert("Please select a date for your appointment");
      return;
    }

    try {
      const appointmentData = {
        requestId: selectedRequest.id,
        donorId: userId,
        donorName: donorProfile.d_name,
        donorPhone: donorProfile.phone,
        donorEmail: donorProfile.email,
        dogName: donorProfile.d_name,
        dogWeight: donorProfile.d_weight_kg,
        dogBloodType: donorProfile.d_bloodgroup,
        clinicId: selectedRequest.clinicId,
        clinicName: selectedRequest.clinicName,
        appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
        appointmentTime: appointmentTime || "TBD",
        status: "pending",
        notes: notes || "",
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "donor-appointments"), appointmentData);

      alert("✅ Appointment booked successfully! The clinic will confirm shortly.");
      setBookingDialogOpen(false);
      resetBookingForm();

      // Refresh to show updated appointment count
      router.push("/app/d/appointments");

    } catch (error) {
      console.error("Error booking appointment:", error);
      alert("❌ Failed to book appointment. Please try again.");
    }
  }

  function resetBookingForm() {
    setSelectedRequest(null);
    setAppointmentDate(undefined);
    setAppointmentTime("");
    setNotes("");
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <HeartLoading />
      </div>
    );
  }

  return (
    <ContentLayout title="Urgent Donations">
      <div className="space-y-6">
        {/* Hero Section */}
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-3">🚨 Urgent Blood Requests</h2>
                <p className="text-red-50 text-lg mb-2">
                  Lives are at risk. Urgent blood donations are needed at the clinics listed below.
                </p>
                <p className="text-red-50 text-lg">
                  Your donation can be the difference between life and death.
                </p>

                <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5" />
                    <span>Your blood group: <strong>{donorProfile?.d_bloodgroup || "Unknown"}</strong></span>
                  </div>
                  <p className="text-sm text-red-50 mt-2">
                    Showing only requests matching your blood type and urgent priority.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search by clinic name or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border rounded-lg min-w-[200px]"
              >
                <option value="nearest">Nearest first</option>
                <option value="recent">Most recent</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Request Cards */}
        {filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {filteredRequests.map((request) => (
              <UrgentRequestCard
                key={request.id}
                request={request}
                donorCity={donorProfile?.d_city}
                onBookAppointment={() => {
                  setSelectedRequest(request);
                  setBookingDialogOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No urgent requests matching your profile right now
              </h3>
              <p className="text-gray-500 mb-6">
                Check back soon or explore nearby donation opportunities
              </p>
              <Link href="/app/d/donate/nearby">
                <Button className="bg-blue-500 hover:bg-blue-600">
                  View Nearby Clinics
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book Donation Appointment</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Info */}
              <Card className="bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">🏥 {selectedRequest.clinicName}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <strong>Blood Type:</strong> {selectedRequest.bloodTypeNeeded}
                    </div>
                    <div>
                      <strong>Quantity:</strong> {selectedRequest.quantityNeeded}ml
                    </div>
                    <div className="col-span-2">
                      <strong>Location:</strong> {selectedRequest.clinicAddress}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Appointment Details */}
              <div className="space-y-4">
                <div>
                  <Label>Preferred Appointment Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {appointmentDate ? format(appointmentDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={appointmentDate}
                        onSelect={setAppointmentDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Preferred Time (Optional)</Label>
                  <Input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Clinic will confirm the exact time
                  </p>
                </div>

                <div>
                  <Label>Additional Notes (Optional)</Label>
                  <Input
                    placeholder="Any special requirements or questions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Contact Info */}
              <Card className="bg-gray-50 dark:bg-gray-900">
                <CardContent className="p-4 space-y-2">
                  <h5 className="font-semibold text-sm">Clinic Contact Information:</h5>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${selectedRequest.clinicPhone}`} className="text-blue-600 hover:underline">
                      {selectedRequest.clinicPhone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${selectedRequest.clinicEmail}`} className="text-blue-600 hover:underline">
                      {selectedRequest.clinicEmail}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBookAppointment} className="bg-red-600 hover:bg-red-700">
              Confirm Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}

// Urgent Request Card Component
function UrgentRequestCard({ request, donorCity, onBookAppointment }: any) {
  const [expanded, setExpanded] = useState(false);
  const isSameCity = request.clinicCity.toLowerCase() === donorCity?.toLowerCase();

  return (
    <Card className="border-red-500 border-l-4 hover:shadow-lg transition-all">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl flex items-center gap-2">
              🏥 {request.clinicName}
              {request.isVerified && (
                <Badge className="bg-blue-500 text-xs">✓ Verified</Badge>
              )}
            </CardTitle>
            {request.linkedPatientName && (
              <p className="text-sm text-gray-600 mt-1">
                For patient: <strong>{request.linkedPatientName}</strong>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-red-600">🚨 Urgent</Badge>
            {isSameCity && (
              <Badge className="bg-green-500">Your City</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Droplet className="w-4 h-4 text-red-600" />
              <p className="text-xs text-gray-600">Blood Type</p>
            </div>
            <p className="text-lg font-bold text-red-600">{request.bloodTypeNeeded}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Location</p>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">{request.clinicCity}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Droplet className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-600">Needed</p>
            </div>
            <p className="text-lg font-bold text-blue-600">{request.quantityNeeded}ml</p>
          </div>
        </div>

        {/* Reason */}
        {request.reason && (
          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Reason:</p>
                <p className="text-sm text-gray-800">{request.reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Expand Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-gray-600 hover:text-gray-900 py-2 border-t border-gray-200 transition-colors"
        >
          <span className="font-medium text-sm">
            {expanded ? "Hide" : "View"} Clinic Details
          </span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-blue-600" />
              <a href={`tel:${request.clinicPhone}`} className="text-blue-600 hover:underline">
                {request.clinicPhone}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-blue-600" />
              <a href={`mailto:${request.clinicEmail}`} className="text-blue-600 hover:underline text-xs">
                {request.clinicEmail}
              </a>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
              <span className="text-gray-700">{request.clinicAddress}</span>
            </div>
            {request.requestExpires && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <Clock className="w-4 h-4" />
                <span>
                  Expires: {format(request.requestExpires.toDate(), "PPP")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onBookAppointment}
            className="flex-1 bg-red-600 hover:bg-red-700 h-12 text-lg font-bold"
          >
            🩸 Book Appointment
          </Button>
          <Button variant="outline" className="sm:w-auto px-6">
            Share Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}