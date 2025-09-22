import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, LogOut, Mail, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreateBoardDialog } from '@/components/CreateBoardDialog';

interface Board {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface BoardInvitation {
  id: string;
  board_id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myBoards, setMyBoards] = useState<Board[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
  const [invitations, setInvitations] = useState<BoardInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    console.log('🔍 Dashboard useEffect - user:', user);
    console.log('🔍 Dashboard useEffect - user email:', user?.email);
    console.log('🔍 Dashboard useEffect - authLoading:', authLoading);
    
    if (!authLoading && user) {
      fetchBoards();
      fetchInvitations();
      setupRealtimeSubscriptions();
    }

    return () => {
      // Cleanup subscriptions when component unmounts
      supabase.removeAllChannels();
    };
  }, [user, authLoading]);

  const fetchBoards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch boards I own
      const { data: ownedBoards, error: ownedError } = await supabase
        .from('boards')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Fetch boards I'm a member of (but don't own)
      const { data: memberBoards, error: memberError } = await supabase
        .from('board_memberships')
        .select(`
          boards:board_id (
            id,
            title,
            description,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .neq('boards.owner_id', user.id);

      if (memberError) throw memberError;

      // Extract board data from memberships
      const sharedBoardsData = memberBoards
        ?.map(membership => membership.boards)
        .filter(Boolean) as Board[] || [];

      setMyBoards(ownedBoards || []);
      setSharedBoards(sharedBoardsData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch boards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!user?.email) {
      console.log('🔍 No user email available for fetching invitations');
      return;
    }
    
    console.log('🔍 Fetching invitations for email:', user.email);
    
    try {
      const { data, error } = await supabase
        .from('board_invitations')
        .select('*')
        .eq('email', user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('📊 Invitations fetch result:', { data, error });

      if (error) {
        console.error('❌ Error fetching invitations:', error);
        throw error;
      }
      
      console.log('✅ Successfully fetched invitations:', data);
      setInvitations(data || []);
    } catch (error: any) {
      console.error('❌ Failed to fetch invitations:', error);
      // Only show error toast if user is authenticated
      if (user) {
        toast({
          title: 'Error',
          description: `Failed to fetch invitations: ${error.message}`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleAcceptInvitation = async (invitation: BoardInvitation) => {
    try {
      const { data, error } = await (supabase as any).rpc('accept_board_invitation', {
        p_token: invitation.token
      });

      if (error) throw error;

      if (data) {
        toast({
          title: 'Success',
          description: 'Invitation accepted! You now have access to the board.',
        });
        fetchInvitations();
        fetchBoards(); // Refresh boards to show the new one
      } else {
        toast({
          title: 'Error',
          description: 'Failed to accept invitation. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'destructive',
      });
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('board_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitation declined',
        description: 'You have declined this invitation.',
      });
      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline invitation',
        variant: 'destructive',
      });
    }
  };

  const setupRealtimeSubscriptions = () => {
    console.log('Setting up real-time subscriptions for dashboard');

    // Subscribe to board changes
    const boardsChannel = supabase
      .channel('dashboard-boards')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boards',
        },
        (payload) => {
          console.log('🔵 Dashboard: Board change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newBoard = payload.new as Board;
            // Check if this is a board I own
            if (newBoard.owner_id === user?.id) {
              setMyBoards(prev => {
                const exists = prev.some(board => board.id === newBoard.id);
                if (exists) return prev;
                return [newBoard, ...prev].sort((a, b) => 
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                );
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBoard = payload.new as Board;
            // Update in my boards if I own it
            if (updatedBoard.owner_id === user?.id) {
              setMyBoards(prev => 
                prev.map(board => 
                  board.id === updatedBoard.id ? updatedBoard : board
                ).sort((a, b) => 
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )
              );
            } else {
              // Update in shared boards if I'm a member
              setSharedBoards(prev => 
                prev.map(board => 
                  board.id === updatedBoard.id ? updatedBoard : board
                ).sort((a, b) => 
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedBoard = payload.old as Board;
            setMyBoards(prev => prev.filter(board => board.id !== deletedBoard.id));
            setSharedBoards(prev => prev.filter(board => board.id !== deletedBoard.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Dashboard boards channel status:', status);
      });

    // Subscribe to board membership changes
    const membershipsChannel = supabase
      .channel('dashboard-memberships')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_memberships',
        },
        (payload) => {
          console.log('🔵 Dashboard: Membership change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMembership = payload.new as any;
            if (newMembership.user_id === user?.id) {
              // Refresh shared boards when I'm added to a new board
              fetchBoards();
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedMembership = payload.old as any;
            if (deletedMembership.user_id === user?.id) {
              // Remove from shared boards when I'm removed
              setSharedBoards(prev => prev.filter(board => board.id !== deletedMembership.board_id));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Dashboard memberships channel status:', status);
      });

    return () => {
      console.log('Cleaning up dashboard real-time subscriptions');
      boardsChannel.unsubscribe();
      membershipsChannel.unsubscribe();
    };
  };

  const handleCreateBoard = async (title: string, description: string) => {
    try {
      const { data, error } = await supabase
        .from('boards')
        .insert([{ title, description, owner_id: user?.id }])
        .select()
        .single();

      if (error) throw error;

      setMyBoards([data, ...myBoards]);
      setCreateDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Board created successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been signed out successfully.',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading boards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold">Kanban Boards</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut} size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5" />
              <h2 className="text-2xl font-bold tracking-tight">Pending Invitations</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((invitation) => (
                <Card key={invitation.id} className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                  <CardHeader>
                    <CardTitle className="text-lg">Board Invitation</CardTitle>
                    <CardDescription className="line-clamp-2">
                      You've been invited to collaborate on a board
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">
                        {invitation.role === 'editor' ? 'Editor' : 'Viewer'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Invited {new Date(invitation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvitation(invitation)}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvitation(invitation.id)}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Boards Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">My Boards</h2>
              <p className="text-muted-foreground">
                Boards you own and manage
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Board
            </Button>
          </div>

          {myBoards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {myBoards.map((board) => (
            <Link key={board.id} to={`/board/${board.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{board.title}</CardTitle>
                  {board.description && (
                    <CardDescription className="line-clamp-3">
                      {board.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(board.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">You haven't created any boards yet.</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Board
              </Button>
            </div>
          )}
        </div>

        {/* Shared Boards Section */}
        {sharedBoards.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-3xl font-bold tracking-tight">Shared with Me</h2>
              <Badge variant="secondary">{sharedBoards.length}</Badge>
            </div>
            <p className="text-muted-foreground mb-6">
              Boards that others have shared with you
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sharedBoards.map((board) => (
                <Link key={board.id} to={`/board/${board.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{board.title}</CardTitle>
                      {board.description && (
                        <CardDescription className="line-clamp-3">
                          {board.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(board.updated_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <CreateBoardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateBoard={handleCreateBoard}
      />
    </div>
  );
}