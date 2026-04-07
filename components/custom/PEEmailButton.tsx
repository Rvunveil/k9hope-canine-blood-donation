"use client";

import { useEffect, useState } from "react";

interface PEEmailButtonProps {
  onVerify: (data: {
    user_email: string;
    user_first_name: string;
    user_last_name: string;
  }) => void;
}

const PEEmailButton: React.FC<PEEmailButtonProps> = ({ onVerify }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const script = document.createElement("script");
    script.src = "https://www.phone.email/verify_email_v1.js";
    script.async = true;
    document.body.appendChild(script);

    (window as any).phoneEmailReceiver = async (userObj: { user_json_url: string }) => {
      const user_json_url = userObj.user_json_url;
      try {
        const response = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_json_url }),
        });
        const data = await response.json();
        const email = data.user_email_id?.toLowerCase().trim();
        if (!email) {
          alert("❌ Error: Email not found in response.");
          return;
        }
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
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      (window as any).phoneEmailReceiver = null;
    };
  }, [mounted, onVerify]);

  if (!mounted) return null;

  return (
    <div
      suppressHydrationWarning
      className="pe_verify_email"
      data-client-id={process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID}
    ></div>
  );
};

export default PEEmailButton;
