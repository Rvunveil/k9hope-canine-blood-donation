"use client";

import React from "react";
import { useEffect, useState } from "react";

import { ContentLayout } from "@/components/admin-panel/content-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Thermometer, Heart, MapPin, Clock, AlertTriangle } from "lucide-react"

import GreetingCard from "@/components/portals/common-parts/greeting-card"

// User Imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";

export default function DashboardPage() {
  const sidebar = useStore(useSidebar, (x) => x);
  const { userId, role, device, setUser } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [matchedDonors, setMatchedDonors] = useState(0);

  useEffect(() => {
    async function fetchPatientData() {
      if (!userId) return;

      try {
        // Fetch patient profile from admin's patient-management (which is patients collection)
        const patientRef = doc(db, "patients", userId);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          const data = patientSnap.data();
          setProfile(data);

          // Fetch linked blood request from admin
          await fetchBloodRequestStatus(data);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }

    fetchPatientData();
  }, [userId]);

  // Fetch linked blood request
  async function fetchBloodRequestStatus(patientData: any) {
    try {
      // Check if admin created a request for this patient
      const requestsRef = collection(db, "veterinary-donor-requests");
      const q = query(
        requestsRef,
        where("linkedPatientId", "==", userId),
        where("status", "==", "open"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const requestData = snapshot.docs[0].data();

        // Update UI with admin's blood request details
        setProfile((prev: any) => ({
          ...prev,
          hasActiveRequest: true,
          requestId: snapshot.docs[0].id,
          adminRequestedBloodType: requestData.bloodTypeNeeded,
          adminRequestedQuantity: requestData.quantityNeeded,
          requestUrgency: requestData.isUrgent,
        }));
      }
    } catch (error) {
      console.error("Error fetching request:", error);
    }
  }

  // Fetch hospital inventory
  useEffect(() => {
    async function fetchHospitalInventory() {
      try {
        // Fetch hospitals in patient's city with blood inventory
        // If city is not available, default to "Chennai" or fetch all
        const city = profile?.p_city || "Chennai";
        const hospitalsRef = collection(db, "hospitals");
        const q = query(
          hospitalsRef,
          where("h_city", "==", city)
        );

        const snapshot = await getDocs(q);
        const hospitalsData = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // Fetch blood inventory for this hospital
          const inventoryRef = doc(db, "blood-inventory", docSnap.id);
          const inventorySnap = await getDoc(inventoryRef);
          const inventoryData = inventorySnap.exists() ? inventorySnap.data() : {};

          // Get stock for patient's blood type
          const bloodTypeKey = profile?.p_bloodgroup || "DEA 4";
          const stock = inventoryData[bloodTypeKey] || 0;

          hospitalsData.push({
            id: docSnap.id,
            h_name: data.h_name,
            phone: data.phone,
            h_city: data.h_city,
            stock: stock,
            bloodType: bloodTypeKey,
          });
        }

        setClinics(hospitalsData);
      } catch (error) {
        console.error("Error fetching inventory:", error);
      }
    }

    if (profile?.p_city || profile === null) { // Try even if profile null initially (will rely on default)
      // Actually better to wait for profile if we want city matching, but default Chennai is ok
      fetchHospitalInventory();
    }
  }, [profile?.p_city, profile?.p_bloodgroup]);

  // Fetch matched donors
  useEffect(() => {
    async function fetchMatchedDonors() {
      if (!userId) return;
      try {
        const appointmentsRef = collection(db, "donor-appointments");
        const q = query(
          appointmentsRef,
          where("linkedPatientId", "==", userId),
          where("status", "in", ["pending", "confirmed"])
        );

        const snapshot = await getDocs(q);
        setMatchedDonors(snapshot.size);
      } catch (error) {
        console.error("Error fetching matched donors:", error);
      }
    }

    fetchMatchedDonors();
  }, [userId]);

  // Fetch user data from /users collection for dog's name (existing logic)
  useEffect(() => {
    async function fetchUserData() {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }
    fetchUserData();
  }, [userId]);

  // Sidebar check
  if (!sidebar) {
    return <div>Loading Sidebar...</div>;
  }

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getOwnerName = () => {
    if (userData?.email) {
      return userData.email.split('@')[0] === 'adithyatamilselvan' ? 'Adithya' : userData.email.split('@')[0];
    }
    if (profile?.email) {
      return profile.email.split('@')[0] === 'adithyatamilselvan' ? 'Adithya' : profile.email.split('@')[0];
    }
    return "Adithya";
  };

  const getDogName = () => {
    return userData?.p_name || profile?.p_name || "your dog";
  };

  return (
    <ContentLayout title="Clinical Dashboard">
      <div>
        <GreetingCard
          name={getDogName()}
          role="patient"
          customGreeting={`🌤️ ${getTimeOfDay()}, ${getOwnerName()}. Monitoring Jillu's recovery.`}
        />
      </div>

      {/* Clinical Status Overview */}
      <div className="pb-6">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Clinical Emergency Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">{profile?.p_bloodgroup || "DEA 1.1+"}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Required Blood Type</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {profile?.hasActiveRequest
                    ? (profile.requestUrgency === "yes" ? "🚨 URGENT" : "ACTIVE")
                    : profile?.p_urgencyRequirment === "high" ? "CRITICAL" : "STABLE"
                  }
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Current Status</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {profile?.adminRequestedQuantity || profile?.p_quantityRequirment || "1"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Units Needed</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">{matchedDonors}</div>
                <div className="text-sm text-gray-600">Donors Matched</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vitals Monitor */}
      <div className="pb-6">
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Canine Vitals Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Activity Level</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{profile?.p_weight_kg > 25 ? "Low" : "High"}</div>
                <div className="text-xs text-gray-500">Normal Range</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Thermometer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Temperature</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">101.5°F</div>
                <div className="text-xs text-gray-500">Normal: 101-102.5°F</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Pulse Rate</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{profile?.p_weight_kg > 25 ? "85" : "95"} BPM</div>
                <div className="text-xs text-gray-500">Normal: 70-120 BPM</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clinical Chart */}
      <div className="pb-6">
        <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Clinical Records
              </span>
              <Badge variant="outline" className="text-xs">
                AI-Summarized Clinical Status
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-700 dark:text-gray-300">Diagnosis</span>
                <span className="text-gray-900 dark:text-gray-100">{profile?.p_reasonRequirment || "Post-Surgery Recovery"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-700 dark:text-gray-300">Treatment Status</span>
                <Badge variant={profile?.p_isMedicalCondition === "yes" ? "destructive" : "default"}>
                  {profile?.p_isMedicalCondition === "yes" ? "Under Observation" : "Stable"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-700 dark:text-gray-300">Veterinarian Notes</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 italic">
                  "Monitor vitals every 30 minutes. Prepare for potential transfusion."
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-700 dark:text-gray-300">Last Updated</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chennai Veterinary Network Availability */}
      <div className="pb-6">
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {profile?.p_city || "Chennai"} Veterinary Network Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {clinics.length > 0 ? clinics.map((clinic) => (
                <div key={clinic.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 shadow-sm">
                  <div className="text-center">
                    <div className="font-bold text-emerald-700 dark:text-emerald-300">{clinic.h_name || "Veterinary Clinic"}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{clinic.h_phone || "Contact Available"}</div>
                    <Badge variant={clinic.stock > 2 ? "default" : clinic.stock > 0 ? "secondary" : "destructive"}>
                      {clinic.stock > 2 ? "✅ Available" : clinic.stock > 0 ? "⚠️ Limited" : "❌ Out of Stock"}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-2">
                      {clinic.stock} Units ({clinic.bloodType})
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-3 text-center text-gray-500">
                  No clinics found with inventory data in this area.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </ContentLayout>
  );
}
