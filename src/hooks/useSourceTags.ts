import { useState, KeyboardEvent } from 'react'

/**
 * Custom hook to manage source tags input
 */
export function useSourceTags(initialSources: string[] = []) {
  const [sources, setSources] = useState<string[]>(initialSources)
  const [sourceInput, setSourceInput] = useState("")

  const addSource = () => {
    const trimmed = sourceInput.trim()
    if (trimmed && !sources.includes(trimmed)) {
      setSources([...sources, trimmed])
      setSourceInput("")
    }
  }

  const removeSource = (source: string) => {
    setSources(sources.filter((s) => s !== source))
  }

  const handleSourceKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addSource()
    }
  }

  const resetSources = (newSources: string[] = []) => {
    setSources(newSources)
    setSourceInput("")
  }

  return {
    sources,
    sourceInput,
    setSourceInput,
    addSource,
    removeSource,
    handleSourceKeyDown,
    resetSources,
  }
}
