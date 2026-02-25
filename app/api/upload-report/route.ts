import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

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
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // If you have a cloud name + upload preset (unsigned), use that.
  // Otherwise fall back to signed upload with api_key/secret.
  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME is not set');
  }

  const formData = new FormData();
  formData.append('file', dataUri);

  if (uploadPreset) {
    // Unsigned upload
    formData.append('upload_preset', uploadPreset);
  } else if (apiKey && apiSecret) {
    // Signed upload
    const timestamp = Math.round(Date.now() / 1000);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    // Note: proper signed uploads need a signature — for simplicity use an unsigned preset
  }

  formData.append('folder', 'wastewise/reports');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Cloudinary upload failed: ${err.error?.message ?? res.statusText}`);
  }

  const json = await res.json();
  return json.secure_url as string;
}

// ─── Cohere Vision Analysis ───────────────────────────────────────────────────

async function analyzeWithCohere(imageUrl: string, userNote: string): Promise<CohereAnalysis> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('COHERE_API_KEY is not set');

  const prompt = `You are a waste management AI analyst. Analyze this image of a waste bin/area and the user's note, then return ONLY a valid JSON object with no markdown, no explanation, no code fences.

User note: "${userNote || 'No additional context provided'}"

Return exactly this JSON shape:
{
  "severity": "critical" | "high" | "medium" | "low",
  "category": one of ["overflowing_bin", "illegal_dumping", "damaged_bin", "missed_collection", "biohazard", "general_waste", "recyclables", "other"],
  "description": "2-3 sentence factual description of what you see",
  "estimatedFillLevel": number between 0-100 (percentage),
  "recommendedAction": "specific action for waste management team",
  "urgencyScore": number between 1-10,
  "tags": array of 2-5 lowercase descriptive tags,
  "locationHint": "any visible location clues from image, or 'Not identifiable'"
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
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cohere API error: ${err.message ?? res.statusText}`);
  }

  const json = await res.json();

  // Extract text from response
  const rawText: string =
    json.message?.content?.[0]?.text ??
    json.text ??
    json.generations?.[0]?.text ??
    '';

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as CohereAnalysis;
  } catch {
    // Fallback if Cohere returns something unexpected
    return {
      severity: 'medium',
      category: 'general_waste',
      description: rawText.slice(0, 200) || 'Unable to parse AI analysis.',
      estimatedFillLevel: 50,
      recommendedAction: 'Manual inspection required.',
      urgencyScore: 5,
      tags: ['waste', 'review-needed'],
      locationHint: 'Not identifiable',
    };
  }
}

// ─── Save Report to MongoDB ───────────────────────────────────────────────────

async function saveReport(
  clerkUserId: string,
  imageUrl: string,
  userNote: string,
  analysis: CohereAnalysis,
  coordinates?: { lat: number; lng: number }
) {
  await dbConnect();

  // Dynamically get or create Report model to avoid re-registration errors
  const mongoose = (await import('mongoose')).default;

  const ReportSchema = new mongoose.Schema(
    {
      reportedBy: { type: String, required: true }, // clerkUserId
      imageUrl: { type: String, required: true },
      userNote: { type: String, default: '' },
      // AI analysis fields
      severity: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
      category: { type: String },
      aiDescription: { type: String },
      estimatedFillLevel: { type: Number },
      recommendedAction: { type: String },
      urgencyScore: { type: Number },
      tags: [{ type: String }],
      locationHint: { type: String },
      // Optional geo
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
      },
      status: {
        type: String,
        enum: ['pending', 'acknowledged', 'in_progress', 'resolved'],
        default: 'pending',
      },
    },
    { timestamps: true }
  );

  const Report =
    mongoose.models.Report ?? mongoose.model('Report', ReportSchema);

  const doc = await Report.create({
    reportedBy: clerkUserId,
    imageUrl,
    userNote,
    severity: analysis.severity,
    category: analysis.category,
    aiDescription: analysis.description,
    estimatedFillLevel: analysis.estimatedFillLevel,
    recommendedAction: analysis.recommendedAction,
    urgencyScore: analysis.urgencyScore,
    tags: analysis.tags,
    locationHint: analysis.locationHint,
    ...(coordinates && {
      location: {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat],
      },
    }),
  });

  return doc;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const userNote = (formData.get('note') as string) ?? '';
    const latRaw = formData.get('lat') as string | null;
    const lngRaw = formData.get('lng') as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // 1. Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(file);

    // 2. Analyze with Cohere
    const analysis = await analyzeWithCohere(imageUrl, userNote);

    // 3. Save to MongoDB
    const coordinates =
      latRaw && lngRaw
        ? { lat: parseFloat(latRaw), lng: parseFloat(lngRaw) }
        : undefined;

    const report = await saveReport(
      session.userId,
      imageUrl,
      userNote,
      analysis,
      coordinates
    );

    return NextResponse.json({
      success: true,
      report: {
        id: report._id.toString(),
        imageUrl,
        analysis,
        status: 'pending',
        createdAt: report.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/upload-report]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET Handler (fetch user's own reports) ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const mongoose = (await import('mongoose')).default;

    const Report =
      mongoose.models.Report ??
      mongoose.model('Report', new mongoose.Schema({}, { strict: false, timestamps: true }));

    const reports = await Report.find({ reportedBy: session.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ success: true, reports });
  } catch (error: unknown) {
    console.error('[GET /api/upload-report]', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}