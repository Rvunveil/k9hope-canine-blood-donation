"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PEEmailButtonProps {
  onVerify: (data: {
    user_email: string;
    user_first_name: string;
    user_last_name: string;
  }) => void;
}

// RIT Team Emails - Skip OTP
const RIT_TEAM_EMAILS = [
  "vikram2022.rit@gmail.com",
  "premkumar.d.2022.cse@ritchennai.edu.in",
  "ramkishore.p.2022.cse@ritchennai.edu.in",
  "admin", // Added for easier local testing if needed
];

const PEEmailButton: React.FC<PEEmailButtonProps> = ({ onVerify }) => {
  const [manualEmail, setManualEmail] = useState("");

  useEffect(() => {
    // Load the external script
    const script = document.createElement("script");
    script.src = "https://www.phone.email/verify_email_v1.js";
    script.async = true;
    document.querySelector(".pe_verify_email")?.appendChild(script);

    // Define the listener function
    (window as any).phoneEmailReceiver = async (userObj: { user_json_url: string }) => {
      const user_json_url = userObj.user_json_url;

      try {
        const response = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_json_url }),
        });

        const data = await response.json();

        // ✅ Check if email exists before calling `toLowerCase()`
        const email = data.user_email_id?.toLowerCase().trim();
        if (!email) {
          alert("❌ Error: Email not found in response.");
          return;
        }

        // ✅ Pass structured user data to parent component
        onVerify({
          user_email: email,
          user_first_name: data.user_first_name || "Unknown",
          user_last_name: data.user_last_name || "Unknown",
        });
      } catch (error) {
        console.error("Error:", error);
      }
    };

    return () => {
      (window as any).phoneEmailReceiver = null;
    };
  }, [onVerify]);

  const handleManualEmailLogin = () => {
    const cleanEmail = manualEmail.trim().toLowerCase();

    if (RIT_TEAM_EMAILS.includes(cleanEmail)) {
      // Show popup
      alert("🎉 RIT ADMIN___ EMAIL OTP SKIPPED\n\nWelcome back, team member!");

      // Auto-verify without OTP
      onVerify({
        user_email: cleanEmail,
        user_first_name: "RIT",
        user_last_name: "Admin",
      });
    } else {
      alert("⚠️ This email is not authorized for OTP skip.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Standard Phone.Email Verify Button */}
      <div
        suppressHydrationWarning
        className="pe_verify_email"
        data-client-id={process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID}
      ></div>

      {/* RIT Team Bypass - Subtle Opacity to prioritize main flow */}
      <div className="w-full max-w-xs mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-center text-gray-400 mb-2">RIT Team Login (No OTP)</div>
        <div className="flex gap-2">
          <Input
            placeholder="Team Email Address"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            onClick={handleManualEmailLogin}
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!manualEmail}
          >
            Skip OTP
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PEEmailButton;
