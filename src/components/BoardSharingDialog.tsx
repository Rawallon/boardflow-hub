import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Share2, Users, Mail, ExternalLink, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BoardSharingDialogProps {
  boardId: string;
  boardTitle: string;
  children: React.ReactNode;
}

interface BoardInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface BoardShareToken {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface BoardMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string | null;
  };
}

export function BoardSharingDialog({ boardId, boardTitle, children }: BoardSharingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [invitations, setInvitations] = useState<BoardInvitation[]>([]);
  const [shareTokens, setShareTokens] = useState<BoardShareToken[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSharingData();
    }
  }, [open, boardId]);

  const fetchSharingData = async () => {
    try {
      console.log('📊 Fetching sharing data for board:', boardId);
      
      // Fetch invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('board_invitations')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      console.log('📧 Invitations data:', { data: invitationsData, error: invitationsError });

      // Fetch share tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('board_share_tokens')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      console.log('🔗 Share tokens data:', { data: tokensData, error: tokensError });

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('board_memberships')
        .select(`
          *,
          profiles:user_id (
            display_name,
            email
          )
        `)
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      console.log('👥 Members data:', { data: membersData, error: membersError });

      setInvitations(invitationsData || []);
      setShareTokens(tokensData || []);
      setMembers(membersData || []);
    } catch (error: any) {
      console.error('❌ Error fetching sharing data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch sharing data',
        variant: 'destructive',
      });
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('📧 Creating invitation for:', { email: inviteEmail.trim(), role: inviteRole, boardId });
      
      const { data, error } = await supabase.rpc('create_board_invitation', {
        p_board_id: boardId,
        p_email: inviteEmail.trim(),
        p_role: inviteRole
      });

      console.log('📊 Invitation creation result:', { data, error });

      if (error) {
        console.error('❌ Error creating invitation:', error);
        throw error;
      }

      console.log('✅ Invitation created successfully:', data);

      toast({
        title: 'Success',
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail('');
      fetchSharingData();
    } catch (error: any) {
      console.error('❌ Failed to send invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    setLoading(true);
    try {
      console.log('🔗 Creating share link for board:', boardId);
      
      const { data, error } = await supabase.rpc('create_board_share_token', {
        p_board_id: boardId,
        p_expires_at: null // No expiration
      });

      console.log('📊 Share token creation result:', { data, error });

      if (error) {
        console.error('❌ Error creating share token:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ No token returned from create_board_share_token');
        throw new Error('No token returned from server');
      }

      const shareUrl = `${window.location.origin}/board/${boardId}/shared/${data}`;
      console.log('🔗 Generated share URL:', shareUrl);
      
      await navigator.clipboard.writeText(shareUrl);
      console.log('📋 Share URL copied to clipboard');
      
      toast({
        title: 'Success',
        description: 'Share link created and copied to clipboard',
      });

      fetchSharingData();
    } catch (error: any) {
      console.error('❌ Failed to create share link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create share link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShareLink = async (token: string) => {
    const shareUrl = `${window.location.origin}/board/${boardId}/shared/${token}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Success',
      description: 'Share link copied to clipboard',
    });
  };

  const handleDeactivateToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('board_share_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Share link deactivated',
      });

      fetchSharingData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate share link',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('board_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation removed',
      });

      fetchSharingData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove invitation',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    try {
      const { error } = await supabase
        .from('board_memberships')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member removed',
      });

      fetchSharingData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge variant="default" className="text-green-600">Accepted</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default">Owner</Badge>;
      case 'editor':
        return <Badge variant="secondary">Editor</Badge>;
      case 'viewer':
        return <Badge variant="outline">Viewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{boardTitle}"
          </DialogTitle>
          <DialogDescription>
            Invite people to collaborate or create a public link to share your board.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Invite
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Links
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invite by Email</CardTitle>
                <CardDescription>
                  Send an invitation to collaborate on this board.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer - Can view the board</SelectItem>
                      <SelectItem value="editor">Editor - Can edit the board</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleInviteUser} disabled={loading} className="w-full">
                  {loading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </CardContent>
            </Card>

            {invitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pending Invitations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{invitation.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getRoleBadge(invitation.role)}
                              {getStatusBadge(invitation.status)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInvitation(invitation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Board Members</CardTitle>
                <CardDescription>
                  People who have access to this board.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">
                            {member.profiles.display_name || member.profiles.email || 'Unknown User'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.profiles.email}
                          </p>
                          <div className="mt-1">
                            {getRoleBadge(member.role)}
                          </div>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Public Share Links</CardTitle>
                <CardDescription>
                  Create links that allow anyone to view your board without signing up.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleCreateShareLink} disabled={loading} className="w-full">
                  {loading ? 'Creating...' : 'Create Share Link'}
                </Button>

                {shareTokens.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Active Share Links</h4>
                    {shareTokens.map((token) => (
                      <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">Public Link</p>
                            <p className="text-sm text-muted-foreground">
                              Created {new Date(token.created_at).toLocaleDateString()}
                            </p>
                            {token.expires_at && (
                              <p className="text-sm text-muted-foreground">
                                Expires {new Date(token.expires_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyShareLink(token.token)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivateToken(token.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
