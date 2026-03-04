"use client"

import { useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

function CallbackHandler() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const handled = useRef(false)

    useEffect(() => {
        if (handled.current) return
        handled.current = true

        const next = searchParams.get('next') || '/'

        async function handleAuth() {
            // 1. Try PKCE code exchange (code in query params)
            const code = searchParams.get('code')
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (!error) {
                    router.replace(next)
                    return
                }
                console.error('[auth/callback] Code exchange failed:', error)
            }

            // 2. Check if supabase-js already picked up hash fragment tokens
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                router.replace(next)
                return
            }

            // 3. Wait for auth state change (hash fragments processed async by supabase-js)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) {
                    subscription.unsubscribe()
                    router.replace(next)
                }
            })

            // 4. Timeout — if nothing works after 6 seconds, redirect to login
            setTimeout(() => {
                subscription.unsubscribe()
                router.replace('/client/login?error=auth_timeout')
            }, 6000)
        }

        handleAuth()
    }, [searchParams, router, supabase])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="h-8 w-8 mx-auto border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Verificando acceso...</p>
            </div>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Cargando...</p>
            </div>
        }>
            <CallbackHandler />
        </Suspense>
    )
}
