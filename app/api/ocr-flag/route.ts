import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const VETERINARY_TRIAGE_PROMPT = `You are a veterinary emergency triage assistant for K9Hope, a canine blood donation network in India.
Analyze this uploaded document which may be a vet recommendation letter, blood test report, or medical document for a dog.

Extract all medical indicators and return ONLY valid JSON in this exact format:
{
  "score": <integer 0-100 representing case severity>,
  "flags": [<array of critical keywords found, e.g. "Trauma", "Severe Anemia", "Urgent Transfusion", "Low PCV", "Accident", "Critical", "Emergency", "Post-op", "Pyometra", "CEH", "Anesthesia">],
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
If the document is a routine post-op monitoring sheet with stable vitals (pink moist mucous membranes, normal urination, satisfactory food intake), score between 30-55.
Always return valid JSON only — no markdown, no explanation outside the JSON object.`;

const FALLBACK_RESPONSE = {
  score: 0,
  flags: [],
  summary: "Could not analyze document",
  pcv_value: null,
  urgency: "low",
  modelUsed: "none",
};

// Model chain: best quality first → most available last
const MODEL_CHAIN = [
  { model: "gemini-2.5-flash-preview-05-20", label: "2.5-flash" },
  { model: "gemini-2.0-flash",               label: "2.0-flash" },
  { model: "gemini-1.5-flash",               label: "1.5-flash" },
  { model: "gemini-1.5-flash-8b",            label: "1.5-flash-8b" },
];

async function tryGeminiModel(
  apiKey: string,
  modelName: string,
  base64Data: string,
  mimeType: string
): Promise<any | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: VETERINARY_TRIAGE_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.warn(`[${modelName}] Empty response from Gemini`);
      return null;
    }

    // Strip markdown code fences if Gemini wraps JSON in them
    const cleaned = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      score: typeof parsed.score === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.score)))
        : 0,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      summary: typeof parsed.summary === "string"
        ? parsed.summary
        : "No summary available",
      pcv_value: parsed.pcv_value ?? null,
      urgency: ["low", "medium", "high", "critical"].includes(parsed.urgency)
        ? parsed.urgency
        : "low",
      modelUsed: modelName,
    };
  } catch (err: any) {
    const status = err?.status ?? err?.code ?? "";
    const message = err?.message ?? "";
    const isQuota =
      status === 429 ||
      String(status) === "429" ||
      message.includes("429") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("quota");
    const isUnavailable =
      status === 503 ||
      String(status) === "503" ||
      message.includes("overloaded") ||
      message.includes("unavailable");

    if (isQuota) {
      console.warn(`[${modelName}] ⚠ Quota exceeded — trying next model`);
    } else if (isUnavailable) {
      console.warn(`[${modelName}] ⚠ Model overloaded — trying next model`);
    } else {
      console.error(`[${modelName}] ✗ Error:`, message.substring(0, 200));
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { base64Data, mimeType } = await request.json();

    if (!base64Data || !mimeType) {
      return NextResponse.json(
        { error: "base64Data and mimeType are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return NextResponse.json(FALLBACK_RESPONSE);
    }

    console.log(`\n🔬 OCR request — mimeType: ${mimeType}, base64 length: ${base64Data.length}`);

    // Try each model in the chain until one succeeds
    for (const { model, label } of MODEL_CHAIN) {
      console.log(`  → Trying: ${label} (${model})`);
      const result = await tryGeminiModel(apiKey, model, base64Data, mimeType);
      if (result) {
        console.log(`  ✓ Success with ${label} — Score: ${result.score}, Urgency: ${result.urgency}, Flags: [${result.flags.join(", ")}]`);
        return NextResponse.json(result);
      }
    }

    // All models failed
    console.error("  ✗ All 4 models failed. Returning fallback.");
    return NextResponse.json(FALLBACK_RESPONSE);
  } catch (error: any) {
    console.error("OCR route error:", error?.message);
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
