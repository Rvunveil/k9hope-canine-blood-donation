"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Droplet, Phone, Mail, Navigation, Search, ChevronDown, Info } from "lucide-react";
import HeartLoading from "@/components/custom/HeartLoading";
import Link from "next/link";

interface NearbyRequest {
  id: string;
  bloodTypeNeeded: string;
  quantityNeeded: number;
  isUrgent: string;
  reason: string;
  clinicId: string;
  clinicName: string;
  clinicPhone: string;
  clinicEmail: string;
  clinicCity: string;
  clinicPincode: string;
  clinicAddress: string;
  linkedPatientName?: string;
  status: string;
}

export default function NearbyDonationsPage() {
  const { userId, role } = useUser();
  const router = useRouter();

  const [donorProfile, setDonorProfile] = useState<any>(null);
  const [nearbyRequests, setNearbyRequests] = useState<NearbyRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<NearbyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBloodType, setFilterBloodType] = useState("all");

  const CANINE_BLOOD_TYPES = ["DEA1.1", "DEA1.2", "DEA3", "DEA4", "DEA5", "DEA7", "DEA1-NEG", "UNKNOWN"];

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
      const donorRef = doc(db, "donors", userId);
      const donorSnap = await getDoc(donorRef);

      if (!donorSnap.exists()) {
        setLoading(false);
        return;
      }

      const donorData = donorSnap.data();
      setDonorProfile(donorData);

      await fetchNearbyRequests(donorData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNearbyRequests(donorData: any) {
    try {
      const requestsRef = collection(db, "veterinary-donor-requests");
      const q = query(
        requestsRef,
        where("status", "==", "open"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const requests: NearbyRequest[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

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
          clinicId: data.clinicId,
          clinicName: clinicData.h_name || "Veterinary Clinic",
          clinicPhone: clinicData.phone || "",
          clinicEmail: clinicData.email || "",
          clinicCity: clinicData.h_city || "",
          clinicPincode: clinicData.h_pincode || "",
          clinicAddress: `${clinicData.h_address_line1 || ""}, ${clinicData.h_city || ""}`,
          linkedPatientName: data.linkedPatientName,
          status: data.status,
          isVerified: clinicData.isVerified || false, // Added
          isPending: clinicData.isPending || false, // Added
        });
      }

      setNearbyRequests(requests);
      setFilteredRequests(requests);

    } catch (error) {
      console.error("Error fetching nearby requests:", error);
    }
  }

  useEffect(() => {
    let filtered = [...nearbyRequests];

    if (searchQuery) {
      filtered = filtered.filter(req =>
        req.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.clinicCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.linkedPatientName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterBloodType !== "all") {
      filtered = filtered.filter(req => req.bloodTypeNeeded === filterBloodType);
    }

    // Sort by proximity (same city first)
    filtered.sort((a, b) => {
      const aMatch = a.clinicCity.toLowerCase() === donorProfile?.d_city.toLowerCase() ? 0 : 1;
      const bMatch = b.clinicCity.toLowerCase() === donorProfile?.d_city.toLowerCase() ? 0 : 1;
      return aMatch - bMatch;
    });

    setFilteredRequests(filtered);
  }, [searchQuery, filterBloodType, nearbyRequests, donorProfile]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <HeartLoading />
      </div>
    );
  }

  return (
    <ContentLayout title="Nearby Donations">
      <div className="space-y-6">
        {/* Hero */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <MapPin className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-3">Find Clinics Near You</h2>
                <p className="text-blue-50 text-lg mb-4">
                  Discover veterinary clinics in your area seeking blood donations. Every contribution saves lives.
                </p>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <Navigation className="w-4 h-4" />
                  <span>Near <strong>{donorProfile?.d_city || "your location"}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
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
                value={filterBloodType}
                onChange={(e) => setFilterBloodType(e.target.value)}
                className="px-4 py-2 border rounded-lg min-w-[200px]"
              >
                <option value="all">All Blood Types</option>
                {CANINE_BLOOD_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Request Cards */}
        {filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRequests.map((request) => (
              <NearbyRequestCard
                key={request.id}
                request={request}
                donorCity={donorProfile?.d_city}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MapPin className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No clinics found matching your filters
              </h3>
              <p className="text-gray-500">
                Try adjusting your search criteria or check back later.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ContentLayout>
  );
}

function NearbyRequestCard({ request, donorCity }: any) {
  const [expanded, setExpanded] = useState(false);
  const isSameCity = request.clinicCity.toLowerCase() === donorCity?.toLowerCase();

  return (
    <Card className="border-blue-500 border-l-4 hover:shadow-lg transition-all">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-xl font-bold flex items-center gap-2">
              🏥 {request.clinicName}
              {request.isVerified && (
                <Badge className="bg-blue-500 text-xs">✓ Verified</Badge>
              )}
            </h3>
            {request.linkedPatientName && (
              <p className="text-sm text-gray-600">For: {request.linkedPatientName}</p>
            )}
          </div>
          <div className="flex gap-2">
            {isSameCity && (
              <Badge className="bg-green-500">Your City</Badge>
            )}
            {request.isUrgent === "yes" && (
              <Badge className="bg-red-500">Urgent</Badge>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Blood Type</p>
            <p className="text-lg font-bold text-red-600 flex items-center gap-1">
              <Droplet className="w-4 h-4" />
              {request.bloodTypeNeeded}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Location</p>
            <p className="text-sm font-semibold truncate">{request.clinicCity}</p>
            <p className="text-xs text-gray-500">{request.clinicPincode}</p>
          </div>
        </div>

        {/* Reason */}
        {request.reason && (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg flex gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Reason</p>
              <p className="text-sm text-gray-800 line-clamp-2">{request.reason}</p>
            </div>
          </div>
        )}

        {/* Expandable Contact */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-gray-600 hover:text-gray-900 py-2 border-t border-gray-100 transition-colors"
        >
          <span className="font-medium text-sm">{expanded ? "Hide" : "View"} Contact Info</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg animate-in fade-in">
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
          </div>
        )}

        {/* CTA */}
        <Link href="/app/d/donate/urgent">
          <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-all active:scale-[0.98]">
            Offer to Donate
          </button>
        </Link>
      </CardContent>
    </Card>
  );
}