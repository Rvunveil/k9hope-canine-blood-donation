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

        if (storedUserId && storedRole && storedRole !== "guest") {
          // Fetch fresh data from Firestore to get confirmed onboarded status
          // Determine collection based on role
          let collectionName = "";
          switch (storedRole) {
            case "donor": collectionName = "donors"; break;
            case "patient": collectionName = "patients"; break;
            case "veterinary": collectionName = "veterinaries"; break;
            case "organisation": collectionName = "organisations"; break;
            case "hospital": collectionName = "veterinaries"; break; // Handle hospital alias
            default: collectionName = "users";
          }

          if (collectionName) {
            try {
              const docRef = doc(db, collectionName, storedUserId);
              const docSnap = await getDoc(docRef);

              if (docSnap.exists()) {
                const userData = docSnap.data();
                // Update state with fresh data from DB
                setUserId(storedUserId);
                setRole(storedRole);
                const freshOnboardedStatus = userData.onboarded === "yes" ? "yes" : "no";
                setOnboarded(freshOnboardedStatus as Onboarded);
                setPhone(userData.phone || storedPhone);

                // Update cookies to match DB if different
                if (freshOnboardedStatus !== storedStatus) {
                  setEncryptedCookie("onboarded", freshOnboardedStatus, 7);
                }
              } else {
                // Fallback to cookie data if doc fetch fails (e.g. offline) or doc missing
                setUserId(storedUserId);
                setRole(storedRole);
                setOnboarded(storedStatus);
                setPhone(storedPhone);
              }
            } catch (err) {
              console.error("Error fetching fresh user data:", err);
              // Fallback to cookie data
              setUserId(storedUserId);
              setRole(storedRole);
              setOnboarded(storedStatus);
              setPhone(storedPhone);
            }
          } else {
            setUserId(storedUserId);
            setRole(storedRole);
            setOnboarded(storedStatus);
            setPhone(storedPhone);
          }
        } else {
          // Guest or incomplete auth
          setUserId(storedUserId !== "" ? storedUserId : null);
          setRole(storedRole);
          setOnboarded(storedStatus);
          setPhone(storedPhone);
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

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





// My Notes

/* 

|| States & Variables ||

userid: string

role: { default: guest, patient, donor, hospital, organisation, admin, banned }

onboarded: {default: guest | boolean}

device: { desktop, mobile }

perf: { low, high } 

*/