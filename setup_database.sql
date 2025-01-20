-- Видаляємо існуючі таблиці
DROP TABLE IF EXISTS gallery CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Створюємо таблицю profiles
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name text,
    age integer,
    gender text CHECK (gender IN ('male', 'female')),
    city text,
    bio text,
    avatar_url text,
    telegram text,
    instagram text,
    facebook text,
    interests text[],
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Створюємо таблицю messages
CREATE TABLE public.messages (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    read_at timestamptz,
    CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_receiver FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Створюємо enum для статусів лайку, якщо він ще не існує
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'like_status') THEN
        CREATE TYPE like_status AS ENUM ('pending', 'accepted', 'declined');
    END IF;
END $$;

-- Створюємо таблицю likes
DROP TABLE IF EXISTS public.likes CASCADE;
CREATE TABLE public.likes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    status like_status DEFAULT 'pending',
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(user_id, profile_id)
);

-- Створюємо таблицю matches
CREATE TABLE public.matches (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user1_id uuid NOT NULL,
    user2_id uuid NOT NULL,
    user1_liked boolean DEFAULT false,
    user2_liked boolean DEFAULT false,
    matched_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_user1 FOREIGN KEY (user1_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user2 FOREIGN KEY (user2_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_id)
);

-- Створюємо таблицю gallery
CREATE TABLE public.gallery (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    image_url text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Включаємо Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

-- Політики для profiles
CREATE POLICY "Profiles are viewable by everyone" 
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Політики для messages
CREATE POLICY "Users can view their own messages" 
    ON messages FOR SELECT USING (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id
    );

CREATE POLICY "Users can send messages" 
    ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own sent messages" 
    ON messages FOR UPDATE USING (auth.uid() = sender_id);

-- Політики для likes
CREATE POLICY "Users can view likes" 
    ON likes FOR SELECT USING (true);

CREATE POLICY "Users can create likes" 
    ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
    ON likes FOR DELETE USING (auth.uid() = user_id);

-- Політики для matches
CREATE POLICY "Users can view their own matches" 
    ON matches FOR SELECT USING (
        auth.uid() = user1_id OR 
        auth.uid() = user2_id
    );

CREATE POLICY "Users can update their own matches" 
    ON matches FOR UPDATE USING (
        auth.uid() = user1_id OR 
        auth.uid() = user2_id
    );

-- Політики для gallery
CREATE POLICY "Images are viewable by everyone" 
    ON gallery FOR SELECT USING (true);

CREATE POLICY "Users can upload their own images" 
    ON gallery FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images" 
    ON gallery FOR DELETE USING (auth.uid() = user_id);

-- Створюємо індекси для оптимізації
CREATE INDEX idx_profiles_created_at ON profiles(created_at);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_likes_profile_id ON likes(profile_id);
CREATE INDEX idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX idx_gallery_user_id ON gallery(user_id);
