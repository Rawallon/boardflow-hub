import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { useDndMonitor } from '@dnd-kit/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
}

export function KanbanList({ list, cards, onCreateCard, onUpdateCard, onDeleteCard, onUpdateList, onDeleteList }: KanbanListProps) {
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isOver, setIsOver] = useState(false);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(list.title);

  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: list.id,
    data: {
      type: 'list',
      listId: list.id,
    },
  });

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

  return (
    <div className="flex-shrink-0 w-80">
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
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
    </div>
  );
}