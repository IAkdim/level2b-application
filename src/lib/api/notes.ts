import { supabase } from '../supabaseClient'
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/types/crm'

/**
 * Fetch notes for a specific lead
 */
export async function getNotes(leadId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .eq('lead_id', leadId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

/**
 * Create a new note
 */
export async function createNote(
  orgId: string,
  input: CreateNoteInput
): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('notes')
    .insert({
      org_id: orgId,
      ...input,
      is_pinned: input.is_pinned || false,
      created_by: user?.id
    })
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create note')

  return data
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: string,
  input: UpdateNoteInput
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update(input)
    .eq('id', noteId)
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Note not found')

  return data
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error
}

/**
 * Toggle pin status of a note
 */
export async function togglePinNote(noteId: string, isPinned: boolean): Promise<Note> {
  return updateNote(noteId, { is_pinned: isPinned })
}
