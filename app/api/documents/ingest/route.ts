import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ingestDocument, candidateToAsset, type AssetCandidate } from '@/lib/doc-ingest';
import { upsertAsset, logAudit } from '@/lib/operations';

const MAX_TEXT = 200_000;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null) as {
      text?: unknown;
      filename?: unknown;
      commit?: unknown;
      candidates?: unknown;
    } | null;

    if (!body) return NextResponse.json({ error: 'JSON body required' }, { status: 400 });

    // Commit path: persist candidates the operator reviewed and kept.
    if (body.commit === true) {
      if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
        return NextResponse.json({ error: 'candidates array required' }, { status: 400 });
      }
      if (body.candidates.length > 500) {
        return NextResponse.json({ error: 'too many candidates (max 500 per import)' }, { status: 400 });
      }

      const now = new Date().toISOString();
      let imported = 0;
      for (const raw of body.candidates as AssetCandidate[]) {
        if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) continue;
        const asset = candidateToAsset(raw, now);
        await upsertAsset(asset);
        imported++;
      }

      await logAudit({
        userId: session.userId,
        username: session.username,
        action: 'import',
        entityType: 'asset',
        entityId: 'document-ingest',
        details: `Imported ${imported} assets from document ingestion`,
      });

      return NextResponse.json({ success: true, imported });
    }

    // Preview path: extract candidates, never write.
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });
    if (text.length > MAX_TEXT) {
      return NextResponse.json({ error: `text too long (max ${MAX_TEXT} characters)` }, { status: 400 });
    }

    const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : undefined;
    const result = ingestDocument(text, { filename });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
