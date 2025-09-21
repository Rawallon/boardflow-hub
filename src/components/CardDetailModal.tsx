import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Eye, Save, X, Trash2 } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

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
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
  }, [card]);

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
    }
  };

  const handleDeleteCard = async () => {
    if (confirm(`Are you sure you want to delete "${card.title}"?`)) {
      await onDeleteCard(card.id);
      onOpenChange(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              {editingTitle ? (
                <div className="flex-1 flex items-center space-x-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveTitle}
                    className="text-lg font-semibold"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveTitle}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2
                  className="text-lg font-semibold cursor-pointer hover:bg-muted px-2 py-1 rounded flex-1"
                  onClick={() => setEditingTitle(true)}
                >
                  {card.title}
                </h2>
              )}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteCard}
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
              <h3 className="font-medium">Description</h3>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant={isMarkdownMode ? "default" : "outline"}
                  onClick={() => setIsMarkdownMode(true)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={!isMarkdownMode ? "default" : "outline"}
                  onClick={() => {
                    setIsMarkdownMode(false);
                    handleSaveDescription();
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {isMarkdownMode ? (
                <div className="h-full">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter card description using Markdown..."
                    className="min-h-[300px] resize-none font-mono"
                    onBlur={handleSaveDescription}
                  />
                </div>
              ) : (
                <div className="h-full overflow-auto border rounded-md p-4 bg-muted/30">
                  {description.trim() ? (
                    <MDEditor.Markdown 
                      source={description} 
                      style={{ 
                        backgroundColor: 'transparent',
                        color: 'inherit'
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">
                      No description yet. Click "Edit" to add one.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}