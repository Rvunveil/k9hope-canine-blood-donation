import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const VETERINARY_TRIAGE_PROMPT = `You are a veterinary emergency triage assistant for K9Hope, a canine blood donation network in India. 
Analyze this uploaded document which may be a vet recommendation letter, blood test report, or medical document for a dog.

Extract all medical indicators and return ONLY valid JSON in this exact format:
{
  "score": <integer 0-100 representing case severity>,
  "flags": [<array of critical keywords found, e.g. "Trauma", "Severe Anemia", "Urgent Transfusion", "Low PCV", "Accident", "Critical", "Emergency">],
  "summary": "<one concise sentence summarizing the medical situation>",
  "pcv_value": "<PCV percentage if found, else null>",
  "urgency": "<low|medium|high|critical>"
}

Scoring guide:
- 0-25: Stable, routine monitoring
- 26-50: Mild concern, scheduled attention needed  
- 51-75: Moderate urgency, prompt veterinary care needed
- 76-100: Critical emergency, immediate intervention required

Base your score on presence of: trauma keywords, critically low PCV (<25%), severe anemia indicators, accident/injury reports, words like urgent/emergency/critical/immediate.`;

const FALLBACK_RESPONSE = {
  score: 0,
  flags: [],
  summary: "Could not analyze document",
  pcv_value: null,
  urgency: "low",
};

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, mimeType } = await request.json();

    if (!fileUrl || !mimeType) {
      console.error("Missing required fields:", { fileUrl: !!fileUrl, mimeType: !!mimeType });
      return NextResponse.json(
        { error: "fileUrl and mimeType are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    // Fetch file from Uploadcare CDN and convert to base64
    // Uploadcare needs a proper User-Agent header for server-side fetches
    console.log("Fetching file from Uploadcare:", fileUrl);
    const fileRes = await fetch(fileUrl, {
      headers: {
        "User-Agent": "K9Hope-OCR-Server/1.0",
        "Accept": "*/*",
      },
    });

    if (!fileRes.ok) {
      console.error("Failed to fetch file from Uploadcare URL:", fileUrl, "status:", fileRes.status, "statusText:", fileRes.statusText);
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    console.log("File fetched successfully. Base64 length:", base64.length, "mimeType:", mimeType);

    // Initialize Gemini — NO apiVersion parameter (not supported by @google/genai)
    const ai = new GoogleGenAI({ apiKey });

    console.log("Calling Gemini with model: gemini-2.0-flash, mimeType:", mimeType);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64,
              },
            },
            {
              text: VETERINARY_TRIAGE_PROMPT,
            },
          ],
        },
      ],
      config: {
        // ONLY responseMimeType — no mediaResolution or thinkingConfig
        // (those are not supported by gemini-2.0-flash)
        responseMimeType: "application/json",
      },
    });

    // Extract text from response
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("Gemini raw response text:", responseText?.substring(0, 300));

    if (!responseText) {
      console.error("Empty response from Gemini. Full response:", JSON.stringify(response?.candidates?.[0]));
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    // Parse the JSON response
    const parsed = JSON.parse(responseText);

    // Validate and sanitize the parsed response
    const result = {
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 0,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary available",
      pcv_value: parsed.pcv_value ?? null,
      urgency: ["low", "medium", "high", "critical"].includes(parsed.urgency) ? parsed.urgency : "low",
    };

    console.log("OCR analysis complete. Score:", result.score, "Urgency:", result.urgency);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("OCR Flag API error details:", {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      errorDetails: error?.errorDetails,
      stack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
