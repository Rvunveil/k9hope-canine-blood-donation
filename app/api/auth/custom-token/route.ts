import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    // Strip any whitespace; custom token UIDs must be < 128 chars
    const sanitisedId = userId.trim();

    const customToken = await adminAuth.createCustomToken(sanitisedId);
    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error("[custom-token] Token generation error:", error);
    return NextResponse.json({ error: "Token generation failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
