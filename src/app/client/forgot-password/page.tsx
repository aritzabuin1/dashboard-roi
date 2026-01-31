
"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building2, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setStatus('loading')
        setMessage('')

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            const data = await res.json()

            if (data.success) {
                setStatus('success')
                setMessage('✅ Si el correo existe, recibirás un enlace de recuperación en unos minutos.')
            } else {
                setStatus('error')
                setMessage(data.error || 'Ocurrió un error.')
            }
        } catch {
            setStatus('error')
            setMessage('Error de conexión.')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Image src="/logo.jpg" alt="AI-Mate" width={200} height={70} className="h-12 w-auto mx-auto object-contain" priority quality={100} />
                    </div>
                    <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Mail className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <CardTitle>Recuperar Contraseña</CardTitle>
                    <CardDescription>Te enviaremos un enlace para restablecer tu acceso</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'success' ? (
                        <div className="space-y-4 text-center">
                            <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                                {message}
                            </div>
                            <Link href="/client/login">
                                <Button variant="outline" className="w-full">
                                    Volver al Login
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="email"
                                placeholder="Tu correo electrónico"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                            {status === 'error' && (
                                <p className="text-sm text-red-500 text-center">{message}</p>
                            )}
                            <Button type="submit" className="w-full" disabled={status === 'loading'}>
                                {status === 'loading' ? 'Enviando...' : 'Enviar enlace de recuperación'}
                            </Button>
                            <Link href="/client/login" className="block text-center text-sm text-slate-500 hover:text-slate-700">
                                <span className="flex items-center justify-center gap-1">
                                    <ArrowLeft className="h-3 w-3" /> Volver al Login
                                </span>
                            </Link>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
