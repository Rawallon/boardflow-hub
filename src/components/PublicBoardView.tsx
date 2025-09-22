import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Lock, ExternalLink, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Board {
  id: string;
  title: string;
  description: string | null;
  background_color: string | null;
  background_image_url: string | null;
  background_image_scale: string | null;
}

interface List {
  id: string;
  title: string;
  position: number;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  list_id: string;
}

export function PublicBoardView() {
  const { boardId, token } = useParams<{ boardId: string; token: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (boardId && token) {
      fetchBoardData();
    }
  }, [boardId, token]);

  const fetchBoardData = async () => {
    try {
      // First, verify the share token is valid
      const { data: tokenData, error: tokenError } = await supabase
        .from('board_share_tokens')
        .select('*')
        .eq('board_id', boardId)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Invalid or expired share link');
      }

      // Check if token has expired
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error('This share link has expired');
      }

      // Fetch board data
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
      setError(error.message || 'Failed to load board');
      toast({
        title: 'Error',
        description: error.message || 'Failed to load board',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    window.location.href = '/auth';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              {error || 'This board is not available for public viewing.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/'} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">{board.title}</h1>
                {board.description && (
                  <p className="text-muted-foreground">{board.description}</p>
                )}
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Public View
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!user && (
                <Button onClick={handleSignIn} variant="outline">
                  Sign In to Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="container mx-auto px-4 py-2">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You're viewing this board in read-only mode. 
            {!user ? ' Sign in to edit or collaborate on this board.' : ' You can edit this board from your dashboard.'}
          </AlertDescription>
        </Alert>
      </div>

      {/* Board content */}
      <div className="container mx-auto px-4 py-6">
        <KanbanBoard
          board={board}
          lists={lists}
          cards={cards}
          readOnly={true}
          onUpdateBoard={() => {}} // No-op for read-only
          onUpdateList={() => {}} // No-op for read-only
          onUpdateCard={() => {}} // No-op for read-only
          onDeleteList={() => {}} // No-op for read-only
          onDeleteCard={() => {}} // No-op for read-only
          onCreateList={() => {}} // No-op for read-only
          onCreateCard={() => {}} // No-op for read-only
        />
      </div>
    </div>
  );
}
