// @ts-nocheck

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import CryptoJS from "crypto-js";
import { db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
const COOKIE_ENCRYPT_KEY = process.env.NEXT_PUBLIC_COOKIE_ENCRYPT_KEY;

// Function to Encrypt Data
export function encryptData(data: string) {
  if (!data || !COOKIE_ENCRYPT_KEY) {
    console.warn("Missing data or encryption key for encryption");
    return data; // Return original data if encryption fails
  }
  try {
    return CryptoJS.AES.encrypt(data, COOKIE_ENCRYPT_KEY).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    return data; // Return original data if encryption fails
  }
}

// Function to Decrypt Data
export function decryptData(ciphertext: string) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, COOKIE_ENCRYPT_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return null;
  }
}

// Function to Store Encrypted Cookie
export function setEncryptedCookie(name: string, value: string, days: number) {
  const encryptedValue = encryptData(value);
  Cookies.set(name, encryptedValue, { expires: days });
}

// Function to Retrieve and Decrypt Cookie
export function getDecryptedCookie(name: string) {
  const encryptedValue = Cookies.get(name);
  return encryptedValue ? decryptData(encryptedValue) : null;
}

// Function to Clear All Auth Cookies
export function clearAuth() {
  Cookies.remove("userId");
  Cookies.remove("role");
  Cookies.remove("onboarded");
  Cookies.remove("phone");
}


// Define types
export type UserRole = "guest" | "patient" | "donor" | "veterinary" | "hospital" | "organisation" | "admin" | "removed";
export type Onboarded = "guest" | "no" | "yes";
export type Device = "desktop" | "mobile";

// Define Context Interface
interface IUserContext {
  userId: string | null;
  role: UserRole;
  onboarded: Onboarded;
  device: Device;
  phone: string | null;
  isAuthLoading: boolean;
  setUser: (userId: string | null, role: UserRole, onboarded: Onboarded, phone?: string | null) => void;
  setDevice: (device: Device) => void;
  clearAuth: () => void;
}

// Create Context with default values
const UserContext = createContext<IUserContext>({
  userId: null,
  role: "guest",
  onboarded: "guest",
  device: "desktop",
  phone: null,
  isAuthLoading: true,
  setUser: () => { },
  setDevice: () => { },
  clearAuth: () => { },
});

// Provider Component
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [onboarded, setOnboarded] = useState<Onboarded>("guest");
  const [device, setDevice] = useState<Device>("desktop");
  const [phone, setPhone] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Function to update User Context
  function setUser(newUserId: string | null, newRole: UserRole, newStatus: Onboarded, newPhone?: string | null) {
    console.log("setUser called with:", { newUserId, newRole, newStatus, newPhone });

    setUserId(newUserId);
    setRole(newRole);
    setOnboarded(newStatus);
    if (newPhone !== undefined) setPhone(newPhone);

    // Store in cookies to persist session - handle null/undefined values
    try {
      setEncryptedCookie("userId", newUserId || "", 7);
      setEncryptedCookie("role", newRole || "guest", 7);
      setEncryptedCookie("onboarded", newStatus || "guest", 7);
      if (newPhone) setEncryptedCookie("phone", newPhone, 7);
    } catch (error) {
      console.error("Error setting user cookies:", error);
      // Continue even if cookies fail - user state is still set in React state
    }
  }

  // Function to update device
  function updateDevice(newDevice: Device) {
    setDevice(newDevice);
  }

  // Load stored user data from cookies on mount
  useEffect(() => {
    // Detect device on mount (client-side only)
    if (typeof window !== "undefined") {
      setDevice(window.innerWidth < 500 ? "mobile" : "desktop");
    }

    // Function to check auth status
    const checkAuth = async () => {
      setIsAuthLoading(true);

      try {
        const storedUserId = getDecryptedCookie("userId") || null;
        const storedRole = (getDecryptedCookie("role") as UserRole) || "guest";
        const storedStatus = (getDecryptedCookie("onboarded") as Onboarded) || "guest";
        const storedPhone = getDecryptedCookie("phone") || null;

        // FIX: Check if we have valid auth data
        if (storedUserId && storedUserId !== "" && storedRole && storedRole !== "guest") {
          // Valid session found - restore immediately
          console.log("Restoring session:", { storedUserId, storedRole, storedStatus });

          // Set state FIRST to prevent redirect
          setUserId(storedUserId);
          setRole(storedRole);
          setOnboarded(storedStatus);
          setPhone(storedPhone);

          // Then fetch fresh data in background
          let collectionName = "";
          switch (storedRole) {
            case "donor": collectionName = "donors"; break;
            case "patient": collectionName = "patients"; break;
            case "veterinary": collectionName = "veterinaries"; break;
            case "organisation": collectionName = "organisations"; break;
            case "hospital": collectionName = "veterinaries"; break;
            default: collectionName = "users";
          }

          if (collectionName && collectionName !== "users") {
            try {
              const docRef = doc(db, collectionName, storedUserId);
              const docSnap = await getDoc(docRef);

              if (docSnap.exists()) {
                const userData = docSnap.data();
                const freshOnboardedStatus = userData.onboarded === "yes" ? "yes" : "no";

                // Update only if different from cookie
                if (freshOnboardedStatus !== storedStatus) {
                  console.log("Updating onboarded status:", freshOnboardedStatus);
                  setOnboarded(freshOnboardedStatus as Onboarded);
                  setEncryptedCookie("onboarded", freshOnboardedStatus, 7);
                }

                // Update phone if available
                if (userData.phone && userData.phone !== storedPhone) {
                  setPhone(userData.phone);
                  setEncryptedCookie("phone", userData.phone, 7);
                }
              }
            } catch (err) {
              console.error("Error fetching fresh user data:", err);
              // Continue with cookie data - don't logout on error
            }
          }
        } else {
          // No valid session found - set as guest
          console.log("No valid session found");
          setUserId(null);
          setRole("guest");
          setOnboarded("guest");
          setPhone(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // On error, try to preserve session if cookies exist
        const storedUserId = getDecryptedCookie("userId");
        const storedRole = getDecryptedCookie("role") as UserRole;

        if (storedUserId && storedRole) {
          setUserId(storedUserId);
          setRole(storedRole);
          setOnboarded(getDecryptedCookie("onboarded") as Onboarded || "no");
          setPhone(getDecryptedCookie("phone"));
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // ADD after the main useEffect:
  useEffect(() => {
    // Re-check auth when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const storedUserId = getDecryptedCookie("userId");
        const storedRole = getDecryptedCookie("role") as UserRole;

        // Only update if we lost the session somehow
        if (storedUserId && storedRole && !userId) {
          console.log("Restoring lost session");
          setUserId(storedUserId);
          setRole(storedRole);
          setOnboarded(getDecryptedCookie("onboarded") as Onboarded || "no");
          setPhone(getDecryptedCookie("phone"));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  return (
    <UserContext.Provider value={{ userId, role, onboarded, device, phone, isAuthLoading, setUser, setDevice: updateDevice, clearAuth }}>
      {children}
    </UserContext.Provider>
  );
}

// Hook to access Context
export function useUser() {
  return useContext(UserContext);
}