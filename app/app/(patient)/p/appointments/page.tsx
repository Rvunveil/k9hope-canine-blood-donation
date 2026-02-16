"use client";

import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useState, useEffect } from "react";
import { CalendarCheck, Clock, MapPin, Stethoscope, Phone } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

// Firebase imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";

export default function AppointmentsPage() {
  const { userId } = useUser();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  // Fetch user profile and appointments
  useEffect(() => {
    async function fetchData() {
      if (!userId) return;

      try {
        // Fetch user profile
        const profileDoc = await getDoc(doc(db, "patients", userId));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data());
        }

        // Fetch user data for dog's name
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }

        // Fetch appointments from admin's donor-appointments
        const appointmentsRef = collection(db, "donor-appointments");
        const q = query(
          appointmentsRef,
          where("linkedPatientId", "==", userId),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const appointmentData = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // Fetch clinic details
          const clinicRef = doc(db, "hospitals", data.clinicId);
          const clinicSnap = await getDoc(clinicRef);
          const clinicData = clinicSnap.exists() ? clinicSnap.data() : {};

          // Fetch donor details if available
          let donorName = data.donorName;
          let donorPhone = data.donorPhone;

          if (data.donorId && !donorName) {
            const donorRef = doc(db, "donors", data.donorId);
            const donorSnap = await getDoc(donorRef);
            if (donorSnap.exists()) {
              donorName = donorSnap.data().d_name;
              donorPhone = donorSnap.data().phone;
            }
          }

          appointmentData.push({
            id: docSnap.id,
            clinicName: clinicData.h_name || "Veterinary Clinic",
            clinicPhone: clinicData.phone,
            clinicAddress: `${clinicData.h_address_line1}, ${clinicData.h_city}`,
            donorName: donorName,
            donorPhone: donorPhone,
            dogBloodType: data.dogBloodType,
            appointmentDate: data.appointmentDate,
            appointmentTime: data.appointmentTime,
            status: data.status,
            notes: data.notes,
            createdAt: data.createdAt,
          });
        }

        setAppointments(appointmentData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  // Get dog's name with fallback
  const getDogName = () => {
    return userData?.p_name || profile?.p_name || "your dog";
  };

  // Format appointment date
  const formatDate = (dateValue: any) => {
    try {
      if (!dateValue) return "TBD";
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  };

  return (
    <ContentLayout title="Scheduled Clinical Visits">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
        <div className="px-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            <h2 className="text-2xl font-semibold">📅 Scheduled Clinical Visits & Transfusions</h2>
          </div>
          <p className="text-foreground text-md mt-3">
            Here you will see your <span className="text-accent">confirmed appointments</span> at Chennai Veterinary Clinics for blood transfusion.
          </p>
          <p className="text-foreground text-sm mt-2 bg-blue-50 dark:bg-blue-900 p-3 rounded-lg border border-blue-200">
            <strong>📋 Important:</strong> Please bring your dog's previous clinical records to the clinic.
          </p>
          <p className="text-foreground text-md mt-3">
            Wishing {getDogName()} a healthy recovery!
          </p>
        </div>
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Clinical Appointment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No scheduled appointments found</p>
              <p className="text-sm mt-2">Your upcoming clinical visits will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic Name</TableHead>
                  <TableHead>Dog's Name</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Donor Information</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        {appointment.clinicName || "Chennai Veterinary Clinic"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getDogName()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-gray-500" />
                        {formatDate(appointment.appointmentDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{appointment.donorName || "Donor"}</div>
                        <div className="text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {appointment.donorPhone || "Not provided"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Blood Type: {appointment.dogBloodType}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        appointment.status === "confirmed" ? "default" :
                          appointment.status === "completed" ? "secondary" :
                            appointment.status === "pending" ? "outline" :
                              "destructive"
                      }>
                        {appointment.status === "confirmed" && "✅ Confirmed"}
                        {appointment.status === "completed" && "🎉 Completed"}
                        {appointment.status === "pending" && "⏳ Awaiting Confirmation"}
                        {appointment.status === "cancelled" && "❌ Cancelled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {appointment.status === "confirmed" && (
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      )}
                      {appointment.status === "completed" && (
                        <Button size="sm" variant="ghost" className="text-green-600">
                          ✓ Received
                        </Button>
                      )}
                      {appointment.status === "pending" && (
                        <Button size="sm" variant="ghost" className="text-gray-500" disabled>
                          Waiting...
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ContentLayout>
  );
}
