// import Firestore & its functions
import { db } from "@/firebaseConfig";
import { doc, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, query, where, deleteDoc, orderBy, limit } from "firebase/firestore";
import { signInAnonymously, signOut } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { DonorData, PatientData, VeterinaryData, OrganisationData, UserData } from "@/types";

// import current user context
import { } from "@/context/UserContext"

// func to generate random userid (my format) for new users.
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

// func to login users to database.
// checks if based on role, whether user's login is present in a collection in that role's doc.
// if yes: get the userId of that collection and set it in user context.
// if  no: create new collection in that role's doc with new userId and set LoginID into it.

export async function loginUserDatabase(role: string, loginId: string) {
    try {
        console.log("Attempting login for role:", role, "with loginId:", loginId);

        // Remove anonymous authentication - work with permissive Firestore rules instead
        console.log("Proceeding without Firebase authentication");

        switch (role) {
            case "patient": {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("phone", "==", loginId.toLowerCase().trim()));

                try {
                    const querySnapshot = await getDocs(q);
                    console.log("Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

                    // If User exists in users collection, return existing userId
                    if (!querySnapshot.empty) {
                        const existingUserId = querySnapshot.docs[0].id;
                        console.log("User exists, returning userId:", existingUserId);
                        return existingUserId;
                    }
                } catch (queryError) {
                    console.error("Error querying users collection:", queryError);
                    console.error("Query error details:", JSON.stringify(queryError, null, 2));
                    // Continue to user creation even if query fails
                }

                // If User does NOT exist, create a new one in users collection
                const userId = generateUserId();
                console.log("Creating new user with ID:", userId);

                try {
                    const userDocRef = doc(db, "users", userId);

                    await setDoc(userDocRef, {
                        phone: loginId.toLowerCase().trim(),
                        role: "patient",
                        onboarded: "no",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true });

                    console.log("Successfully created user in users collection");

                    // Also create entry in patients collection for detailed data
                    const patientDocRef = doc(db, "patients", userId);
                    await setDoc(patientDocRef, {
                        phone: loginId.toLowerCase().trim(),
                        onboarded: "no",
                        createdAt: new Date(),
                        role: "individual"
                    }, { merge: true });

                    console.log("New user created with ID:", userId);
                    return userId; // Always return userId, never null
                } catch (createError) {
                    console.error("Error creating user:", createError);
                    console.error("Create error details:", JSON.stringify(createError, null, 2));
                    // Even if Firestore fails, return generated userId
                    console.log("Returning generated userId despite Firestore error:", userId);
                    return userId;
                }
            }

            case "donor": {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("phone", "==", loginId.toLowerCase().trim()));

                try {
                    const querySnapshot = await getDocs(q);
                    console.log("Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

                    // ✅ If User exists in users collection, return existing userId
                    if (!querySnapshot.empty) {
                        const existingUserId = querySnapshot.docs[0].id;
                        console.log("User exists, returning userId:", existingUserId);
                        return existingUserId;
                    }
                } catch (queryError) {
                    console.error("Error querying users collection:", queryError);
                    // Continue to user creation even if query fails
                }

                // ❌ If User does NOT exist, create a new one in users collection
                const userId = generateUserId();
                console.log("Creating new user with ID:", userId);

                try {
                    const userDocRef = doc(db, "users", userId);

                    await setDoc(userDocRef, {
                        phone: loginId.toLowerCase().trim(),
                        role: "donor",
                        onboarded: "no",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true });

                    console.log("Successfully created user in users collection");

                    // Also create entry in canines collection for detailed data
                    const canineDocRef = doc(db, "canines", userId);
                    await setDoc(canineDocRef, {
                        phone: loginId.toLowerCase().trim(),
                        onboarded: "no",
                        createdAt: new Date(),
                        role: "individual"
                    }, { merge: true });

                    console.log("New user created with ID:", userId);
                    return userId; // Always return userId, never null
                } catch (createError) {
                    console.error("Error creating user:", createError);
                    // Even if Firestore fails, return the generated userId
                    console.log("Returning generated userId despite Firestore error:", userId);
                    return userId;
                }
            }

            case "veterinary": {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("email", "==", loginId.toLowerCase().trim()));

                try {
                    const querySnapshot = await getDocs(q);
                    console.log("Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

                    // ✅ If User exists in users collection, return existing userId
                    if (!querySnapshot.empty) {
                        const existingUserId = querySnapshot.docs[0].id;
                        console.log("User exists, returning userId:", existingUserId);
                        return existingUserId;
                    }
                } catch (queryError) {
                    console.error("Error querying users collection:", queryError);
                    // Continue to user creation even if query fails
                }

                // ❌ If User does NOT exist, create a new one in users collection
                const userId = generateUserId();
                console.log("Creating new user with ID:", userId);

                try {
                    const userDocRef = doc(db, "users", userId);

                    await setDoc(userDocRef, {
                        email: loginId.toLowerCase().trim(),
                        role: "veterinary",
                        onboarded: "no",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true });

                    console.log("Successfully created user in users collection");

                    // Also create entry in clinics collection for detailed data
                    const clinicDocRef = doc(db, "clinics", userId);
                    await setDoc(clinicDocRef, {
                        email: loginId.toLowerCase().trim(),
                        onboarded: "no",
                        createdAt: new Date(),
                        role: "organization"
                    }, { merge: true });

                    console.log("New user created with ID:", userId);
                    return userId; // Always return userId, never null
                } catch (createError) {
                    console.error("Error creating user:", createError);
                    // Even if Firestore fails, return the generated userId
                    console.log("Returning generated userId despite Firestore error:", userId);
                    return userId;
                }
            }

            case "organisation": {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("email", "==", loginId.toLowerCase().trim()));

                try {
                    const querySnapshot = await getDocs(q);
                    console.log("Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

                    // ✅ If User exists in users collection, return existing userId
                    if (!querySnapshot.empty) {
                        const existingUserId = querySnapshot.docs[0].id;
                        console.log("User exists, returning userId:", existingUserId);
                        return existingUserId;
                    }
                } catch (queryError) {
                    console.error("Error querying users collection:", queryError);
                    // Continue to user creation even if query fails
                }

                // ❌ If User does NOT exist, create a new one in users collection
                const userId = generateUserId();
                console.log("Creating new user with ID:", userId);

                try {
                    const userDocRef = doc(db, "users", userId);

                    await setDoc(userDocRef, {
                        email: loginId.toLowerCase().trim(),
                        role: "organisation",
                        onboarded: "no",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true });

                    console.log("Successfully created user in users collection");

                    // Also create entry in organisations collection for detailed data
                    const orgDocRef = doc(db, "organisations", userId);
                    await setDoc(orgDocRef, {
                        email: loginId.toLowerCase().trim(),
                        onboarded: "no",
                        createdAt: new Date(),
                        role: "organization"
                    }, { merge: true });

                    console.log("New user created with ID:", userId);
                    return userId; // Always return userId, never null
                } catch (createError) {
                    console.error("Error creating user:", createError);
                    // Even if Firestore fails, return the generated userId
                    console.log("Returning generated userId despite Firestore error:", userId);
                    return userId;
                }
            }

            default:
                alert("Invalid role");
                return null;
        }
    }
    catch (error) {
        console.error("Error handling user login:", error);
        return null;
    }
}

export async function getUserDataById(userId: string, role: string): Promise<UserData | null> {
    if (role == "patient") {
        try {
            const docRef = doc(db, "patients", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("patient Data:", docSnap.data());
                return { id: docSnap.id, ...docSnap.data() } as PatientData;
            } else {
                console.log("No such patient found!");
                return null;
            }
        } catch (error) {
            console.error("Error fetching patient:", error);
            return null;
        }
    }
    else if (role == "donor") {
        try {
            const docRef = doc(db, "donors", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Donor Data:", docSnap.data());
                return { id: docSnap.id, ...docSnap.data() } as DonorData;
            } else {
                console.log("No such Donor found!");
                return null;
            }
        } catch (error) {
            console.error("Error fetching Donor:", error);
            return null;
        }
    }
    else if (role == "veterinary") {
        try {
            const docRef = doc(db, "veterinaries", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Veterinary Data:", docSnap.data());
                return { id: docSnap.id, ...docSnap.data() } as VeterinaryData;
            } else {
                console.log("No such veterinary found!");
                return null;
            }
        } catch (error) {
            console.error("Error fetching veterinary:", error);
            return null;
        }
    }
    else if (role == "organisation") {
        try {
            const docRef = doc(db, "organisations", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("organisation Data:", docSnap.data());
                return { id: docSnap.id, ...docSnap.data() } as OrganisationData;
            } else {
                console.log("No such organisation found!");
                return null;
            }
        } catch (error) {
            console.error("Error fetching organisation:", error);
            return null;
        }
    }
    return null;
}


// func to update data of a user/collection in their role's doc
// func to update data of a user/collection in their role's doc
export async function updateUserData(
    collection: string,
    userId: string,
    data: any
): Promise<{ success: boolean; message: string }> {
    try {
        const docRef = doc(db, collection, userId);

        // Use merge: true to update existing fields or create new document
        await setDoc(docRef, data, { merge: true });

        return {
            success: true,
            message: "User data updated successfully"
        };
    } catch (error: any) {
        console.error("Error updating user data:", error);
        return {
            success: false,
            message: error.message || "Failed to update user data"
        };
    }
}



export async function deleteUserById(userId: string, role: string) {
    if (role == "patient") {
        try {
            const docRef = doc(db, "patients", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Patient Data:", docSnap.data());
                // Deleting the patient document
                await deleteDoc(docRef);
                console.log("Patient document deleted.");
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                console.log("No such patient found!");
                return null;
            }
        } catch (error) {
            console.error("Error deleting patient:", error);
            return null;
        }
    }
    else if (role == "donor") {
        try {
            const docRef = doc(db, "donors", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Donor Data:", docSnap.data());
                // Deleting the donor document
                await deleteDoc(docRef);
                console.log("Donor document deleted.");
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                console.log("No such Donor found!");
                return null;
            }
        } catch (error) {
            console.error("Error deleting Donor:", error);
            return null;
        }
    }
    else if (role == "veterinary") {
        try {
            const docRef = doc(db, "veterinaries", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Veterinary Data:", docSnap.data());
                // Deleting the veterinary document
                await deleteDoc(docRef);
                console.log("Veterinary document deleted.");
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                console.log("No such veterinary found!");
                return null;
            }
        }
        catch (error) {
            console.error("Error deleting veterinary:", error);
            return null;
        }
    }

    else if (role == "organisation") {
        try {
            const docRef = doc(db, "organisations", userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("organisation Data:", docSnap.data());
                // Deleting the organisation document
                await deleteDoc(docRef);
                console.log("organisation document deleted.");
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                console.log("No such organisation found!");
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }
}

// ==================== DONOR DASHBOARD FUNCTIONS ====================

// Get donor's donation history
export async function getDonorHistory(donorId: string) {
    try {
        const donationsRef = collection(db, "donations");
        const q = query(
            donationsRef,
            where("donorId", "==", donorId),
            orderBy("donationDate", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching donor history:", error);
        return [];
    }
}

// Get urgent blood requests (patients with urgency = immediate or within_24_hours)
export async function getUrgentRequests(donorCity?: string, donorBloodType?: string, onlyUrgent: boolean = true) {
    try {
        const patientsRef = collection(db, "patients");

        // Query for onboarded patients
        const q = query(
            patientsRef,
            where("onboarded", "==", "yes"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Client-side filtering for urgency if requested
        if (onlyUrgent) {
            requests = requests.filter((req: any) =>
                req.p_urgencyRequirment === "immediate" ||
                req.p_urgencyRequirment === "within_24_hours"
            );
        }

        // Client-side filtering for blood type match
        if (donorBloodType) {
            requests = requests.filter((req: any) => req.p_bloodgroup === donorBloodType);
        }

        // Prioritize same city
        if (donorCity) {
            requests = requests.sort((a: any, b: any) => {
                const aMatch = a.p_city?.toLowerCase() === donorCity.toLowerCase() ? 0 : 1;
                const bMatch = b.p_city?.toLowerCase() === donorCity.toLowerCase() ? 0 : 1;
                return aMatch - bMatch;
            });
        }

        return requests.slice(0, onlyUrgent ? 6 : 20); // Return more results if not just urgent
    } catch (error) {
        console.error("Error fetching requests:", error);
        return [];
    }
}

// Get donor stats (total donations, lives saved)
export async function getDonorStats(donorId: string) {
    try {
        const donationsRef = collection(db, "donations");
        const q = query(donationsRef, where("donorId", "==", donorId));
        const snapshot = await getDocs(q);

        const totalDonations = snapshot.size;
        const livesSaved = totalDonations * 3; // Each donation helps ~3 patients

        const donations = snapshot.docs.map(doc => doc.data());
        let lastDonation = null;

        if (donations.length > 0) {
            // Sort by donation date and get the most recent
            const sortedDonations = donations.sort((a: any, b: any) => {
                const dateA = a.donationDate?.toDate ? a.donationDate.toDate() : new Date(a.donationDate);
                const dateB = b.donationDate?.toDate ? b.donationDate.toDate() : new Date(b.donationDate);
                return dateB.getTime() - dateA.getTime();
            });

            const mostRecent = sortedDonations[0];
            lastDonation = mostRecent.donationDate?.toDate ? mostRecent.donationDate.toDate() : new Date(mostRecent.donationDate);
        }

        // Calculate next eligible date (8 weeks from last donation)
        let nextEligible = "Now";
        let nextEligibleDate = null;

        if (lastDonation) {
            const eligibleDate = new Date(lastDonation);
            eligibleDate.setDate(eligibleDate.getDate() + 56); // 8 weeks = 56 days
            nextEligibleDate = eligibleDate;

            if (eligibleDate > new Date()) {
                nextEligible = eligibleDate.toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        }

        return {
            totalDonations,
            livesSaved,
            lastDonation: lastDonation ? lastDonation.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : "Never",
            lastDonationDate: lastDonation,
            nextEligible,
            nextEligibleDate,
            isEligible: nextEligible === "Now"
        };
    } catch (error) {
        console.error("Error fetching donor stats:", error);
        return {
            totalDonations: 0,
            livesSaved: 0,
            lastDonation: "Never",
            lastDonationDate: null,
            nextEligible: "Now",
            nextEligibleDate: null,
            isEligible: true
        };
    }
}

// Calculate distance between two locations (simplified - can use Google Maps API later)
export function calculateDistance(city1: string, city2: string): string {
    // For MVP: return "nearby" for same city, "X km" otherwise
    if (city1?.toLowerCase() === city2?.toLowerCase()) {
        return "2-5 km away"; // Placeholder for same city
    }
    return "15+ km away"; // Placeholder for different city
}

// Get donor's upcoming and past appointments
export async function getDonorAppointments(donorId: string) {
    try {
        const appointmentsRef = collection(db, "appointments");
        const q = query(
            appointmentsRef,
            where("donorId", "==", donorId),
            orderBy("appointmentDate", "desc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return [];
    }
}