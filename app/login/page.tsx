"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun, ArrowLeft } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import RoleCard from "@/components/ui/rolecard"
import { motion, AnimatePresence } from "framer-motion"
import { Variants } from "framer-motion";

import HeartLoading from "@/components/custom/HeartLoading"; // <HeartLoading />

import PEPhoneButton from "@/components/custom/PEPhoneButton"
import PEEmailButton from "@/components/custom/PEEmailButton"

//User Account 
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { loginUserDatabase, updateUserData } from "@/firebaseFunctions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

// Helper function to generate random userId (same as in firebaseFunctions.ts)
function generateUserId(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const partLength = 4;
  const parts = 6;
  let userId = [];

  for (let i = 0; i < parts; i++) {
    let segment = "";
    for (let j = 0; j < partLength; j++) {
      segment += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    userId.push(segment);
  }

  return userId.join("-");
}

async function getOnboardedStatus(userId: string, roleToCheck: string) {
  try {
    if (!userId) {
      return { exists: false, role: null, onboarded: "no", hasRole: false };
    }

    // Check users collection for main account
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { exists: false, role: null, onboarded: "no", hasRole: false };
    }

    const userData = userDocSnap.data();

    // Check if user has the requested role
    const userRoles = userData.roles || [userData.role];
    const hasRole = userRoles.includes(roleToCheck);

    // Check onboarded status in role-specific collection
    let roleOnboarded = "no";
    let roleCollection = "";

    switch (roleToCheck) {
      case "patient": roleCollection = "patients"; break;
      case "donor": roleCollection = "donors"; break;
      case "veterinary": roleCollection = "veterinaries"; break;
      case "organisation": roleCollection = "organisations"; break;
      default: roleCollection = "users";
    }

    if (roleCollection && roleCollection !== "users") {
      const roleDocRef = doc(db, roleCollection, userId);
      const roleDocSnap = await getDoc(roleDocRef);

      if (roleDocSnap.exists()) {
        const roleData = roleDocSnap.data();
        roleOnboarded = roleData.onboarded === "yes" ? "yes" : "no";
      }
    }

    return {
      exists: true,
      role: roleToCheck,
      onboarded: roleOnboarded,
      hasRole: hasRole,
      allRoles: userRoles
    };
  } catch (error) {
    console.error("Error fetching user status:", error);
    return { exists: false, role: null, onboarded: "no", hasRole: false };
  }
}

// ---------------- PATIENT ROLE LOGIN PAGE CONTENT ----------------------------

const PatientContent: React.FC = () => {
  const { setUser } = useUser();
  const router = useRouter();
  const [content, setContent] = useState<React.ReactElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerificationSuccess = async (data: {
    user_country_code: string;
    user_phone_number: string;
    user_first_name: string;
    user_last_name: string;
  }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setContent(<HeartLoading />);

    try {
      console.log("Starting patient login process...");

      // Store intended role in sessionStorage for onboarding page
      const intendedRole = "patient";
      sessionStorage.setItem('pendingRole', intendedRole);

      const userId = await loginUserDatabase("patient", data.user_country_code + data.user_phone_number);
      console.log("loginUserDatabase returned:", userId);

      // If backend returns null, generate a temporary ID and continue
      const finalUserId = userId || generateUserId();
      if (!userId) {
        console.log("Backend returned null, using temporary ID:", finalUserId);
      }

      const userStatus = await getOnboardedStatus(finalUserId, "patient");
      console.log("getOnboardedStatus returned:", userStatus);

      // If user doesn't have patient role yet (new to this role)
      if (!userStatus.hasRole) {
        console.log("User doesn't have patient role, will be created by loginUserDatabase");
        // loginUserDatabase already created it, now redirect to onboarding
        setUser(finalUserId, "patient", "no", data.user_country_code + data.user_phone_number);
        setIsProcessing(false);
        router.replace("/onboarding");
        return;
      }

      // User has patient role - check if onboarded
      const isOnboarded = userStatus.onboarded;
      console.log("User has patient role, onboarded status:", isOnboarded);

      setUser(finalUserId, "patient", isOnboarded === "yes" ? "yes" : "no", data.user_country_code + data.user_phone_number);
      setIsProcessing(false);

      if (isOnboarded === "yes") {
        router.push("/app/p/dashboard");
      } else {
        console.log("Patient not fully onboarded, redirecting to onboarding");
        router.push("/onboarding");
      }

    } catch (error) {
      console.error("Error during patient login:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("Error stack:", error?.stack);

      // Even if there's an error, generate a temporary ID and continue
      const fallbackUserId = generateUserId();
      console.log("Patient login failed, using fallback ID:", fallbackUserId);

      setUser(fallbackUserId, "guest", "no");
      setIsProcessing(false);
      router.replace("/onboarding");
    }
  };

  function defaultUI() {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Welcome, Patient!</h1>
        <p className="mb-4">
          Here you can request/find blood.
        </p>
        <form>
          <div className="flex justify-center items-center w-full h-full">
            <PEPhoneButton onVerify={handleVerificationSuccess} />
          </div>
        </form>
      </div >
    )
  }

  useEffect(() => {
    setContent(defaultUI());
  }, []);

  return <>{content}</>;
};

// ---------------- DONOR ROLE LOGIN PAGE CONTENT ----------------------------

const DonorContent: React.FC = () => {
  const { setUser } = useUser();
  const router = useRouter();
  const [content, setContent] = useState<React.ReactElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerificationSuccess = async (data: {
    user_country_code: string;
    user_phone_number: string;
    user_first_name: string;
    user_last_name: string;
  }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setContent(<HeartLoading />);

    try {
      console.log("Starting donor login process...");

      // Store intended role in sessionStorage for onboarding page
      const intendedRole = "donor";
      sessionStorage.setItem('pendingRole', intendedRole);

      const userId = await loginUserDatabase("donor", data.user_country_code + data.user_phone_number);
      console.log("loginUserDatabase returned:", userId);

      // If backend returns null, generate a temporary ID and continue
      const finalUserId = userId || generateUserId();
      if (!userId) {
        console.log("Backend returned null, using temporary ID:", finalUserId);
      }

      const userStatus = await getOnboardedStatus(finalUserId, "donor");
      console.log("getOnboardedStatus returned:", userStatus);

      // If user doesn't have donor role yet (new to this role)
      if (!userStatus.hasRole) {
        console.log("User doesn't have donor role, will be created by loginUserDatabase");
        // loginUserDatabase already created it, now redirect to onboarding
        setUser(finalUserId, "donor", "no", data.user_country_code + data.user_phone_number);
        setIsProcessing(false);
        router.replace("/onboarding");
        return;
      }

      // User has donor role - check if onboarded
      const isOnboarded = userStatus.onboarded;
      console.log("User has donor role, onboarded status:", isOnboarded);

      setUser(finalUserId, "donor", isOnboarded === "yes" ? "yes" : "no", data.user_country_code + data.user_phone_number);
      setIsProcessing(false);

      if (isOnboarded === "yes") {
        router.push("/app/d/dashboard");
      } else {
        console.log("Donor not fully onboarded, redirecting to onboarding");
        router.push("/onboarding");
      }

    } catch (error) {
      console.error("Error during login:", error);
      // Even if there's an error, generate a temporary ID and continue
      const fallbackUserId = generateUserId();
      console.log("Login failed, using fallback ID:", fallbackUserId);

      setUser(fallbackUserId, "guest", "no");
      setIsProcessing(false);
      router.replace("/onboarding");
    }
  };

  function defaultUI() {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Welcome, Donor!</h1>
        <p className="mb-4">Here you can donate blood.</p>
        <form>
          <div className="flex justify-center items-center w-full h-full">
            <PEPhoneButton onVerify={handleVerificationSuccess} />
          </div>
        </form>
      </div>
    );
  }

  useEffect(() => {
    setContent(defaultUI());
  }, []);

  return <>{content}</>;
};



// ---------------- VETERINARY ROLE LOGIN PAGE CONTENT ----------------------------


const VeterinaryContent: React.FC = () => {
  const { setUser } = useUser();
  const router = useRouter();
  const [content, setContent] = useState<React.ReactElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerificationSuccess = async (data: {
    user_email: string;
  }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setContent(<HeartLoading />);

    try {
      console.log("Starting veterinary login process...");

      // Store intended role in sessionStorage for onboarding page
      const intendedRole = "veterinary";
      sessionStorage.setItem('pendingRole', intendedRole);

      const userId = await loginUserDatabase("veterinary", data.user_email);
      console.log("loginUserDatabase returned:", userId);

      // If backend returns null, generate a temporary ID and continue
      const finalUserId = userId || generateUserId();
      if (!userId) {
        console.log("Backend returned null, using temporary ID:", finalUserId);
      }

      const userStatus = await getOnboardedStatus(finalUserId, "veterinary");
      console.log("getOnboardedStatus returned:", userStatus);

      // If user doesn't have veterinary role yet (new to this role)
      if (!userStatus.hasRole) {
        console.log("User doesn't have veterinary role, will be created by loginUserDatabase");
        setUser(finalUserId, "veterinary", "no");
        setIsProcessing(false);
        router.replace("/onboarding");
        return;
      }

      // User has veterinary role - check if onboarded
      const isOnboarded = userStatus.onboarded;
      console.log("User has veterinary role, onboarded status:", isOnboarded);

      setUser(finalUserId, "veterinary", isOnboarded === "yes" ? "yes" : "no");
      setIsProcessing(false);

      if (isOnboarded === "yes") {
        router.push("/app/h/dashboard");
      } else {
        console.log("Veterinary not fully onboarded, redirecting to onboarding");
        router.push("/onboarding");
      }

    } catch (error) {
      console.error("Error during login:", error);
      // Even if there's an error, generate a temporary ID and continue
      const fallbackUserId = generateUserId();
      console.log("Login failed, using fallback ID:", fallbackUserId);

      setUser(fallbackUserId, "guest", "no");
      setIsProcessing(false);
      router.replace("/onboarding");
    }
  };

  function defaultUI() {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Registering as a Veterinary Clinic 🏥</h1>
        <p className="mb-4">
          Connect directly with dog donors to get the blood your patients need.
        </p>
        <form>
          <div className="flex justify-center items-center w-full h-full pb-4">
            <PEEmailButton onVerify={handleVerificationSuccess} />
          </div>
        </form>
        <p className="text-gray-500 text-sm">Only professional emails allowed. No @gmail, @outlook, etc. Personal emails are currently allowed for testing.</p>
      </div>
    );
  }

  useEffect(() => {
    setContent(defaultUI());
  }, []);

  return <>{content}</>;
};


// ---------------- ORGANISATION ROLE LOGIN PAGE CONTENT ----------------------------

const OrganisationContent: React.FC = () => {
  const { setUser } = useUser();
  const router = useRouter();
  const [content, setContent] = useState<React.ReactElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerificationSuccess = async (data: {
    user_email: string;
  }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setContent(<HeartLoading />);

    try {
      console.log("Starting organisation login process...");

      // Store intended role in sessionStorage for onboarding page
      const intendedRole = "organisation";
      sessionStorage.setItem('pendingRole', intendedRole);

      const userId = await loginUserDatabase("organisation", data.user_email);
      console.log("loginUserDatabase returned:", userId);

      // If backend returns null, generate a temporary ID and continue
      const finalUserId = userId || generateUserId();
      if (!userId) {
        console.log("Backend returned null, using temporary ID:", finalUserId);
      }

      const userStatus = await getOnboardedStatus(finalUserId, "organisation");
      console.log("getOnboardedStatus returned:", userStatus);

      // Check if user exists in users collection
      if (!userStatus.exists) {
        // New User - redirect to onboarding with intended role
        console.log("New user detected, redirecting to onboarding");
        setUser(finalUserId, intendedRole as any, "no");
        setIsProcessing(false);
        router.replace("/onboarding");
        return;
      }

      // Old User - redirect to specific dashboard based on role
      const userRole = userStatus.role;
      const isOnboarded = userStatus.onboarded;
      console.log("Existing user detected - role:", userRole, "onboarded:", isOnboarded);

      setUser(finalUserId, userRole, isOnboarded === "yes" ? "yes" : "no");
      setIsProcessing(false);

      // STRICT CHECK: Only redirect to dashboard if onboarded === 'yes'
      if (isOnboarded === "yes") {
        // Redirect to role-specific dashboard
        switch (userRole) {
          case "patient":
            router.push("/app/p/dashboard");
            break;
          case "donor":
            router.push("/app/d/dashboard");
            break;
          case "veterinary":
            router.push("/app/h/dashboard");
            break;
          case "organisation":
            router.push("/app/o/dashboard");
            break;
          default:
            router.push("/app");
        }
      } else {
        // FORCE ONBOARDING: If document missing OR onboarded is not 'yes'
        console.log("User not fully onboarded, redirecting to onboarding");
        router.push("/onboarding");
      }

    } catch (error) {
      console.error("Error during login:", error);
      // Even if there's an error, generate a temporary ID and continue
      const fallbackUserId = generateUserId();
      console.log("Login failed, using fallback ID:", fallbackUserId);

      setUser(fallbackUserId, "guest", "no");
      setIsProcessing(false);
      router.replace("/onboarding");
    }
  };

  function defaultUI() {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Registering as an Organisation/NGO 👥</h1>
        <p className="mb-4">
          Organize donation drives and support those in urgent need.
        </p>
        <form>
          <div className="flex justify-center items-center w-full h-full pb-4">
            <PEEmailButton onVerify={handleVerificationSuccess} />
          </div>
        </form>
        <p className="text-gray-500 text-sm">Only professional emails allowed. No @gmail, @outlook, etc. Personal emails are currently allowed for testing.</p>
      </div>
    );
  }

  useEffect(() => {
    setContent(defaultUI());
  }, []);

  return <>{content}</>;
};


// --------------------------------
// --------------------------------
// --------------------------------


// ---------------- ROLE SELECTION PAGE CONTENT ----------------------------

// Items for role selection
const items = [
  {
    title: "Continue as Patient",
    description:
      "Sign up to quickly request blood!",
    image: "/cs_patient.webp",
  },
  {
    title: "Continue as Donor",
    description:
      "Register to see where your donation saves lives.",
    image: "/cs_donor.webp",
  }
  ,
  {
    title: "Continue as Veterinary Clinic Admin",
    description:
      "Manage a local clinic branch in the Ambattur network and sync data with the main hospital.",
    image: "/cs_hospital.webp",
    // comingSoon removed
  },
  {
    title: "Continue as Veterinary Hospital",
    description:
      "Central CRM hub for hospital operations, managing multiple clinic branches and large-scale blood inventory.",
    image: "/cs_organisation.webp",
    comingSoon: true,
  },
]

interface RoleContentProps {
  role: typeof items[0];
}

const RoleContent: React.FC<RoleContentProps> = ({ role }) => {
  switch (role.title) {
    case "Continue as Patient":
      return <PatientContent />
    case "Continue as Donor":
      return <DonorContent />
    case "Continue as Veterinary Clinic Admin":
      return <VeterinaryContent />
    case "Continue as Organisation/NGO":
      return <OrganisationContent />

    default:
      return (
        <div>
          <h1 className="text-2xl font-bold mb-4">
            You selected: {role.title}
          </h1>
          <p className="mb-4">{role.description}</p>
        </div>
      )
  }
}





// ---------------- DEFAULT FUNCTION THAT BRINGS EVERYTHING TOGETHER AND HANDLES ROLE SELECTION --------------------
// -------------------& TRANSITION TO ROLE LOGIN PAGE CONTENT ----------------------------

export default function LoginPage() {
  const { setTheme } = useTheme()
  const [selectedRole, setSelectedRole] = useState<null | typeof items[0]>(null)
  const [direction, setDirection] = useState(1)

  const handleRoleSelect = (role: typeof items[0]) => {
    setDirection(1)
    setSelectedRole(role)
  }

  const handleGoBack = () => {
    setDirection(-1)
    setSelectedRole(null)
  }

  // Get user data from context
  const { userId, role, onboarded, device } = useUser();
  const router = useRouter();

  // Redirect loggedins (userId != null) to app
  useEffect(() => {
    if (userId !== null) {
      const timeout = setTimeout(() => {
        router.push("/app");
      }, 1000);

      return () => clearTimeout(timeout); // Cleanup function to avoid memory leaks
    }
  }, [userId, router]);

  // Define variants with explicit transitions.
  const roleSelectionVariants: Variants = {
    initial: (dir: number) => (dir === -1 ? { x: "-100%" } : { x: 0 }),
    animate: {
      x: 0,
      transition: { type: "tween", duration: 0.1, ease: "easeInOut" },
    },
    exit: {
      x: "-100%",
      transition: { type: "tween", duration: 0.1, ease: "easeInOut" },
    },
  }

  const newScreenVariants: Variants = {
    initial: { x: "100%" },
    animate: {
      x: 0,
      transition: { type: "tween", duration: 0.1, ease: "easeInOut" },
    },
    exit: {
      x: "100%",
      transition: { type: "tween", duration: 0.1, ease: "easeInOut" },
    },
  }


  const { setUser } = useUser();

  // Using test data here
  function handleLogin(role: string) {
    const userId = "ABCD-EFGH"
    setUser(userId, "veterinary", "no");
    router.push("/app");
  }

  return (<>

    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Theme Toggler at top right */}
      <div className="absolute top-0 right-0 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Animate between screens */}
      <AnimatePresence mode="wait">
        {selectedRole === null ? (
          // Role selection screen
          <motion.div
            key="role-selection"
            custom={direction}
            variants={roleSelectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute w-full left-0 "
          >
            <div className="max-w-6xl mx-auto p-5 md:p-8 gap-5 md:gap-8 grid grid-cols-1">
              {items.map((item, i) => (
                <RoleCard
                  key={i}
                  image={item.image}
                  title={item.title}
                  description={item.description}
                  comingSoon={item.comingSoon}
                  onClick={() => handleRoleSelect(item)}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          // New screen for the selected role.
          <motion.div
            key="new-screen"
            variants={newScreenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute w-screen flex flex-col items-center justify-center p-10"
          >
            {/* Wrap content in a centered container */}
            <div className="relative max-w-6xl mx-auto">
              <RoleContent role={selectedRole} />
              <div className="absolute top-[-50px] left-0">
                <Button
                  className="text-fg bg-bg border border-border focus:outline-none hover:bg-accent font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-background dark:text-foreground dark:border-border dark:hover:bg-accent"
                  onClick={handleGoBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



    </div>

  </>
  )
}
