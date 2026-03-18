
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Plus, Copy, Check, LogOut, Mail, Loader2, ChevronDown, ChevronUp, UserPlus, RefreshCw, Users } from "lucide-react"
import Link from "next/link"
import { SilenceAlertsBanner } from "@/components/admin/silence-alerts-banner"
import { ReportSection } from "@/components/admin/report-section"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface ClientUser {
    id: string
    email: string
    role: string
    invited_at: string
    accepted_at: string | null
    auth_user_id: string | null
}

interface Client {
    id: string
    name: string
    created_at: string
    auth_user_id: string | null
}

interface Automation {
    id: string
    name: string
    manual_duration_minutes: number
    cost_per_hour: number
    expected_frequency: string
    silence_threshold_hours: number | null
    clients: { id: string; name: string }
}

const FREQUENCY_LABELS: Record<string, string> = {
    daily: 'Diaria',
    weekly: 'Semanal',
    on_demand: 'Bajo demanda',
    custom: 'Personalizada',
}

export default function AdminPage() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null)
    const [clients, setClients] = useState<Client[]>([])
    const [automations, setAutomations] = useState<Automation[]>([])
    const [newClient, setNewClient] = useState({ name: '', email: '' })
    const [newAutomation, setNewAutomation] = useState({ client_id: '', name: '', manual_duration_minutes: '', cost_per_hour: '', expected_frequency: 'on_demand', silence_threshold_hours: '' })
    const [loading, setLoading] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Client users state
    const [expandedClient, setExpandedClient] = useState<string | null>(null)
    const [clientUsers, setClientUsers] = useState<Record<string, ClientUser[]>>({})
    const [loadingUsers, setLoadingUsers] = useState<string | null>(null)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('')
    const [invitingUser, setInvitingUser] = useState(false)
    const [resendingUser, setResendingUser] = useState<string | null>(null)

    // Tools state
    const [toolEmail, setToolEmail] = useState('')
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)
    const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
    const [resendingInvite, setResendingInvite] = useState<string | null>(null)

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
        if (!newClient.name.trim()) return
        setLoading(true)
        setSuccessMessage(null)
        const res = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newClient)
        })
        const data = await res.json()
        if (data.success) {
            setNewClient({ name: '', email: '' })
            fetchClients()
            if (data.message) {
                setSuccessMessage(data.message)
                setTimeout(() => setSuccessMessage(null), 10000)
            }
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
                client_id: newAutomation.client_id,
                name: newAutomation.name,
                manual_duration_minutes: parseFloat(newAutomation.manual_duration_minutes) || 0,
                cost_per_hour: parseFloat(newAutomation.cost_per_hour) || 0,
                expected_frequency: newAutomation.expected_frequency,
                ...(newAutomation.expected_frequency === 'custom' && newAutomation.silence_threshold_hours
                    ? { silence_threshold_hours: parseInt(newAutomation.silence_threshold_hours) }
                    : {})
            })
        })
        const data = await res.json()
        if (data.success) {
            setNewAutomation({ client_id: '', name: '', manual_duration_minutes: '', cost_per_hour: '', expected_frequency: 'on_demand', silence_threshold_hours: '' })
            fetchAutomations()
        } else {
            alert('Error: ' + data.error)
        }
        setLoading(false)
    }

    async function handleSendInvite(clientId: string) {
        const email = prompt('Introduce el email del cliente para enviarle la invitación:')
        if (!email) return

        setResendingInvite(clientId)
        setSuccessMessage(null)
        try {
            const res = await fetch('/api/admin/resend-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, email })
            })
            const data = await res.json()
            if (data.success) {
                setSuccessMessage(data.message)
                setTimeout(() => setSuccessMessage(null), 8000)
                fetchClients()
            } else {
                alert('Error: ' + data.error)
            }
        } catch {
            alert('Error de conexión al enviar invitación')
        }
        setResendingInvite(null)
    }

    async function fetchClientUsers(clientId: string) {
        setLoadingUsers(clientId)
        try {
            const res = await fetch(`/api/admin/client-users?clientId=${clientId}`)
            const data = await res.json()
            if (data.success) {
                setClientUsers(prev => ({ ...prev, [clientId]: data.users || [] }))
            }
        } catch {
            console.error('Error fetching client users')
        }
        setLoadingUsers(null)
    }

    function toggleExpandClient(clientId: string) {
        if (expandedClient === clientId) {
            setExpandedClient(null)
        } else {
            setExpandedClient(clientId)
            if (!clientUsers[clientId]) {
                fetchClientUsers(clientId)
            }
        }
        setInviteEmail('')
        setInviteRole('')
    }

    async function handleInviteUser(clientId: string) {
        if (!inviteEmail.trim()) return
        setInvitingUser(true)
        setSuccessMessage(null)
        try {
            const res = await fetch('/api/admin/client-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, email: inviteEmail.trim(), role: inviteRole.trim() || 'viewer' })
            })
            const data = await res.json()
            if (data.success) {
                setSuccessMessage(data.message)
                setTimeout(() => setSuccessMessage(null), 8000)
                setInviteEmail('')
                setInviteRole('')
                fetchClientUsers(clientId)
                fetchClients()
            } else {
                alert('Error: ' + data.error)
            }
        } catch {
            alert('Error de conexión al enviar invitación')
        }
        setInvitingUser(false)
    }

    async function handleResendUserInvite(clientUserId: string, clientId: string) {
        setResendingUser(clientUserId)
        setSuccessMessage(null)
        try {
            const res = await fetch('/api/admin/client-users/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientUserId })
            })
            const data = await res.json()
            if (data.success) {
                setSuccessMessage(data.message)
                setTimeout(() => setSuccessMessage(null), 8000)
                fetchClientUsers(clientId)
            } else {
                alert('Error: ' + data.error)
            }
        } catch {
            alert('Error de conexión')
        }
        setResendingUser(null)
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

                {/* Silence Alerts Banner */}
                <SilenceAlertsBanner />

                {/* Add Client Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Añadir Cliente</CardTitle>
                        <CardDescription>Crea un cliente con acceso al dashboard. El email y contraseña son para que el cliente pueda ver sus métricas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {successMessage && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                                ✅ {successMessage}
                            </div>
                        )}
                        <form onSubmit={handleAddClient} className="grid gap-4 md:grid-cols-3">
                            <Input
                                placeholder="Nombre del cliente *"
                                value={newClient.name}
                                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                required
                            />
                            <Input
                                type="email"
                                placeholder="Email del cliente (para acceso dashboard)"
                                value={newClient.email}
                                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                            />
                            <Button type="submit" disabled={loading}>
                                <Plus className="h-4 w-4 mr-2" /> {newClient.email ? 'Invitar Cliente' : 'Crear Cliente'}
                            </Button>
                        </form>
                        <p className="text-xs text-muted-foreground">
                            📧 Si pones email, el cliente recibirá una invitación para crear su propia contraseña.
                        </p>
                    </CardContent>
                </Card>

                {/* Clients Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Clientes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {successMessage && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                                {successMessage}
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Usuarios</TableHead>
                                    <TableHead>API Key</TableHead>
                                    <TableHead>Creado</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            No hay clientes. Añade uno arriba.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    clients.map((client) => (
                                        <>
                                        <TableRow key={client.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => toggleExpandClient(client.id)}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {expandedClient === client.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                    {client.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {client.auth_user_id ? (
                                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        <Users className="h-3 w-3 mr-1" />
                                                        Con acceso
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-500">
                                                        Solo webhook
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    {revealedKeys[client.id] ? (
                                                        <>
                                                            <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">
                                                                {revealedKeys[client.id]}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(revealedKeys[client.id]);
                                                                    setCopiedKey(client.id);
                                                                    setTimeout(() => setCopiedKey(null), 2000);
                                                                }}
                                                            >
                                                                {copiedKey === client.id ? (
                                                                    <Check className="h-4 w-4 text-green-500" />
                                                                ) : (
                                                                    <Copy className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(`/api/clients/${client.id}/key`);
                                                                    const data = await res.json();
                                                                    if (data.success) {
                                                                        setRevealedKeys(prev => ({ ...prev, [client.id]: data.api_key }));
                                                                    } else {
                                                                        alert('Error: ' + data.error);
                                                                    }
                                                                } catch {
                                                                    alert('Error fetching API key');
                                                                }
                                                            }}
                                                        >
                                                            Revelar Key
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(client.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => toggleExpandClient(client.id)}
                                                >
                                                    <UserPlus className="h-4 w-4 mr-1" />
                                                    Gestionar usuarios
                                                </Button>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded: User management */}
                                        {expandedClient === client.id && (
                                            <TableRow key={`${client.id}-users`}>
                                                <TableCell colSpan={5} className="bg-slate-50/50 dark:bg-slate-900/50 p-0">
                                                    <div className="p-4 space-y-4">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                            <Users className="h-4 w-4" />
                                                            Usuarios con acceso a {client.name}
                                                        </h4>

                                                        {/* Loading */}
                                                        {loadingUsers === client.id && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
                                                            </div>
                                                        )}

                                                        {/* Users list */}
                                                        {clientUsers[client.id] && clientUsers[client.id].length > 0 && (
                                                            <div className="rounded-md border">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="text-xs">Email</TableHead>
                                                                            <TableHead className="text-xs">Rol</TableHead>
                                                                            <TableHead className="text-xs">Estado</TableHead>
                                                                            <TableHead className="text-xs">Invitado</TableHead>
                                                                            <TableHead className="text-xs"></TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {clientUsers[client.id].map((user) => (
                                                                            <TableRow key={user.id}>
                                                                                <TableCell className="text-sm">{user.email}</TableCell>
                                                                                <TableCell>
                                                                                    <Badge variant="outline" className="text-xs">
                                                                                        {user.role || 'viewer'}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {user.accepted_at ? (
                                                                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                                                                            Activo
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 text-xs">
                                                                                            Pendiente
                                                                                        </Badge>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-xs text-muted-foreground">
                                                                                    {new Date(user.invited_at).toLocaleDateString()}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        disabled={resendingUser === user.id}
                                                                                        onClick={() => handleResendUserInvite(user.id, client.id)}
                                                                                        title={user.accepted_at ? 'Enviar email de recuperación' : 'Reenviar invitación'}
                                                                                    >
                                                                                        {resendingUser === user.id ? (
                                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                                        ) : (
                                                                                            <RefreshCw className="h-3 w-3" />
                                                                                        )}
                                                                                        <span className="ml-1 text-xs">
                                                                                            {user.accepted_at ? 'Reenviar acceso' : 'Reenviar invitación'}
                                                                                        </span>
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}

                                                        {/* No users message */}
                                                        {clientUsers[client.id] && clientUsers[client.id].length === 0 && loadingUsers !== client.id && (
                                                            <p className="text-sm text-muted-foreground">
                                                                No hay usuarios invitados. Añade uno abajo.
                                                            </p>
                                                        )}

                                                        {/* Invite new user form */}
                                                        <div className="flex items-center gap-2 pt-2 border-t">
                                                            <Input
                                                                type="email"
                                                                placeholder="Email del nuevo usuario"
                                                                value={inviteEmail}
                                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                                className="max-w-xs"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleInviteUser(client.id)}
                                                            />
                                                            <Input
                                                                placeholder="Rol (ej: CEO, CTO...)"
                                                                value={inviteRole}
                                                                onChange={(e) => setInviteRole(e.target.value)}
                                                                className="max-w-[160px]"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleInviteUser(client.id)}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                disabled={invitingUser || !inviteEmail.trim()}
                                                                onClick={() => handleInviteUser(client.id)}
                                                            >
                                                                {invitingUser ? (
                                                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                ) : (
                                                                    <Mail className="h-4 w-4 mr-1" />
                                                                )}
                                                                Enviar invitación
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        </>
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
                    <CardContent className="space-y-4">
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
                        <div className="flex items-center gap-4 pt-2 border-t">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                Frecuencia esperada
                                <InfoTooltip text="Define cada cuánto se espera que se ejecute esta automatización. 'Bajo demanda' no genera alertas. Las demás opciones activan la detección de silencio." />
                            </div>
                            <select
                                className="border rounded-md p-2 bg-white dark:bg-slate-900 text-sm"
                                value={newAutomation.expected_frequency}
                                onChange={(e) => setNewAutomation({ ...newAutomation, expected_frequency: e.target.value, silence_threshold_hours: '' })}
                            >
                                <option value="on_demand">Bajo demanda</option>
                                <option value="daily">Diaria</option>
                                <option value="weekly">Semanal</option>
                                <option value="custom">Personalizada</option>
                            </select>
                            {newAutomation.expected_frequency === 'custom' && (
                                <Input
                                    type="number"
                                    placeholder="Umbral (horas)"
                                    value={newAutomation.silence_threshold_hours}
                                    onChange={(e) => setNewAutomation({ ...newAutomation, silence_threshold_hours: e.target.value })}
                                    className="w-40"
                                />
                            )}
                        </div>
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
                                    <TableHead>Frecuencia</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {automations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {FREQUENCY_LABELS[auto.expected_frequency] || auto.expected_frequency}
                                                    {auto.expected_frequency === 'custom' && auto.silence_threshold_hours
                                                        ? ` (${auto.silence_threshold_hours}h)`
                                                        : ''}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* ROI Reports */}
                <ReportSection clients={clients} />

                {/* Emergency Tools */}
                <Card className="border-orange-200 dark:border-orange-900">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                            🔧 Herramientas de Emergencia (Sin Email)
                        </CardTitle>
                        <CardDescription>
                            Si el sistema de correos falla (Rate Limit excedido), usa esto para obtener el link manualmente y enviárselo al cliente por WhatsApp/Slack.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <Input
                                placeholder="Email del cliente a recuperar"
                                value={toolEmail}
                                onChange={(e) => setToolEmail(e.target.value)}
                            />
                            <Button
                                onClick={async () => {
                                    if (!toolEmail) return;
                                    setLoading(true);
                                    try {
                                        const res = await fetch('/api/admin/generate-link', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ email: toolEmail })
                                        });
                                        const d = await res.json();
                                        if (d.success) setGeneratedLink(d.link);
                                        else alert('Error Servidor: ' + (d.error || JSON.stringify(d)));
                                    } catch (e) {
                                        console.error(e);
                                        alert('Error crítico (Posible falta de SUPABASE_SERVICE_ROLE_KEY). Revisa Vercel.');
                                    }
                                    setLoading(false);
                                }}
                                disabled={loading}
                            >
                                Generar Link
                            </Button>
                        </div>
                        {generatedLink && (
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-md break-all relative group">
                                <p className="text-xs text-muted-foreground mb-1">Copia este link y ábrelo en incógnito:</p>
                                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                                    {generatedLink}
                                </code>
                                <Button
                                    size="sm"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyToClipboard(generatedLink)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        <div className="pt-4 border-t border-orange-200 dark:border-orange-800">
                            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">Opción B: Forzar Contraseña (Definitivo)</h4>
                            <div className="flex gap-4">
                                <Button
                                    variant="destructive"
                                    onClick={async () => {
                                        if (!toolEmail) return alert('Pon el email primero');
                                        const newPass = prompt('Escribe la nueva contraseña para este usuario:');
                                        if (!newPass) return;

                                        setLoading(true);
                                        try {
                                            const res = await fetch('/api/admin/system-password-reset', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ email: toolEmail, password: newPass })
                                            });
                                            const d = await res.json();
                                            if (d.success) alert('✅ Contraseña cambiada. Ahora inicia sesión normal con ella.');
                                            else alert('Error: ' + d.error);
                                        } catch (e) { alert('Error conexión'); }
                                        setLoading(false);
                                    }}
                                    disabled={loading}
                                >
                                    Establecer Contraseña Manualmente
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
