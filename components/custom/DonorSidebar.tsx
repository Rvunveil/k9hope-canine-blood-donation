"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    LayoutDashboard,
    Heart,
    Calendar,
    History,
    Bell,
    User,
    LogOut,
    ChevronDown,
    ChevronUp,
    Bot
} from "lucide-react";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function DonorSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { clearAuth } = useUser();
    const [isDonateExpanded, setIsDonateExpanded] = useState(true);

    const isActive = (path: string) => pathname === path;

    const handleLogout = async () => {
        try {
            await signOut(auth);
            clearAuth();
            router.push("/login");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 h-screen overflow-y-auto flex-col shrink-0 hidden lg:flex">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
                <Link href="/app/d/dashboard">
                    <Image
                        src="/k9hope_ritchennai.svg"
                        alt="K9Hope"
                        width={150}
                        height={50}
                        className="w-auto h-12 object-contain"
                    />
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {/* Dashboard */}
                <Link href="/app/d/dashboard">
                    <button
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive("/app/d/dashboard")
                            ? "bg-red-500 text-white"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </button>
                </Link>

                {/* Contribute Section */}
                <div className="mt-6">
                    <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                        Contribute
                    </p>

                    {/* Donate Now - Collapsible */}
                    <div>
                        <button
                            onClick={() => setIsDonateExpanded(!isDonateExpanded)}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-medium transition-all ${pathname.startsWith("/app/d/donate")
                                ? "bg-red-50 text-red-600"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Heart className="w-5 h-5" />
                                Donate Now
                            </div>
                            {isDonateExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>

                        {/* Sub-items */}
                        {isDonateExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link href="/app/d/donate/urgent">
                                    <button
                                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/app/d/donate/urgent")
                                            ? "bg-red-100 text-red-700"
                                            : "text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        -  Urgent
                                    </button>
                                </Link>
                                <Link href="/app/d/donate/nearby">
                                    <button
                                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/app/d/donate/nearby")
                                            ? "bg-red-100 text-red-700"
                                            : "text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        -  Nearby Donations
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Appointments */}
                    <Link href="/app/d/appointments">
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive("/app/d/appointments")
                                ? "bg-red-500 text-white"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <Calendar className="w-5 h-5" />
                            Appointments
                        </button>
                    </Link>

                    {/* Donation History */}
                    <Link href="/app/d/donation-history">
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive("/app/d/donation-history")
                                ? "bg-red-500 text-white"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <History className="w-5 h-5" />
                            Donation History
                        </button>
                    </Link>

                    {/* Notifications */}
                    <Link href="/app/d/notifications">
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive("/app/d/notifications")
                                ? "bg-red-500 text-white"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <Bell className="w-5 h-5" />
                            Notifications
                        </button>
                    </Link>
                </div>

                {/* Options Section */}
                <div className="mt-6">
                    <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                        Options
                    </p>

                    {/* Profile */}
                    <Link href="/app/d/profile">
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive("/app/d/profile")
                                ? "bg-red-500 text-white"
                                : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <User className="w-5 h-5" />
                            Profile
                        </button>
                    </Link>
                </div>
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-gray-200 space-y-2">
                {/* K9 Buddy AI */}
                <Link href="/app/d/k9buddy">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all border-2 border-gray-300">
                        <Bot className="w-5 h-5" />
                        K9 Buddy AI
                    </button>
                </Link>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
