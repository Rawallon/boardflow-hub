import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { KanbanBoard } from '@/components/KanbanBoard';
import { arrayMove } from '@dnd-kit/sortable';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
  const [showBoardEdit, setShowBoardEdit] = useState(false);
  const [editBoardTitle, setEditBoardTitle] = useState('');
  const [editBoardDescription, setEditBoardDescription] = useState('');
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false);
  const [inlineBoardTitle, setInlineBoardTitle] = useState('');

  useEffect(() => {
    if (boardId) {
      fetchBoardData();
      setupRealtimeSubscriptions();
    }

    return () => {
      // Cleanup subscriptions when component unmounts
      supabase.removeAllChannels();
    };
  }, [boardId]);

  // Test real-time connection and authentication (simplified)
  useEffect(() => {
    // Check authentication status
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      console.log('🔐 Current user:', user?.id, user?.email);
      if (error) {
        console.error('❌ Auth error:', error);
      }
    });

    // Simple test channel to verify real-time is working
    const testChannel = supabase
      .channel('test-connection')
      .on('broadcast', { event: 'test' }, (payload) => {
        console.log('✅ Real-time connection working!', payload);
      })
      .subscribe((status) => {
        console.log('Test channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time is connected and working!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Real-time connection timed out');
        } else if (status === 'CLOSED') {
          console.error('❌ Real-time connection closed');
        }
      });

    return () => {
      testChannel.unsubscribe();
    };
  }, []);

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

  const setupRealtimeSubscriptions = () => {
    if (!boardId) return;

    console.log('Setting up real-time subscriptions for board:', boardId);

    // Subscribe to board changes
    const boardChannel = supabase
      .channel(`board-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${boardId}`,
        },
        (payload) => {
          console.log('🔵 Board change received:', payload);
          if (payload.eventType === 'UPDATE') {
            setBoard(payload.new as Board);
          } else if (payload.eventType === 'DELETE') {
            // Board was deleted, redirect to dashboard
            window.location.href = '/';
          }
        }
      )
      .subscribe((status) => {
        console.log('Board channel status:', status);
      });

    // Subscribe to list changes for this board
    const listsChannel = supabase
      .channel(`lists-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          console.log('🟢 List change received:', payload);
          if (payload.eventType === 'INSERT') {
            const newList = payload.new as List;
            setLists(prev => {
              // Check if list already exists to prevent duplicates
              const exists = prev.some(list => list.id === newList.id);
              if (exists) {
                console.log('List already exists, skipping duplicate');
                return prev;
              }
              return [...prev, newList].sort((a, b) => a.position - b.position);
            });
          } else if (payload.eventType === 'UPDATE') {
            setLists(prev => prev.map(list => 
              list.id === payload.new.id ? payload.new as List : list
            ).sort((a, b) => a.position - b.position));
          } else if (payload.eventType === 'DELETE') {
            setLists(prev => prev.filter(list => list.id !== payload.old.id));
            setCards(prev => prev.filter(card => card.list_id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Lists channel status:', status);
      });

    // Subscribe to card changes for lists in this board
    const cardsChannel = supabase
      .channel(`cards-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
        },
        async (payload) => {
          console.log('🟡 Card change received:', payload);
          console.log('Event type:', payload.eventType);
          console.log('New data:', payload.new);
          console.log('Old data:', payload.old);
          
          // Check if this card belongs to a list in this board by querying the database
          const newCard = payload.new as Card | null;
          const oldCard = payload.old as Card | null;
          
          let isRelevantCard = false;
          
          if (newCard?.list_id) {
            // Check if the list belongs to this board
            const { data: listData } = await supabase
              .from('lists')
              .select('board_id')
              .eq('id', newCard.list_id)
              .single();
            isRelevantCard = listData?.board_id === boardId;
            console.log('List data for new card:', listData);
          } else if (oldCard?.list_id) {
            // For delete operations, check the old card's list
            const { data: listData } = await supabase
              .from('lists')
              .select('board_id')
              .eq('id', oldCard.list_id)
              .single();
            isRelevantCard = listData?.board_id === boardId;
            console.log('List data for old card:', listData);
          }
          
          console.log('Is relevant card:', isRelevantCard, 'Board ID:', boardId);
          
          if (!isRelevantCard) {
            console.log('Card not relevant to this board, ignoring');
            return;
          }

          if (payload.eventType === 'INSERT' && newCard) {
            console.log('Adding new card:', newCard);
            setCards(prev => {
              // Check if card already exists to prevent duplicates
              const exists = prev.some(card => card.id === newCard.id);
              if (exists) {
                console.log('Card already exists, skipping duplicate');
                return prev;
              }
              return [...prev, newCard].sort((a, b) => a.position - b.position);
            });
          } else if (payload.eventType === 'UPDATE' && newCard) {
            console.log('Updating card:', newCard);
            setCards(prev => prev.map(card => 
              card.id === newCard.id ? newCard : card
            ).sort((a, b) => a.position - b.position));
          } else if (payload.eventType === 'DELETE' && oldCard) {
            console.log('Deleting card:', oldCard);
            setCards(prev => prev.filter(card => card.id !== oldCard.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Cards channel status:', status);
      });

    return () => {
      console.log('Cleaning up real-time subscriptions');
      boardChannel.unsubscribe();
      listsChannel.unsubscribe();
      cardsChannel.unsubscribe();
    };
  };

  const updateBoard = async (updates: Partial<Board>) => {
    if (!boardId) return;

    try {
      const { data, error } = await supabase
        .from('boards')
        .update(updates)
        .eq('id', boardId)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately (real-time will also update when working)
      setBoard(data);
      
      toast({
        title: 'Success',
        description: 'Board updated successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteBoard = async () => {
    if (!boardId) return;

    if (confirm(`Are you sure you want to delete "${board?.title}"? This will delete all lists and cards in this board.`)) {
      try {
        // First delete all cards
        const { error: cardsError } = await supabase
          .from('cards')
          .delete()
          .in('list_id', lists.map(list => list.id));

        if (cardsError) throw cardsError;

        // Then delete all lists
        const { error: listsError } = await supabase
          .from('lists')
          .delete()
          .eq('board_id', boardId);

        if (listsError) throw listsError;

        // Finally delete the board
        const { error: boardError } = await supabase
          .from('boards')
          .delete()
          .eq('id', boardId);

        if (boardError) throw boardError;

        toast({
          title: 'Success',
          description: 'Board deleted successfully!',
        });

        // Redirect to dashboard
        window.location.href = '/';
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleEditBoard = () => {
    if (board) {
      setEditBoardTitle(board.title);
      setEditBoardDescription(board.description || '');
      setShowBoardEdit(true);
    }
  };

  const handleSaveBoard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!editBoardTitle.trim()) {
      setEditBoardTitle(board?.title || '');
      setShowBoardEdit(false);
      return;
    }

    await updateBoard({
      title: editBoardTitle.trim(),
      description: editBoardDescription.trim() || null,
    });
    setShowBoardEdit(false);
  };

  const handleBoardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveBoard();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleSaveBoard();
    }
  };

  const handleInlineBoardTitleEdit = () => {
    if (board) {
      setInlineBoardTitle(board.title);
      setIsEditingBoardTitle(true);
    }
  };

  const handleSaveInlineBoardTitle = async () => {
    if (!inlineBoardTitle.trim()) {
      setInlineBoardTitle(board?.title || '');
      setIsEditingBoardTitle(false);
      return;
    }

    if (inlineBoardTitle.trim() !== board?.title) {
      await updateBoard({ title: inlineBoardTitle.trim() });
    }
    setIsEditingBoardTitle(false);
  };

  const handleInlineBoardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      handleSaveInlineBoardTitle();
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

      // Update local state immediately (real-time will also update when working)
      setLists(prev => [...prev, data].sort((a, b) => a.position - b.position));
      
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

  const updateList = async (listId: string, updates: Partial<List>) => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .update(updates)
        .eq('id', listId)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately (real-time will also update when working)
      setLists(prev => prev.map(list => 
        list.id === listId ? data : list
      ).sort((a, b) => a.position - b.position));
      
      toast({
        title: 'Success',
        description: 'List updated successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteList = async (listId: string) => {
    try {
      // First delete all cards in the list
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .eq('list_id', listId);

      if (cardsError) throw cardsError;

      // Then delete the list
      const { error: listError } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId);

      if (listError) throw listError;

      // Update local state immediately (real-time will also update when working)
      setLists(prev => prev.filter(list => list.id !== listId));
      setCards(prev => prev.filter(card => card.list_id !== listId));
      
      toast({
        title: 'Success',
        description: 'List deleted successfully!',
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

      // Update local state immediately (real-time will also update when working)
      setCards(prev => [...prev, data].sort((a, b) => a.position - b.position));
      
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

      // Update local state immediately (real-time will also update when working)
      setCards(prev => prev.map(card => 
        card.id === cardId ? data : card
      ).sort((a, b) => a.position - b.position));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;

      // Update local state immediately (real-time will also update when working)
      setCards(prev => prev.filter(card => card.id !== cardId));
      
      toast({
        title: 'Success',
        description: 'Card deleted successfully!',
      });
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

      console.log('Database updates successful - real-time subscriptions will handle state updates');
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
            <div className="flex-1">
              {isEditingBoardTitle ? (
                <Input
                  value={inlineBoardTitle}
                  onChange={(e) => setInlineBoardTitle(e.target.value)}
                  onKeyDown={handleInlineBoardKeyDown}
                  onBlur={handleSaveInlineBoardTitle}
                  className="text-xl font-bold h-8 bg-transparent border-none p-0 focus:ring-0 focus:border-b-2 focus:border-primary"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-xl font-bold cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                  onClick={handleInlineBoardTitleEdit}
                >
                  {board.title}
                </h1>
              )}
              {board.description && (
                <p className="text-sm text-muted-foreground">{board.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEditBoard}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Board
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={deleteBoard} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          onDeleteCard={deleteCard}
          onUpdateList={updateList}
          onDeleteList={deleteList}
          onUpdateBoard={updateBoard}
          onDeleteBoard={deleteBoard}
          onMoveCard={moveCard}
          onUpdateCardPositions={updateCardPositions}
          onOptimisticMoveCard={optimisticMoveCard}
        />
      </main>

      {/* Board Edit Dialog */}
      <Dialog open={showBoardEdit} onOpenChange={setShowBoardEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Board</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBoard} onKeyDown={handleBoardKeyDown} className="space-y-4">
            <div>
              <label htmlFor="board-title" className="block text-sm font-medium mb-2">
                Board Title
              </label>
              <Input
                id="board-title"
                value={editBoardTitle}
                onChange={(e) => setEditBoardTitle(e.target.value)}
                onBlur={() => {
                  // Only save on blur if the dialog is still open
                  if (showBoardEdit) {
                    handleSaveBoard();
                  }
                }}
                placeholder="Enter board title..."
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="board-description" className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <Textarea
                id="board-description"
                value={editBoardDescription}
                onChange={(e) => setEditBoardDescription(e.target.value)}
                placeholder="Enter board description..."
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveBoard}
              >
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}