import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/driver/documents — submit document reference
// GET  /api/driver/documents — list submitted documents
// ═══════════════════════════════════════════════════════════════════════════

const docSchema = z.object({
  docType: z.enum(['license_front', 'license_back', 'insurance', 'registration', 'profile_photo', 'background_check']),
  fileUrl: z.string().url(),
  expiresAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = docSchema.parse(await request.json());

    const { data: doc, error } = await supabase
      .from('driver_documents')
      .insert({
        driver_id: user.id,
        doc_type: body.docType,
        file_url: body.fileUrl,
        expires_at: body.expiresAt ?? null,
        status: 'pending',
      })
      .select('id, doc_type, status')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Check if all required docs are submitted
    const { data: allDocs } = await supabase
      .from('driver_documents')
      .select('doc_type')
      .eq('driver_id', user.id)
      .in('status', ['pending', 'approved']);

    const types = new Set((allDocs ?? []).map((d: { doc_type: string }) => d.doc_type));
    const required = ['license_front', 'insurance', 'profile_photo'];
    const complete = required.every(r => types.has(r));

    if (complete) {
      await supabase.from('driver_applications')
        .update({ documents_complete: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');
    }

    return NextResponse.json({ documentId: doc?.id, documentsComplete: complete }, { status: 201 });
  } catch (err) {
    console.error('[driver/documents]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { data: docs } = await supabase
      .from('driver_documents')
      .select('id, doc_type, status, expires_at, created_at')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ documents: docs ?? [] });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
