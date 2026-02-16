"use client";

import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { History, AlertTriangle, Calendar, MapPin, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Firebase imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy } from "firebase/firestore";

interface Appointment {
  id: string;
  type?: string;
  procedureType?: string;
  clinicName?: string;
  date?: string;
  completedDate?: string;
  notes?: string;
  medicalNotes?: string;
  status?: string;
  donorName?: string;
  quantityReceived?: string;
}

export default function HistoryPage() {
  const { userId } = useUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [hasTransfusion, setHasTransfusion] = useState(false);
  const [transfusionCount, setTransfusionCount] = useState(0);

  // Fetch user profile and completed appointments
  useEffect(() => {
    async function fetchCompletedAppointments() {
      if (!userId) return;

      try {
        // Fetch profile
        const profileDoc = await getDoc(doc(db, "patients", userId));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data());
        }

        // Fetch user data
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }

        // Fetch completed appointments from admin's donor-appointments
        const appointmentsRef = collection(db, "donor-appointments");
        const q = query(
          appointmentsRef,
          where("linkedPatientId", "==", userId),
          where("status", "==", "completed"),
          orderBy("completedAt", "desc") // Assuming admin sets this timestamp
        );

        const snapshot = await getDocs(q);
        const history: Appointment[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // Fetch clinic details
          const clinicRef = doc(db, "hospitals", data.clinicId);
          const clinicSnap = await getDoc(clinicRef);
          const clinicData = clinicSnap.exists() ? clinicSnap.data() : {};

          history.push({
            id: docSnap.id,
            type: "Blood Transfusion",
            procedureType: `${data.dogBloodType} Transfusion`,
            clinicName: clinicData.h_name || "Veterinary Clinic",
            date: data.completedAt ? data.completedAt.toDate().toISOString() : data.appointmentDate,
            completedDate: data.completedAt ? data.completedAt.toDate().toISOString() : "",
            notes: data.notes,
            medicalNotes: `Received ${data.quantityDonated || "450ml"} of ${data.dogBloodType} blood`,
            donorName: data.donorName,
            quantityReceived: data.quantityDonated || "450ml",
            status: "Completed",
          });
        }

        setAppointments(history);
        setTransfusionCount(history.length);

        // Check sensitization
        if (history.length > 0) {
          setHasTransfusion(true);
          await updateSensitizationStatus();
        }

      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCompletedAppointments();
  }, [userId]);

  // Update user record to indicate sensitization
  const updateSensitizationStatus = async () => {
    try {
      const userDocRef = doc(db, "users", userId);
      // We also update patients collection if separate
      const patientDocRef = doc(db, "patients", userId);

      await updateDoc(userDocRef, {
        isSensitized: true,
        sensitizationDate: new Date().toISOString(),
      }).catch(() => { }); // access might be denied if rules strict

      await updateDoc(patientDocRef, {
        isSensitized: true,
      }).catch(() => { });

      console.log("Updated sensitization status for user");
    } catch (error) {
      console.error("Error updating sensitization status:", error);
    }
  };

  // Get dog's name with fallback
  const getDogName = () => {
    return userData?.p_name || profile?.p_name || "your dog";
  };

  // Format appointment date
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ContentLayout title="Canine Transfusion & Clinical History">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
        <div className="px-2">
          <div className="flex items-center gap-2">
            <History className="h-6 w-6" />
            <h2 className="text-2xl font-semibold">🐾 {getDogName()}'s Clinical Record History</h2>
          </div>
          <p className="text-foreground text-md mt-3">
            Here you can see all recorded <span className="text-accent">clinical procedures</span> in the K9Hope Chennai Network.
          </p>
        </div>
      </div>

      {/* Medical Advisory Section */}
      <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>⚠️ Safety Protocol:</strong> While a first canine transfusion may be tolerated without full crossmatching,
          immune sensitization occurs immediately after. For all repeat transfusions, blood typing and crossmatching are
          mandatory to prevent life-threatening reactions.
        </AlertDescription>
      </Alert>

      {/* Sensitization Alert */}
      {hasTransfusion && (
        <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <Shield className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>🚨 Medical Alert:</strong> {getDogName()} has received {transfusionCount} {transfusionCount === 1 ? " transfusion" : " transfusions"}.
            All future transfusions require mandatory crossmatching.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Medical Procedure History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading clinical history...
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No clinical procedures recorded</p>
              <p className="text-sm mt-2">Completed procedures will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedure Date</TableHead>
                  <TableHead>Clinic Name</TableHead>
                  <TableHead>Procedure Type</TableHead>
                  <TableHead>Medical Notes</TableHead>
                  <TableHead>Donor Details</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {formatDate(appointment.date || appointment.completedDate || "")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        {appointment.clinicName || "Chennai Veterinary Clinic"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={appointment.type?.toLowerCase().includes('transfusion') ? "destructive" : "outline"}
                        className={appointment.type?.toLowerCase().includes('transfusion')
                          ? "bg-red-100 dark:bg-red-900"
                          : "bg-blue-50 dark:bg-blue-900"}
                      >
                        {appointment.type || appointment.procedureType || "Check-up"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                      <div className="truncate">
                        {appointment.notes || appointment.medicalNotes || "Standard procedure completed"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {appointment.donorName ? (
                        <div>
                          <div className="font-medium text-green-700">
                            ❤️ {appointment.donorName}
                          </div>
                          <div className="text-xs text-gray-500">
                            Donated {appointment.quantityReceived}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Anonymous</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Completed
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center mt-6 space-x-2">
        <Button disabled className="bg-accent">
          Previous
        </Button>
        <span className="px-4 py-2">1 / 1</span>
        <Button disabled className="bg-accent">
          Next
        </Button>
      </div>
    </ContentLayout>
  );
}
