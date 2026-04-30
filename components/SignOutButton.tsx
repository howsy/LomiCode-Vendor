'use client'
import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-xs text-slate-600 hover:text-slate-900 underline
                 dark:text-slate-400 dark:hover:text-white"
    >
      Sign out
    </button>
  )
}
