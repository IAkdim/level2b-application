import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as notesApi from '@/lib/api/notes'
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/types/crm'

/**
 * Hook to fetch notes for a specific lead
 */
export function useNotes(leadId: string | undefined) {
  return useQuery({
    queryKey: ['notes', leadId],
    queryFn: () => {
      if (!leadId) throw new Error('Lead ID is required')
      return notesApi.getNotes(leadId)
    },
    enabled: !!leadId,
  })
}

/**
 * Hook to create a new note
 */
export function useCreateNote() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateNoteInput) => {
      if (!selectedOrg) throw new Error('No organization selected')
      return notesApi.createNote(selectedOrg.id, input)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.lead_id] })
    },
  })
}

/**
 * Hook to update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: UpdateNoteInput }) =>
      notesApi.updateNote(noteId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.lead_id] })
    },
  })
}

/**
 * Hook to delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, leadId }: { noteId: string; leadId: string }) =>
      notesApi.deleteNote(noteId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.leadId] })
    },
  })
}

/**
 * Hook to toggle pin status of a note
 */
export function useTogglePinNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) =>
      notesApi.togglePinNote(noteId, isPinned),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.lead_id] })
    },
  })
}
