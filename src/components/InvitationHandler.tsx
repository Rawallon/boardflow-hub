import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface InvitationData {
  id: string;
  board_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  boards: {
    title: string;
    description: string | null;
  };
}

export function InvitationHandler() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('board_invitations')
        .select(`
          *,
          boards:board_id (
            title,
            description
          )
        `)
        .eq('token', token)
        .single();

      if (error) throw error;

      setInvitation(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Invalid or expired invitation link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to accept this invitation',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('accept_board_invitation', {
        p_token: token
      });

      if (error) throw error;

      if (data) {
        toast({
          title: 'Success',
          description: 'Invitation accepted! You now have access to the board.',
        });
        navigate(`/board/${invitation?.board_id}`);
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
    } finally {
      setProcessing(false);
    }
  };

  const handleDeclineInvitation = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('board_invitations')
        .update({ status: 'declined' })
        .eq('token', token);

      if (error) throw error;

      toast({
        title: 'Invitation declined',
        description: 'You have declined this invitation.',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline invitation',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();
  const isAccepted = invitation.status === 'accepted';
  const isDeclined = invitation.status === 'declined';
  const isPending = invitation.status === 'pending' && !isExpired;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isAccepted && <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />}
          {isDeclined && <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />}
          {isExpired && <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />}
          {isPending && <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />}
          
          <CardTitle>
            {isAccepted && 'Invitation Accepted'}
            {isDeclined && 'Invitation Declined'}
            {isExpired && 'Invitation Expired'}
            {isPending && 'Board Invitation'}
          </CardTitle>
          
          <CardDescription>
            {isAccepted && 'You have already accepted this invitation.'}
            {isDeclined && 'You have declined this invitation.'}
            {isExpired && 'This invitation has expired.'}
            {isPending && `You've been invited to collaborate on a board.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold">{invitation.boards.title}</h3>
            {invitation.boards.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {invitation.boards.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                {invitation.role === 'editor' ? 'Editor' : 'Viewer'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {invitation.role === 'editor' ? 'Can edit the board' : 'Can view the board'}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="space-y-2">
              <Button 
                onClick={handleAcceptInvitation} 
                disabled={processing}
                className="w-full"
              >
                {processing ? 'Accepting...' : 'Accept Invitation'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeclineInvitation}
                disabled={processing}
                className="w-full"
              >
                {processing ? 'Declining...' : 'Decline'}
              </Button>
            </div>
          )}

          {isAccepted && (
            <Button onClick={() => navigate(`/board/${invitation.board_id}`)} className="w-full">
              Go to Board
            </Button>
          )}

          <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
