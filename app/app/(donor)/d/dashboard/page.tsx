"use client";

import { useState, useEffect } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, MapPin, Calendar, BarChart3, Heart, Users, Clock, TrendingUp, Droplet, Phone } from "lucide-react";
import HeartLoading from "@/components/custom/HeartLoading";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";

interface DonorProfile {
  d_name: string;
  d_bloodgroup: string;
  d_city: string;
  d_weight_kg: number;
  d_lastDonation?: string;
  d_donationCount: number;
  d_isMedicalCondition: string;
  email: string;
  phone: string;
}

interface UrgentRequest {
  id: string;
  bloodTypeNeeded: string;
  clinicName: string;
  clinicCity: string;
  quantityNeeded: number;
  isUrgent: string;
  reason: string;
  requestExpires: any;
  linkedPatientName?: string;
  status: string;
}

interface DonorStats {
  totalDonations: number;
  livesSaved: number;
  lastDonation: string;
  nextEligible: string;
  isEligible: boolean;
  pendingAppointments: number;
}

export default function DonorDashboard() {
  const { userId, role, isAuthLoading } = useUser();
  const router = useRouter();

  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [urgentRequests, setUrgentRequests] = useState<UrgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (!userId || role !== "donor") {
      router.push("/");
      return;
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    fetchDashboardData();
  }, [userId, role, router]);

  async function fetchDashboardData() {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch donor profile
      const donorRef = doc(db, "donors", userId);
      const donorSnap = await getDoc(donorRef);

      if (!donorSnap.exists()) {
        console.error("Donor profile not found");
        setLoading(false);
        return;
      }

      const donorData = donorSnap.data() as DonorProfile;
      setProfile(donorData);

      // Calculate donor stats
      const calculatedStats = await calculateDonorStats(donorData);
      setStats(calculatedStats);

      // Fetch urgent requests matching donor's profile
      await fetchUrgentRequests(donorData);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateDonorStats(donorData: DonorProfile): Promise<DonorStats> {
    // Fetch donor appointments
    const appointmentsRef = collection(db, "donor-appointments");
    const q = query(appointmentsRef, where("donorId", "==", userId));
    const appointmentsSnap = await getDocs(q);

    const completedDonations = appointmentsSnap.docs.filter(
      doc => doc.data().status === "completed"
    ).length;

    const pendingAppointments = appointmentsSnap.docs.filter(
      doc => doc.data().status === "pending"
    ).length;

    // Calculate eligibility (8 weeks = 56 days since last donation)
    let isEligible = true;
    let nextEligible = "Now";
    let lastDonation = "Never";

    if (donorData.d_lastDonation) {
      const lastDonationDate = new Date(donorData.d_lastDonation);
      lastDonation = format(lastDonationDate, "PPP");
      const daysSinceLastDonation = differenceInDays(new Date(), lastDonationDate);

      if (daysSinceLastDonation < 56) {
        isEligible = false;
        const nextDate = new Date(lastDonationDate);
        nextDate.setDate(nextDate.getDate() + 56);
        nextEligible = format(nextDate, "PPP");
      }
    }

    // Check medical conditions
    if (donorData.d_isMedicalCondition === "yes" || donorData.d_weight_kg < 25) {
      isEligible = false;
      nextEligible = "See Profile";
    }

    return {
      totalDonations: donorData.d_donationCount || completedDonations,
      livesSaved: (donorData.d_donationCount || completedDonations) * 3, // Each donation helps ~3 patients
      lastDonation,
      nextEligible,
      isEligible,
      pendingAppointments,
    };
  }

  async function fetchUrgentRequests(donorData: DonorProfile) {
    try {
      const requestsRef = collection(db, "veterinary-donor-requests");
      const q = query(
        requestsRef,
        where("status", "==", "open"),
        where("bloodTypeNeeded", "==", donorData.d_bloodgroup),
        orderBy("createdAt", "desc"),
        limit(6)
      );

      const snapshot = await getDocs(q);
      const requests: UrgentRequest[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Fetch clinic details
        const clinicRef = doc(db, "hospitals", data.clinicId);
        const clinicSnap = await getDoc(clinicRef);
        const clinicData = clinicSnap.exists() ? clinicSnap.data() : {};

        requests.push({
          id: docSnap.id,
          bloodTypeNeeded: data.bloodTypeNeeded,
          clinicName: clinicData.h_name || "Hospital",
          clinicCity: clinicData.h_city || "Unknown",
          quantityNeeded: data.quantityNeeded,
          isUrgent: data.isUrgent,
          reason: data.reason,
          requestExpires: data.requestExpires,
          linkedPatientName: data.linkedPatientName,
          status: data.status,
        });
      }

      // Prioritize requests from same city
      requests.sort((a, b) => {
        const aSameCity = a.clinicCity.toLowerCase() === donorData.d_city.toLowerCase() ? 1 : 0;
        const bSameCity = b.clinicCity.toLowerCase() === donorData.d_city.toLowerCase() ? 1 : 0;
        return bSameCity - aSameCity;
      });

      setUrgentRequests(requests);
    } catch (error) {
      console.error("Error fetching urgent requests:", error);
      setUrgentRequests([]);
    }
  }

  if (loading || isAuthLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <HeartLoading />
      </div>
    );
  }

  if (!profile || !stats) {
    return (
      <ContentLayout title="Dashboard">
        <Card className="p-8">
          <p className="text-center text-gray-500">Unable to load dashboard data</p>
        </Card>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Dashboard">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {greeting}, {profile.d_name}! 🐕
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Your blood type: <strong>{profile.d_bloodgroup}</strong> • Ready to save canine lives today
          </p>
        </div>

        {/* Eligibility Status */}
        <Card className={stats.isEligible ? "border-green-500 border-2" : "border-orange-500 border-2"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {stats.isEligible ? (
                <>
                  <Heart className="h-5 w-5 text-green-600 fill-green-600" />
                  <span className="text-green-700">You're Eligible to Donate!</span>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="text-orange-700">Donation Eligibility Status</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.isEligible ? (
              <p className="text-gray-700">
                Great news! Your dog can donate blood now. Check urgent requests below or browse nearby opportunities.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-700">
                  Last donation: <strong>{stats.lastDonation}</strong>
                </p>
                <p className="text-gray-700">
                  Next eligible: <strong>{stats.nextEligible}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Dogs must wait 8 weeks between donations for their health and safety.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ActionCard
              icon={AlertCircle}
              title="Urgent Requests"
              description="Critical blood needs"
              href="/app/d/donate/urgent"
              accentColor="red"
              count={urgentRequests.filter(r => r.isUrgent === "yes").length}
            />
            <ActionCard
              icon={MapPin}
              title="Nearby Clinics"
              description="Find clinics near you"
              href="/app/d/donate/nearby"
              accentColor="blue"
            />
            <ActionCard
              icon={Calendar}
              title="My Appointments"
              description="Scheduled donations"
              href="/app/d/appointments"
              accentColor="purple"
              count={stats.pendingAppointments}
            />
            <ActionCard
              icon={BarChart3}
              title="Donation History"
              description="Track your impact"
              href="/app/d/donation-history"
              accentColor="green"
            />
          </div>
        </section>

        {/* Urgent Requests */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">🆘 Urgent Blood Requests</h2>
            <Link href="/app/d/donate/urgent">
              <Button variant="outline">View All</Button>
            </Link>
          </div>

          {urgentRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentRequests.slice(0, 3).map((request) => (
                <UrgentRequestCard key={request.id} request={request} donorCity={profile.d_city} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Heart className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600">
                  No urgent requests matching your profile right now
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Check back soon or explore nearby clinics
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Impact Stats */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Donation Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              icon={Heart}
              title="Total Donations"
              value={stats.totalDonations.toString()}
              subtitle="Lifetime contributions"
              colorScheme="blue"
            />
            <StatsCard
              icon={Users}
              title="Lives Saved"
              value={stats.livesSaved.toString()}
              subtitle="Approximate patients helped"
              colorScheme="green"
            />
            <StatsCard
              icon={Clock}
              title="Last Donation"
              value={stats.lastDonation}
              subtitle="Thank you!"
              colorScheme="purple"
            />
            <StatsCard
              icon={TrendingUp}
              title="Next Available"
              value={stats.nextEligible}
              subtitle={stats.isEligible ? "You're eligible!" : "Mark your calendar"}
              colorScheme="orange"
            />
          </div>
        </section>
      </div>
    </ContentLayout>
  );
}

// Action Card Component
function ActionCard({ icon: Icon, title, description, href, accentColor, count }: any) {
  const colorClasses: any = {
    red: "border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20",
    blue: "border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20",
    purple: "border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20",
    green: "border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20",
  };

  return (
    <Link href={href}>
      <Card className={`cursor-pointer transition-all hover:shadow-lg ${colorClasses[accentColor]} border-l-4`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Icon className={`h-8 w-8 mb-3 text-${accentColor}-600`} />
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            {count !== undefined && count > 0 && (
              <Badge className={`bg-${accentColor}-600`}>{count}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Urgent Request Card
function UrgentRequestCard({ request, donorCity }: any) {
  const isSameCity = request.clinicCity.toLowerCase() === donorCity.toLowerCase();

  return (
    <Card className={request.isUrgent === "yes" ? "border-red-500 border-2" : ""}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">🏥 {request.clinicName}</CardTitle>
          {request.isUrgent === "yes" && (
            <Badge className="bg-red-600">🚨 Urgent</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-red-500" />
          <span className="font-semibold">{request.bloodTypeNeeded}</span>
          <span className="text-sm text-gray-500">({request.quantityNeeded}ml needed)</span>
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">{request.clinicCity}</span>
          {isSameCity && (
            <Badge className="bg-green-500 text-xs">Your City</Badge>
          )}
        </div>

        {request.reason && (
          <div className="text-sm text-gray-600">
            <strong>Reason:</strong> {request.reason}
          </div>
        )}

        {request.linkedPatientName && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-sm">
            For: <strong>{request.linkedPatientName}</strong>
          </div>
        )}

        <Link href={`/app/d/donate/urgent`}>
          <Button className="w-full bg-red-600 hover:bg-red-700 mt-2">
            I Can Help
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Stats Card
function StatsCard({ icon: Icon, title, value, subtitle, colorScheme }: any) {
  const colors: any = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
    green: "text-green-600 bg-green-50 dark:bg-green-950/20",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-950/20",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className={`${colors[colorScheme]} p-3 rounded-lg inline-block mb-4`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
        <p className="text-2xl font-bold mb-1">{value}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
