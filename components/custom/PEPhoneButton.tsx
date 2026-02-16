"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PEPhoneButtonProps {
  onVerify: (data: {
    user_country_code: string;
    user_phone_number: string;
    user_first_name: string;
    user_last_name: string;
  }) => void;
}

// RIT Team Numbers - Skip OTP
const RIT_TEAM_NUMBERS = [
  "9176423451",
  "9025020523",
  "9884854813",
  "7305883670",
  "8825449244",
  "6382702293",
  "9566779338",
  "admin"  // Added for easier local testing if needed
];

const PEPhoneButton: React.FC<PEPhoneButtonProps> = ({ onVerify }) => {
  const [manualPhone, setManualPhone] = useState("");

  useEffect(() => {
    // Load the external script
    const script = document.createElement("script");
    script.src = "https://www.phone.email/sign_in_button_v1.js";
    script.async = true;
    document.querySelector(".pe_signin_button")?.appendChild(script);

    // Define the listener function
    (window as any).phoneEmailListener = async (userObj: { user_json_url: string }) => {
      const user_json_url = userObj.user_json_url;

      try {
        const response = await fetch("/api/verify-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_json_url }),
        });

        const data = await response.json();
        if (data.error) {
          alert(`❌ Error: ${data.error}`);
        } else {
          // Pass the data to the parent component
          onVerify({
            user_country_code: data.user_country_code,
            user_phone_number: data.user_phone_number,
            user_first_name: data.user_first_name,
            user_last_name: data.user_last_name,
          });
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    return () => {
      (window as any).phoneEmailListener = null;
    };
  }, [onVerify]);

  const handleManualLogin = () => {
    // Simple check for RIT team members
    const cleanPhone = manualPhone.replace(/^\+91/, '').replace(/^91/, '').trim();

    if (RIT_TEAM_NUMBERS.includes(cleanPhone)) {
      // Show popup
      alert("🎉 RIT ADMIN___ OTP SKIPPED\n\nWelcome back, team member!");

      // Auto-verify without OTP
      const verificationData = {
        user_country_code: "+91",
        user_phone_number: cleanPhone,
        user_first_name: "RIT",
        user_last_name: "Admin",
      };

      onVerify(verificationData);
    } else {
      alert("⚠️ This number is not authorized for OTP skip. Please use the Verify button above.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Standard Phone.Email Button */}
      <div suppressHydrationWarning className="pe_signin_button"
        data-client-id={process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID}
      ></div>

      {/* RIT Team Bypass - Subtle Opacity to prioritize main flow */}
      <div className="w-full max-w-xs mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-center text-gray-400 mb-2">RIT Team Login (No OTP)</div>
        <div className="flex gap-2">
          <Input
            placeholder="Team Phone Number"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            onClick={handleManualLogin}
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!manualPhone}
          >
            Skip OTP
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PEPhoneButton;
