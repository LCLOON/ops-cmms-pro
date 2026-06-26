import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPmSchedules } from '@/lib/operations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(getPmSchedules());
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
