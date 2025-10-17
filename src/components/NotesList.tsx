import { useState } from "react"
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useTogglePinNote } from "@/hooks/useNotes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  StickyNote,
  Pin,
  Trash2,
  Loader2,
  Plus,
  Edit2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Note } from "@/types/crm"

interface NotesListProps {
  leadId: string
}

export function NotesList({ leadId }: NotesListProps) {
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")

  const { data: notes = [], isLoading } = useNotes(leadId)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const togglePin = useTogglePinNote()

  const handleAddNote = async () => {
    if (!noteContent.trim()) return

    try {
      await createNote.mutateAsync({
        lead_id: leadId,
        content: noteContent.trim(),
      })

      setNoteContent("")
      setShowAddNote(false)
    } catch (error) {
      console.error("Failed to create note:", error)
    }
  }

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim()) return

    try {
      await updateNote.mutateAsync({
        noteId,
        input: { content: editingContent.trim() },
      })

      setEditingNoteId(null)
      setEditingContent("")
    } catch (error) {
      console.error("Failed to update note:", error)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      await deleteNote.mutateAsync({ noteId, leadId })
    } catch (error) {
      console.error("Failed to delete note:", error)
    }
  }

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      await togglePin.mutateAsync({ noteId, isPinned: !isPinned })
    } catch (error) {
      console.error("Failed to toggle pin:", error)
    }
  }

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id)
    setEditingContent(note.content)
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditingContent("")
  }

  const pinnedNotes = notes.filter(n => n.is_pinned)
  const unpinnedNotes = notes.filter(n => !n.is_pinned)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Notes</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddNote(!showAddNote)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </CardHeader>
      <CardContent>
        {/* Add Note Form */}
        {showAddNote && (
          <div className="mb-6 p-4 border border-border/40 rounded-lg space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Note</label>
              <Textarea
                placeholder="Write your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddNote(false)
                  setNoteContent("")
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteContent.trim() || createNote.isPending}
              >
                {createNote.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Note"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="text-center py-12">
            <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notes yet</p>
            <p className="text-sm text-muted-foreground">
              Add internal notes and observations about this lead
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Pin className="h-4 w-4" />
                  Pinned ({pinnedNotes.length})
                </h3>
                <div className="space-y-3">
                  {pinnedNotes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      isEditing={editingNoteId === note.id}
                      editingContent={editingContent}
                      onStartEdit={startEditing}
                      onCancelEdit={cancelEditing}
                      onSaveEdit={handleUpdateNote}
                      onSetEditingContent={setEditingContent}
                      onTogglePin={handleTogglePin}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Notes */}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && <Separator className="mb-4" />}
                <div className="space-y-3">
                  {unpinnedNotes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      isEditing={editingNoteId === note.id}
                      editingContent={editingContent}
                      onStartEdit={startEditing}
                      onCancelEdit={cancelEditing}
                      onSaveEdit={handleUpdateNote}
                      onSetEditingContent={setEditingContent}
                      onTogglePin={handleTogglePin}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface NoteItemProps {
  note: Note
  isEditing: boolean
  editingContent: string
  onStartEdit: (note: Note) => void
  onCancelEdit: () => void
  onSaveEdit: (noteId: string) => void
  onSetEditingContent: (content: string) => void
  onTogglePin: (noteId: string, isPinned: boolean) => void
  onDelete: (noteId: string) => void
}

function NoteItem({
  note,
  isEditing,
  editingContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSetEditingContent,
  onTogglePin,
  onDelete,
}: NoteItemProps) {
  return (
    <div className={`p-4 border rounded-lg ${note.is_pinned ? "border-primary/50 bg-primary/5" : "border-border/30"}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {note.creator && (
              <span>{note.creator.full_name || note.creator.email}</span>
            )}
            <span>•</span>
            <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onTogglePin(note.id, note.is_pinned)}
          >
            <Pin className={`h-3.5 w-3.5 ${note.is_pinned ? "fill-current" : ""}`} />
          </Button>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onStartEdit(note)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDelete(note.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editingContent}
            onChange={(e) => onSetEditingContent(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSaveEdit(note.id)}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
      )}
    </div>
  )
}
