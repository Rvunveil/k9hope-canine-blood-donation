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
      return NextResponse.json(
        { error: "fileUrl and mimeType are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    // Fetch file from Uploadcare CDN and convert to base64
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      console.error("Failed to fetch file from URL:", fileUrl);
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Determine media resolution based on mime type
    const isImage = mimeType.startsWith("image/");
    const mediaResolution = isImage ? "high" : "medium";

    // Initialize Gemini with v1alpha for media resolution support
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: "v1alpha",
    });

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
        responseMimeType: "application/json",
        mediaResolution: mediaResolution as any,
        thinkingConfig: { thinkingLevel: "low" as any },
      },
    });

    // Extract text from response
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("Empty response from Gemini");
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR Flag API error:", error);
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
