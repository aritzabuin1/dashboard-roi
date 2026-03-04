import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next')
    // Sanitize redirect: must start with "/" to prevent open redirect attacks
    const redirectPath = next?.startsWith('/') ? next : '/'

    const origin = new URL(request.url).origin
    const forwardedHost = request.headers.get('x-forwarded-host')
    const baseUrl = forwardedHost ? `https://${forwardedHost}` : origin

    // Primary flow: verify token hash from email link (invite, recovery, etc.)
    if (token_hash && type) {
        const supabase = await createClient()
        const { error } = await supabase.auth.verifyOtp({ type, token_hash })

        if (!error) {
            return NextResponse.redirect(`${baseUrl}${redirectPath}`)
        }

        console.error('[auth/callback] verifyOtp error:', error.message)
        return NextResponse.redirect(`${baseUrl}/client/login?error=link_expired`)
    }

    // Fallback: PKCE code exchange (for OAuth flows)
    const code = searchParams.get('code')
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return NextResponse.redirect(`${baseUrl}${redirectPath}`)
        }

        console.error('[auth/callback] code exchange error:', error.message)
    }

    return NextResponse.redirect(`${baseUrl}/client/login?error=auth_failed`)
}
