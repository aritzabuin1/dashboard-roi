
"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ClientLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (authError) {
            setError('Email o contraseña incorrectos')
            setLoading(false)
            return
        }

        router.push('/')
        router.refresh()
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Image src="/logo.jpg" alt="AI-Mate" width={150} height={50} className="h-12 w-auto" />
                    </div>
                    <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <CardTitle>Acceso Cliente</CardTitle>
                    <CardDescription>Introduce tus credenciales para ver tu dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                        />
                        <Input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Verificando...' : 'Acceder'}
                        </Button>
                    </form>
                    <div className="mt-4 text-center space-y-2">
                        <Link href="/admin/login" className="text-sm text-slate-500 hover:text-slate-700 block">
                            ¿Eres administrador? Accede aquí
                        </Link>
                        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                            <ArrowLeft className="h-3 w-3" /> Volver
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
