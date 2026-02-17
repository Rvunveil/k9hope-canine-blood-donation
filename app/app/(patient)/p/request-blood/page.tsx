// @ts-nocheck
"use client";

import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { SquareUserRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, addDoc, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";

export default function RequestBloodPage() {
  const { userId } = useUser();
  const [bloodRequests, setBloodRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [showAddHospital, setShowAddHospital] = useState(false);

  // Form states
  const [selectedHospital, setSelectedHospital] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [urgency, setUrgency] = useState("no");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // New hospital form states
  const [newHospitalData, setNewHospitalData] = useState({
    name: "",
    address: "",
    city: "Chennai",
    pincode: "",
    phone: "",
    landmark: "",
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  async function fetchData() {
    if (!userId) return;

    try {
      const profileDoc = await getDoc(doc(db, "patients", userId));
      if (profileDoc.exists()) {
        setProfile(profileDoc.data());
        setNewHospitalData(prev => ({ ...prev, city: profileDoc.data().p_city || "Chennai" }));
      }

      const requestsQuery = query(
        collection(db, "blood_requests"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(requestsQuery);
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBloodRequests(requests);

      await fetchHospitals(profileDoc.data()?.p_city || "Chennai");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHospitals(city: string) {
    try {
      const hospitalsRef = collection(db, "hospitals");
      const q = query(hospitalsRef, where("h_city", "==", city));
      const snapshot = await getDocs(q);

      const hospitalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().h_name,
        city: doc.data().h_city,
        isVerified: doc.data().isVerified || false,
      }));

      setHospitals(hospitalsData);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function handleAddNewHospital() {
    if (!newHospitalData.name || !newHospitalData.address || !newHospitalData.phone) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const hospitalData = {
        h_name: newHospitalData.name,
        h_address_line1: newHospitalData.address,
        h_city: newHospitalData.city,
        h_pincode: newHospitalData.pincode,
        phone: newHospitalData.phone,
        h_landmark: newHospitalData.landmark,
        addedBy: "patient",
        addedByUserId: userId,
        isVerified: false,
        isPending: true,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, "hospitals"), hospitalData);

      // Also add to pending-hospitals collection for admin review
      await addDoc(collection(db, "pending-hospitals"), {
        ...hospitalData,
        hospitalId: docRef.id,
        status: "pending_verification",
        requestedAt: Timestamp.now(),
      });

      alert("✅ Hospital added successfully!");
      setHospitals([...hospitals, { id: docRef.id, name: newHospitalData.name, city: newHospitalData.city, isVerified: false }]);
      setSelectedHospital(docRef.id);
      setShowAddHospital(false);

      setNewHospitalData({
        name: "",
        address: "",
        city: profile?.p_city || "Chennai",
        pincode: "",
        phone: "",
        landmark: "",
      });
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to add hospital");
    }
  }

  async function handlePostRequest() {
    if (!userId || !profile || !selectedHospital) {
      alert("Please select a hospital");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "veterinary-donor-requests"), {
        clinicId: selectedHospital,
        bloodTypeNeeded: profile.p_bloodgroup,
        quantityNeeded: parseInt(quantity) || 450,
        isUrgent: urgency,
        reason: reason || "Blood transfusion needed",
        linkedPatientId: userId,
        linkedPatientName: profile.p_name,
        status: "open",
        createdAt: Timestamp.now(),
      });

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

      alert("✅ Blood request submitted!");
      setRequestDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to submit request");
    }
  }

  return (
    <ContentLayout title="Request Blood">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Blood Requests</CardTitle>
              <Button onClick={() => setRequestDialogOpen(true)} className="bg-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : bloodRequests.length === 0 ? (
              <p>No requests found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blood Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bloodRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.bloodType}</TableCell>
                      <TableCell><Badge>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Blood Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select Hospital *</Label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose hospital" />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map(hospital => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 border-dashed"
                onClick={() => setShowAddHospital(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Hospital
              </Button>
            </div>

            <div>
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">🚨 Urgent</SelectItem>
                  <SelectItem value="no">⏰ Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity (ml)</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="450"
              />
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for request..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePostRequest} className="bg-red-600">
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Hospital Dialog */}
      <Dialog open={showAddHospital} onOpenChange={setShowAddHospital}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Hospital</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Hospital Name *</Label>
              <Input
                value={newHospitalData.name}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Address *</Label>
              <Textarea
                value={newHospitalData.address}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, address: e.target.value })}
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
                  value={newHospitalData.pincode}
                  onChange={(e) => setNewHospitalData({ ...newHospitalData, pincode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Phone *</Label>
              <Input
                value={newHospitalData.phone}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, phone: e.target.value })}
              />
            </div>

            <div>
              <Label>Landmark</Label>
              <Input
                value={newHospitalData.landmark}
                onChange={(e) => setNewHospitalData({ ...newHospitalData, landmark: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddHospital(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewHospital} className="bg-green-600">
              Add Hospital
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}
