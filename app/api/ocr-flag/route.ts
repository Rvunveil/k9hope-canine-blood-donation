import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const VETERINARY_TRIAGE_PROMPT = `You are a veterinary emergency triage assistant for K9Hope, a canine blood donation network in India. 
Analyze this uploaded document which may be a vet recommendation letter, blood test report, or medical document for a dog.

Extract all medical indicators and return ONLY valid JSON in this exact format:
{
  "score": <integer 0-100 representing case severity>,
  "flags": [<array of critical keywords found, e.g. "Trauma", "Severe Anemia", "Urgent Transfusion", "Low PCV", "Accident", "Critical", "Emergency", "Post-op", "Pyometra", "Anesthesia">],
  "summary": "<one concise sentence summarizing the medical situation>",
  "pcv_value": "<PCV percentage if found, else null>",
  "urgency": "<low|medium|high|critical>"
}

Scoring guide:
- 0-25: Stable, routine monitoring
- 26-50: Mild concern, scheduled attention needed  
- 51-75: Moderate urgency, prompt veterinary care needed
- 76-100: Critical emergency, immediate intervention required

Base your score on: trauma keywords, critically low PCV (<25%), severe anemia, accident/injury, post-surgical complications, words like urgent/emergency/critical/immediate/pyometra/CEH.
If the document appears to be a routine post-op monitoring sheet with stable vitals, score between 30-55.`;

const FALLBACK_RESPONSE = {
  score: 0,
  flags: [],
  summary: "Could not analyze document",
  pcv_value: null,
  urgency: "low",
};

export async function POST(request: NextRequest) {
  try {
    // Accept base64Data directly from client — no server-side file fetching needed
    const { base64Data, mimeType } = await request.json();

    if (!base64Data || !mimeType) {
      console.error("Missing required fields: base64Data and mimeType are required");
      return NextResponse.json(
        { error: "base64Data and mimeType are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    console.log("Calling Gemini gemini-2.0-flash. mimeType:", mimeType, "base64 length:", base64Data.length);

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
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
      },
    });

    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("Gemini response:", responseText?.substring(0, 300));

    if (!responseText) {
      console.error("Empty response from Gemini");
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    // Strip markdown code fences if Gemini wraps JSON in them
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result = {
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 0,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary available",
      pcv_value: parsed.pcv_value ?? null,
      urgency: ["low", "medium", "high", "critical"].includes(parsed.urgency) ? parsed.urgency : "low",
    };

    console.log("OCR complete. Score:", result.score, "Urgency:", result.urgency, "Flags:", result.flags);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("OCR Flag API error:", error?.message, error?.stack?.substring(0, 300));
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
