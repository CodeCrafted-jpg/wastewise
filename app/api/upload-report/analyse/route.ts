import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CohereAnalysis {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  estimatedFillLevel: number;
  recommendedAction: string;
  urgencyScore: number;
  tags: string[];
  locationHint: string;
}

// ─── Cloudinary Upload ────────────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUri = `data:${file.type};base64,${base64}`;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET; // set this in .env

  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not set');

  const fd = new FormData();
  fd.append('file', dataUri);
  fd.append('folder', 'wastewise/reports');
  if (uploadPreset) fd.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cloudinary: ${err.error?.message ?? res.statusText}`);
  }

  return (await res.json()).secure_url as string;
}

// ─── Cohere Vision Analysis ───────────────────────────────────────────────────

async function analyzeWithCohere(imageUrl: string, userNote: string): Promise<CohereAnalysis> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('COHERE_API_KEY not set');

  const prompt = `You are a waste management AI analyst. Analyze this image of a waste bin or waste area, plus the user's note. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

User note: "${userNote || 'No additional context'}"

Return exactly:
{
  "severity": "critical" | "high" | "medium" | "low",
  "category": "overflowing_bin" | "illegal_dumping" | "damaged_bin" | "missed_collection" | "biohazard" | "general_waste" | "recyclables" | "other",
  "description": "2-3 sentence factual description of what you observe",
  "estimatedFillLevel": <integer 0-100>,
  "recommendedAction": "specific action the waste management team should take",
  "urgencyScore": <integer 1-10>,
  "tags": ["tag1", "tag2"],
  "locationHint": "any visible location clues, or Not identifiable"
}`;

  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'command-r-plus',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cohere: ${err.message ?? res.statusText}`);
  }

  const json = await res.json();
  const raw: string =
    json.message?.content?.[0]?.text ??
    json.text ??
    json.generations?.[0]?.text ??
    '';

  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as CohereAnalysis;
  } catch {
    // Graceful fallback
    return {
      severity: 'medium',
      category: 'general_waste',
      description: raw.slice(0, 250) || 'Unable to parse AI response.',
      estimatedFillLevel: 50,
      recommendedAction: 'Manual inspection required.',
      urgencyScore: 5,
      tags: ['needs-review'],
      locationHint: 'Not identifiable',
    };
  }
}

// ─── POST /api/upload-report/analyze ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const note = (formData.get('note') as string) ?? '';

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 10MB' }, { status: 400 });
    }

    // 1. Upload to Cloudinary to get a public URL for Cohere vision
    const imageUrl = await uploadToCloudinary(file);

    // 2. Analyze with Cohere vision
    const analysis = await analyzeWithCohere(imageUrl, note);

    return NextResponse.json({
      success: true,
      imageUrl,   // pass back so the submit step can reuse it
      analysis,
    });
  } catch (error: unknown) {
    console.error('[POST /api/upload-report/analyze]', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}