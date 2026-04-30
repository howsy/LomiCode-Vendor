import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Pre-flight check used by the login form so we know whether to ask for a
// 2FA code on the second submit. Always returns 200 so an attacker can't
// distinguish "user exists" from "user doesn't exist" via the timing of
// a 4xx — we just say "not required" if we can't tell.

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const email = String(json?.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ required: false })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { totpEnabled: true, isActive: true },
  })

  // Don't reveal active/inactive — just say "not required" so the user
  // submits without a code and gets a generic invalid-credentials error.
  if (!user || !user.isActive) return NextResponse.json({ required: false })

  return NextResponse.json({ required: user.totpEnabled })
}
