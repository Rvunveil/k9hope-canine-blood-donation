"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, writeBatch, getDoc, increment } from "firebase/firestore";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, X, Calendar as CalendarIcon, Clock, Droplet } from "lucide-react";
import { format } from "date-fns";
import HeartLoading from "@/components/custom/HeartLoading";

export default function DonorNotificationsPage() {
  const { userId, role } = useUser();
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [appointmentTime, setAppointmentTime] = useState("");

  useEffect(() => {
    if (userId && role === "donor") {
      fetchNotifications();
    }
  }, [userId, role]);

  async function fetchNotifications() {
    if (!userId) return;

    setLoading(true);
    try {
      const notificationsRef = collection(db, "notifications");
      const q = query(
        notificationsRef,
        where("userId", "==", userId),
        where("userRole", "==", "donor")
      );

      const snapshot = await getDocs(q);
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));

      // Sort by date, unread first
      notifs.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return b.createdAt - a.createdAt;
      });

      setNotifications(notifs);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptMatch() {
    if (!selectedNotification || !appointmentDate) {
      alert("Please select an appointment date");
      return;
    }

    try {
      const batch = writeBatch(db);
      const appointmentId = selectedNotification.data.appointmentId;

      // Check if appointment still available (first come first serve)
      const appointmentRef = doc(db, "donor-appointments", appointmentId);
      const appointmentSnap = await getDoc(appointmentRef);

      if (!appointmentSnap.exists()) {
        alert("❌ This match is no longer available");
        return;
      }

      const appointmentData = appointmentSnap.data();

      if (appointmentData.status !== "pending_donor_acceptance") {
        alert("❌ This request has already been accepted or closed");
        fetchNotifications();
        setAcceptDialogOpen(false);
        return;
      }

      // Update appointment status
      batch.update(appointmentRef, {
        status: "confirmed",
        appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
        appointmentTime: appointmentTime || "TBD",
        acceptedAt: Timestamp.now(),
        acceptedBy: userId,
      });

      // Mark notification as read
      const notificationRef = doc(db, "notifications", selectedNotification.id);
      batch.update(notificationRef, {
        read: true,
        respondedAt: Timestamp.now(),
      });

      // Create notification for PATIENT
      const patientNotificationRef = doc(collection(db, "notifications"));
      batch.set(patientNotificationRef, {
        userId: appointmentData.linkedPatientId,
        userRole: "patient",
        type: "appointment_confirmed",
        title: "🎉 Appointment Confirmed!",
        message: `Your blood transfusion appointment has been scheduled for ${format(appointmentDate, "PPP")} at ${appointmentTime || "TBD"}`,
        data: {
          appointmentId,
          appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
          appointmentTime: appointmentTime || "TBD",
        },
        read: false,
        createdAt: Timestamp.now(),
      });

      // Create notification for ADMIN (Clinic)
      const adminNotificationRef = doc(collection(db, "notifications"));
      batch.set(adminNotificationRef, {
        userId: appointmentData.clinicId,
        userRole: "admin", // Assuming admin checks universal notifications or based on clinicId
        // In reality, admin might need to poll or have a dedicated notification view. 
        // For now we store it.
        type: "appointment_confirmed",
        title: "✅ Donor Accepted Match",
        message: `Donor accepted blood request. Appointment: ${format(appointmentDate, "PPP")}`,
        data: {
          appointmentId,
          donorId: userId,
          patientId: appointmentData.linkedPatientId,
        },
        read: false,
        createdAt: Timestamp.now(),
      });

      // Update request pending/confirmed counts
      // Note: Admin logic uses 'veterinary-donor-requests' or 'patients'??
      // In the Admin Matchmaking code, we updated 'patients' collection pendingMatches. 
      // But we also linked to 'veterinary-donor-requests' implicitly via requestId?
      // Wait, in Admin code: `requestId: requestData.id` (Patient ID used as request ID).
      // So we should update 'patients' collection.

      const patientRef = doc(db, "patients", appointmentData.linkedPatientId); // requestData.id was linkedPatientId
      batch.update(patientRef, {
        pendingMatches: increment(-1),
        confirmedMatches: increment(1),
        request_status: "accepted", // reinforce status
      });

      await batch.commit();

      alert("✅ Appointment confirmed! Patient has been notified.");
      setAcceptDialogOpen(false);
      fetchNotifications();

    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to confirm appointment");
    }
  }

  async function handleRejectMatch(notification: any) {
    if (!confirm("Are you sure you want to reject this match?")) return;

    try {
      const batch = writeBatch(db);
      const appointmentId = notification.data.appointmentId;

      // Update appointment
      const appointmentRef = doc(db, "donor-appointments", appointmentId);
      batch.update(appointmentRef, {
        status: "rejected_by_donor",
        rejectedAt: Timestamp.now(),
        rejectedBy: userId,
      });

      // Mark notification as read
      const notificationRef = doc(db, "notifications", notification.id);
      batch.update(notificationRef, {
        read: true,
        respondedAt: Timestamp.now(),
      });

      // Get appointment data for patient notification
      const appointmentSnap = await getDoc(appointmentRef);
      const appointmentData = appointmentSnap.data();

      // Notify patient
      const patientNotificationRef = doc(collection(db, "notifications"));
      batch.set(patientNotificationRef, {
        userId: appointmentData.linkedPatientId,
        userRole: "patient",
        type: "donor_declined",
        title: "🔄 Match Update",
        message: "A donor was unable to proceed. Admin is finding another match for you.",
        data: { appointmentId },
        read: false,
        createdAt: Timestamp.now(),
      });

      // Update request pending count
      const patientRef = doc(db, "patients", appointmentData.linkedPatientId);
      batch.update(patientRef, {
        pendingMatches: increment(-1),
      });

      await batch.commit();

      alert("Match declined. Admin will find another donor.");
      fetchNotifications();

    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to decline match");
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
      });
      fetchNotifications();
    } catch (error) {
      console.error("Error:", error);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <HeartLoading />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ContentLayout title="Notifications">
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <Bell className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Notifications</h2>
                <p className="text-purple-50">
                  {unreadCount > 0
                    ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                    : "You're all caught up!"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No notifications yet
              </h3>
              <p className="text-gray-500">
                You'll be notified when matches are found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onAccept={() => {
                  setSelectedNotification(notification);
                  setAcceptDialogOpen(true);
                }}
                onReject={() => handleRejectMatch(notification)}
                onMarkRead={() => markAsRead(notification.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accept Match Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Appointment Details</DialogTitle>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              <Card className="bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">Match Details:</h4>
                  <div className="space-y-1 text-sm">
                    <p>Patient: <strong>{selectedNotification.data.patientName}</strong></p>
                    <p>Blood Type: <strong className="text-red-600">{selectedNotification.data.bloodType}</strong></p>
                    {selectedNotification.data.isUrgent === "yes" && (
                      <Badge className="bg-red-600">🚨 URGENT</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>Select Appointment Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appointmentDate ? format(appointmentDate, "PPP") : "Choose date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={appointmentDate}
                      onSelect={setAppointmentDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Preferred Time</Label>
                <Input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Clinic will confirm exact time</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcceptMatch} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              Accept & Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}

function NotificationCard({ notification, onAccept, onReject, onMarkRead }: any) {
  const isPending = notification.type === "match_found" && !notification.read;

  return (
    <Card className={`${!notification.read ? "border-purple-500 border-2" : ""} transition-all hover:shadow-md`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg">{notification.title}</h3>
              {!notification.read && (
                <Badge className="bg-purple-600">New</Badge>
              )}
              {notification.data?.isUrgent === "yes" && (
                <Badge className="bg-red-600">URGENT</Badge>
              )}
            </div>

            <p className="text-gray-700 mb-3">{notification.message}</p>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>{format(notification.createdAt, "PPp")}</span>
            </div>

            {notification.data && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
                {notification.data.patientName && (
                  <p>Patient: <strong>{notification.data.patientName}</strong></p>
                )}
                {notification.data.bloodType && (
                  <div className="flex items-center gap-2 mt-1">
                    <Droplet className="h-4 w-4 text-red-500" />
                    <span>Blood Type: <strong className="text-red-600">{notification.data.bloodType}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isPending ? (
              <>
                <Button onClick={onAccept} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 mr-2" />
                  Accept
                </Button>
                <Button onClick={onReject} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </>
            ) : !notification.read ? (
              <Button onClick={onMarkRead} size="sm" variant="outline">
                Mark Read
              </Button>
            ) : (
              <Badge variant="secondary">Read</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
