import { NextResponse } from 'next/server';

import { getSafeDatabaseTarget, pingMySql } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const target = getSafeDatabaseTarget();
    const result = await pingMySql();

    return NextResponse.json({
      status: 'ok',
      target,
      database: result.databaseName ?? target.database,
      serverTime: result.serverTime,
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
      { status: 500 }
    );
  }
}