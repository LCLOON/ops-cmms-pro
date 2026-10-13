import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { askAdvisor } from '@/lib/advisor';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null) as { question?: unknown } | null;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });
    if (question.length > 2000) return NextResponse.json({ error: 'question too long (max 2000 characters)' }, { status: 400 });

    const answer = await askAdvisor({ question, role: session.role });
    return NextResponse.json(answer);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
