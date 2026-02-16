"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/firebaseConfig";
import { useUser } from "@/context/UserContext";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Droplet, AlertCircle, CheckCircle } from "lucide-react";

// Canine Blood Types (DEA System)
const CANINE_BLOOD_TYPES = [
  {
    short: "DEA1.1",
    full: "DEA 1.1 Positive",
    description: "Most common blood type, can cause severe reactions"
  },
  {
    short: "DEA1.2",
    full: "DEA 1.2 Positive",
    description: "Less antigenic than DEA 1.1"
  },
  {
    short: "DEA3",
    full: "DEA 3 Positive",
    description: "Moderately common, less reactive"
  },
  {
    short: "DEA4",
    full: "DEA 4 Positive (Universal Donor)",
    description: "Universal donor - safest for transfusions"
  },
  {
    short: "DEA5",
    full: "DEA 5 Positive",
    description: "Less common blood type"
  },
  {
    short: "DEA7",
    full: "DEA 7 Positive",
    description: "Rare blood type"
  },
  {
    short: "DEA1-NEG",
    full: "DEA 1.1 Negative (Universal Donor)",
    description: "Ideal universal donor - no DEA 1.1 antigen"
  },
  {
    short: "UNKNOWN",
    full: "Unknown Blood Type",
    description: "Blood type not yet determined"
  },
];

export default function BloodInventoryPage() {
  const { userId } = useUser();
  const [inventory, setInventory] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchOrCreateInventory = async () => {
      setLoading(true);
      try {
        const inventoryRef = doc(db, "veterinary-blood-inventory", userId);
        const inventorySnap = await getDoc(inventoryRef);

        if (!inventorySnap.exists()) {
          // Create document with all canine blood types initialized to 0 and needed = "no"
          const initialData = CANINE_BLOOD_TYPES.reduce((acc, type) => {
            const key = type.short.replace(/\./g, "_").replace("-", "_");
            acc[`${key}_count`] = 0;
            acc[`${key}_needed`] = "no";
            acc[`${key}_units`] = "ml"; // Units in milliliters for canine blood
            return acc;
          }, {});

          // Add metadata
          initialData.lastUpdated = new Date();
          initialData.clinicId = userId;

          await setDoc(inventoryRef, initialData);
          setInventory(initialData);
        } else {
          setInventory(inventorySnap.data());
        }
      } catch (error) {
        console.error("Error fetching blood inventory:", error);
        alert("Failed to load blood inventory. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreateInventory();
  }, [userId]);

  const handleAdjust = (groupKey, delta) => {
    setInventory((prev) => ({
      ...prev,
      [groupKey]: Math.max(0, (prev[groupKey] || 0) + delta),
    }));
  };

  const handleToggleNeeded = (groupKey) => {
    setInventory((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === "yes" ? "no" : "yes",
    }));
  };

  const handleSave = async () => {
    try {
      const inventoryRef = doc(db, "veterinary-blood-inventory", userId);
      await updateDoc(inventoryRef, {
        ...inventory,
        lastUpdated: new Date()
      });
      setIsEditing(false);
      alert("✅ Blood inventory updated successfully!");
    } catch (error) {
      console.error("Error saving inventory:", error);
      alert("❌ Failed to save inventory. Please try again.");
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
    }
  };

  // Calculate totals
  const getTotalAvailable = () => {
    return CANINE_BLOOD_TYPES.reduce((sum, type) => {
      const key = type.short.replace(/\./g, "_").replace("-", "_");
      return sum + (inventory[`${key}_count`] || 0);
    }, 0);
  };

  const getNeededCount = () => {
    return CANINE_BLOOD_TYPES.filter(type => {
      const key = type.short.replace(/\./g, "_").replace("-", "_");
      return inventory[`${key}_needed`] === "yes";
    }).length;
  };

  if (loading) {
    return (
      <ContentLayout title="Blood Inventory">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">Loading canine blood inventory...</div>
        </div>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Canine Blood Inventory">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
        <div className="px-2">
          <h2 className="text-2xl font-semibold">🩸 Manage Canine Blood Inventory</h2>
          <p className="text-foreground text-md mt-3">
            View and update your clinic's <span className="text-accent">current canine blood stock</span> and <span className="text-accent">requirements</span>.
          </p>
          <p className="text-foreground text-md mt-2">
            Monitor blood type availability and ensure timely fulfillment of patient needs.
          </p>
          <p className="text-foreground text-md mt-2">
            Create requests & see appointments for blood that is needed in{' '}
            <Link href="/app/h/donor-management" className="text-accent underline hover:text-primary/80">
              Donor Management
            </Link>.
          </p>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Units Available</div>
                <div className="text-2xl font-bold text-green-600">{getTotalAvailable()}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Types Needed</div>
                <div className="text-2xl font-bold text-orange-600">{getNeededCount()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end w-full md:w-auto px-2">
          <Button className="bg-accent" onClick={handleEdit}>
            {isEditing ? "💾 Save Changes" : "✏️ Update Inventory"}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-md">
        <CardContent className="p-6 space-y-4">
          {/* Column Titles */}
          <div className="grid grid-cols-3 font-semibold border-b-2 border-foreground/70 pb-3">
            <div>🐕 Canine Blood Type</div>
            <div className="text-center">Available Units (ml)</div>
            <div className="text-center">Needed</div>
          </div>

          {CANINE_BLOOD_TYPES.map((type) => {
            const key = type.short.replace(/\./g, "_").replace("-", "_");
            const countKey = `${key}_count`;
            const neededKey = `${key}_needed`;
            const isNeeded = inventory[neededKey] === "yes";
            const count = inventory[countKey] || 0;
            const isUniversalDonor = type.short === "DEA4" || type.short === "DEA1-NEG";

            return (
              <div
                key={type.short}
                className={`grid grid-cols-1 sm:grid-cols-3 items-center border-b-2 py-4 gap-4 ${isNeeded ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200' : 'border-gray-200 dark:border-gray-900'
                  }`}
              >
                {/* Blood Type Name */}
                <div className="text-lg text-center sm:text-left">
                  <div className="flex items-center gap-2">
                    <Droplet className={`h-4 w-4 ${count > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    <span className="font-semibold">{type.short}</span>
                    {isUniversalDonor && (
                      <Badge className="bg-blue-500 text-white text-xs">Universal</Badge>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm block ml-6">{type.full}</span>
                  <span className="text-gray-400 text-xs block ml-6">{type.description}</span>
                </div>

                {/* Available Quantity */}
                <div className="flex items-center justify-center space-x-2">
                  {isEditing && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="w-10 h-10"
                      onClick={() => handleAdjust(countKey, -50)}
                    >
                      -
                    </Button>
                  )}
                  <Input
                    className={`w-24 text-center font-semibold ${count > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}
                    value={`${count} ml`}
                    readOnly
                  />
                  {isEditing && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="w-10 h-10"
                      onClick={() => handleAdjust(countKey, 50)}
                    >
                      +
                    </Button>
                  )}
                </div>

                {/* Needed Toggle */}
                <div className="flex justify-center sm:justify-center">
                  {isEditing ? (
                    <Switch
                      checked={isNeeded}
                      onCheckedChange={() => handleToggleNeeded(neededKey)}
                    />
                  ) : (
                    <span className={`text-sm font-semibold ${isNeeded ? 'text-orange-600' : 'text-gray-400'}`}>
                      {isNeeded ? "⚠️ Yes" : "✓ No"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Educational Info */}
      <Card className="mt-6 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">📚 Canine Blood Typing Guide</h3>
          <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <li>-  <strong>DEA 4 (Universal Donor):</strong> Safe for first-time transfusions</li>
            <li>-  <strong>DEA 1.1 Negative:</strong> Ideal universal donor, no antibody reactions</li>
            <li>-  <strong>DEA 1.1 Positive:</strong> Most common but can cause reactions in negative dogs</li>
            <li>-  <strong>Cross-matching:</strong> Always recommended before transfusion</li>
            <li>-  <strong>Storage:</strong> Canine blood can be stored up to 35 days at 1-6°C</li>
            <li>-  <strong>Typical Donation:</strong> 450ml per donation (for dogs over 25kg)</li>
          </ul>
        </CardContent>
      </Card>
    </ContentLayout>
  );
}
