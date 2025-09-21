import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { CardDetailModal } from './CardDetailModal';

interface CardProps {
  id: string;
  title: string;
  description: string | null;
  position: number;
  list_id: string;
}

interface KanbanCardProps {
  card: CardProps;
  onUpdateCard: (cardId: string, updates: Partial<CardProps>) => Promise<void>;
  isDragging?: boolean;
  isDragOver?: boolean;
}

export function KanbanCard({ card, onUpdateCard, isDragging = false, isDragOver = false }: KanbanCardProps) {
  const [showModal, setShowModal] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
      listId: card.list_id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`cursor-pointer hover:shadow-md transition-all duration-200 ${
          isCurrentlyDragging ? 'opacity-50' : ''
        } ${
          isDragOver ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-lg scale-105' : ''
        }`}
        onClick={() => setShowModal(true)}
      >
        <CardContent className="p-3">
          <h4 className="font-medium text-sm leading-tight">{card.title}</h4>
          {card.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {card.description.replace(/[#*`]/g, '').substring(0, 100)}
              {card.description.length > 100 ? '...' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <CardDetailModal
        card={card}
        open={showModal}
        onOpenChange={setShowModal}
        onUpdateCard={onUpdateCard}
      />
    </>
  );
}