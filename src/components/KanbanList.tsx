import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Edit2, Trash2, MoreHorizontal, GripVertical, Copy } from 'lucide-react';
import { useDndMonitor } from '@dnd-kit/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface List {
  id: string;
  title: string;
  position: number;
  board_id: string;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  list_id: string;
}

interface KanbanListProps {
  list: List;
  cards: Card[];
  onCreateCard: (listId: string, title: string) => Promise<void>;
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onUpdateList: (listId: string, updates: Partial<List>) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onDuplicateList: (listId: string, newTitle: string) => Promise<void>;
}

export function KanbanList({ list, cards, onCreateCard, onUpdateCard, onDeleteCard, onUpdateList, onDeleteList, onDuplicateList }: KanbanListProps) {
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isOver, setIsOver] = useState(false);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(list.title);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState(`${list.title} (Copy)`);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: {
      type: 'list',
      listId: list.id,
    },
  });

  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: list.id,
    data: {
      type: 'list',
      listId: list.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Combine both refs
  const setRefs = (node: HTMLElement | null) => {
    setSortableNodeRef(node);
    setNodeRef(node);
  };

  // Monitor drag state for visual feedback
  useDndMonitor({
    onDragOver: (event) => {
      const { over } = event;
      setIsOver(over?.id === list.id);
      
      // Track which card is being hovered over
      if (over?.data.current?.type === 'card' && over.data.current?.listId === list.id) {
        setDragOverCardId(over.id as string);
      } else {
        setDragOverCardId(null);
      }
    },
    onDragEnd: () => {
      setIsOver(false);
      setDragOverCardId(null);
    },
  });

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    await onCreateCard(list.id, newCardTitle.trim());
    setNewCardTitle('');
    setShowAddCard(false);
  };

  const handleUpdateTitle = async () => {
    if (!editTitle.trim()) {
      setEditTitle(list.title); // Reset to original if empty
      setIsEditingTitle(false);
      return;
    }

    if (editTitle.trim() !== list.title) {
      await onUpdateList(list.id, { title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      handleUpdateTitle();
    }
  };

  const handleDeleteList = async () => {
    if (confirm(`Are you sure you want to delete "${list.title}"? This will also delete all cards in this list.`)) {
      await onDeleteList(list.id);
    }
  };

  const handleDuplicateList = () => {
    setDuplicateTitle(`${list.title} (Copy)`);
    setShowDuplicateModal(true);
  };

  const handleConfirmDuplicate = async () => {
    if (duplicateTitle.trim()) {
      await onDuplicateList(list.id, duplicateTitle.trim());
      setShowDuplicateModal(false);
    }
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateModal(false);
    setDuplicateTitle(`${list.title} (Copy)`);
  };

  return (
    <div 
      ref={setRefs}
      style={style}
      className={`flex-shrink-0 w-80 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mr-2 p-1 hover:bg-muted/50 rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            {isEditingTitle ? (
              <div className="flex-1 mr-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleUpdateTitle}
                  className="h-6 text-sm font-semibold"
                  autoFocus
                />
              </div>
            ) : (
              <h3 
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded flex-1"
                onClick={() => setIsEditingTitle(true)}
              >
                {list.title}
              </h3>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">{cards.length}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicateList}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteList} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          ref={setNodeRef}
          className={`space-y-3 min-h-[200px] transition-colors duration-200 ${
            isDroppableOver ? 'bg-blue-50 dark:bg-blue-950/20 rounded-lg' : ''
          }`}
        >
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((card, index) => (
              <div key={card.id} className="relative">
                {/* Drop indicator line above the card */}
                {dragOverCardId === card.id && (
                  <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 shadow-lg" />
                )}
                <KanbanCard
                  card={card}
                  onUpdateCard={onUpdateCard}
                  onDeleteCard={onDeleteCard}
                  isDragOver={dragOverCardId === card.id}
                />
              </div>
            ))}
            {/* Drop indicator at the end of the list */}
            {isDroppableOver && dragOverCardId === null && (
              <div className="h-0.5 bg-blue-500 rounded-full shadow-lg" />
            )}
          </SortableContext>
        </div>

        <div className="mt-4">
          {showAddCard ? (
            <form onSubmit={handleCreateCard} className="space-y-2">
              <Input
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Enter card title..."
                className="bg-background"
                autoFocus
              />
              <div className="flex space-x-2">
                <Button type="submit" size="sm">
                  Add Card
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddCard(false);
                    setNewCardTitle('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setShowAddCard(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add a card
            </Button>
          )}
        </div>
      </div>

      {/* Duplicate List Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="duplicate-title" className="block text-sm font-medium mb-2">
                New list name
              </label>
              <Input
                id="duplicate-title"
                value={duplicateTitle}
                onChange={(e) => setDuplicateTitle(e.target.value)}
                placeholder="Enter list name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmDuplicate();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelDuplicate();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelDuplicate}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDuplicate}
                disabled={!duplicateTitle.trim()}
              >
                Duplicate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}