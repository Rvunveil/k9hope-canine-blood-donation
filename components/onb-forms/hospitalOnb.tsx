// @ts-nocheck
"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


//User Imports
import { useUser } from "@/context/UserContext";
import { db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { updateUserData } from "@/firebaseFunctions"
import Cookies from "js-cookie";


// Fetch a single veterinary clinic by userId
export async function getVeterinaryById(userId: string) {
    try {
        const docRef = doc(db, "veterinaries", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Veterinary Clinic Data:", docSnap.data());
            const data = docSnap.data();
            return { id: docSnap.id, ...data } as any;
        } else {
            console.log("No such veterinary clinic found!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching veterinary clinic:", error);
        return null;
    }
}


// Theme Changer Imports
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { FileUploader } from "@/components/ui/files-upload"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import LocationSelector from "@/components/ui/location-input"
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch"
import Image from "next/image";
import { UploadClient } from "@uploadcare/upload-client";
const client = new UploadClient({ publicKey: process.env.NEXT_PUBLIC_UPLOADCARE_PUB_KEY });





const formSchema = z.object({
    email: z.string().min(1, "Email is required"),
    v_name: z.string().min(1, "Clinic name is required"),
    v_logo_url: z.string().optional(),
    monthly_patient_count: z.string().min(1, "Patient count is required"),
    v_documents: z
        .array(
            z.object({
                name: z.string(),
                url: z.string().url(),
            })
        )
        .max(3, "Maximum 3 documents allowed")
        .optional(),
    v_type: z.string().min(1, "Clinic type is required"),
    v_website: z.string().optional(),
    v_region: z.tuple([z.string(), z.string().optional()]).optional(),
    v_city: z.string().min(1, "City is required"),
    v_pincode: z.string().min(1, "Pincode is required"),
    v_lat: z.string().min(1, "Latitude is required"),
    v_lon: z.string().min(1, "Longitude is required"),
    v_phone: z.string().min(1, "Phone is required"),
    v_admin_name: z.string().min(1, "Admin name is required"),
    v_admin_phone: z.string().min(1, "Admin phone is required"),
    v_bloodbank_available: z.string(),
    onboarded: z.string(),
});


export default function OnboardingHos() {

    const { userId, role, device, setUser } = useUser();
    const router = useRouter();
    const [veterinary, setVeterinary] = useState<any>(null);

    // Fetch veterinary data when the component loads
    useEffect(() => {
        if (userId) {
            async function fetchVeterinaryData() {
                // Try to get from veterinaries collection first
                const vetData = await getVeterinaryById(userId);

                // If not found, try to get email from users collection
                if (!vetData || !vetData.email) {
                    try {
                        const userDocRef = doc(db, "users", userId);
                        const userSnap = await getDoc(userDocRef);

                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            // Merge user data with vet data
                            setVeterinary({
                                ...vetData,
                                email: userData.email || userData.phone || ""
                            });
                            return;
                        }
                    } catch (err) {
                        console.error("Error fetching user email:", err);
                    }
                }

                setVeterinary(vetData);
            }
            fetchVeterinaryData();
        }
    }, [userId]);


    //Logout Function
    function handleLogout() {
        if (typeof window !== "undefined") {
            // Remove cookies using js-cookie
            Cookies.remove("userId");
            Cookies.remove("role");
            Cookies.remove("onboarded");
            Cookies.remove("phone");
            localStorage.clear();
        }
        setUser(null, "guest", "guest");
        router.push("/");
    }

    //Theme
    const { setTheme } = useTheme()

    //loading state
    const [isLoading, setIsLoading] = useState(false);



    const [preview, setPreview] = useState<string | null>(null);

    const [countryName, setCountryName] = useState<string>('')
    const [stateName, setStateName] = useState<string>('')

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: veterinary?.email ?? "",
            v_documents: [],

            v_bloodbank_available: "no",

            onboarded: "yes",
        },
    })




    useEffect(() => {
        if (veterinary?.email !== undefined) {
            form.reset({
                ...form.getValues(), // Keep other field values
                email: veterinary.email || "",
                onboarded: "yes"
            });
        }

    }, [veterinary?.email]);


    // SUBMIT FORM FUNCTION
    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            // Validate email is present
            if (!values.email || values.email.length === 0) {
                alert("Email is required. Please refresh the page and try again.");
                setIsLoading(false);
                return;
            }

            console.log("Submitting veterinary clinic onboarding:", values);
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
                onboarded: "yes",
                updatedAt: new Date()
            };

            // Update veterinaries collection
            const vetResponse = await updateUserData("veterinaries", userId, sanitizedData);

            if (!vetResponse.success) {
                setIsLoading(false);
                alert("Error updating clinic data: " + vetResponse.message);
                return;
            }

            // Update users collection
            const userData = {
                role: "veterinary",
                onboarded: "yes",
                email: formValues.email,
                updatedAt: new Date()
            };

            const userResponse = await updateUserData("users", userId, userData);

            if (!userResponse.success) {
                setIsLoading(false);
                alert("Error updating user data: " + userResponse.message);
                return;
            }

            console.log("Veterinary clinic onboarding completed successfully");

            // Update context
            setUser(userId, "veterinary", "yes", formValues.email);

            // Wait for state propagation
            await new Promise(resolve => setTimeout(resolve, 300));

            // Navigate to dashboard
            router.push("/app/h/dashboard");

        } catch (error) {
            setIsLoading(false);
            console.error("Form submission error:", error);
            alert("Failed to submit form. Please try again. Error: " + (error?.message || "Unknown error"));
        }
    }






    return (
        <div className="relative">
            {/* Theme Toggler at top right */}
            <div className="absolute top-0 right-0 p-4">
                {/* @ts-ignore */}
                <DropdownMenu>
                    {/* @ts-ignore */}
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


            <div className="pl-10 pr-10 pt-10 pb-20">
                <Form {...form}>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-3xl mx-auto py-10">

                        {/* FORM HEADING */}
                        <div className="flex items-center justify-between space-x-1">
                            <h1 className="text-[25px] font-bold">🏥 You've logged in as a veterinary clinic.</h1>
                            <button
                                type="button"
                                className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900"
                                onClick={handleLogout}
                            >
                                Log Out
                            </button>
                        </div>
                        <h1 className="text-[20px] font-bold text-center">Enter remaining details to finish creating your account!</h1>

                        <h1 className="font-bold border-b-2 border-fg-500 pt-4 pb-2">Veterinary Clinic Details</h1>

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>🔒 Email *</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || veterinary?.email || ""}
                                            disabled
                                            className="bg-gray-100 dark:bg-gray-900"
                                            type="email"
                                        />
                                    </FormControl>
                                    <FormDescription>Login with new email if you want to change this right now.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="v_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Veterinary Clinic Name *</FormLabel>
                                    <FormControl>
                                        <Input

                                            placeholder="Paws & Claws Veterinary Clinic"

                                            type="text"
                                            {...field} />
                                    </FormControl>
                                    <FormDescription>Enter full legal name of your veterinary clinic as it appears on registration documents.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Veterinary Clinic LOGO */}
                        <FormField
                            control={form.control}
                            name="v_logo_url"
                            render={({ field }) => {
                                const [preview, setPreview] = useState<string | null>(field.value ?? null);

                                const handleFileUpload = async (event: any) => {
                                    const fileInput = event.target;
                                    const file = fileInput.files?.[0];

                                    if (!file) return;

                                    // Validate file type
                                    if (!file.type.startsWith("image/")) {
                                        alert("Please upload a valid image file.");
                                        fileInput.value = "";
                                        setPreview(null);
                                        return;
                                    }

                                    // Validate file size (500KB max)
                                    if (file.size > 500 * 1024) {
                                        alert("File size must be 500KB or less.");
                                        fileInput.value = "";
                                        setPreview(null);
                                        return;
                                    }

                                    // Show local preview
                                    const imageUrl = URL.createObjectURL(file);
                                    setPreview(imageUrl);

                                    try {
                                        // Upload to Uploadcare
                                        const uploadedFile = await client.uploadFile(file);
                                        const uploadedUrl = `https://ucarecdn.com/${uploadedFile.uuid}/`;

                                        // Set form value with uploaded URL
                                        field.onChange(uploadedUrl);
                                    } catch (error) {
                                        alert("File upload failed. Please try again.");
                                        fileInput.value = "";
                                        setPreview(null);
                                    }
                                };

                                return (
                                    <FormItem>
                                        <FormLabel>Clinic Logo</FormLabel>
                                        <FormControl>
                                            <div className="relative flex items-center gap-2">
                                                <Input
                                                    id="v_logo"
                                                    type="file"
                                                    accept="image/*"
                                                    className="h-24 py-9 text-lg"
                                                    onChange={handleFileUpload}
                                                />
                                                {preview && (
                                                    <Image
                                                        src={preview}
                                                        alt="Preview"
                                                        width={100}
                                                        height={100}
                                                        className="w-24 h-24 border-2 border-input rounded-md object-fill"
                                                    />
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />





                        <FormField
                            control={form.control}
                            name="monthly_patient_count"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monthly Canine Patients Count *</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="50"

                                            type="text"
                                            {...field} />
                                    </FormControl>
                                    <FormDescription>Enter an estimated number of dog/canine patients treated monthly at your clinic.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Veterinary Clinic Documents */}
                        <FormField
                            control={form.control}
                            name="v_documents"
                            render={({ field }) => {
                                const [uploadedFiles, setUploadedFiles] = useState<any[]>(field.value || []);

                                const handleFileUpload = async (event: any) => {
                                    const files = event.target.files;
                                    if (!files || files.length === 0) return;

                                    const uploadedUrls: any[] = [];

                                    for (let i = 0; i < Math.min(files.length, 3); i++) {
                                        const file = files[i];

                                        // Validate file size
                                        if (file.size > 1 * 1024 * 1024) {
                                            alert(`File ${file.name} is too large. Max 1MB per file.`);
                                            continue;
                                        }

                                        try {
                                            console.log("Uploading file:", file.name);
                                            const uploadedFile = await client.uploadFile(file);
                                            const fileUrl = `https://ucarecdn.com/${uploadedFile.uuid}/`;

                                            uploadedUrls.push({
                                                name: file.name,
                                                url: fileUrl
                                            });

                                            console.log("File uploaded successfully:", fileUrl);
                                        } catch (error) {
                                            console.error("File upload failed:", error);
                                            alert(`Failed to upload ${file.name}. Please try again.`);
                                        }
                                    }

                                    const allFiles = [...uploadedFiles, ...uploadedUrls];
                                    setUploadedFiles(allFiles);
                                    field.onChange(allFiles);
                                };

                                const removeFile = (index: number) => {
                                    const newFiles = uploadedFiles.filter((_, i) => i !== index);
                                    setUploadedFiles(newFiles);
                                    field.onChange(newFiles);
                                };

                                return (
                                    <FormItem>
                                        <FormLabel>Upload Veterinary Clinic Documents (Optional)</FormLabel>
                                        <FormControl>
                                            <div className="space-y-2">
                                                <Input
                                                    type="file"
                                                    accept=".pdf,.png,.jpg,.jpeg"
                                                    multiple
                                                    onChange={handleFileUpload}
                                                    className="cursor-pointer"
                                                />

                                                {/* Show uploaded files */}
                                                {uploadedFiles.length > 0 && (
                                                    <div className="space-y-1 mt-2">
                                                        {uploadedFiles.map((file, index) => (
                                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                                                <span className="text-sm truncate">{file.name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFile(index)}
                                                                    className="text-red-500 hover:text-red-700 text-sm ml-2"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            Optional: Upload licensing documents if available. Accepted formats: PDF, PNG, JPG. Max 1MB/file, up to 3 files.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        {/* Clinic Type */}
                        <FormField
                            control={form.control}
                            name="v_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Clinic Type *</FormLabel>
                                    {/* @ts-ignore */}
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="independent">Independent Veterinary Clinic</SelectItem>
                                            <SelectItem value="chain">Part of Veterinary Chain/Network</SelectItem>
                                            <SelectItem value="hospital">Multi-Specialty Veterinary Hospital</SelectItem>
                                            <SelectItem value="emergency">24/7 Emergency Veterinary Center</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Select the type that best describes your veterinary practice.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Clinic Website */}
                        <FormField
                            control={form.control}
                            name="v_website"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Clinic Website</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="https://pawsandclawsvet.com"

                                            type="text"
                                            {...field} />
                                    </FormControl>
                                    <FormDescription>Enter the link to your clinic's website (if available).</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Clinic Country & State */}
                        <FormField
                            control={form.control}
                            name="v_region"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Country *</FormLabel>
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
                                    <FormDescription>If your country has states, it will be appear after selecting country.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Clinic City & Pincode */}
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-6">

                                <FormField
                                    control={form.control}
                                    name="v_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="New York"

                                                    type="text"
                                                    {...field} />
                                            </FormControl>

                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="col-span-6">

                                <FormField
                                    control={form.control}
                                    name="v_pincode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pin/Zip Code *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="123456"

                                                    type="string"
                                                    {...field} />
                                            </FormControl>

                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                        </div>

                        {/* Clinic Lat & Long */}
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-6">

                                <FormField
                                    control={form.control}
                                    name="v_lat"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Maps Latitude *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="1.00000000"

                                                    type="text"
                                                    {...field} />
                                            </FormControl>
                                            <FormDescription>Enter Google Maps latitude so pet owners can locate your clinic easily.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="col-span-6">

                                <FormField
                                    control={form.control}
                                    name="v_lon"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Maps Longitude *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="5.00000000"

                                                    type="string"
                                                    {...field} />
                                            </FormControl>
                                            <FormDescription>Enter Google Maps longitude so pet owners can locate your clinic easily.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                        </div>

                        {/* Clinic Phone */}
                        <FormField
                            control={form.control}
                            name="v_phone"
                            render={({ field }) => (
                                <FormItem className="flex flex-col items-start">
                                    <FormLabel>Clinic Phone *</FormLabel>
                                    <FormControl className="w-full">
                                        <PhoneInput

                                            {...field}

                                        />
                                    </FormControl>
                                    <FormDescription>Enter a phone number that pet owners can call for appointments and emergencies.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="v_bloodbank_available"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Does your clinic have canine blood storage/bank facilities? *</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center space-x-3">
                                            <Switch checked={field.value === "yes"} onCheckedChange={(checked) => field.onChange(checked ? "yes" : "no")} />
                                            <FormLabel className="font-normal">{field.value === "yes" ? "Yes" : "No"}</FormLabel>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <h1 className="font-bold border-b-2 border-fg-500 pt-4 pb-2">Clinic Admin Details (Person managing K9Hope account)</h1>

                        <FormField
                            control={form.control}
                            name="v_admin_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Admin Full Name *</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="John Doe"

                                            type="text"
                                            {...field} />
                                    </FormControl>
                                    <FormDescription>Name of the veterinarian or staff member managing this K9Hope account.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="v_admin_phone"
                            render={({ field }) => (
                                <FormItem className="flex flex-col items-start">
                                    <FormLabel>Admin Phone *</FormLabel>
                                    <FormControl className="w-full">
                                        <PhoneInput

                                            {...field}

                                        />
                                    </FormControl>
                                    <FormDescription>Direct phone number of the person managing this account for coordination with donors.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />


                        <br></br>
                        <Button className="w-full bg-accent pt-6 pb-6 submit-button" type="submit">Submit</Button>

                    </form>

                </Form>
            </div>
            {isLoading && (
                <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
                    <HeartLoading />
                </div>
            )}
        </div>
    )
}
