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
export async function createNote(input: CreateNoteInput): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      ...input,
      is_pinned: input.is_pinned || false,
      created_by: user.id
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
 * Toggle note pinned status
 */
export async function toggleNotePin(noteId: string, isPinned: boolean): Promise<Note> {
  return updateNote(noteId, { is_pinned: isPinned })
}
