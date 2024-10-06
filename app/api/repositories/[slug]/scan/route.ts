// app/api/repositories/[slug]/scan/route.ts

import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { db } from '@/lib/db/drizzle';
import { repositories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Initialize Redis connection
const redisConnection = new Redis();

// Initialize BullMQ queue
const scanQueue = new Queue('repositoryScan', { connection: redisConnection });

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
  }

  try {
    // Check if the repository exists
    const repoData = await db.query.repositories.findFirst({
      where: eq(repositories.id, slug),
    });

    if (!repoData) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    // Enqueue the scan job
    await scanQueue.add('scan', {
      repositoryId: repoData.id,
      provider: repoData.provider,
      slug,
    });
    console.log('Queued for scan', repoData.name)

    return NextResponse.json({ message: 'Scan job enqueued' });
  } catch (error) {
    console.error('Error triggering scan:', error);
    return NextResponse.json({ error: 'Failed to enqueue scan job' }, { status: 500 });
  }
}
