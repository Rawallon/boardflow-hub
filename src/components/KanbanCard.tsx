import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { CardDetailModal } from './CardDetailModal';
import { FileText } from 'lucide-react';

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
  onDeleteCard: (cardId: string) => Promise<void>;
  isDragging?: boolean;
  isDragOver?: boolean;
  readOnly?: boolean;
}

export function KanbanCard({ card, onUpdateCard, onDeleteCard, isDragging = false, isDragOver = false, readOnly = false }: KanbanCardProps) {
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
    disabled: readOnly,
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
          <div className="flex items-start justify-between gap-2 min-w-0">
            <h4 className="font-medium text-sm leading-tight flex-1 break-all hyphens-auto overflow-hidden">{card.title}</h4>
            {card.description && card.description.trim() && (
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
          </div>
        </CardContent>
      </Card>

      <CardDetailModal
        card={card}
        open={showModal}
        onOpenChange={setShowModal}
        onUpdateCard={onUpdateCard}
        onDeleteCard={onDeleteCard}
        readOnly={readOnly}
      />
    </>
  );
}