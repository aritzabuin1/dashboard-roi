
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
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                setMessage('Error: ' + error.message)
            } else {
                setMessage('Contraseña actualizada correctamente. Redirigiendo...')
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            }
        } catch (err) {
            setMessage('Error de conexión. Inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Clear admin session to avoid conflicts
        fetch('/api/admin/logout', { method: 'POST' })

        // Listen for auth state changes (Magic Link login)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                console.log('Session established via recovery link')
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Logo className="justify-center" height={40} />
                    </div>
                    <CardTitle>Establecer Nueva Contraseña</CardTitle>
                    <CardDescription>Introduce tu nueva contraseña para acceder al dashboard</CardDescription>
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
                        />
                        {message && (
                            <div className={`text-sm p-2 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {message}
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
