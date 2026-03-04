"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Logo } from "@/components/logo"

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)
    const [message, setMessage] = useState('')
    const [hasSession, setHasSession] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // Clear admin session to avoid conflicts
        fetch('/api/admin/logout', { method: 'POST' })

        async function checkSession() {
            // Give supabase-js a moment to process any hash fragment tokens
            await new Promise(r => setTimeout(r, 500))

            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                setHasSession(true)
                setChecking(false)
                return
            }

            // Listen for auth state changes (invite or recovery link)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    setHasSession(true)
                    setChecking(false)
                    subscription.unsubscribe()
                }
            })

            // After 4 seconds, if no session, redirect to login
            setTimeout(() => {
                subscription.unsubscribe()
                setChecking(false)
            }, 4000)
        }

        checkSession()
    }, [supabase])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setMessage('Las contraseñas no coinciden.')
            return
        }
        setLoading(true)
        setMessage('')

        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                setMessage('Error: ' + error.message)
            } else {
                setMessage('Contraseña creada correctamente. Redirigiendo a tu dashboard...')
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            }
        } catch {
            setMessage('Error de conexión. Inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    if (checking) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <div className="h-8 w-8 mx-auto border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm">Verificando sesión...</p>
                </div>
            </div>
        )
    }

    if (!hasSession) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4">
                            <Logo className="justify-center" height={40} />
                        </div>
                        <CardTitle>Enlace expirado</CardTitle>
                        <CardDescription>
                            El enlace de invitación ha caducado o ya fue utilizado. Solicita uno nuevo a tu administrador o recupera tu contraseña.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button className="w-full" onClick={() => router.push('/client/forgot-password')}>
                            Recuperar contraseña
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/client/login')}>
                            Ir al login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Logo className="justify-center" height={40} />
                    </div>
                    <CardTitle>Crea tu contraseña</CardTitle>
                    <CardDescription>Establece una contraseña para acceder a tu dashboard de automatizaciones</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <Input
                            type="password"
                            placeholder="Nueva contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoFocus
                        />
                        <Input
                            type="password"
                            placeholder="Confirmar contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                        {message && (
                            <div className={`text-sm p-3 rounded-lg ${
                                message.includes('Error') || message.includes('coinciden')
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            }`}>
                                {message}
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Guardando...' : 'Crear contraseña y acceder'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
