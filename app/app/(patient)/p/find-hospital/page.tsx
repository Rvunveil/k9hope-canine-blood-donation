"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Droplet, Search, Navigation } from "lucide-react";

export default function FindHospitalPage() {
  const { userId } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!userId) return;

      try {
        const profileDoc = await getDoc(doc(db, "patients", userId));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data());
          await fetchHospitals(profileDoc.data());
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  async function fetchHospitals(patientData: any) {
    try {
      const hospitalsRef = collection(db, "hospitals");
      const snapshot = await getDocs(hospitalsRef);

      const hospitalsData = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Fetch blood inventory
        const inventoryRef = doc(db, "blood-inventory", docSnap.id);
        const inventorySnap = await getDoc(inventoryRef);
        const inventoryData = inventorySnap.exists() ? inventorySnap.data() : {};

        const bloodTypeStock = inventoryData[patientData.p_bloodgroup] || 0;

        hospitalsData.push({
          id: docSnap.id,
          name: data.h_name,
          phone: data.phone,
          email: data.email,
          city: data.h_city,
          pincode: data.h_pincode,
          address: `${data.h_address_line1}, ${data.h_city}`,
          stock: bloodTypeStock,
          bloodType: patientData.p_bloodgroup,
          isSameCity: data.h_city?.toLowerCase() === patientData.p_city?.toLowerCase(),
        });
      }

      // Sort by same city first, then by stock
      hospitalsData.sort((a, b) => {
        if (a.isSameCity && !b.isSameCity) return -1;
        if (!a.isSameCity && b.isSameCity) return 1;
        return b.stock - a.stock;
      });

      setHospitals(hospitalsData);
      setFilteredHospitals(hospitalsData);

    } catch (error) {
      console.error("Error:", error);
    }
  }

  useEffect(() => {
    if (searchQuery) {
      const filtered = hospitals.filter(h =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredHospitals(filtered);
    } else {
      setFilteredHospitals(hospitals);
    }
  }, [searchQuery, hospitals]);

  if (loading) {
    return <ContentLayout title="Find Hospital">Loading...</ContentLayout>;
  }

  return (
    <ContentLayout title="Find Hospital">
      <div className="space-y-6">
        {/* Hero */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <MapPin className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-3">Find Veterinary Hospitals</h2>
                <p className="text-green-50 text-lg mb-4">
                  Locate hospitals with <strong>{profile?.p_bloodgroup}</strong> blood availability
                </p>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <Navigation className="w-4 w-4" />
                  <span>Near <strong>{profile?.p_city}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by hospital name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hospital Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredHospitals.map((hospital) => (
            <Card key={hospital.id} className={hospital.isSameCity ? "border-green-500 border-2" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">🏥 {hospital.name}</CardTitle>
                  {hospital.isSameCity && (
                    <Badge className="bg-green-500">Your City</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span className="text-sm">{hospital.address}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <a href={`tel:${hospital.phone}`} className="text-sm text-blue-600 hover:underline">
                    {hospital.phone}
                  </a>
                </div>

                {hospital.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <a href={`mailto:${hospital.email}`} className="text-sm text-blue-600 hover:underline">
                      {hospital.email}
                    </a>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-5 h-5 text-red-500" />
                      <span className="font-medium">{hospital.bloodType} Stock</span>
                    </div>
                    <Badge variant={hospital.stock > 2 ? "default" : hospital.stock > 0 ? "secondary" : "destructive"}>
                      {hospital.stock > 2 ? "✅ Available" : hospital.stock > 0 ? "⚠️ Limited" : "❌ Out"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{hospital.stock} units available</p>
                </div>

                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Contact Hospital
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ContentLayout>
  );
}
