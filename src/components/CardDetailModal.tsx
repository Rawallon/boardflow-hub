import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit3, Eye, Save, X, Trash2, EyeOff } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  list_id: string;
}

interface CardDetailModalProps {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

export function CardDetailModal({ card, open, onOpenChange, onUpdateCard, onDeleteCard }: CardDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const mdEditorRef = useRef<any>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
  }, [card]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Focus the MDEditor when entering edit mode
  useEffect(() => {
    if (isEditingDescription && mdEditorRef.current) {
      // Small delay to ensure the editor is rendered
      setTimeout(() => {
        const textarea = mdEditorRef.current?.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }, 100);
    }
  }, [isEditingDescription]);

  const handleSaveTitle = async () => {
    if (!title.trim()) {
      setTitle(card.title); // Reset to original if empty
      setEditingTitle(false);
      return;
    }

    if (title.trim() !== card.title) {
      setSaving(true);
      await onUpdateCard(card.id, { title: title.trim() });
      setSaving(false);
    }
    setEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (description !== card.description) {
      setSaving(true);
      await onUpdateCard(card.id, { description: description || null });
      setSaving(false);
      setHasUnsavedChanges(false);
    }
  };

  const handleDescriptionChange = (value: string | undefined) => {
    const newDescription = value || '';
    setDescription(newDescription);
    setHasUnsavedChanges(newDescription !== card.description);
  };

  const handleDescriptionFocus = () => {
    // Cancel any pending blur timeout when user focuses back on editor
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const handleDescriptionBlur = (e: React.FocusEvent) => {
    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    // Check if the focus is moving to another element within the editor
    const relatedTarget = e.relatedTarget as HTMLElement;
    const editorContainer = mdEditorRef.current;
    
    // If focus is moving to a toolbar button or another element within the editor, don't save/exit
    if (relatedTarget && editorContainer && editorContainer.contains(relatedTarget)) {
      return;
    }
    
    // Use a timeout to allow for toolbar button clicks
    blurTimeoutRef.current = setTimeout(() => {
      // Only save and exit if focus is truly leaving the editor
      if (hasUnsavedChanges) {
        handleSaveDescription();
      }
      setIsEditingDescription(false);
    }, 150); // Small delay to allow toolbar interactions
  };

  const handleDeleteCard = async () => {
    await onDeleteCard(card.id);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleSaveTitle();
    }
  };

  // Handle keyboard shortcuts for description editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      // Ctrl/Cmd + E to toggle edit mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setIsEditingDescription(!isEditingDescription);
      }
      
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSaveDescription();
        }
      }
      
      // Escape to exit edit mode and save
      if (e.key === 'Escape' && isEditingDescription) {
        e.preventDefault();
        // Create a synthetic blur event
        const syntheticEvent = {
          relatedTarget: null,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as React.FocusEvent;
        handleDescriptionBlur(syntheticEvent);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isEditingDescription, hasUnsavedChanges]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              {editingTitle ? (
                <div className="flex-1 flex items-start space-x-2 min-w-0">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveTitle}
                    className="text-lg font-semibold flex-1 break-all hyphens-auto overflow-hidden min-w-0"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveTitle}
                    disabled={saving}
                    className="flex-shrink-0 mt-1"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2
                  className="text-lg font-semibold cursor-pointer hover:bg-muted px-2 py-1 rounded flex-1 break-all hyphens-auto overflow-hidden min-w-0"
                  onClick={() => setEditingTitle(true)}
                >
                  {card.title}
                </h2>
              )}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-4"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">Description</h3>
                <span className="text-xs text-muted-foreground">
                  (Click to edit, Ctrl+E to toggle, Ctrl+S to save)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {hasUnsavedChanges && (
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    Unsaved changes
                  </span>
                )}
                {hasUnsavedChanges && (
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {isEditingDescription ? (
                <div className="h-full border rounded-md overflow-hidden" ref={mdEditorRef}>
                  <MDEditor
                    value={description}
                    onChange={handleDescriptionChange}
                    onBlur={(e) => handleDescriptionBlur(e as any)}
                    onFocus={handleDescriptionFocus}
                    data-color-mode="light"
                    height={400}
                    visibleDragbar={false}
                    textareaProps={{
                      placeholder: 'Enter card description using Markdown...',
                      style: {
                        fontSize: 14,
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                      },
                    }}
                    preview="edit"
                    hideToolbar={false}
                    toolbarHeight={40}
                  />
                </div>
              ) : (
                <div 
                  className="h-full overflow-auto border rounded-md p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setIsEditingDescription(true)}
                >
                  {description.trim() ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <MDEditor.Markdown 
                        source={description} 
                        style={{ 
                          backgroundColor: 'transparent',
                          color: 'inherit'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-muted-foreground italic mb-2">
                          Click to add a description...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Card Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{card.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDeleteCard();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}