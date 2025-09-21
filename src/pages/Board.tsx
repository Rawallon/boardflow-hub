import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { KanbanBoard } from '@/components/KanbanBoard';
import { arrayMove } from '@dnd-kit/sortable';

interface Board {
  id: string;
  title: string;
  description: string | null;
}

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

export default function Board() {
  const { boardId } = useParams<{ boardId: string }>();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (boardId) {
      fetchBoardData();
    }
  }, [boardId]);

  const fetchBoardData = async () => {
    if (!boardId) return;

    try {
      // Fetch board
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (boardError) throw boardError;
      setBoard(boardData);

      // Fetch lists
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('board_id', boardId)
        .order('position');

      if (listsError) throw listsError;
      setLists(listsData || []);

      // Fetch cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .in('list_id', (listsData || []).map(list => list.id))
        .order('position');

      if (cardsError) throw cardsError;
      setCards(cardsData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch board data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createList = async (title: string) => {
    if (!boardId) return;

    try {
      const position = Math.max(...lists.map(l => l.position), -1) + 1;
      
      const { data, error } = await supabase
        .from('lists')
        .insert([{ title, board_id: boardId, position }])
        .select()
        .single();

      if (error) throw error;

      setLists([...lists, data]);
      toast({
        title: 'Success',
        description: 'List created successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createCard = async (listId: string, title: string) => {
    try {
      const listCards = cards.filter(card => card.list_id === listId);
      const position = Math.max(...listCards.map(c => c.position), -1) + 1;
      
      const { data, error } = await supabase
        .from('cards')
        .insert([{ title, list_id: listId, position }])
        .select()
        .single();

      if (error) throw error;

      setCards([...cards, data]);
      toast({
        title: 'Success',
        description: 'Card created successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateCard = async (cardId: string, updates: Partial<Card>) => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;

      setCards(cards.map(card => card.id === cardId ? data : card));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const moveCard = async (cardId: string, newListId: string, newPosition: number) => {
    try {
      console.log('Moving card:', { cardId, newListId, newPosition });
      
      // Perform optimistic update first
      const cardUpdates = optimisticMoveCard(cardId, newListId, newPosition);
      
      if (!cardUpdates || cardUpdates.length === 0) {
        console.log('No updates needed');
        return;
      }

      // Then update the database
      await updateCardPositions(cardUpdates);
    } catch (error: any) {
      console.error('Error in moveCard, reverting optimistic update:', error);
      
      // Revert the optimistic update on error
      fetchBoardData();
      
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const optimisticMoveCard = (cardId: string, newListId: string, newPosition: number) => {
    console.log('Performing optimistic move:', { cardId, newListId, newPosition });
    const cardToMove = cards.find(c => c.id === cardId);
    if (!cardToMove) return;

    const cardUpdates = [];
    
    // Handle moving between different lists
    if (cardToMove.list_id !== newListId) {
      // Get all cards in the source list (excluding the moved card)
      const sourceListCards = cards
        .filter(c => c.list_id === cardToMove.list_id && c.id !== cardId)
        .sort((a, b) => a.position - b.position);

      // Get all cards in the target list
      const targetListCards = cards
        .filter(c => c.list_id === newListId)
        .sort((a, b) => a.position - b.position);

      // Add the moved card at the new position
      cardUpdates.push({ id: cardId, list_id: newListId, position: newPosition });
      
      // Update positions for existing cards in the target list
      targetListCards.forEach((card, index) => {
        let adjustedPosition = index;
        if (index >= newPosition) {
          adjustedPosition = index + 1;
        }
        cardUpdates.push({ id: card.id, list_id: card.list_id, position: adjustedPosition });
      });

      // Update positions for remaining cards in the source list
      sourceListCards.forEach((card, index) => {
        cardUpdates.push({ id: card.id, list_id: card.list_id, position: index });
      });
    } else {
      // Handle reordering within the same list
      const listCards = cards
        .filter(c => c.list_id === cardToMove.list_id)
        .sort((a, b) => a.position - b.position);
      
      const oldIndex = listCards.findIndex(c => c.id === cardId);
      const reorderedCards = arrayMove(listCards, oldIndex, newPosition);
      
      reorderedCards.forEach((card, index) => {
        if (card.position !== index) {
          cardUpdates.push({ id: card.id, list_id: card.list_id, position: index });
        }
      });
    }

    // Update local state immediately
    setCards(prevCards => {
      const updatedCards = prevCards.map(card => {
        const update = cardUpdates.find(u => u.id === card.id);
        return update ? { ...card, list_id: update.list_id, position: update.position } : card;
      });
      return updatedCards;
    });

    return cardUpdates;
  };

  const updateCardPositions = async (cardUpdates: { id: string; list_id: string; position: number }[]) => {
    try {
      console.log('Updating card positions in database:', cardUpdates);
      
      // Update all cards in a single transaction
      const updates = cardUpdates.map(update => 
        supabase
          .from('cards')
          .update({ list_id: update.list_id, position: update.position })
          .eq('id', update.id)
      );

      const results = await Promise.all(updates);
      
      // Check for any errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Database update errors:', errors);
        throw errors[0].error;
      }

      console.log('Database updates successful - no local state update needed (optimistic update already done)');
    } catch (error: any) {
      console.error('Error updating card positions:', error);
      throw error; // Re-throw to let the caller handle it
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading board...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Board not found</h2>
          <p className="text-muted-foreground mb-4">
            The board you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{board.title}</h1>
              {board.description && (
                <p className="text-sm text-muted-foreground">{board.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto">
        <KanbanBoard
          lists={lists}
          cards={cards}
          onCreateList={createList}
          onCreateCard={createCard}
          onUpdateCard={updateCard}
          onMoveCard={moveCard}
          onUpdateCardPositions={updateCardPositions}
          onOptimisticMoveCard={optimisticMoveCard}
        />
      </main>
    </div>
  );
}