//Basic Imports
// @ts-nocheck
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

//User Imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { updateUserData } from "@/firebaseFunctions"

// Fetch a single donor by userId
export async function getDonorById(userId: string) {
    try {
        const docRef = doc(db, "donors", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Donor Data:", docSnap.data());
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            console.log("No such donor found!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching Donor:", error);
        return null;
    }
}

// Theme Changer Imports
import { useTheme } from "next-themes"
import { Moon, Sun, CalendarIcon } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"



import HeartLoading from "@/components/custom/HeartLoading"; // <HeartLoading />


// Form Component Imports
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { parse, differenceInYears, format } from "date-fns";
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import LocationSelector from "@/components/ui/location-input"
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import { Calendar } from "@/components/ui/calendar";
import { CalendarFull } from "@/components/ui/calendar-full";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import { UploadClient } from "@uploadcare/upload-client";
const client = new UploadClient({ publicKey: process.env.NEXT_PUBLIC_UPLOADCARE_PUB_KEY });


const dobSchema = z
    .string()
    .refine((dateString) => {
        const date = parse(dateString, "yyyy-MM-dd", new Date());
        const age = differenceInYears(new Date(), date);
        return age >= 1 && age <= 8;
    }, { message: "Dog age must be between 1 and 8 years for donation eligibility." });

const formSchema = z.object({
    phone: z.string(),
    email: z.string().email("Invalid email address"),

    // Section A: Location
    d_region: z.tuple([z.string(), z.string().optional()]).optional(),
    d_city: z.string().min(1, "City is required"),
    d_pincode: z.string().min(1, "Pincode is required"),

    // Section B: Dog Details
    d_name: z.string().min(1, "Dog's name is required"),
    d_logo_url: z.string().optional(),
    d_dob: dobSchema,
    d_breed: z.string().min(1, "Breed is required"),
    d_gender: z.string(),
    d_bloodgroup: z.string(),
    d_weight_kg: z.preprocess(
        (val) => Number(val),
        z.number().min(25, { message: "Dog weight must be at least 25kg to be eligible." })
    ),
    d_spayed_neutered: z.string(),

    // Section C: Medical History
    d_vaccinations_core: z.boolean().default(false).optional(),
    d_vaccinations_rabies: z.boolean().default(false).optional(),
    d_vaccinations_boosters: z.boolean().default(false).optional(),

    d_transfusion_history: z.string(),
    d_isMedication: z.string(),
    d_specifyMedication: z.string().max(500).optional(),
    d_travelled_abroad: z.string(),
    d_general_health: z.string(),
    d_health_conditions: z.string().max(500).optional(),

    // Section D: Vet Details
    vet_practice_name: z.string().min(1, "Vet practice name is required"),
    vet_surgeon_name: z.string().min(1, "Vet surgeon name is required"),
    vet_practice_phone: z.string().min(1, "Vet practice phone is required"),

    // Section E: Emergency Contact
    emergency_contact_name: z.string().min(1, "Emergency contact name is required"),
    emergency_contact_phone: z.string().min(1, "Emergency contact phone is required"),
    emergency_contact_relationship: z.string().min(1, "Relationship is required"),

    // Section F: Consent
    consent_owner_legal: z.boolean().refine(val => val === true, "Must confirm legal ownership"),
    consent_health_screening: z.boolean().refine(val => val === true, "Must consent to health screening"),
    consent_contact: z.boolean().refine(val => val === true, "Must consent to contact"),
    consent_voluntary: z.boolean().refine(val => val === true, "Must understand voluntary nature"),
    consent_truthful: z.boolean().refine(val => val === true, "Must confirm truthfulness"),

    signature_name: z.string().min(1, "Digital signature is required"),
    signature_date: z.string(),

    // Legacy/System fields
    onboarded: z.string(),
    totalDonations: z.number(),

    // Deprecated but keeping ensuring no breaks if listed elsewhere
    d_isLastDonation: z.string().optional(),
    d_dateLastDonation: z.string().optional(),
    d_isSmoker: z.string().optional(),
    d_isAlcoholic: z.string().optional(),
    d_willingRegular: z.string().optional(),
    d_availableEmergency: z.string().optional(),
});


export default function OnboardingDon() {

    const { userId, role, device, phone, setUser } = useUser();
    const router = useRouter();

    // Import Cookies for logout
    const Cookies = require("js-cookie");

    //Logout Function
    function handleLogout() {
        Cookies.remove("userId");
        Cookies.remove("role");
        Cookies.remove("onboarded");
        Cookies.remove("phone");
        setUser(null, "guest", "guest");
        router.push("/");
    }

    //Theme
    const { setTheme } = useTheme()

    //loading state
    const [isLoading, setIsLoading] = useState(false);

    const [countryName, setCountryName] = useState<string>('')
    const [stateName, setStateName] = useState<string>('')
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());


    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            phone: phone ?? "",
            email: "",
            onboarded: "yes",
            totalDonations: 0,

            d_isMedication: "no",
            d_transfusion_history: "no",
            d_travelled_abroad: "no",
            d_general_health: "yes",

            d_vaccinations_core: false,
            d_vaccinations_rabies: false,
            d_vaccinations_boosters: false,

            consent_owner_legal: false,
            consent_health_screening: false,
            consent_contact: false,
            consent_voluntary: false,
            consent_truthful: false,

            signature_date: new Date().toISOString().split('T')[0],

            d_isLastDonation: "no",
            d_isSmoker: "no",
            d_isAlcoholic: "no",
            d_willingRegular: "no",
            d_availableEmergency: "no",
        },
    })

    useEffect(() => {
        if (phone !== undefined && phone !== null) {
            form.reset({
                phone: phone || "",
                email: "",
                onboarded: "yes",
                totalDonations: 0,

                d_isMedication: "no",
                d_transfusion_history: "no",
                d_travelled_abroad: "no",
                d_general_health: "yes",

                d_vaccinations_core: false,
                d_vaccinations_rabies: false,
                d_vaccinations_boosters: false,

                consent_owner_legal: false,
                consent_health_screening: false,
                consent_contact: false,
                consent_voluntary: false,
                consent_truthful: false,

                signature_date: new Date().toISOString().split('T')[0],
            });
        }
    }, [phone, form]);

    const isOnMedication = form.watch("d_isMedication") === "yes";
    const isGeneralHealthIssue = form.watch("d_general_health") === "no";

    // SUBMIT FORM FUNCTION
    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setIsLoading(true);
            const formValues = form.getValues();
            const sanitizedData = {
                ...Object.fromEntries(
                    Object.entries(formValues).filter(([_, value]) => {
                        return (
                            value !== undefined &&
                            typeof value !== "function" &&
                            (typeof value !== "object" || value === null || Array.isArray(value))
                        );
                    })
                ),
                onboarded: "yes" // CRITICAL: Force onboarded to "yes"
            };

            const response = await updateUserData("donors", userId, sanitizedData);

            if (!response.success) {
                setIsLoading(false);
                alert("Error updating user: " + response.message);
                return;
            }

            console.log("User updated successfully:", response.message);

            // Also update users collection with onboarded status
            const userData = {
                role: "donor",
                onboarded: "yes",
                phone: phone,
                email: sanitizedData.email,
                updatedAt: new Date()
            };

            const userResponse = await updateUserData("users", userId, userData);

            if (!userResponse.success) {
                setIsLoading(false);
                alert("Error updating user collection: " + userResponse.message);
                return;
            }

            console.log("User collection updated successfully");

            // update onboarding in usercontext AFTER successful DB update
            setUser(userId, "donor", "yes", phone);

            // Small delay to ensure context propagates
            await new Promise(resolve => setTimeout(resolve, 200));

            // Navigate to dashboard
            router.push("/app/d/dashboard");

        } catch (error) {
            setIsLoading(false);
            console.error("Form submission error", error);
            alert("Failed to submit the form. Please try again.");
        }
    }

    return (
        <div className="relative bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Theme Toggler */}
            <div className="absolute top-0 right-0 p-4 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Toggle theme</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                        {/* PROFESSIONAL HEADER */}
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-4 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-200">
                                Logged in as Blood Donor
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl mb-2">
                                Canine Blood Donor Registration
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-400">
                                Register your dog to join K9Hope Chennai's life-saving blood donor programme
                            </p>
                        </div>

                        {/* ELIGIBILITY BANNER */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 mb-8 rounded-r-lg shadow-sm">
                            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                                Blood Donor Eligibility Requirements
                            </h3>
                            <p className="text-blue-800 dark:text-blue-200 mb-3">
                                To be a blood donor, your dog must meet the following criteria:
                            </p>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-blue-900 dark:text-blue-200 text-sm">
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Be fit and healthy</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Aged between 1-8 years</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Weigh more than 25kg</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Good temperament</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Relaxed in veterinary settings</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Never travelled abroad</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Fully vaccinated</li>
                                <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">✓</span> Not on medication</li>
                            </ul>
                        </div>

                        {/* SECTION A: OWNER CONTACT DETAILS */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                A. Owner Contact Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact Phone Number *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input {...field} disabled value={phone || ''} className="bg-gray-100 dark:bg-gray-900" />
                                                </div>
                                            </FormControl>
                                            <FormDescription>Login with new phone to change this</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="owner@example.com" type="email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="d_region"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Location (Country & State) *</FormLabel>
                                                <FormControl>
                                                    <LocationSelector
                                                        onCountryChange={(country) => {
                                                            setCountryName(country?.name || '')
                                                            form.setValue(field.name, [country?.name || '', stateName || ''])
                                                        }}
                                                        onStateChange={(state) => {
                                                            setStateName(state?.name || '')
                                                            form.setValue(field.name, [form.getValues(field.name)[0] || '', state?.name || ''])
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="d_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City *</FormLabel>
                                            <FormControl><Input placeholder="City" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_pincode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pin/Zip Code *</FormLabel>
                                            <FormControl><Input placeholder="Pincode" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* SECTION B: CANINE DONOR DETAILS */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                B. Canine Donor Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="d_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Dog's Registered Name *</FormLabel>
                                            <FormControl><Input placeholder="Max" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_dob"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date of Birth * <span className="text-xs text-gray-500">(1-8 years old)</span></FormLabel>
                                            <FormControl>
                                                <div className="flex gap-2">
                                                    <Input type="date" {...field}
                                                        value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                                                        onChange={(e) => field.onChange(e.target.value)}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_breed"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Breed *</FormLabel>
                                            <FormControl><Input placeholder="e.g. Golden Retriever" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_weight_kg"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Weight (kg) *</FormLabel>
                                            <FormControl><Input type="number" placeholder="25" {...field} /></FormControl>
                                            <FormDescription>Minimum 25kg required</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_gender"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sex *</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="male">Male</SelectItem>
                                                    <SelectItem value="female">Female</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_spayed_neutered"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Spayed / Neutered? *</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="yes">Yes</SelectItem>
                                                    <SelectItem value="no">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="d_bloodgroup"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Blood Group (if known)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="dea1.1">DEA 1.1 (Positive)</SelectItem>
                                                    <SelectItem value="dea1.2">DEA 1.2 (Positive)</SelectItem>
                                                    <SelectItem value="dea3">DEA 3 (Positive)</SelectItem>
                                                    <SelectItem value="dea4">DEA 4 (Universal)</SelectItem>
                                                    <SelectItem value="dea5">DEA 5 (Positive)</SelectItem>
                                                    <SelectItem value="dea7">DEA 7 (Positive)</SelectItem>
                                                    <SelectItem value="unknown">Unknown</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {/* Photo Upload */}
                                <FormField
                                    control={form.control}
                                    name="d_logo_url"
                                    render={({ field }) => {
                                        const [preview, setPreview] = useState<string | null>(field.value ?? null);
                                        const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
                                            const file = event.target.files?.[0];
                                            if (!file) return;
                                            if (!file.type.startsWith("image/")) return alert("Invalid image");
                                            if (file.size > 500 * 1024) return alert("File too large (max 500KB)");
                                            setPreview(URL.createObjectURL(file));
                                            try {
                                                const uploadedFile = await client.uploadFile(file);
                                                field.onChange(`https://ucarecdn.com/${uploadedFile.uuid}/`);
                                            } catch (e) { alert("Upload failed"); }
                                        };
                                        return (
                                            <FormItem>
                                                <FormLabel>Photo (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center gap-4">
                                                        <Input type="file" accept="image/*" onChange={handleFileUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                                        {preview && <Image src={preview} alt="Preview" width={48} height={48} className="w-12 h-12 rounded-full object-cover border" />}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </div>
                        </div>

                        {/* SECTION C: MEDICAL HISTORY */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                C. Medical History & Health Screening
                            </h2>
                            <div className="space-y-6">
                                {/* Vaccinations */}
                                <FormItem>
                                    <FormLabel className="text-base">Vaccination Status (Check all that apply)</FormLabel>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <FormField
                                            control={form.control}
                                            name="d_vaccinations_core"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={field.value} onChange={field.onChange} /></FormControl>
                                                    <FormLabel className="font-normal cursor-pointer">Core Vaccinations (Distemper, Hepatitis, Parvovirus, Leptospirosis)</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="d_vaccinations_rabies"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={field.value} onChange={field.onChange} /></FormControl>
                                                    <FormLabel className="font-normal cursor-pointer">Rabies Vaccination</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="d_vaccinations_boosters"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={field.value} onChange={field.onChange} /></FormControl>
                                                    <FormLabel className="font-normal cursor-pointer">Up to date with annual boosters?</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </FormItem>

                                {/* Transfusion History */}
                                <FormField
                                    control={form.control}
                                    name="d_transfusion_history"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base">Has your dog ever received a blood transfusion?</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="trans_yes" /><label htmlFor="trans_yes">Yes</label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="trans_no" /><label htmlFor="trans_no">No</label></div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Medication */}
                                <FormField
                                    control={form.control}
                                    name="d_isMedication"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base">Is your dog currently on any medication?</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="med_yes" /><label htmlFor="med_yes">Yes</label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="med_no" /><label htmlFor="med_no">No</label></div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {isOnMedication && (
                                    <FormField
                                        control={form.control}
                                        name="d_specifyMedication"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Please specify medications:</FormLabel>
                                                <FormControl><Textarea {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {/* Travel */}
                                <FormField
                                    control={form.control}
                                    name="d_travelled_abroad"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base">Has your dog travelled outside India?</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="trav_yes" /><label htmlFor="trav_yes">Yes</label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="trav_no" /><label htmlFor="trav_no">No</label></div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* General Health */}
                                <FormField
                                    control={form.control}
                                    name="d_general_health"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base">Is your dog in good general health?</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="health_yes" /><label htmlFor="health_yes">Yes</label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="health_no" /><label htmlFor="health_no">No</label></div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {isGeneralHealthIssue && (
                                    <FormField
                                        control={form.control}
                                        name="d_health_conditions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Please describe any health issues:</FormLabel>
                                                <FormControl><Textarea {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </div>

                        {/* SECTION D: VET PRACTICE */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                D. Veterinary Practice Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="vet_practice_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Veterinary Practice Name *</FormLabel>
                                            <FormControl><Input placeholder="Paws & Claws Clinic" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vet_surgeon_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Veterinary Surgeon Name *</FormLabel>
                                            <FormControl><Input placeholder="Dr. Smith" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vet_practice_phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Practice Phone Number *</FormLabel>
                                            <FormControl><Input placeholder="+91..." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* SECTION E: EMERGENCY CONTACT */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                E. Emergency Contact Information
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="emergency_contact_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Emergency Contact Name *</FormLabel>
                                            <FormControl><Input placeholder="Contact Person" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="emergency_contact_phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Number *</FormLabel>
                                            <FormControl><PhoneInput {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="emergency_contact_relationship"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Relationship to Owner *</FormLabel>
                                            <FormControl><Input placeholder="e.g. Spouse, Parent" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* SECTION F: CONSENT */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-6">
                                F. Owner Consent & Declaration
                            </h2>
                            <div className="space-y-4">
                                {[
                                    { name: "consent_owner_legal", label: "I confirm I am the legal owner of the dog." },
                                    { name: "consent_health_screening", label: "I consent to health screening and blood typing for my dog." },
                                    { name: "consent_contact", label: "I consent to being contacted by K9Hope regarding blood donation." },
                                    { name: "consent_voluntary", label: "I understand that my dog's participation is voluntary." },
                                    { name: "consent_truthful", label: "I confirm that all information provided is true and accurate." }
                                ].map((item) => (
                                    <FormField
                                        key={item.name}
                                        control={form.control}
                                        name={item.name as any}
                                        render={({ field }) => (
                                            <FormItem className="flex items-start space-x-2 space-y-0">
                                                <FormControl>
                                                    <input type="checkbox" className="w-4 h-4 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer leading-tight">{item.label}</FormLabel>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}

                                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="signature_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Digital Signature (Type Full Name) *</FormLabel>
                                                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="signature_date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date</FormLabel>
                                                    <FormControl><Input {...field} disabled /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DONOR BENEFITS PANEL */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 p-6 rounded-lg border border-blue-100 dark:border-blue-800">
                            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-4 text-center">
                                Hero Benefits for Your Dog
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <span className="block text-2xl mb-1">🏥</span>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Free Health Screening</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <span className="block text-2xl mb-1">🩸</span>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Blood Type Certificate</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <span className="block text-2xl mb-1">🏷️</span>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Donor Tag & ID</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <span className="block text-2xl mb-1">🚑</span>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Priority Blood Access</span>
                                </div>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <div className="flex flex-col items-center gap-4 pt-6">
                            <Button
                                type="submit"
                                className="w-full md:w-auto min-w-[300px] h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all shadow-lg hover:shadow-xl"
                                disabled={isLoading}
                            >
                                {isLoading ? <HeartLoading /> : "Submit Donor Registration"}
                            </Button>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Your application will be reviewed by our veterinary team.
                            </p>
                        </div>

                    </form>
                </Form>
            </div>
        </div>
    );
}
