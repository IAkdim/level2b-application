import { useState, useRef } from "react"
import { useImportLeads } from "@/hooks/useLeads"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle2, XCircle, Download, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  parseCSVFile,
  detectColumnMapping,
  processCSVRows,
  generateErrorReportCSV,
  downloadTextAsFile,
  type ColumnMapping,
  type ProcessedRow,
} from "@/lib/csvParser"
import type { CreateLeadInput, Lead } from "@/types/crm"

interface ImportCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'upload' | 'preview' | 'processing' | 'results'

const MAX_FILE_SIZE = 1_000_000 // 1MB
const MAX_PREVIEW_ROWS = 10

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
  const [validLeads, setValidLeads] = useState<CreateLeadInput[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{
    totalCreated: number
    totalUpdated: number
    totalFailed: number
    totalSkipped: number
    createdLeads: Lead[]
    updatedLeads: Lead[]
    failedLeads: Array<{ lead: CreateLeadInput; error: string }>
  } | null>(null)
  const [showCreatedList, setShowCreatedList] = useState(false)
  const [showUpdatedList, setShowUpdatedList] = useState(false)
  const [showFailedList, setShowFailedList] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const importLeads = useImportLeads()

  const resetState = () => {
    setStep('upload')
    setFile(null)
    setColumnMapping({})
    setProcessedRows([])
    setValidLeads([])
    setImportProgress(0)
    setImportResults(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const handleFileSelect = async (selectedFile: File) => {
    try {
      // Parse CSV
      const parsed = await parseCSVFile(selectedFile)

      if (parsed.errors.length > 0) {
        alert(`CSV parsing errors: ${parsed.errors[0].message}`)
        return
      }

      if (parsed.rows.length === 0) {
        alert('CSV file is empty')
        return
      }

      // Detect column mapping
      const mapping = detectColumnMapping(parsed.headers)

      if (!mapping.name || !mapping.email) {
        alert('Could not detect required columns (name and email). Please ensure your CSV has these columns.')
        return
      }

      // Validate and process rows
      const processed = processCSVRows(parsed.rows, mapping)
      const valid = processed.filter(row => row.result === 'success' && row.lead).map(row => row.lead!)

      setFile(selectedFile)
      setColumnMapping(mapping)
      setProcessedRows(processed)
      setValidLeads(valid)
      setStep('preview')
    } catch (error: any) {
      alert(`Error processing file: ${error.message}`)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        const sizeMB = (selectedFile.size / 1_000_000).toFixed(2)
        if (!confirm(`File is ${sizeMB}MB. Large files may cause browser performance issues. Continue?`)) {
          return
        }
      }
      handleFileSelect(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.type === 'text/csv') {
      handleFileSelect(droppedFile)
    } else {
      alert('Please drop a CSV file')
    }
  }

  const handleImport = async () => {
    if (validLeads.length === 0) return

    setStep('processing')
    setImportProgress(0)

    try {
      const results = await importLeads.mutateAsync({
        leads: validLeads,
        onProgress: (processed, total) => {
          setImportProgress((processed / total) * 100)
        },
      })

      // Results already categorized by hook
      setImportResults(results)
      setStep('results')
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
      setStep('preview')
    }
  }

  const handleDownloadErrorReport = () => {
    if (!importResults || importResults.failedLeads.length === 0) return

    const failedRows: ProcessedRow[] = importResults.failedLeads.map((item, idx) => ({
      rowIndex: idx + 2,
      originalData: item.lead as any,
      result: 'error',
      error: item.error,
    }))

    const csv = generateErrorReportCSV(failedRows)
    downloadTextAsFile(csv, `import-errors-${Date.now()}.csv`)
  }

  const validCount = processedRows.filter(r => r.result === 'success').length
  const errorCount = processedRows.filter(r => r.result === 'error').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with lead data. Required columns: name, email
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Drop CSV file here or click to browse</p>
              <p className="text-sm text-muted-foreground mb-4">
                Maximum file size: 1MB (~1000 rows recommended)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV Format Guidelines
                </h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Required columns:</strong> name, email</p>
                  <p><strong>Optional columns:</strong> phone, company, title, status, sentiment, source, notes</p>
                  <p><strong>Source tags:</strong> Can be comma-separated (e.g., "linkedin,referral")</p>
                  <p><strong>Duplicates:</strong> Existing leads (by email) will be updated with new data</p>
                  <p><strong>Column names:</strong> Case-insensitive and flexible (e.g., "Name", "Full Name", "name" all work)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">File: {file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {validCount} valid leads, {errorCount} errors
                </p>
              </div>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Choose Different File
              </Button>
            </div>

            {errorCount > 0 && (
              <Card className="border-warning bg-warning/5">
                <CardContent className="pt-6">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">
                        {errorCount} row{errorCount !== 1 ? 's' : ''} will be skipped
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        These rows have validation errors (missing required fields or invalid data).
                        Only valid rows will be imported.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <h4 className="font-medium mb-3">Detected Column Mapping</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(columnMapping).map(([field, csvColumn]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                    <span className="text-muted-foreground">← {csvColumn}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Preview (first {MAX_PREVIEW_ROWS} rows)</h4>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.slice(0, MAX_PREVIEW_ROWS).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {row.result === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.lead?.name || row.originalData[columnMapping.name || '']}
                          </TableCell>
                          <TableCell>
                            {row.lead?.email || row.originalData[columnMapping.email || '']}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.lead?.company || row.originalData[columnMapping.company || ''] || '—'}
                          </TableCell>
                          <TableCell>
                            {row.result === 'success' ? (
                              <Badge variant="secondary" className="text-xs">
                                {row.lead?.status}
                              </Badge>
                            ) : (
                              <span className="text-xs text-destructive">{row.error}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Import {validCount} Lead{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium text-lg mb-2">Importing leads...</p>
              <p className="text-sm text-muted-foreground">This may take a moment</p>
            </div>

            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {Math.round(importProgress)}% complete
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'results' && importResults && (
          <div className="space-y-4">
            {/* Compact Summary */}
            <div className="text-center py-4">
              <p className="text-lg text-muted-foreground">
                <span className="font-semibold text-success">{importResults.totalCreated} created</span>
                {importResults.totalUpdated > 0 && (
                  <>, <span className="font-semibold text-info">{importResults.totalUpdated} updated</span></>
                )}
                {importResults.totalFailed > 0 && (
                  <>, <span className="font-semibold text-destructive">{importResults.totalFailed} failed</span></>
                )}
                {importResults.totalSkipped > 0 && (
                  <>, <span className="font-semibold text-muted-foreground">{importResults.totalSkipped} skipped (no changes)</span></>
                )}
              </p>
            </div>

            {/* Created Leads List */}
            {importResults.totalCreated > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <button
                    onClick={() => setShowCreatedList(!showCreatedList)}
                    className="w-full flex items-center justify-between text-left hover:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="font-medium">
                        Created Leads ({importResults.totalCreated})
                      </span>
                    </div>
                    {showCreatedList ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showCreatedList && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResults.createdLeads.map((lead) => (
                            <TableRow key={lead.id}>
                              <TableCell className="font-medium">{lead.name}</TableCell>
                              <TableCell>{lead.email}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {lead.company || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {lead.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Updated Leads List */}
            {importResults.totalUpdated > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <button
                    onClick={() => setShowUpdatedList(!showUpdatedList)}
                    className="w-full flex items-center justify-between text-left hover:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-info" />
                      <span className="font-medium">
                        Updated Leads ({importResults.totalUpdated})
                      </span>
                    </div>
                    {showUpdatedList ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showUpdatedList && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResults.updatedLeads.map((lead) => (
                            <TableRow key={lead.id}>
                              <TableCell className="font-medium">{lead.name}</TableCell>
                              <TableCell>{lead.email}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {lead.company || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {lead.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Failed Leads List */}
            {importResults.totalFailed > 0 && (
              <Card className="border-warning bg-warning/5">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        onClick={() => setShowFailedList(!showFailedList)}
                        className="flex-1 flex items-center justify-between text-left hover:opacity-70 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                          <div>
                            <p className="font-medium text-warning">
                              Failed Leads ({importResults.totalFailed})
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {showFailedList ? 'Hide details' : 'Show details or download error report'}
                            </p>
                          </div>
                        </div>
                        {showFailedList ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadErrorReport}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Report
                      </Button>
                    </div>

                    {showFailedList && (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResults.failedLeads.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  {item.lead.name}
                                </TableCell>
                                <TableCell>{item.lead.email}</TableCell>
                                <TableCell className="text-destructive text-sm">
                                  {item.error}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
