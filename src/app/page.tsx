
"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { HeroStat } from "@/components/dashboard/HeroStat"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { MetricsGrid } from "@/components/dashboard/MetricsGrid"
import { TransparencyTable } from "@/components/dashboard/TransparencyTable"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings, RefreshCw, Building2 } from "lucide-react"
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

const EMPTY_STATE: DashboardData = {
  totalSaved: 0,
  hoursSaved: 0,
  executionCount: 0,
  successRate: 0,
  trendData: [],
  recentExecutions: [],
  isDemo: false
};

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [data, setData] = useState<DashboardData>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  // Fetch clients on load
  useEffect(() => {
    fetchClients()
    fetchMetrics('all')
  }, [])

  // Refetch metrics when client changes
  useEffect(() => {
    fetchMetrics(selectedClient)
  }, [selectedClient])

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

  async function fetchMetrics(clientId: string) {
    setLoading(true)
    try {
      const url = clientId === 'all'
        ? '/api/metrics'
        : `/api/metrics?clientId=${clientId}`
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

  function handleRefresh() {
    fetchMetrics(selectedClient)
  }

  const selectedClientName = selectedClient === 'all'
    ? 'Todos los Clientes'
    : clients.find(c => c.id === selectedClient)?.name || 'Cliente'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navbar */}
      <header className="border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="AI-Mate Logo"
              width={120}
              height={40}
              className="h-8 w-auto dark:invert"
              priority
            />
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-400">
              ROI Dashboard
            </span>
            {data.isDemo && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400">
                Modo Demo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">
              Última actualización: {lastUpdate}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" /> Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 space-y-8">
        {/* Client Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-500" />
            <select
              className="border rounded-lg px-4 py-2 bg-white dark:bg-slate-900 text-sm font-medium"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">🌐 Todos los Clientes (Global)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {selectedClient !== 'all' && (
              <Badge variant="secondary">{selectedClientName}</Badge>
            )}
          </div>
        </div>

        {/* Demo Warning */}
        {data.isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
            <strong>⚠️ Datos de demostración:</strong> Ejecuta el schema SQL en Supabase y envía tu primera ejecución para ver datos reales.
          </div>
        )}

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
              <TrendChart data={data.trendData} />
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
