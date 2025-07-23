"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  Search,
  Globe,
  Code,
  Eye,
  FileText,
  Download,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ErrorBoundary } from "@/components/error-boundary"
import { MaximLogger } from "@/components/maxim-logger"
import type { ScrapingSession, ComparisonResult, BrowserMethod } from "@/types"
import { validateProductName, validateMethods, sanitizeInput } from "@/lib/utils"

const browserMethods: BrowserMethod[] = [
  {
    id: "scrapybara",
    name: "ScrapybaraBrowser",
    description: "Advanced browser automation with AI-powered element detection",
    icon: Globe,
  },
  {
    id: "playwright",
    name: "Playwright + Custom Functions",
    description: "Playwright with custom LLM-controlled functions",
    icon: Code,
  },
  {
    id: "puppeteer",
    name: "Puppeteer + AI Vision",
    description: "Puppeteer with AI vision for element identification",
    icon: Eye,
  },
]

export default function ProductComparisonAgent() {
  const [product1, setProduct1] = useState("")
  const [product2, setProduct2] = useState("")
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["scrapybara", "playwright"])
  const [sessions, setSessions] = useState<ScrapingSession[]>([])
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const validateInputs = useCallback(() => {
    const errors: string[] = []

    if (!validateProductName(product1)) {
      errors.push("Product 1 name must be between 2-100 characters")
    }

    if (!validateProductName(product2)) {
      errors.push("Product 2 name must be between 2-100 characters")
    }

    const methodValidation = validateMethods(selectedMethods)
    if (!methodValidation.valid) {
      errors.push(...methodValidation.errors)
    }

    return errors
  }, [product1, product2, selectedMethods])

  const startComparison = async () => {
    const validationErrors = validateInputs()
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "))
      return
    }

    setIsRunning(true)
    setCurrentStep("Initializing browser sessions...")
    setSessions([])
    setComparisonResult(null)
    setError(null)

    try {
      // Sanitize inputs
      const sanitizedProduct1 = sanitizeInput(product1)
      const sanitizedProduct2 = sanitizeInput(product2)

      // Create scraping sessions for each product and method
      const newSessions: ScrapingSession[] = []

      for (const product of [sanitizedProduct1, sanitizedProduct2]) {
        for (const method of selectedMethods) {
          const session: ScrapingSession = {
            id: `${product}-${method}-${Date.now()}`,
            productName: product,
            method,
            status: "pending",
            progress: 0,
            logs: [],
            startTime: new Date(),
          }
          newSessions.push(session)
        }
      }

      setSessions(newSessions)

      // Start scraping process
      const response = await fetch("/api/scrape-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product1: sanitizedProduct1,
          product2: sanitizedProduct2,
          methods: selectedMethods,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to start scraping process")
      }

      const { sessionId } = await response.json()
      setCurrentSessionId(sessionId)

      // Start polling for updates
      let pollInterval: NodeJS.Timeout
      let pollCount = 0
      const maxPolls = 150 // 5 minutes with 2-second intervals

      pollInterval = setInterval(async () => {
        try {
          pollCount++

          if (pollCount > maxPolls) {
            clearInterval(pollInterval)
            setIsRunning(false)
            setCurrentStep("Process timed out")
            setError("The comparison process took too long and was terminated.")
            return
          }

          const statusResponse = await fetch(`/api/scraping-status?sessionId=${sessionId}`)
          if (!statusResponse.ok) {
            throw new Error("Failed to fetch status")
          }
          const statusData = await statusResponse.json()

          if (statusData.completed) {
            clearInterval(pollInterval)
            if (statusData.result) {
              setComparisonResult(statusData.result)
              setCurrentStep("Comparison completed!")
            } else {
              setCurrentStep("Comparison failed")
              setError("The comparison process failed. Please try again.")
            }
            setIsRunning(false)
          } else {
            // Update sessions with progress
            setSessions((prev) =>
              prev.map((session) => ({
                ...session,
                status: statusData.sessions?.[session.id]?.status || session.status,
                progress: statusData.sessions?.[session.id]?.progress || session.progress,
                logs: statusData.sessions?.[session.id]?.logs || session.logs,
              })),
            )
            setCurrentStep(statusData.currentStep || currentStep)
          }
        } catch (error) {
          console.error("Polling error:", error)
          clearInterval(pollInterval)
          setIsRunning(false)
          setCurrentStep("Error occurred during polling")
          setError(error instanceof Error ? error.message : "Unknown error occurred")
        }
      }, 2000)
    } catch (error) {
      console.error("Comparison error:", error)
      setIsRunning(false)
      setCurrentStep("Error occurred during comparison")
      setError(error instanceof Error ? error.message : "Unknown error occurred")
    }
  }

  const downloadReadme = () => {
    if (!comparisonResult?.readme) return

    const blob = new Blob([comparisonResult.readme], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${sanitizeInput(product1)}-vs-${sanitizeInput(product2)}-comparison.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetComparison = () => {
    setProduct1("")
    setProduct2("")
    setSelectedMethods(["scrapybara", "playwright"])
    setSessions([])
    setComparisonResult(null)
    setIsRunning(false)
    setCurrentStep("")
    setError(null)
    setCurrentSessionId(null)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getMethodIcon = (methodId: string) => {
    const method = browserMethods.find((m) => m.id === methodId)
    const IconComponent = method?.icon || Globe
    return <IconComponent className="h-4 w-4" />
  }

  useEffect(() => {
    return () => {
      // Cleanup any active intervals when component unmounts
      if (typeof window !== "undefined") {
        const highestId = window.setTimeout(() => {}, 0)
        for (let i = 0; i < highestId; i++) {
          window.clearTimeout(i)
          window.clearInterval(i)
        }
      }
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">AI Product Comparison Agent</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Advanced product comparison using AI-controlled browser automation. Enter two products and let our AI
              agents scrape the web to provide comprehensive comparisons.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-6">
              {/* Product Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Product Comparison Setup
                  </CardTitle>
                  <CardDescription>
                    Enter two products to compare. Our AI agents will scrape data from multiple sources.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product1">Product 1</Label>
                      <Input
                        id="product1"
                        placeholder="e.g., iPhone 15 Pro"
                        value={product1}
                        onChange={(e) => setProduct1(e.target.value)}
                        disabled={isRunning}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product2">Product 2</Label>
                      <Input
                        id="product2"
                        placeholder="e.g., Samsung Galaxy S24 Ultra"
                        value={product2}
                        onChange={(e) => setProduct2(e.target.value)}
                        disabled={isRunning}
                        maxLength={100}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Browser Method Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Browser Automation Methods</CardTitle>
                  <CardDescription>
                    Select which browser automation methods to use for scraping product data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {browserMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedMethods.includes(method.id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => {
                          if (isRunning) return
                          setSelectedMethods((prev) =>
                            prev.includes(method.id) ? prev.filter((id) => id !== method.id) : [...prev, method.id],
                          )
                        }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <method.icon className="h-5 w-5" />
                          <h3 className="font-medium">{method.name}</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{method.description}</p>
                        {selectedMethods.includes(method.id) && <Badge className="mt-2">Selected</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Control Buttons */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <Button
                      onClick={startComparison}
                      disabled={!product1.trim() || !product2.trim() || selectedMethods.length === 0 || isRunning}
                      className="flex-1"
                      size="lg"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running Comparison...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start AI Product Comparison
                        </>
                      )}
                    </Button>
                    <Button onClick={resetComparison} variant="outline" disabled={isRunning}>
                      Reset
                    </Button>
                  </div>
                  {isRunning && (
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">{currentStep}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="progress" className="space-y-6">
              {sessions.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-slate-600 dark:text-slate-400">
                      No active sessions. Start a comparison to see progress here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <Card key={session.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getMethodIcon(session.method)}
                            <div>
                              <CardTitle className="text-lg">{session.productName}</CardTitle>
                              <CardDescription>
                                {browserMethods.find((m) => m.id === session.method)?.name}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(session.status)}
                            <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                              {session.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{session.progress}%</span>
                            </div>
                            <Progress value={session.progress} className="h-2" />
                          </div>

                          {session.logs.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
                              <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 text-xs font-mono max-h-32 overflow-y-auto">
                                {session.logs.slice(-5).map((log, index) => (
                                  <div key={index} className="text-slate-600 dark:text-slate-400">
                                    {log}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {!comparisonResult ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">
                      Comparison results will appear here once the analysis is complete.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Comparison Results
                        </CardTitle>
                        <Button onClick={downloadReadme} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download README
                        </Button>
                      </div>
                      <CardDescription>
                        AI-generated comparison between {comparisonResult.product1} and {comparisonResult.product2}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="border rounded-lg p-4">
                          <h3 className="font-medium mb-2">{comparisonResult.product1}</h3>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Data sources: {selectedMethods.length} methods
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h3 className="font-medium mb-2">{comparisonResult.product2}</h3>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Data sources: {selectedMethods.length} methods
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* README Preview */}
                  <Card>
                    <CardHeader>
                      <CardTitle>README Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-mono">{comparisonResult.readme}</pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Logs</CardTitle>
                  <CardDescription>
                    Detailed logs from all browser automation sessions and AI interactions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="text-xs font-mono space-y-1">
                      {sessions.flatMap((session) =>
                        session.logs.map((log, index) => (
                          <div key={`${session.id}-${index}`} className="text-slate-600 dark:text-slate-400">
                            <span className="text-blue-600 dark:text-blue-400">[{session.method}]</span>{" "}
                            <span className="text-green-600 dark:text-green-400">[{session.productName}]</span> {log}
                          </div>
                        )),
                      )}
                      {sessions.length === 0 && (
                        <div className="text-slate-500 dark:text-slate-500">
                          No logs available. Start a comparison to see detailed logs here.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              <MaximLogger sessionId={currentSessionId || undefined} isActive={isRunning} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  )
}
