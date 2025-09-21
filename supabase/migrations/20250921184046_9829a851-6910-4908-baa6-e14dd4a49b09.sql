-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create boards table
CREATE TABLE public.boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'link_shared', 'public')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lists table
CREATE TABLE public.lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cards table
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create board memberships table for sharing
CREATE TABLE public.board_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_memberships ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Boards policies
CREATE POLICY "Users can view boards they own or are members of" ON public.boards FOR SELECT USING (
  auth.uid() = owner_id OR 
  visibility = 'public' OR
  EXISTS (SELECT 1 FROM public.board_memberships WHERE board_id = boards.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create their own boards" ON public.boards FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Board owners can update their boards" ON public.boards FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Board owners can delete their boards" ON public.boards FOR DELETE USING (auth.uid() = owner_id);

-- Lists policies
CREATE POLICY "Users can view lists in accessible boards" ON public.lists FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE boards.id = lists.board_id 
    AND (
      auth.uid() = boards.owner_id OR 
      boards.visibility = 'public' OR
      EXISTS (SELECT 1 FROM public.board_memberships WHERE board_id = boards.id AND user_id = auth.uid())
    )
  )
);
CREATE POLICY "Users can manage lists in boards they can edit" ON public.lists FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE boards.id = lists.board_id 
    AND (
      auth.uid() = boards.owner_id OR
      EXISTS (SELECT 1 FROM public.board_memberships WHERE board_id = boards.id AND user_id = auth.uid() AND role IN ('owner', 'editor'))
    )
  )
);

-- Cards policies
CREATE POLICY "Users can view cards in accessible lists" ON public.cards FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.lists 
    JOIN public.boards ON boards.id = lists.board_id
    WHERE lists.id = cards.list_id 
    AND (
      auth.uid() = boards.owner_id OR 
      boards.visibility = 'public' OR
      EXISTS (SELECT 1 FROM public.board_memberships WHERE board_id = boards.id AND user_id = auth.uid())
    )
  )
);
CREATE POLICY "Users can manage cards in boards they can edit" ON public.cards FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.lists 
    JOIN public.boards ON boards.id = lists.board_id
    WHERE lists.id = cards.list_id 
    AND (
      auth.uid() = boards.owner_id OR
      EXISTS (SELECT 1 FROM public.board_memberships WHERE board_id = boards.id AND user_id = auth.uid() AND role IN ('owner', 'editor'))
    )
  )
);

-- Board memberships policies
CREATE POLICY "Users can view memberships for accessible boards" ON public.board_memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE boards.id = board_memberships.board_id 
    AND (
      auth.uid() = boards.owner_id OR 
      boards.visibility = 'public' OR
      user_id = auth.uid()
    )
  )
);
CREATE POLICY "Board owners can manage memberships" ON public.board_memberships FOR ALL USING (
  EXISTS (SELECT 1 FROM public.boards WHERE boards.id = board_memberships.board_id AND auth.uid() = boards.owner_id)
);

-- Create indexes for better performance
CREATE INDEX idx_boards_owner_id ON public.boards(owner_id);
CREATE INDEX idx_lists_board_id ON public.lists(board_id);
CREATE INDEX idx_cards_list_id ON public.cards(list_id);
CREATE INDEX idx_board_memberships_board_id ON public.board_memberships(board_id);
CREATE INDEX idx_board_memberships_user_id ON public.board_memberships(user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();