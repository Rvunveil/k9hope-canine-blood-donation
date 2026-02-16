"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock, Check, X, Info } from "lucide-react";
import { format } from "date-fns";
import HeartLoading from "@/components/custom/HeartLoading";

export default function PatientNotificationsPage() {
  const { userId, role } = useUser();
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && role === "patient") {
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
        where("userRole", "==", "patient")
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
    <ContentLayout title="Alerts & Updates">
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <Bell className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">My Alerts</h2>
                <p className="text-blue-50">
                  {unreadCount > 0
                    ? `You have ${unreadCount} new update${unreadCount > 1 ? 's' : ''}`
                    : "No new updates on your request."
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
                No notifications received
              </h3>
              <p className="text-gray-500">
                Updates about your blood requests and appointments will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={() => markAsRead(notification.id)}
              />
            ))}
          </div>
        )}
      </div>
    </ContentLayout>
  );
}

function NotificationCard({ notification, onMarkRead }: any) {
  // Determine icon and color based on type
  const getTypeStyles = (type: string) => {
    switch (type) {
      case "donor_matched":
        return { icon: Info, color: "text-blue-500", bg: "bg-blue-50" };
      case "appointment_confirmed":
        return { icon: Check, color: "text-green-500", bg: "bg-green-50" };
      case "donor_declined":
        return { icon: X, color: "text-red-500", bg: "bg-red-50" };
      default:
        return { icon: Bell, color: "text-gray-500", bg: "bg-gray-50" };
    }
  };

  const { icon: Icon, color, bg } = getTypeStyles(notification.type);

  return (
    <Card className={`${!notification.read ? "border-blue-500 border-2" : ""} transition-all hover:shadow-md`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${bg} ${color}`}>
              <Icon className="w-6 h-6" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{notification.title}</h3>
                {!notification.read && (
                  <Badge className="bg-blue-600">New</Badge>
                )}
              </div>

              <p className="text-gray-700 mb-2">{notification.message}</p>

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Clock className="h-3 w-3" />
                <span>{format(notification.createdAt, "PPp")}</span>
              </div>

              {/* Context Data Display */}
              {notification.type === "appointment_confirmed" && notification.data && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded w-fit text-sm">
                  <Calendar className="h-4 w-4" />
                  <strong>{format(new Date(notification.data.appointmentDate), "PPP")}</strong>
                  <span>at {notification.data.appointmentTime}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!notification.read ? (
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
