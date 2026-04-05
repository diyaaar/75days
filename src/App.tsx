/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Bolt, 
  Groups, 
  Leaderboard, 
  Person, 
  Menu, 
  CheckCircle, 
  AddAPhoto, 
  UploadFile, 
  Schedule, 
  FormatQuote,
  Add,
  Favorite,
  ChatBubble,
  Logout,
  MilitaryTech,
  CalendarToday,
  Search,
  PersonAdd,
  MoreVert,
  WaterDrop,
  FitnessCenter,
  MenuBook
} from './components/Icons';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
}

interface Task {
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
}

// --- Components ---

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
        const { error } = await supabase.auth.signUp({ email, password });
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
            className="w-full bg-surface-container p-4 rounded-xl outline-none focus:ring-2 ring-primary-container/50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-surface-container p-4 rounded-xl outline-none focus:ring-2 ring-primary-container/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-xl active:scale-95 transition-transform"
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

const Home = ({ profile, tasks, onToggleTask }: { profile: Profile, tasks: Task[], onToggleTask: (name: string) => void }) => {
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / 6) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
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
          <h2 className="font-headline text-sm font-bold text-secondary uppercase tracking-[0.2em]">{75 - profile.total_days} Days Remaining</h2>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#cefc22] to-primary-dim transition-all duration-500" style={{ width: `${(profile.total_days / 75) * 100}%` }}></div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="font-headline text-2xl font-bold tracking-tight uppercase">Critical Tasks</h3>
          <span className="font-label text-[10px] text-on-surface-variant font-bold">{completedCount}/6 COMPLETE</span>
        </div>
        <div className="grid gap-4">
          {tasks.map((task, idx) => (
            <div 
              key={task.task_name} 
              onClick={() => onToggleTask(task.task_name)}
              className={cn(
                "surface-container p-5 rounded-xl transition-all active:scale-[0.98] cursor-pointer border-l-4",
                task.completed ? "border-primary-container" : "border-transparent"
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-label text-[10px] text-primary-container font-black tracking-widest uppercase mb-1 block">Task 0{idx + 1}</span>
                  <h4 className="font-headline text-lg font-bold leading-tight">{task.task_name}</h4>
                </div>
                <div className={cn("p-1 rounded", task.completed ? "bg-primary-container text-on-primary-container" : "bg-surface-container-highest text-on-surface-variant")}>
                  {task.completed ? <CheckCircle className="w-6 h-6" /> : <div className="w-6 h-6 border-2 border-current rounded-full" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10">
          <FormatQuote className="w-24 h-24" />
        </div>
        <p className="font-headline italic text-xl font-medium text-primary mb-2 relative z-10">"Pain is temporary. Quitting lasts forever."</p>
        <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">- Lance Armstrong</p>
      </section>
    </motion.div>
  );
};

const Feed = () => {
  const [posts, setPosts] = useState<FeedItem[]>([]);

  useEffect(() => {
    fetchPosts();
    const channel = supabase.channel('feed_changes')
      .on('postgres_changes', { event: 'INSERT', table: 'social_feed' }, payload => {
        fetchPosts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('social_feed')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data as any);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-headline text-4xl font-black italic tracking-tighter text-on-surface uppercase leading-none">Activity</h2>
        <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">Community Progress • Live</p>
      </div>
      {posts.map(post => (
        <article key={post.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={post.profiles.avatar_url || 'https://picsum.photos/seed/user/100/100'} className="w-12 h-12 rounded-xl object-cover ring-2 ring-primary-container/10" alt="" />
              <div>
                <h3 className="font-headline font-bold text-lg leading-none">{post.profiles.username || 'Anonymous'}</h3>
                <span className="font-label text-[10px] text-primary-container font-bold tracking-widest uppercase">{post.type}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="block font-headline text-2xl font-bold text-on-surface leading-none">DAY {post.profiles.total_days}</span>
            </div>
          </div>
          {post.photo_url && (
            <div className="relative h-80 rounded-xl overflow-hidden">
              <img src={post.photo_url} className="w-full h-full object-cover" alt="" />
            </div>
          )}
          <p className="text-on-surface-variant text-sm">{post.content}</p>
          <div className="flex items-center gap-6 pt-2">
            <button className="flex items-center gap-2 group">
              <Favorite className="w-5 h-5 text-secondary" />
              <span className="font-label text-xs font-bold">128</span>
            </button>
            <button className="flex items-center gap-2 group">
              <ChatBubble className="w-5 h-5 text-on-surface-variant" />
              <span className="font-label text-xs font-bold">14</span>
            </button>
          </div>
        </article>
      ))}
    </motion.div>
  );
};

const Rank = () => {
  const [leaders, setLeaders] = useState<Profile[]>([]);

  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('streak', { ascending: false })
      .limit(10);
    if (data) setLeaders(data);
  };

  const top3 = leaders.slice(0, 3);
  const others = leaders.slice(3);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <section className="pt-4">
        <div className="flex items-end justify-center gap-4 h-64">
          {top3[1] && (
            <div className="flex flex-col items-center w-1/3">
              <div className="relative mb-3">
                <img src={top3[1].avatar_url || 'https://picsum.photos/seed/2/100/100'} className="w-16 h-16 rounded-full object-cover border-2 border-slate-300" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-slate-300 text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">2</div>
              </div>
              <span className="font-headline font-bold text-xs uppercase">{top3[1].username}</span>
              <span className="text-secondary font-headline font-black text-lg">{top3[1].streak}</span>
              <div className="w-full h-16 bg-surface-container-low rounded-t-xl mt-2 opacity-50"></div>
            </div>
          )}
          {top3[0] && (
            <div className="flex flex-col items-center w-1/3 relative z-10">
              <div className="relative mb-4 -mt-8">
                <img src={top3[0].avatar_url || 'https://picsum.photos/seed/1/100/100'} className="w-20 h-20 rounded-full object-cover border-2 border-primary-container" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-primary-container text-black text-[12px] font-black w-7 h-7 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">1</div>
              </div>
              <span className="font-headline font-bold text-sm text-primary-container uppercase">{top3[0].username}</span>
              <span className="text-primary-fixed font-headline font-black text-3xl">{top3[0].streak}</span>
              <div className="w-full h-24 bg-surface-container rounded-t-xl mt-2 shadow-[0_-10px_30px_rgba(206,252,34,0.15)]"></div>
            </div>
          )}
          {top3[2] && (
            <div className="flex flex-col items-center w-1/3">
              <div className="relative mb-3">
                <img src={top3[2].avatar_url || 'https://picsum.photos/seed/3/100/100'} className="w-16 h-16 rounded-full object-cover border-2 border-orange-500" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#0e0e0e]">3</div>
              </div>
              <span className="font-headline font-bold text-xs uppercase">{top3[2].username}</span>
              <span className="text-secondary font-headline font-black text-lg">{top3[2].streak}</span>
              <div className="w-full h-12 bg-surface-container-low rounded-t-xl mt-2 opacity-30"></div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center mb-6 pl-4 border-l-4 border-primary-container">
          <h2 className="font-headline text-xl font-bold tracking-tight uppercase">Global Elite</h2>
        </div>
        <div className="space-y-3">
          {others.map((leader, i) => (
            <div key={leader.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-4">
                <span className="font-headline font-black text-on-surface-variant/40 w-6">0{i + 4}</span>
                <img src={leader.avatar_url || `https://picsum.photos/seed/${leader.id}/100/100`} className="w-12 h-12 rounded-lg object-cover" alt="" />
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
    </motion.div>
  );
};

const User = ({ profile, onSignOut }: { profile: Profile, onSignOut: () => void }) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <section className="flex items-end gap-4">
        <div className="flex-1">
          <p className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase mb-1">Elite Operator</p>
          <h2 className="font-headline font-bold text-4xl tracking-tighter uppercase">{profile.username || 'OPERATOR'}</h2>
        </div>
        <div className="bg-surface-container px-3 py-1 rounded-lg">
          <span className="font-headline font-black italic text-primary-container text-xl">Lvl {profile.level}</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container p-5 rounded-xl flex flex-col justify-between aspect-square">
          <Bolt className="w-8 h-8 text-primary-container" />
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
              <p className="font-headline font-bold text-xl text-on-surface">8</p>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">Badges</p>
            </div>
            <MilitaryTech className="w-5 h-5 text-tertiary" />
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <button 
          onClick={onSignOut}
          className="w-full bg-surface-container p-4 rounded-xl flex items-center justify-center gap-3 text-error font-bold uppercase tracking-widest"
        >
          <Logout className="w-5 h-5" />
          Sign Out
        </button>
      </section>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<View>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([
    { task_name: '45 MIN WORKOUT (OUTDOOR)', completed: false },
    { task_name: '45 MIN WORKOUT (INDOOR)', completed: false },
    { task_name: 'READ 10 PAGES', completed: false },
    { task_name: 'CLEAN DIET / NO ALCOHOL', completed: false },
    { task_name: 'GALLON OF WATER', completed: false },
    { task_name: 'PROGRESS PHOTO', completed: false },
  ]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
      fetchTasks();
    }
  }, [session]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Create profile if not exists
      const newProfile = {
        id: session.user.id,
        username: session.user.email?.split('@')[0],
        avatar_url: `https://picsum.photos/seed/${session.user.id}/100/100`,
        streak: 0,
        total_days: 0,
        level: 1
      };
      const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
      if (created) setProfile(created);
    } else if (data) {
      setProfile(data);
    }
  };

  const fetchTasks = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', today);
    
    if (data && data.length > 0) {
      const updatedTasks = tasks.map(t => {
        const found = data.find(d => d.task_name === t.task_name);
        return found ? { ...t, completed: found.completed, id: found.id } : t;
      });
      setTasks(updatedTasks);
    }
  };

  const toggleTask = async (taskName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const task = tasks.find(t => t.task_name === taskName);
    if (!task) return;

    const newCompleted = !task.completed;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .upsert({
          user_id: session.user.id,
          date: today,
          task_name: taskName,
          completed: newCompleted
        }, { onConflict: 'user_id,date,task_name' });

      if (error) throw error;

      setTasks(prev => prev.map(t => t.task_name === taskName ? { ...t, completed: newCompleted } : t));
      
      if (newCompleted) {
        toast.success(`${taskName} completed!`, {
          icon: '🔥',
          style: { background: '#1a1a1a', color: '#cefc22', border: '1px solid #cefc22' }
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  if (!session) return <Auth />;
  if (!profile) return <div className="min-h-screen grit-gradient flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Toaster position="top-center" />
      
      <header className="fixed top-0 w-full z-50 h-20 bg-[#0e0e0e] shadow-2xl shadow-black/60">
        <div className="flex justify-between items-center px-6 w-full max-w-md mx-auto h-full">
          <button className="p-2 active:scale-95 duration-150 ease-in-out hover:bg-[#1a1a1a] transition-colors rounded-lg">
            <Menu className="w-6 h-6 text-primary-container" />
          </button>
          <h1 className="font-headline font-bold tracking-tighter text-3xl uppercase text-primary-container">DAY {profile.total_days || 1}</h1>
          <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden ring-2 ring-primary-container/20">
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-md mx-auto grit-gradient min-h-screen">
        <AnimatePresence mode="wait">
          {view === 'home' && <Home key="home" profile={profile} tasks={tasks} onToggleTask={toggleTask} />}
          {view === 'feed' && <Feed key="feed" />}
          {view === 'rank' && <Rank key="rank" />}
          {view === 'user' && <User key="user" profile={profile} onSignOut={handleSignOut} />}
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

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all active:scale-90 transform duration-200",
        active ? "text-primary-container bg-[#1a1a1a] ring-1 ring-primary-container/20" : "text-on-surface-variant hover:text-white"
      )}
    >
      <div className="mb-1">{icon}</div>
      <span className="font-body font-bold text-[10px] tracking-[0.1em] uppercase">{label}</span>
    </button>
  );
}
