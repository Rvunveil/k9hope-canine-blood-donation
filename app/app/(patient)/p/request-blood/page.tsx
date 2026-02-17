"use client";

import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { SquareUserRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Firebase imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, addDoc, query, where, getDocs, doc, getDoc, orderBy, Timestamp } from "firebase/firestore";

export default function RequestBloodPage() {
  const { userId } = useUser();
  const [bloodRequests, setBloodRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Dialog states
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [urgency, setUrgency] = useState("no");
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);

  // Add Hospital states
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospitalData, setNewHospitalData] = useState({
    name: "",
    address: "",
    city: "",
    pincode: "",
    phone: "",
    landmark: "",
  });

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      if (!userId) return;
      try {
        const profileDoc = await getDoc(doc(db, "patients", userId));
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setProfile(data);
          // Set default city for new hospital
          setNewHospitalData(prev => ({ ...prev, city: data.p_city || "Chennai" }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    }
    fetchProfile();
  }, [userId]);

  // Fetch hospitals based on city
  useEffect(() => {
    async function fetchHospitals() {
      try {
        const hospitalsRef = collection(db, "hospitals");
        // Convert to lowercase for loose matching or keep exact if data is clean
        // For now using exact match as in existing code, but fallback to "Chennai"
        const cityToQuery = profile?.p_city || "Chennai";

        const q = query(hospitalsRef, where("h_city", "==", cityToQuery));
        const snapshot = await getDocs(q);

        const hospitalsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().h_name,
          city: doc.data().h_city,
          isVerified: doc.data().isVerified || false,
        }));

        setHospitals(hospitalsData);
      } catch (error) {
        console.error("Error fetching hospitals:", error);
      }
    }

    if (profile) {
      fetchHospitals();
    }
  }, [profile]);

  async function handleAddNewHospital() {
    if (!newHospitalData.name || !newHospitalData.address || !newHospitalData.phone) {
      alert("Please fill all required fields");
      return;
    }

    try {
      // Create new hospital record
      const hospitalData = {
        h_name: newHospitalData.name,
        h_address_line1: newHospitalData.address,
        h_city: newHospitalData.city,
        h_pincode: newHospitalData.pincode,
        phone: newHospitalData.phone,
        h_landmark: newHospitalData.landmark,

        // Patient-added metadata
        addedBy: "patient",
        addedByUserId: userId,
        addedByPatientName: profile?.p_name || "Patient",

        // Verification status
        isVerified: false,
        isPending: true,

        // Auto-generated
        email: "", // Admin will add later
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),

        // Default values
        onboarded: "no",
        role: "veterinary",
      };

      const docRef = await addDoc(collection(db, "hospitals"), hospitalData);

      // Also add to pending-hospitals collection for admin review
      await addDoc(collection(db, "pending-hospitals"), {
        ...hospitalData,
        hospitalId: docRef.id,
        status: "pending_verification",
        requestedAt: Timestamp.now(),
      });

      alert("✅ Hospital added! You can now select it for your blood request.");

      // Refresh hospitals list locally to include the new one immediately
      setHospitals(prev => [...prev, {
        id: docRef.id,
        name: newHospitalData.name,
        city: newHospitalData.city,
        isVerified: false,
      }]);

      // Select the new hospital automatically
      setSelectedHospital(docRef.id);

      // Close dialog
      setShowAddHospital(false);

      // Reset form
      setNewHospitalData({
        name: "",
        address: "",
        city: profile?.p_city || "Chennai",
        pincode: "",
        phone: "",
        landmark: "",
      });

    } catch (error) {
      console.error("Error adding hospital:", error);
      alert("❌ Failed to add hospital. Please try again.");
    }
  }

  // Fetch blood requests
  useEffect(() => {
    if (userId) fetchBloodRequests();
  }, [userId]);

  async function fetchBloodRequests() {
    setLoading(true);
    try {
      const requestsQuery = query(
        collection(db, "blood_requests"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(requestsQuery);
      const requests = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Check admin's veterinary-donor-requests for status
        let adminStatus = "Pending";
        let matchedDonorsCount = 0;

        if (data.requestId) {
          const adminRequestRef = doc(db, "veterinary-donor-requests", data.requestId);
          const adminRequestSnap = await getDoc(adminRequestRef);

          if (adminRequestSnap.exists()) {
            const adminData = adminRequestSnap.data();
            adminStatus = adminData.status;

            // Count appointments (matched donors)
            const appointmentsRef = collection(db, "donor-appointments");
            const appointmentsQuery = query(
              appointmentsRef,
              where("requestId", "==", data.requestId)
            );
            const appointmentsSnap = await getDocs(appointmentsQuery);
            matchedDonorsCount = appointmentsSnap.size;
          }
        }

        requests.push({
          id: docSnap.id,
          ...data,
          adminStatus: adminStatus,
          matchedDonors: matchedDonorsCount,
        });
      }

      setBloodRequests(requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  }

  const handlePostRequest = async () => {
    if (!userId || !profile || !selectedHospital) {
      alert("Please select a hospital");
      return;
    }

    try {
      // Create request that admin will see in donor-management
      const requestData = {
        clinicId: selectedHospital,
        bloodTypeNeeded: profile.p_bloodgroup,
        quantityNeeded: parseInt(quantity) || profile.p_quantityRequirment || 450,
        isUrgent: urgency,
        reason: reason || profile.p_reasonRequirment || "Blood transfusion needed",
        linkedPatientId: userId,
        linkedPatientName: profile.p_name,
        status: "open",
        requestExpires: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdAt: Timestamp.now(),
        createdBy: "patient",
      };

      const docRef = await addDoc(collection(db, "veterinary-donor-requests"), requestData);

      // Also create in blood_requests for patient tracking
      await addDoc(collection(db, "blood_requests"), {
        userId,
        requestId: docRef.id,
        dogName: profile.p_name,
        bloodType: profile.p_bloodgroup,
        location: profile.p_city || "Chennai",
        urgency,
        reason,
        status: "Pending Admin Approval",
        createdAt: Timestamp.now(),
        quantity: parseInt(quantity) || 450,
      });

      alert("✅ Blood request submitted to hospital! Admin will process your request.");
      setRequestDialogOpen(false);

      // Refresh requests
      fetchBloodRequests();

    } catch (error) {
      console.error("Error creating request:", error);
      alert("❌ Failed to submit request");
    }
  };

  return (
    <ContentLayout title="Request Blood">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
        <div className="px-2">
          <div className="flex items-center gap-2">
            <SquareUserRound className="h-6 w-6" />
            <h2 className="text-2xl font-semibold">Canine Blood Requests</h2>
          </div>
          <p className="text-foreground text-md mt-3">
            Here you will find <span className="text-accent">Veterinary Clinics</span> to submit <span className="text-accent">Canine Blood Requests</span> to.
          </p>
          <p className="text-foreground text-sm mt-3">
            Chennai network veterinary services for your canine companion's blood needs.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">🐕 Your Canine Blood Requests</CardTitle>
            <Button onClick={() => setRequestDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Blood Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-500">Loading requests...</p>
          ) : bloodRequests.length === 0 ? (
            <p className="text-center text-gray-500">No canine blood requests found. Post your first request above!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dog Name</TableHead>
                  <TableHead>DEA Blood Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Matched Donors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bloodRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.dogName || "N/A"}</TableCell>
                    <TableCell>{request.bloodType || "N/A"}</TableCell>
                    <TableCell>{request.location || "Chennai"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        request.adminStatus === "open" ? "default" :
                          request.adminStatus === "closed" ? "secondary" :
                            "outline"
                      }>
                        {request.adminStatus === "open" ? "Active" :
                          request.adminStatus === "closed" ? "Completed" :
                            request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.matchedDonors > 0 ? (
                        <Badge className="bg-green-500">
                          {request.matchedDonors} Donor(s) Matched
                        </Badge>
                      ) : (
                        <span className="text-gray-500 text-sm">Searching...</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label>Select Hospital *</Label>

          <div className="space-y-2">
            {/* Hospital Selector */}
            <Select value={selectedHospital} onValueChange={setSelectedHospital}>
              <SelectTrigger>
                <SelectValue placeholder="Choose hospital" />
              </SelectTrigger>
              <SelectContent>
                {hospitals.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hospitals found in {profile?.p_city}
                  </SelectItem>
                ) : (
                  hospitals.map(hospital => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      <div className="flex items-center gap-2">
                        <span>{hospital.name}</span>
                        {hospital.isVerified && (
                          <Badge className="bg-green-500 text-xs h-5">✓ Verified</Badge>
                        )}
                        {!hospital.isVerified && (
                          <Badge variant="outline" className="text-xs h-5 text-orange-500 border-orange-500">Pending</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Add Hospital Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowAddHospital(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Hospital not listed? Add new hospital
            </Button>
          </div>
        </div>

        <div>
          <Label>Blood Type: {profile?.p_bloodgroup}</Label>
          <p className="text-xs text-gray-500">From your profile</p>
        </div>

        <div>
          <Label>Urgency Level *</Label>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">🚨 Urgent (Within 24 hours)</SelectItem>
              <SelectItem value="no">⏰ Normal (Within 7 days)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Quantity Needed (ml)</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="450"
          />
        </div>

        <div>
          <Label>Reason for Request</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why blood is needed..."
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
          Cancel
        </Button>
        <Button onClick={handlePostRequest} className="bg-red-600 hover:bg-red-700">
          Submit Request
        </Button>
      </DialogFooter>
    </DialogContent>
      </Dialog >

    {/* Add Hospital Dialog */ }
    < Dialog open = { showAddHospital } onOpenChange = { setShowAddHospital } >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Your Hospital/Clinic</DialogTitle>
          <p className="text-sm text-gray-500">
            Where are you currently getting treatment for your dog?
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Hospital/Clinic Name *</Label>
            <Input
              placeholder="e.g., Blue Cross Veterinary Clinic"
              value={newHospitalData.name}
              onChange={(e) => setNewHospitalData({ ...newHospitalData, name: e.target.value })}
            />
          </div>

          <div>
            <Label>Complete Address *</Label>
            <Textarea
              placeholder="Street, Area, Locality"
              value={newHospitalData.address}
              onChange={(e) => setNewHospitalData({ ...newHospitalData, address: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>City</Label>
              <Input
                value={newHospitalData.city}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, city: e.target.value })}
              />
            </div>

            <div>
              <Label>Pincode</Label>
              <Input
                placeholder="600001"
                value={newHospitalData.pincode}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, pincode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Hospital Phone Number *</Label>
            <Input
              placeholder="044 1234 5678"
              value={newHospitalData.phone}
              onChange={(e) => setNewHospitalData({ ...newHospitalData, phone: e.target.value })}
            />
          </div>

          <div>
            <Label>Nearby Landmark (Optional)</Label>
            <Input
              placeholder="e.g., Near Central Railway Station"
              value={newHospitalData.landmark}
              onChange={(e) => setNewHospitalData({ ...newHospitalData, landmark: e.target.value })}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>ℹ️ Note:</strong> This hospital will be added to our network and
              reviewed by admin. Donors will be able to see this location for blood donation.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddHospital(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddNewHospital} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Hospital
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog >
    </ContentLayout >
  );
}
