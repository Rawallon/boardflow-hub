import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanList } from './KanbanList';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

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

interface KanbanBoardProps {
  lists: List[];
  cards: Card[];
  onCreateList: (title: string) => Promise<void>;
  onCreateCard: (listId: string, title: string) => Promise<void>;
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>;
  onMoveCard: (cardId: string, newListId: string, newPosition: number) => Promise<void>;
  onUpdateCardPositions: (cardUpdates: { id: string; list_id: string; position: number }[]) => Promise<void>;
  onOptimisticMoveCard: (cardId: string, newListId: string, newPosition: number) => { id: string; list_id: string; position: number }[] | undefined;
}

export function KanbanBoard({
  lists,
  cards,
  onCreateList,
  onCreateCard,
  onUpdateCard,
  onMoveCard,
  onUpdateCardPositions,
  onOptimisticMoveCard,
}: KanbanBoardProps) {
  // Component for managing kanban board with drag and drop functionality
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    if (active.data.current?.type === 'card') {
      const card = cards.find(c => c.id === active.id);
      setActiveCard(card || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('Drag end event:', { active: active.id, over: over?.id, overData: over?.data.current });
    setActiveCard(null);
    setOverId(null);

    if (!over) {
      console.log('No drop target');
      return;
    }

    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) {
      console.log('Active card not found');
      return;
    }

    const overList = over.data.current?.type === 'list' ? over.id as string : over.data.current?.listId;
    if (!overList) {
      console.log('No over list found');
      return;
    }

    console.log('Drag end details:', { activeCard: activeCard.id, overList, activeList: activeCard.list_id });

    // Handle moving card to a different list
    if (activeCard.list_id !== overList) {
      console.log('Moving between lists');
      const overCards = cards.filter(c => c.list_id === overList).sort((a, b) => a.position - b.position);
      let newPosition = overCards.length; // Default to end
      
      // If dropping on a specific card in the target list, calculate position
      if (over.data.current?.type === 'card') {
        const overCard = cards.find(c => c.id === over.id);
        if (overCard) {
          const targetIndex = overCards.findIndex(c => c.id === overCard.id);
          newPosition = targetIndex;
          console.log('Dropping on card, position:', newPosition);
        }
      } else {
        console.log('Dropping on list, position:', newPosition);
      }
      
      console.log('Performing optimistic update immediately');
      // Perform optimistic update immediately for instant UI feedback
      onOptimisticMoveCard(activeCard.id, overList, newPosition);
      
      console.log('Calling onMoveCard with:', { cardId: activeCard.id, newListId: overList, newPosition });
      // Then update the database
      onMoveCard(activeCard.id, overList, newPosition);
    } else {
      // Handle reordering within the same list
      const listCards = cards.filter(c => c.list_id === activeCard.list_id).sort((a, b) => a.position - b.position);
      const oldIndex = listCards.findIndex(c => c.id === activeCard.id);
      
      let newIndex: number;
      
      if (over.data.current?.type === 'list') {
        // Dropped on the list itself (at the end)
        newIndex = listCards.length - 1;
      } else {
        // Dropped on a card
        const overCard = cards.find(c => c.id === over.id);
        if (!overCard) return;
        
        newIndex = listCards.findIndex(c => c.id === overCard.id);
        
        // If dragging down, we need to adjust the index
        if (oldIndex < newIndex) {
          newIndex -= 1;
        }
      }
      
        if (oldIndex !== newIndex && newIndex >= 0) {
          console.log('Performing optimistic update for same-list reorder');
          // Perform optimistic update immediately for instant UI feedback
          onOptimisticMoveCard(activeCard.id, activeCard.list_id, newIndex);
          
          // Then update the database
          const reorderedCards = arrayMove(listCards, oldIndex, newIndex);
          
          // Prepare batch updates for all affected cards
          const cardUpdates = reorderedCards
            .map((card, index) => ({ id: card.id, list_id: card.list_id, position: index }))
            .filter(update => {
              const originalCard = cards.find(c => c.id === update.id);
              return originalCard && (originalCard.position !== update.position || originalCard.list_id !== update.list_id);
            });
          
          if (cardUpdates.length > 0) {
            onUpdateCardPositions(cardUpdates);
          }
        }
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    await onCreateList(newListTitle.trim());
    setNewListTitle('');
    setShowAddList(false);
  };

  const getCardsByListId = (listId: string) => {
    return cards
      .filter(card => card.list_id === listId)
      .sort((a, b) => a.position - b.position);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="p-6">
        <div className="flex space-x-6 overflow-x-auto pb-6">
          <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <KanbanList
                key={list.id}
                list={list}
                cards={getCardsByListId(list.id)}
                onCreateCard={onCreateCard}
                onUpdateCard={onUpdateCard}
              />
            ))}
          </SortableContext>

          <div className="flex-shrink-0 w-80">
            {showAddList ? (
              <form onSubmit={handleCreateList} className="bg-card rounded-lg p-4 border">
                <Input
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="Enter list title..."
                  className="mb-3"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <Button type="submit" size="sm">
                    Add List
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddList(false);
                      setNewListTitle('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="ghost"
                className="w-full h-12 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50"
                onClick={() => setShowAddList(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add another list
              </Button>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="transform rotate-3 scale-105 shadow-2xl">
            <KanbanCard card={activeCard} onUpdateCard={onUpdateCard} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}