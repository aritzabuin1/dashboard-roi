
"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { HeroStat } from "@/components/dashboard/HeroStat"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { MetricsGrid } from "@/components/dashboard/MetricsGrid"
import { TransparencyTable } from "@/components/dashboard/TransparencyTable"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings, RefreshCw, Building2, LogOut, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

interface Client {
  id: string
  name: string
}

interface DashboardData {
  totalSaved: number
  hoursSaved: number
  executionCount: number
  successRate: number
  trendData: { date: string; savings: number }[]
  recentExecutions: { id: string; automation_name: string; timestamp: string; status: 'success' | 'error' }[]
  isDemo: boolean
}

interface UserSession {
  type: 'admin' | 'client' | 'none'
  clientId?: string
  clientName?: string
  email?: string
}

const EMPTY_STATE: DashboardData = {
  totalSaved: 0,
  hoursSaved: 0,
  executionCount: 0,
  successRate: 0,
  trendData: [],
  recentExecutions: [],
  isDemo: false
};

type TimeRange = '7d' | '30d' | '365d'

export default function DashboardPage() {
  const [session, setSession] = useState<UserSession>({ type: 'none' })
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [data, setData] = useState<DashboardData>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const router = useRouter()
  const supabase = createClient()

  // Check auth on load
  useEffect(() => {
    checkAuth()

    // Safety net: Intercept password recovery flow landing on home
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Recovery flow detected in Home, redirecting...')
        router.push('/client/update-password')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Refetch when client or range changes
  useEffect(() => {
    if (session.type !== 'none') {
      fetchMetrics()
    }
  }, [selectedClient, timeRange, session])

  async function checkAuth() {
    // Check Supabase Auth (client login)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // User is logged in via Supabase Auth - find their client
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

      if (clientData) {
        setSession({
          type: 'client',
          clientId: clientData.id,
          clientName: clientData.name,
          email: user.email
        })
        setSelectedClient(clientData.id)
        fetchClients() // Admin still needs client list
        return
      }
    }

    // Check admin cookie session
    const adminRes = await fetch('/api/admin/check')
    const adminData = await adminRes.json()

    if (adminData.authenticated) {
      setSession({ type: 'admin' })
      fetchClients()
      fetchMetrics()
      return
    }

    // No session - show public view with login prompts
    setSession({ type: 'none' })
    setLoading(false)
  }

  async function fetchClients() {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      if (json.success) {
        setClients(json.clients || [])
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
  }

  async function fetchMetrics() {
    setLoading(true)
    try {
      const clientParam = session.type === 'client'
        ? session.clientId
        : selectedClient

      const url = `/api/metrics?range=${timeRange}${clientParam !== 'all' ? `&clientId=${clientParam}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setData(EMPTY_STATE)
      }
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setData(EMPTY_STATE)
    } finally {
      setLoading(false)
      setLastUpdate(new Date().toLocaleTimeString())
    }
  }

  async function handleLogout() {
    if (session.type === 'client') {
      await supabase.auth.signOut()
    } else {
      await fetch('/api/admin/logout', { method: 'POST' })
    }
    setSession({ type: 'none' })
    router.refresh()
  }

  function handleRefresh() {
    fetchMetrics()
  }

  const selectedClientName = selectedClient === 'all'
    ? 'Todos los Clientes'
    : clients.find(c => c.id === selectedClient)?.name || 'Cliente'

  // No session - show login prompt
  if (session.type === 'none' && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <Image src="/logo.jpg" alt="AI-Mate" width={200} height={70} className="h-12 w-auto mx-auto object-contain" priority quality={100} />
          <h1 className="text-2xl font-bold">Dashboard ROI</h1>
          <p className="text-slate-500">Accede para ver tus métricas de automatización</p>
          <div className="flex gap-4 justify-center">
            <Link href="/client/login">
              <Button size="lg">
                <Building2 className="h-4 w-4 mr-2" /> Acceso Cliente
              </Button>
            </Link>
            <Link href="/admin/login">
              <Button variant="outline" size="lg">
                <Settings className="h-4 w-4 mr-2" /> Admin
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navbar */}
      <header className="border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.jpg"
              alt="AI-Mate"
              width={180}
              height={60}
              className="h-10 w-auto object-contain"
              priority
              quality={100}
            />
            {session.type === 'client' && (
              <Badge variant="secondary">{session.clientName}</Badge>
            )}
            {session.type === 'admin' && (
              <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">
              {lastUpdate && `Actualizado: ${lastUpdate}`}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {session.type === 'admin' && (
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" /> Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 space-y-8">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Client Filter - Only for Admin */}
          {session.type === 'admin' && (
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-500" />
              <select
                className="border rounded-lg px-4 py-2 bg-white dark:bg-slate-900 text-sm font-medium"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="all">🌐 Todos los Clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-500" />
            <div className="inline-flex rounded-lg border bg-white dark:bg-slate-900 p-1">
              <Button
                variant={timeRange === '7d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                Semanal
              </Button>
              <Button
                variant={timeRange === '30d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                Mensual
              </Button>
              <Button
                variant={timeRange === '365d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('365d')}
              >
                Anual
              </Button>
            </div>
          </div>
        </div>

        {/* Top Section */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-40 col-span-1" />
            <Skeleton className="h-40 col-span-3" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="col-span-4 lg:col-span-1">
              <HeroStat totalSaved={data.totalSaved} />
            </div>
            <div className="col-span-4 lg:col-span-3">
              <MetricsGrid
                hoursSaved={data.hoursSaved}
                executionCount={data.executionCount}
                successRate={data.successRate}
              />
            </div>
          </div>
        )}

        {/* Charts & Data */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-7">
            <Skeleton className="h-80 col-span-4" />
            <Skeleton className="h-80 col-span-3" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-7">
            <div className="col-span-4 md:col-span-4">
              <TrendChart data={data.trendData} timeRange={timeRange} />
            </div>
            <div className="col-span-4 md:col-span-3">
              <TransparencyTable executions={data.recentExecutions} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
