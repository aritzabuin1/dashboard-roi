
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Plus, Copy, Check, LogOut } from "lucide-react"
import Link from "next/link"

interface Client {
    id: string
    name: string
    api_key: string
    created_at: string
}

interface Automation {
    id: string
    name: string
    manual_duration_minutes: number
    cost_per_hour: number
    clients: { id: string; name: string }
}

export default function AdminPage() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null)
    const [clients, setClients] = useState<Client[]>([])
    const [automations, setAutomations] = useState<Automation[]>([])
    const [newClientName, setNewClientName] = useState('')
    const [newAutomation, setNewAutomation] = useState({ client_id: '', name: '', manual_duration_minutes: '', cost_per_hour: '' })
    const [loading, setLoading] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const router = useRouter()

    // Check authentication on load
    useEffect(() => {
        checkAuth()
    }, [])

    async function checkAuth() {
        try {
            const res = await fetch('/api/admin/check')
            const data = await res.json()
            if (data.authenticated) {
                setAuthenticated(true)
                fetchClients()
                fetchAutomations()
            } else {
                router.push('/admin/login')
            }
        } catch {
            router.push('/admin/login')
        }
    }

    async function handleLogout() {
        await fetch('/api/admin/logout', { method: 'POST' })
        router.push('/admin/login')
    }

    async function fetchClients() {
        const res = await fetch('/api/clients')
        const data = await res.json()
        if (data.success) setClients(data.clients || [])
    }

    async function fetchAutomations() {
        const res = await fetch('/api/automations')
        const data = await res.json()
        if (data.success) setAutomations(data.automations || [])
    }

    async function handleAddClient(e: React.FormEvent) {
        e.preventDefault()
        if (!newClientName.trim()) return
        setLoading(true)
        const res = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newClientName })
        })
        const data = await res.json()
        if (data.success) {
            setNewClientName('')
            fetchClients()
        } else {
            alert('Error: ' + data.error)
        }
        setLoading(false)
    }

    async function handleAddAutomation(e: React.FormEvent) {
        e.preventDefault()
        if (!newAutomation.client_id || !newAutomation.name) return
        setLoading(true)
        const res = await fetch('/api/automations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...newAutomation,
                manual_duration_minutes: parseFloat(newAutomation.manual_duration_minutes) || 0,
                cost_per_hour: parseFloat(newAutomation.cost_per_hour) || 0
            })
        })
        const data = await res.json()
        if (data.success) {
            setNewAutomation({ client_id: '', name: '', manual_duration_minutes: '', cost_per_hour: '' })
            fetchAutomations()
        } else {
            alert('Error: ' + data.error)
        }
        setLoading(false)
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text)
        setCopiedKey(text)
        setTimeout(() => setCopiedKey(null), 2000)
    }

    // Show loading while checking auth
    if (authenticated === null) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-60 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="outline" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">Panel de Administración</h1>
                            <p className="text-muted-foreground">Gestiona clientes y automatizaciones</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" /> Cerrar Sesión
                    </Button>
                </div>

                {/* Add Client Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Añadir Cliente</CardTitle>
                        <CardDescription>Crea un nuevo cliente y obtén su API Key automáticamente</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddClient} className="flex gap-4">
                            <Input
                                placeholder="Nombre del cliente"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                                className="max-w-xs"
                            />
                            <Button type="submit" disabled={loading}>
                                <Plus className="h-4 w-4 mr-2" /> Crear Cliente
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Clients Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Clientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>API Key</TableHead>
                                    <TableHead>Creado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            No hay clientes. Añade uno arriba.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    clients.map((client) => (
                                        <TableRow key={client.id}>
                                            <TableCell className="font-medium">{client.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">
                                                        {client.api_key.slice(0, 10)}...
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => copyToClipboard(client.api_key)}
                                                    >
                                                        {copiedKey === client.api_key ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(client.created_at).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add Automation Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Añadir Automatización</CardTitle>
                        <CardDescription>Configura el coste y tiempo de una nueva automatización</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddAutomation} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <select
                                className="border rounded-md p-2 bg-white dark:bg-slate-900"
                                value={newAutomation.client_id}
                                onChange={(e) => setNewAutomation({ ...newAutomation, client_id: e.target.value })}
                            >
                                <option value="">Seleccionar cliente</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <Input
                                placeholder="Nombre automatización"
                                value={newAutomation.name}
                                onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                            />
                            <Input
                                type="number"
                                step="0.1"
                                placeholder="Tiempo manual (min)"
                                value={newAutomation.manual_duration_minutes}
                                onChange={(e) => setNewAutomation({ ...newAutomation, manual_duration_minutes: e.target.value })}
                            />
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Coste/hora (€)"
                                value={newAutomation.cost_per_hour}
                                onChange={(e) => setNewAutomation({ ...newAutomation, cost_per_hour: e.target.value })}
                            />
                            <Button type="submit" disabled={loading}>
                                <Plus className="h-4 w-4 mr-2" /> Añadir
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Automations Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Automatizaciones Configuradas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tiempo Manual</TableHead>
                                    <TableHead>Coste/Hora</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {automations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            No hay automatizaciones configuradas.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    automations.map((auto) => (
                                        <TableRow key={auto.id}>
                                            <TableCell>
                                                <Badge variant="outline">{auto.clients?.name || 'N/A'}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{auto.name}</TableCell>
                                            <TableCell>{auto.manual_duration_minutes} min</TableCell>
                                            <TableCell>€{auto.cost_per_hour}/h</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
