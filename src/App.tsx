/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Bolt,
  Groups,
  Leaderboard,
  Person,
  CheckCircle,
  AddAPhoto,
  FormatQuote,
  Add,
  Favorite,
  FavoriteBorder,
  Logout,
  MilitaryTech,
  CalendarToday,
  Edit,
  Delete,
  Close,
  CameraAlt,
  Save,
  Send,
  Image,
  EmojiEvents,
  LocalFireDepartment,
  WaterDrop,
  FitnessCenter,
  MenuBook,
  DirectionsRun,
  SelfImprovement,
  NoFood,
  PhotoCamera,
  RestaurantMenu,
  Bedtime,
  MonitorHeart,
  Hiking,
} from './components/Icons';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- Types ---
type View = 'home' | 'feed' | 'rank' | 'user';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  streak: number;
  total_days: number;
  level: number;
  challenge_start_date: string | null;
}

interface UserTask {
  id: string;
  task_name: string;
  icon: string;
  sort_order: number;
}

interface DailyTask {
  id?: string;
  task_name: string;
  completed: boolean;
  photo_url?: string;
}

interface FeedItem {
  id: string;
  user_id: string;
  content: string;
  type: string;
  photo_url: string;
  created_at: string;
  profiles: Profile;
  like_count: number;
  liked_by_me: boolean;
}

interface TaskIconOption {
  key: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
}

const TASK_ICON_OPTIONS: TaskIconOption[] = [
  { key: 'fitness_center', label: 'Workout', Icon: FitnessCenter },
  { key: 'menu_book', label: 'Reading', Icon: MenuBook },
  { key: 'no_food', label: 'Diet', Icon: NoFood },
  { key: 'water_drop', label: 'Water', Icon: WaterDrop },
  { key: 'photo_camera', label: 'Photo', Icon: PhotoCamera },
  { key: 'bolt', label: 'Focus', Icon: Bolt },
  { key: 'directions_run', label: 'Run', Icon: DirectionsRun },
  { key: 'self_improvement', label: 'Mindset', Icon: SelfImprovement },
  { key: 'restaurant_menu', label: 'Meals', Icon: RestaurantMenu },
  { key: 'bedtime', label: 'Sleep', Icon: Bedtime },
  { key: 'monitor_heart', label: 'Health', Icon: MonitorHeart },
  { key: 'hiking', label: 'Outdoor', Icon: Hiking },
  { key: 'check_circle', label: 'General', Icon: CheckCircle },
];

const DEFAULT_NEW_TASK_ICON = 'bolt';

const DEFAULT_TASKS = [
  { task_name: '45 MIN WORKOUT (OUTDOOR)', icon: 'fitness_center', sort_order: 0 },
  { task_name: '45 MIN WORKOUT (INDOOR)', icon: 'fitness_center', sort_order: 1 },
  { task_name: 'READ 10 PAGES', icon: 'menu_book', sort_order: 2 },
  { task_name: 'CLEAN DIET / NO ALCOHOL', icon: 'no_food', sort_order: 3 },
  { task_name: 'GALLON OF WATER', icon: 'water_drop', sort_order: 4 },
  { task_name: 'PROGRESS PHOTO', icon: 'photo_camera', sort_order: 5 },
];

const TASK_ICON_MAP: Record<string, React.FC<{ className?: string }>> = TASK_ICON_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.Icon;
    return acc;
  },
  {} as Record<string, React.FC<{ className?: string }>>
);

const BADGES = [
  { name: 'First Day', icon: '🌟', requirement: 1 },
  { name: '7 Day Streak', icon: '🔥', requirement: 7 },
  { name: '14 Day Streak', icon: '⚡', requirement: 14 },
  { name: '21 Day Streak', icon: '💪', requirement: 21 },
  { name: '30 Day Streak', icon: '🏆', requirement: 30 },
  { name: '45 Day Streak', icon: '👑', requirement: 45 },
  { name: '60 Day Streak', icon: '💎', requirement: 60 },
  { name: '75 HARD Complete', icon: '🎖️', requirement: 75 },
];

// =============================================
// AUTH COMPONENT
// =============================================
const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Check your email for confirmation!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 grit-gradient">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-headline text-5xl font-black tracking-tighter text-primary-container uppercase">75 HARD</h1>
          <p className="text-on-surface-variant mt-2 uppercase tracking-widest text-xs">Mental Toughness Challenge</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full bg-surface-container p-4 rounded-xl outline-none focus:ring-2 ring-primary-container/50 text-on-surface"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-surface-container p-4 rounded-xl outline-none focus:ring-2 ring-primary-container/50 text-on-surface"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-on-surface-variant text-sm uppercase tracking-widest"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};

// =============================================
// HOME COMPONENT
// =============================================
const Home = ({
  profile,
  dailyTasks,
  userTasks,
  onToggleTask,
  onUploadTaskPhoto,
}: {
  profile: Profile;
  dailyTasks: DailyTask[];
  userTasks: UserTask[];
  onToggleTask: (name: string) => void;
  onUploadTaskPhoto: (taskName: string, file: File) => void;
}) => {
  const totalTasks = userTasks.length || 6;
  const completedCount = dailyTasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoTask, setActivePhotoTask] = useState<string | null>(null);
  const [quote, setQuote] = useState({ text: '"The only person you are destined to become is the person you decide to be."', author: 'Ralph Waldo Emerson' });
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setQuoteLoading(true);
        const res = await fetch('https://api.quotable.io/random');
        const data = await res.json();
        setQuote({ text: `"${data.content}"`, author: data.author });
      } catch (error) {
        console.error('Error fetching quote:', error);
        // Keep default quote on error
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, []);

  const handlePhotoClick = (e: React.MouseEvent, taskName: string) => {
    e.stopPropagation();
    setActivePhotoTask(taskName);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePhotoTask) {
      onUploadTaskPhoto(activePhotoTask, file);
      setActivePhotoTask(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTaskIcon = (taskName: string) => {
    const ut = userTasks.find((u) => u.task_name === taskName);
    const iconKey = ut?.icon || 'check_circle';
    const IconComp = TASK_ICON_MAP[iconKey] || CheckCircle;
    return <IconComp className="w-5 h-5" />;
  };

  const getDailyTaskData = (ut: UserTask): DailyTask => {
    return dailyTasks.find((dt) => dt.task_name === ut.task_name) || { task_name: ut.task_name, completed: false };
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Progress Ring */}
      <section className="text-center">
        <div className="relative inline-block mb-6">
          <svg className="w-48 h-48 -rotate-90">
            <circle className="text-surface-container-highest" cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12" />
            <circle
              className="progress-glow transition-all duration-500"
              cx="96" cy="96" fill="transparent" r="80" stroke="#cefc22"
              strokeWidth="12" strokeDasharray="502.6"
              strokeDashoffset={502.6 - (502.6 * progress) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-5xl font-black tracking-tighter text-on-surface">{progress}%</span>
            <span className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Today's Grit</span>
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="font-headline text-sm font-bold text-secondary uppercase tracking-[0.2em]">
            {Math.max(0, 75 - profile.total_days)} Days Remaining
          </h2>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#cefc22] to-primary-dim transition-all duration-500" style={{ width: `${Math.min(100, (profile.total_days / 75) * 100)}%` }} />
          </div>
        </div>
      </section>

      {/* Task List */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="font-headline text-2xl font-bold tracking-tight uppercase">Critical Tasks</h3>
          <span className="font-label text-[10px] text-on-surface-variant font-bold">{completedCount}/{totalTasks} COMPLETE</span>
        </div>
        <div className="grid gap-4">
          {userTasks.map((ut, idx) => {
            const dt = getDailyTaskData(ut);
            return (
              <div
                key={ut.task_name}
                onClick={() => onToggleTask(ut.task_name)}
                className={cn(
                  "surface-container p-5 rounded-xl transition-all active:scale-[0.98] cursor-pointer border-l-4",
                  dt.completed ? "border-primary-container" : "border-transparent"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5", dt.completed ? "text-primary-container" : "text-on-surface-variant")}>
                      {getTaskIcon(ut.task_name)}
                    </div>
                    <div>
                      <span className="font-label text-[10px] text-primary-container font-black tracking-widest uppercase mb-1 block">Task 0{idx + 1}</span>
                      <h4 className="font-headline text-lg font-bold leading-tight">{ut.task_name}</h4>
                      {dt.photo_url && (
                        <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden">
                          <img src={dt.photo_url} className="w-full h-full object-cover" alt="task" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handlePhotoClick(e, ut.task_name)}
                      className="p-1.5 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-primary-container transition-colors"
                    >
                      <AddAPhoto className="w-5 h-5" />
                    </button>
                    <div className={cn("p-1 rounded", dt.completed ? "bg-primary-container text-on-primary-container" : "bg-surface-container-highest text-on-surface-variant")}>
                      {dt.completed ? <CheckCircle className="w-6 h-6" /> : <div className="w-6 h-6 border-2 border-current rounded-full" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quote */}
      <section className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10">
          <FormatQuote className="w-24 h-24" />
        </div>
        <p className="font-headline italic text-xl font-medium text-primary mb-2 relative z-10">{quote.text}</p>
        <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">- {quote.author}</p>
        {quoteLoading && <p className="text-xs text-on-surface-variant mt-2">Loading quote...</p>}
      </section>
    </motion.div>
  );
};

// =============================================
// FEED COMPONENT
// =============================================
const Feed = ({ session, profile }: { session: any, profile: Profile | null }) => {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPhoto, setNewPostPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchPosts = useCallback(async () => {
    const { data: feedData } = await supabase
      .from('social_feed')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (!feedData) return;

    // Get like counts and user likes
    const postIds = feedData.map((p: any) => p.id);
    const { data: likesData } = await supabase.from('likes').select('post_id, user_id').in('post_id', postIds);

    const enriched = feedData.map((post: any) => {
      const postLikes = (likesData || []).filter((l: any) => l.post_id === post.id);
      return {
        ...post,
        like_count: postLikes.length,
        liked_by_me: postLikes.some((l: any) => l.user_id === session?.user?.id),
      };
    });

    setPosts(enriched as FeedItem[]);
  }, [session]);

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('feed_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_feed' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleLike = async (postId: string, likedByMe: boolean) => {
    if (likedByMe) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', session.user.id);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: session.user.id });
    }
    fetchPosts();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPostPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!newPostContent.trim() && !newPostPhoto) return;
    setPosting(true);
    try {
      let photoUrl = null;
      if (newPostPhoto) {
        const ext = newPostPhoto.name.split('.').pop();
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('task_photos').upload(path, newPostPhoto);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('task_photos').getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const { data: insertedPost, error } = await supabase.from('social_feed').insert({
        user_id: session.user.id,
        content: newPostContent,
        type: 'manual_post',
        photo_url: photoUrl,
      }).select().single();
      if (error) throw error;
      
      // Trigger push notification
      await supabase.functions.invoke('send-push-notification', {
        body: {
          post_id: insertedPost.id,
          user_id: session.user.id,
          poster_name: profile?.username,
          content: newPostContent
        }
      });


      setNewPostContent('');
      setNewPostPhoto(null);
      setPhotoPreview(null);
      setShowCompose(false);
      toast.success('Posted!', { icon: '📝' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setPosting(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoSelect} />

      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="font-headline text-4xl font-black italic tracking-tighter text-on-surface uppercase leading-none">Activity</h2>
          <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">Community Progress • Live</p>
        </div>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="bg-primary-container text-on-primary-container p-2.5 rounded-xl active:scale-95 transition-transform"
        >
          {showCompose ? <Close className="w-5 h-5" /> : <Add className="w-5 h-5" />}
        </button>
      </div>

      {/* Compose Post */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface-container rounded-2xl p-4 space-y-3">
              <textarea
                placeholder="Share your progress..."
                className="w-full bg-transparent resize-none outline-none text-on-surface placeholder:text-on-surface-variant/50 min-h-[80px]"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
              />
              {photoPreview && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden">
                  <img src={photoPreview} className="w-full h-full object-cover" alt="preview" />
                  <button
                    onClick={() => { setNewPostPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 p-1 rounded-full"
                  >
                    <Close className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-on-surface-variant hover:text-primary-container transition-colors">
                  <Image className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting || (!newPostContent.trim() && !newPostPhoto)}
                  className="bg-primary-container text-on-primary-container px-5 py-2 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 active:scale-95 transition-transform"
                >
                  <Send className="w-4 h-4" />
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts */}
      {posts.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <Groups className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-label text-sm">No posts yet. Be the first to share!</p>
        </div>
      )}
      {posts.map((post) => (
        <article key={post.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.profiles?.username || 'U'}`}
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-primary-container/10"
                alt=""
              />
              <div>
                <h3 className="font-headline font-bold text-lg leading-none">{post.profiles?.username || 'Anonymous'}</h3>
                <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">{timeAgo(post.created_at)}</span>
              </div>
            </div>
            {post.type !== 'manual_post' && (
              <div className="bg-surface-container px-2 py-1 rounded-lg">
                <span className="font-label text-[10px] text-primary-container font-bold tracking-widest uppercase">{post.type?.replace('_', ' ')}</span>
              </div>
            )}
          </div>
          {post.photo_url && (
            <div className="relative h-80 rounded-xl overflow-hidden">
              <img src={post.photo_url} className="w-full h-full object-cover" alt="" />
            </div>
          )}
          {post.content && <p className="text-on-surface-variant text-sm">{post.content}</p>}
          <div className="flex items-center gap-6 pt-2">
            <button onClick={() => handleLike(post.id, post.liked_by_me)} className="flex items-center gap-2 group active:scale-90 transition-transform">
              {post.liked_by_me
                ? <Favorite className="w-5 h-5 text-secondary" />
                : <FavoriteBorder className="w-5 h-5 text-on-surface-variant group-hover:text-secondary transition-colors" />
              }
              <span className="font-label text-xs font-bold">{post.like_count}</span>
            </button>
          </div>
        </article>
      ))}
    </motion.div>
  );
};

// =============================================
// RANK COMPONENT
// =============================================
const Rank = () => {
  const [leaders, setLeaders] = useState<Profile[]>([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('streak', { ascending: false })
        .limit(10);
      if (data) setLeaders(data);
    };
    fetchLeaders();
  }, []);

  const top3 = leaders.slice(0, 3);
  const others = leaders.slice(3);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <section className="pt-4">
        <div className="flex items-end justify-center gap-4 h-64">
          {top3[1] && (
            <div className="flex flex-col items-center w-1/3">
              <div className="relative mb-3">
                <img src={top3[1].avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${top3[1].username}`} className="w-16 h-16 rounded-full object-cover border-2 border-slate-300" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-slate-300 text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">2</div>
              </div>
              <span className="font-headline font-bold text-xs uppercase">{top3[1].username}</span>
              <span className="text-secondary font-headline font-black text-lg">{top3[1].streak}</span>
              <div className="w-full h-16 bg-surface-container-low rounded-t-xl mt-2 opacity-50" />
            </div>
          )}
          {top3[0] && (
            <div className="flex flex-col items-center w-1/3 relative z-10">
              <div className="relative mb-4 -mt-8">
                <img src={top3[0].avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${top3[0].username}`} className="w-20 h-20 rounded-full object-cover border-2 border-primary-container" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-primary-container text-black text-[12px] font-black w-7 h-7 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">1</div>
              </div>
              <span className="font-headline font-bold text-sm text-primary-container uppercase">{top3[0].username}</span>
              <span className="text-primary-fixed font-headline font-black text-3xl">{top3[0].streak}</span>
              <div className="w-full h-24 bg-surface-container rounded-t-xl mt-2 shadow-[0_-10px_30px_rgba(206,252,34,0.15)]" />
            </div>
          )}
          {top3[2] && (
            <div className="flex flex-col items-center w-1/3">
              <div className="relative mb-3">
                <img src={top3[2].avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${top3[2].username}`} className="w-16 h-16 rounded-full object-cover border-2 border-orange-500" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">3</div>
              </div>
              <span className="font-headline font-bold text-xs uppercase">{top3[2].username}</span>
              <span className="text-secondary font-headline font-black text-lg">{top3[2].streak}</span>
              <div className="w-full h-12 bg-surface-container-low rounded-t-xl mt-2 opacity-30" />
            </div>
          )}
        </div>
      </section>

      {others.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center mb-6 pl-4 border-l-4 border-primary-container">
            <h2 className="font-headline text-xl font-bold tracking-tight uppercase">Global Elite</h2>
          </div>
          <div className="space-y-3">
            {others.map((leader, i) => (
              <div key={leader.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-4">
                  <span className="font-headline font-black text-on-surface-variant/40 w-6">{String(i + 4).padStart(2, '0')}</span>
                  <img src={leader.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${leader.id}`} className="w-12 h-12 rounded-lg object-cover" alt="" />
                  <div>
                    <p className="font-headline font-bold text-sm uppercase">{leader.username}</p>
                    <p className="text-[9px] font-label font-bold text-on-surface-variant tracking-wider uppercase">Level {leader.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-headline font-black text-xl text-on-surface">{leader.streak}</span>
                  <span className="text-[8px] font-label font-bold tracking-widest text-on-surface-variant uppercase">Days</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {leaders.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <EmojiEvents className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-label text-sm">No participants yet. Start your challenge!</p>
        </div>
      )}
    </motion.div>
  );
};

// =============================================
// USER / PROFILE COMPONENT
// =============================================
const User = ({
  profile,
  userTasks,
  onSignOut,
  onUpdateProfile,
  onAddTask,
  onDeleteTask,
}: {
  profile: Profile;
  userTasks: UserTask[];
  onSignOut: () => void;
  onUpdateProfile: (updates: Partial<Profile>, avatarFile?: File) => Promise<void>;
  onAddTask: (taskName: string, icon: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(profile.username || '');
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState(DEFAULT_NEW_TASK_ICON);
  const [showAddTask, setShowAddTask] = useState(false);

  const earnedBadges = BADGES.filter((b) => profile.total_days >= b.requirement);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ username: editUsername });
      setEditing(false);
      toast.success('Profile updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUpdateProfile({}, file);
      toast.success('Avatar updated!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    try {
      await onAddTask(newTaskName.trim().toUpperCase(), newTaskIcon);
      setNewTaskName('');
      setNewTaskIcon(DEFAULT_NEW_TASK_ICON);
      setShowAddTask(false);
      toast.success('Task added!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (!confirm(`Delete "${taskName}"?`)) return;
    try {
      await onDeleteTask(taskId);
      toast.success('Task removed!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />

      {/* Profile Header */}
      <section className="flex items-end gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-primary-container/20">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
              className="w-full h-full object-cover"
              alt=""
            />
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 bg-primary-container text-on-primary-container p-1 rounded-full"
          >
            <CameraAlt className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1">
          <p className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase mb-1">Elite Operator</p>
          {editing ? (
            <div className="flex gap-2">
              <input
                className="bg-surface-container px-3 py-1 rounded-lg outline-none font-headline font-bold text-xl text-on-surface flex-1"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                autoFocus
              />
              <button onClick={handleSaveProfile} disabled={saving} className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="bg-surface-container text-on-surface-variant p-2 rounded-lg">
                <Close className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-headline font-bold text-3xl tracking-tighter uppercase">{profile.username || 'OPERATOR'}</h2>
              <button onClick={() => { setEditUsername(profile.username || ''); setEditing(true); }} className="text-on-surface-variant">
                <Edit className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="bg-surface-container px-3 py-1 rounded-lg">
          <span className="font-headline font-black italic text-primary-container text-xl">Lvl {profile.level}</span>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container p-5 rounded-xl flex flex-col justify-between aspect-square">
          <LocalFireDepartment className="w-8 h-8 text-primary-container" />
          <div>
            <p className="font-headline font-bold text-4xl text-on-surface">{profile.streak}</p>
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Day Streak</p>
          </div>
        </div>
        <div className="grid grid-rows-2 gap-3">
          <div className="bg-surface-container-low p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-xl text-on-surface">{profile.total_days}</p>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Total Days</p>
            </div>
            <CalendarToday className="w-5 h-5 text-on-surface-variant" />
          </div>
          <div className="bg-surface-container-low p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-xl text-on-surface">{earnedBadges.length}</p>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Badges</p>
            </div>
            <MilitaryTech className="w-5 h-5 text-tertiary" />
          </div>
        </div>
      </div>

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-headline text-lg font-bold uppercase tracking-tight">Badges Earned</h3>
          <div className="flex flex-wrap gap-2">
            {BADGES.map((badge) => (
              <div
                key={badge.name}
                className={cn(
                  "px-3 py-2 rounded-xl text-center",
                  profile.total_days >= badge.requirement
                    ? "bg-surface-container ring-1 ring-primary-container/20"
                    : "bg-surface-container-low opacity-30"
                )}
              >
                <span className="text-xl block">{badge.icon}</span>
                <span className="font-label text-[8px] tracking-widest uppercase text-on-surface-variant">{badge.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Task Management */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-headline text-lg font-bold uppercase tracking-tight">My Tasks</h3>
          <button onClick={() => setShowAddTask(!showAddTask)} className="bg-primary-container text-on-primary-container p-1.5 rounded-lg active:scale-95 transition-transform">
            {showAddTask ? <Close className="w-4 h-4" /> : <Add className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {showAddTask && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-surface-container-low rounded-2xl p-4 space-y-4 border border-primary-container/10">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-surface-container px-4 py-3 rounded-xl outline-none text-on-surface placeholder:text-on-surface-variant/50 font-headline text-sm uppercase"
                    placeholder="New task name..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="bg-primary-container text-on-primary-container px-4 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-40"
                    disabled={!newTaskName.trim()}
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant">Choose Icon</p>
                    <div className="flex items-center gap-2 text-primary-container">
                      {React.createElement(TASK_ICON_MAP[newTaskIcon] || CheckCircle, { className: 'w-5 h-5' })}
                      <span className="font-label text-[10px] tracking-widest uppercase">
                        {TASK_ICON_OPTIONS.find((option) => option.key === newTaskIcon)?.label || 'General'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {TASK_ICON_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setNewTaskIcon(option.key)}
                        className={cn(
                          'rounded-xl p-3 border transition-all active:scale-95 flex flex-col items-center gap-1.5',
                          newTaskIcon === option.key
                            ? 'bg-primary-container text-on-primary-container border-primary-container shadow-[0_8px_24px_rgba(206,252,34,0.18)]'
                            : 'bg-surface-container text-on-surface-variant border-transparent hover:text-primary-container hover:border-primary-container/20'
                        )}
                        aria-label={`Select ${option.label} icon`}
                      >
                        <option.Icon className="w-5 h-5" />
                        <span className="font-label text-[8px] tracking-widest uppercase text-center leading-tight">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {userTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-primary-container">
                  {(TASK_ICON_MAP[task.icon] && React.createElement(TASK_ICON_MAP[task.icon], { className: 'w-5 h-5' })) || <CheckCircle className="w-5 h-5" />}
                </div>
                <span className="font-headline font-bold text-sm uppercase">{task.task_name}</span>
              </div>
              <button onClick={() => handleDeleteTask(task.id, task.task_name)} className="text-on-surface-variant hover:text-error transition-colors p-1">
                <Delete className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full bg-surface-container p-4 rounded-xl flex items-center justify-center gap-3 text-error font-bold uppercase tracking-widest"
      >
        <Logout className="w-5 h-5" />
        Sign Out
      </button>
    </motion.div>
  );
};

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<View>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Load user data when session changes
  useEffect(() => {
    if (session?.user) {
      loadProfile();
      loadUserTasks();
      subscribeToPushNotifications();
    }
  }, [session]);


  // Load daily tasks when userTasks change
  useEffect(() => {
    if (session?.user && userTasks.length > 0) {
      loadDailyTasks();
    }
  }, [userTasks, session]);

  // ---- PROFILE ----
  const loadProfile = async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

    if (error && error.code === 'PGRST116') {
      const newProfile = {
        id: session.user.id,
        username: session.user.email?.split('@')[0],
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${session.user.email?.split('@')[0]}`,
        streak: 0,
        total_days: 0,
        level: 1,
        challenge_start_date: new Date().toISOString().split('T')[0],
      };
      const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
      if (created) setProfile(created);
    } else if (data) {
      setProfile(data);
    }
  };

  const updateProfile = async (updates: Partial<Profile>, avatarFile?: File) => {
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${session.user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      updates.avatar_url = urlData.publicUrl + '?t=' + Date.now(); // cache bust
    }

    const { data, error } = await supabase.from('profiles').update(updates).eq('id', session.user.id).select().single();
    if (error) throw error;
    if (data) setProfile(data);
  };

  // ---- PUSH NOTIFICATIONS ----
  const subscribeToPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const authResult = await Notification.requestPermission();
      if (authResult !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublicKey) as any
        });
      }

      const subData = JSON.parse(JSON.stringify(subscription));
      
      // Save subscription to Supabase
      await supabase.from('push_subscriptions').upsert({
        user_id: session.user.id,
        endpoint: subData.endpoint,
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth,
      }, { onConflict: 'user_id,endpoint' });
      
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  };

  // ---- USER TASKS (challenge template) ----
  const loadUserTasks = async () => {
    const { data } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('sort_order', { ascending: true });

    if (data && data.length > 0) {
      setUserTasks(data.map((task) => ({ ...task, icon: task.icon || DEFAULT_NEW_TASK_ICON })));
    } else {
      // First time: create default tasks
      const defaults = DEFAULT_TASKS.map((t) => ({ ...t, user_id: session.user.id }));
      const { data: created } = await supabase.from('user_tasks').insert(defaults).select();
      if (created) setUserTasks(created);
    }
  };

  const addUserTask = async (taskName: string, icon: string) => {
    const { data, error } = await supabase
      .from('user_tasks')
      .insert({ user_id: session.user.id, task_name: taskName, icon, sort_order: userTasks.length })
      .select()
      .single();
    if (error) throw error;
    if (data) setUserTasks((prev) => [...prev, data]);
  };

  const deleteUserTask = async (taskId: string) => {
    const { error } = await supabase.from('user_tasks').delete().eq('id', taskId);
    if (error) throw error;
    setUserTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // ---- DAILY TASKS ----
  const loadDailyTasks = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('tasks').select('*').eq('user_id', session.user.id).eq('date', today);

    const merged: DailyTask[] = userTasks.map((ut) => {
      const found = (data || []).find((d: any) => d.task_name === ut.task_name);
      return found
        ? { id: found.id, task_name: found.task_name, completed: found.completed, photo_url: found.photo_url }
        : { task_name: ut.task_name, completed: false };
    });
    setDailyTasks(merged);
  };

  const toggleTask = async (taskName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const task = dailyTasks.find((t) => t.task_name === taskName);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
      const { error } = await supabase.from('tasks').upsert(
        { user_id: session.user.id, date: today, task_name: taskName, completed: newCompleted },
        { onConflict: 'user_id,date,task_name' }
      );
      if (error) throw error;

      setDailyTasks((prev) => prev.map((t) => (t.task_name === taskName ? { ...t, completed: newCompleted } : t)));

      if (newCompleted) {
        toast.success(`${taskName} completed!`, {
          icon: '🔥',
          style: { background: '#1a1a1a', color: '#cefc22', border: '1px solid #cefc22' },
        });
      }

      // Check if all tasks are now completed -> update streak
      const updatedTasks = dailyTasks.map((t) => (t.task_name === taskName ? { ...t, completed: newCompleted } : t));
      const allCompleted = updatedTasks.every((t) => t.completed);

      if (allCompleted && newCompleted) {
        await completeDayAndUpdateStreak();
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const uploadTaskPhoto = async (taskName: string, file: File) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/${today}_${taskName.replace(/\s/g, '_')}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('task_photos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('task_photos').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      // Upsert the task with photo
      await supabase.from('tasks').upsert(
        { user_id: session.user.id, date: today, task_name: taskName, photo_url: photoUrl, completed: true },
        { onConflict: 'user_id,date,task_name' }
      );

      setDailyTasks((prev) =>
        prev.map((t) => (t.task_name === taskName ? { ...t, photo_url: photoUrl, completed: true } : t))
      );

      toast.success('Photo uploaded!', { icon: '📸' });

      // Auto-post to feed for progress photos
      if (taskName === 'PROGRESS PHOTO') {
        const { data: insertedFeed } = await supabase.from('social_feed').insert({
          user_id: session.user.id,
          content: `Day ${(profile?.total_days || 0) + 1} progress photo 💪`,
          type: 'task_complete',
          photo_url: photoUrl,
        }).select().single();
        
        if (insertedFeed) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              post_id: insertedFeed.id,
              user_id: session.user.id,
              poster_name: profile?.username,
              content: 'Progress photo 💪'
            }
          });
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // ---- STREAK LOGIC ----
  const completeDayAndUpdateStreak = async () => {
    if (!profile) return;

    const newTotalDays = profile.total_days + 1;
    const newLevel = Math.floor(newTotalDays / 10) + 1;

    // Check if yesterday was also completed to maintain streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayTasks } = await supabase
      .from('tasks')
      .select('completed')
      .eq('user_id', session.user.id)
      .eq('date', yesterdayStr);

    const yesterdayAllCompleted = yesterdayTasks && yesterdayTasks.length >= userTasks.length && yesterdayTasks.every((t: any) => t.completed);
    const newStreak = yesterdayAllCompleted || profile.streak === 0 ? profile.streak + 1 : 1;

    const { data } = await supabase
      .from('profiles')
      .update({ total_days: newTotalDays, streak: newStreak, level: newLevel })
      .eq('id', session.user.id)
      .select()
      .single();

    if (data) {
      setProfile(data);
      toast.success(`Day ${newTotalDays} complete! 🎯 Streak: ${newStreak}`, {
        duration: 4000,
        style: { background: '#1a1a1a', color: '#cefc22', border: '1px solid #cefc22' },
      });

      // Post milestone to feed
      if (newStreak % 7 === 0 || newTotalDays === 75) {
        const { data: insertedFeed } = await supabase.from('social_feed').insert({
          user_id: session.user.id,
          content: newTotalDays === 75
            ? `🎖️ COMPLETED 75 HARD CHALLENGE! 🎖️`
            : `🔥 ${newStreak} day streak achieved!`,
          type: 'streak_milestone',
        }).select().single();
        
        if (insertedFeed) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              post_id: insertedFeed.id,
              user_id: session.user.id,
              poster_name: profile?.username,
              content: `Milestone Achieved!`
            }
          });
        }
      }
    }
  };

  // ---- SIGN OUT ----
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setUserTasks([]);
    setDailyTasks([]);
  };

  // ---- RENDER ----
  if (!session) return <Auth />;
  if (!profile) {
    return (
      <div className="min-h-screen grit-gradient flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Toaster position="top-center" />

      <header className="fixed top-0 w-full z-50 h-20 bg-[#0e0e0e] shadow-2xl shadow-black/60">
        <div className="flex justify-between items-center px-6 w-full max-w-md mx-auto h-full">
          <div>
            <span className="font-label text-[9px] tracking-widest text-on-surface-variant uppercase">Streak</span>
            <p className="font-headline font-black text-primary-container text-lg leading-none">{profile.streak} 🔥</p>
          </div>
          <h1 className="font-headline font-bold tracking-tighter text-3xl uppercase text-primary-container">DAY {profile.total_days || 1}</h1>
          <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden ring-2 ring-primary-container/20">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
              className="w-full h-full object-cover"
              alt=""
            />
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-md mx-auto grit-gradient min-h-screen">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <React.Fragment key="home">
              <Home
                profile={profile}
                dailyTasks={dailyTasks}
                userTasks={userTasks}
                onToggleTask={toggleTask}
                onUploadTaskPhoto={uploadTaskPhoto}
              />
            </React.Fragment>
          )}
          {view === 'feed' && (
            <React.Fragment key="feed">
              <Feed session={session} profile={profile} />
            </React.Fragment>
          )}
          {view === 'rank' && (
            <React.Fragment key="rank">
              <Rank />
            </React.Fragment>
          )}
          {view === 'user' && (
            <React.Fragment key="user">
              <User
                profile={profile}
                userTasks={userTasks}
                onSignOut={handleSignOut}
                onUpdateProfile={updateProfile}
                onAddTask={addUserTask}
                onDeleteTask={deleteUserTask}
              />
            </React.Fragment>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 bg-[#131313]/90 backdrop-blur-xl z-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <NavItem active={view === 'home'} onClick={() => setView('home')} icon={<Bolt className="w-6 h-6" />} label="HOME" />
        <NavItem active={view === 'feed'} onClick={() => setView('feed')} icon={<Groups className="w-6 h-6" />} label="FEED" />
        <NavItem active={view === 'rank'} onClick={() => setView('rank')} icon={<Leaderboard className="w-6 h-6" />} label="RANK" />
        <NavItem active={view === 'user'} onClick={() => setView('user')} icon={<Person className="w-6 h-6" />} label="USER" />
      </nav>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all active:scale-90 transform duration-200',
        active ? 'text-primary-container bg-[#1a1a1a] ring-1 ring-primary-container/20' : 'text-on-surface-variant hover:text-white'
      )}
    >
      <div className="mb-1">{icon}</div>
      <span className="font-body font-bold text-[10px] tracking-[0.1em] uppercase">{label}</span>
    </button>
  );
}
