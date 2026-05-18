import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Share2, Plus, ArrowRight, Heart, Trophy, Crown, Target, Calendar, Edit3, Settings, CheckCircle2, ChevronLeft, Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  addDoc,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  return errInfo;
}

interface User {
  id: string;
  name: string;
  points: number;
}

interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
}

interface Competition {
  id: string;
  circleId: string;
  name: string;
  startDate: string;
  endDate: string;
  creatorId: string;
  allowedHabits?: string[]; // New: Filter which habits count
}

interface CompetitionLeaderboardEntry {
  userId: string;
  userName: string;
  points: number;
}

interface FeedItem {
  id: string; // Document ID of the log
  userId: string;
  userName: string;
  habitId: string;
  timestamp: string;
  likes: string[]; // List of user IDs who liked
}

const HABIT_LABELS: Record<string, string> = {
  'morning': 'أذكار الصباح',
  'evening': 'أذكار المساء',
  'quran-wird': 'ورد القرآن',
  'duha': 'سنة الضحى',
  'fajr-q': 'سنة الفجر',
  'dhuhr-q': 'سنة الظهر (قبلية)',
  'dhuhr-b': 'سنة الظهر (بعدية)',
  'maghrib-b': 'سنة المغرب',
  'isha-b': 'سنة العشاء',
  'qiyam': 'صلاة القيام',
  'kahf': 'سورة الكهف',
};

export default function SocialCircle({ userId, userName, firebaseUser }: { userId: string, userName: string, firebaseUser: any }) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [members, setMembers] = useState<{id: string, name: string, points: number}[]>([]);
  const [viewMode, setViewMode] = useState<'feed' | 'leaderboard' | 'competitions'>('feed');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [compLeaderboard, setCompLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompDays, setNewCompDays] = useState('7');
  const [allowedHabits, setAllowedHabits] = useState<string[]>(Object.keys(HABIT_LABELS));
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [isEditingCircle, setIsEditingCircle] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  useEffect(() => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || userId;
    if (!effectiveUserId) return;

    const memberQuery = query(collection(db, 'circleMembers'), where('userId', '==', effectiveUserId));
    const unsubscribe = onSnapshot(memberQuery, { includeMetadataChanges: true }, async (memberSnapshot) => {
      const circleIds = memberSnapshot.docs.map(doc => doc.data().circleId);

      if (circleIds.length === 0) {
        setCircles([]);
        setSelectedCircle(null);
        return;
      }

      const circlePromises = circleIds.map(id => getDoc(doc(db, 'circles', id)));
      const circleDocs = await Promise.all(circlePromises);
      const circlesData = circleDocs
        .filter(d => d.exists())
        .map(d => ({ id: d.id, ...d.data() })) as Circle[];
      
      setCircles(circlesData);
      setSelectedCircle(current => {
        if (!current) return circlesData[0];
        const stillExists = circlesData.find(c => c.id === current.id);
        return stillExists ? stillExists : circlesData[0];
      });
    }, (err) => {
      console.error('Fetch circles failed', err);
    });

    return () => unsubscribe();
  }, [userId, firebaseUser]);

  useEffect(() => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || userId;
    if (!selectedCircle || !effectiveUserId) {
      setFeed([]);
      setMembers([]);
      return;
    }

    // Step 1: Listen to members of this circle
    const memberQuery = query(collection(db, 'circleMembers'), where('circleId', '==', selectedCircle.id));
    
    let unsubscribeLogs: (() => void) | null = null;

    const unsubscribeMembers = onSnapshot(memberQuery, async (memberSnapshot) => {
      const uids = memberSnapshot.docs
        .map(doc => doc.data().userId)
        .filter(id => id && typeof id === 'string') as string[];
        
      if (uids.length === 0) {
        setFeed([]);
        setMembers([]);
        return;
      }

      // Step 2: Get user names for these UIDs
      const validUids = uids.slice(0, 10); // Limit to 10 for 'in' query safety
      const userPromises = validUids.map(uid => getDoc(doc(db, 'users', uid)).catch(err => {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        return null;
      }));
      const userDocs = await Promise.all(userPromises);
      const userMap = userDocs.reduce((acc, d) => {
        if (d && d.exists()) acc[d.id] = d.data().name;
        return acc;
      }, {} as Record<string, string>);

      // Step 3: Listen to today's logs for these users
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      const logQuery = query(
        collection(db, 'habitLogs'),
        where('userId', 'in', validUids),
        where('date', '==', today),
        where('completed', '==', true)
      );

      // Clean up previous log listener if it exists
      if (unsubscribeLogs) unsubscribeLogs();

      unsubscribeLogs = onSnapshot(logQuery, { includeMetadataChanges: true }, (logSnapshot) => {
        const logData = logSnapshot.docs.map(d => d.data());
        setDailyLogs(logData);
        
        // Calculate points
        const memberData = validUids.map(uid => {
          const count = logData.filter(l => l.userId === uid).length;
          return {
            id: uid,
            name: userMap[uid] || 'مستخدم',
            points: count
          };
        }).sort((a, b) => b.points - a.points);
        
        setMembers(memberData);

        const feedItems: FeedItem[] = logSnapshot.docs.map(doc => {
          const data = doc.data();
          const logDate = data.timestamp?.toDate?.() || new Date();
          return {
            id: doc.id,
            userId: data.userId,
            userName: data.userName || userMap[data.userId] || 'مستخدم',
            habitId: data.habitId,
            likes: data.likes || [],
            timestamp: logDate.toISOString()
          };
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setFeed(feedItems);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'habitLogs');
        console.error('Feed logs snapshot failed', error);
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `circleMembers`);
      console.error('Member snapshot failed', err);
    });

    return () => {
      unsubscribeMembers();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [selectedCircle, firebaseUser]);

  useEffect(() => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || userId;
    if (selectedCircle && effectiveUserId) {
      // Setup real-time listener for competitions
      const compQuery = query(
        collection(db, 'competitions'), 
        where('circleId', '==', selectedCircle.id),
        orderBy('startDate', 'desc')
      );
      
      const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const comps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competition[];
        setCompetitions(comps);
      });

      return () => unsubscribe();
    }
  }, [selectedCircle, firebaseUser]);

  useEffect(() => {
    if (selectedCompetition && members.length > 0) {
      const fetchCompResults = async () => {
        const uids = members.map(m => m.id);
        const q = query(
          collection(db, 'habitLogs'),
          where('userId', 'in', uids.slice(0, 10)),
          where('date', '>=', selectedCompetition.startDate),
          where('date', '<=', selectedCompetition.endDate),
          where('completed', '==', true)
        );
        
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => d.data());
        
        const results = members.map(m => {
          let filteredLogs = logs.filter(l => l.userId === m.id);
          
          // Apply habit filter if defined
          if (selectedCompetition.allowedHabits && selectedCompetition.allowedHabits.length > 0) {
            filteredLogs = filteredLogs.filter(l => selectedCompetition.allowedHabits?.includes(l.habitId));
          }

          const count = filteredLogs.length;
          return {
            userId: m.id,
            userName: m.name,
            points: count
          };
        }).sort((a, b) => b.points - a.points);
        
        setCompLeaderboard(results);
      };

      fetchCompResults();
    }
  }, [selectedCompetition, members]);

  const handleLikeLog = async (item: FeedItem) => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid;
    if (!effectiveUserId) return;

    try {
      const isLiked = item.likes.includes(effectiveUserId);
      const logRef = doc(db, 'habitLogs', item.id);
      
      await setDoc(logRef, {
        likes: isLiked 
          ? arrayRemove(effectiveUserId) 
          : arrayUnion(effectiveUserId)
      }, { merge: true });
    } catch (err) {
      console.error('Like failed', err);
    }
  };

  const createCircle = async () => {
    if (!newCircleName.trim()) return;
    setLoading(true);
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const circleRef = doc(collection(db, 'circles'));
      const circleData = {
        id: circleRef.id,
        name: newCircleName,
        inviteCode,
        ownerId: userId
      };
      
      await setDoc(circleRef, circleData);
      
      // Add self as member
      await setDoc(doc(db, 'circleMembers', `${circleRef.id}-${userId}`), {
        circleId: circleRef.id,
        userId: userId,
        joinedAt: serverTimestamp()
      });

      setCircles([...circles, circleData]);
      setSelectedCircle(circleData);
      setShowCreate(false);
      setNewCircleName('');
    } catch (err) {
      console.error('Create circle failed', err);
    } finally {
      setLoading(false);
    }
  };

  const joinCircle = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'circles'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('كود الدعوة غير صحيح');
        return;
      }

      const circle = { id: snap.docs[0].id, ...snap.docs[0].data() } as Circle;
      
      // Add as member
      await setDoc(doc(db, 'circleMembers', `${circle.id}-${userId}`), {
        circleId: circle.id,
        userId: userId,
        joinedAt: serverTimestamp()
      });

      setCircles([...circles, circle]);
      setSelectedCircle(circle);
      setShowJoin(false);
      setInviteCode('');
      setError(null);
    } catch (err) {
      console.error('Join failed', err);
      setError('حدث خطأ أثناء الانضمام');
    } finally {
      setLoading(false);
    }
  };

  const leaveCircle = async () => {
    if (!selectedCircle) return;
    if (!window.confirm('هل أنت متأكد من مغادرة هذه الدائرة؟')) return;
    
    setLoading(true);
    try {
      const memberDocId = `${selectedCircle.id}-${userId}`;
      await deleteDoc(doc(db, 'circleMembers', memberDocId));
      
      // Update local state
      const remainingCircles = circles.filter(c => c.id !== selectedCircle.id);
      setCircles(remainingCircles);
      setSelectedCircle(remainingCircles.length > 0 ? remainingCircles[0] : null);
      
      // Close any active listeners or clean up if needed
      setError('تم مغادرة الدائرة بنجاح');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Leave failed', err);
      setError('فشل في مغادرة الدائرة');
    } finally {
      setLoading(false);
    }
  };

  const updateCircleName = async () => {
    if (!selectedCircle || !editingName.trim()) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'circles', selectedCircle.id), { 
        name: editingName.trim() 
      }, { merge: true });
      
      setSelectedCircle({ ...selectedCircle, name: editingName.trim() });
      setCircles(circles.map(c => c.id === selectedCircle.id ? { ...c, name: editingName.trim() } : c));
      setIsEditingCircle(false);
      setError('تم تحديث الاسم بنجاح');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Rename failed', err);
      setError('فشل في تحديث الاسم');
    } finally {
      setLoading(false);
    }
  };

  const createCompetition = async () => {
    if (!selectedCircle || !newCompName.trim()) return;
    setLoading(true);
    try {
      const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + parseInt(newCompDays));
      
      const compRef = doc(collection(db, 'competitions'));
      await setDoc(compRef, {
        circleId: selectedCircle.id,
        name: newCompName,
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(end),
        creatorId: userId,
        allowedHabits: allowedHabits
      });
      
      setNewCompName('');
      setAllowedHabits(Object.keys(HABIT_LABELS));
      setShowCreateComp(false);
    } catch (err) {
      console.error('Create comp failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Circle Selection */}
        <div key="circle-selection-header" className="flex items-center space-x-2 space-x-reverse overflow-x-auto pb-2 scrollbar-none">
            {circles.map((c, idx) => (
              <button
                key={`${c.id}-${idx}`}
                onClick={() => setSelectedCircle(c)}
                className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all ${
                  selectedCircle?.id === c.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none' 
                    : 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          <button 
            key="join-circle-btn"
            onClick={() => setShowJoin(true)}
            className="p-2 rounded-2xl bg-white dark:bg-slate-800 text-emerald-600 border border-dashed border-emerald-200 dark:border-slate-700"
          >
            <UserPlus size={20} />
          </button>
          <button 
            key="create-circle-btn"
            onClick={() => setShowCreate(true)}
            className="p-2 rounded-2xl bg-white dark:bg-slate-800 text-emerald-600 border border-dashed border-emerald-200 dark:border-slate-700"
          >
            <Plus size={20} />
          </button>
        </div>

        {selectedCircle ? (
          <div key="selected-circle-view" className="space-y-6">
            
            {/* Global Alert Notification */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed top-24 left-6 right-6 z-50 pointer-events-none flex justify-center"
                >
                  <div className="bg-emerald-600 dark:bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 space-x-reverse pointer-events-auto border border-emerald-400/30">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-bold">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          {/* Active Circle Info */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl space-y-4 border border-emerald-200 dark:border-emerald-800/30 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-1">
                {isEditingCircle ? (
                  <div className="flex items-center space-x-2 space-x-reverse mb-2">
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={(e) => setEditingName(e.target.value)}
                      className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-slate-700 text-sm font-bold w-full"
                      autoFocus
                    />
                    <button 
                      onClick={updateCircleName}
                      disabled={loading}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                    >
                      حفظ
                    </button>
                    <button 
                      onClick={() => setIsEditingCircle(false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100">{selectedCircle.name}</h3>
                    {(selectedCircle.ownerId === userId || selectedCircle.ownerId === firebaseUser?.uid) && (
                      <button 
                        onClick={() => {
                          setEditingName(selectedCircle.name);
                          setIsEditingCircle(true);
                        }}
                        className="p-1 px-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 transition-all flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span className="text-[10px] font-black">تعديل الاسم</span>
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center space-x-1 space-x-reverse">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">كود الدعوة:</span>
                  <span className="text-[10px] font-mono font-bold select-all bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-100 dark:border-slate-700">{selectedCircle.inviteCode}</span>
                </div>
              </div>
              <div className="flex space-x-2 space-x-reverse">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCircle.inviteCode);
                    setError('تم نسخ الكود!');
                    setTimeout(() => setError(null), 2000);
                  }}
                  className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-emerald-600 shadow-sm hover:bg-emerald-50 transition-colors"
                >
                  <Share2 size={18} />
                </button>
                <button 
                  onClick={leaveCircle}
                  className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-500 shadow-sm hover:bg-rose-100 transition-colors"
                  title="مغادرة الدائرة"
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
              </div>
            </div>

            {/* Sub-tabs: Feed vs Leaderboard */}
            <div className="flex bg-white/50 dark:bg-slate-900/40 p-1 rounded-2xl border border-emerald-100 dark:border-slate-800">
              <button 
                onClick={() => setViewMode('feed')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'feed' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-emerald-800 dark:text-emerald-400'
                }`}
              >
                آخر النشاطات
              </button>
              <button 
                onClick={() => setViewMode('leaderboard')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'leaderboard' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-emerald-800 dark:text-emerald-400'
                }`}
              >
                المتصدرون
              </button>
              <button 
                onClick={() => setViewMode('competitions')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'competitions' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-emerald-800 dark:text-emerald-400'
                }`}
              >
                المسابقات
              </button>
            </div>
          </div>

          {viewMode === 'feed' ? (
          <div key="activity-feed-container" className="space-y-4">
            <div className="flex justify-between items-center mb-2 px-2">
              <h4 className="font-bold text-lg text-emerald-950 dark:text-emerald-50 flex items-center gap-2">
                <Target size={20} className="text-emerald-600" />
                نشاط اليوم
              </h4>
              <div className="flex -space-x-2 space-x-reverse">
                {members.slice(0, 5).map((m, i) => (
                  <div key={m.id} className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white dark:bg-slate-700 dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
                    {m.name.charAt(0)}
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +{members.length - 5}
                  </div>
                )}
              </div>
            </div>
            {feed.length === 0 ? (
              <div key="feed-empty" className="text-center py-20 bg-white/50 dark:bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Users className="text-emerald-300 dark:text-emerald-700" size={40} />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-base font-bold">لا يوجد نـور في المجلس بعد..</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">كن أنت الفاتح وابدأ حصاد الحسنات!</p>
              </div>
            ) : (
              <div key="feed-items" className="space-y-5">
                <AnimatePresence mode="popLayout">
                  {feed.map((item, idx) => (
                    <motion.div
                      key={`feed-${item.userId}-${item.habitId}-${item.timestamp}-${idx}`}
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      whileHover={{ scale: 1.01 }}
                      className="group relative bg-white dark:bg-slate-800 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all"
                    >
                      {/* Decorative gradient corner */}
                      <div className="absolute top-0 left-0 w-24 h-24 bg-linear-to-br from-emerald-50/50 dark:from-emerald-900/10 to-transparent rounded-tl-[2.5rem] -z-0 pointer-events-none" />
                      
                      <div className="relative flex items-center space-x-4 space-x-reverse">
                        <div className="w-14 h-14 rounded-3xl bg-linear-to-br from-emerald-100/50 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-xl shadow-inner border border-white dark:border-slate-700">
                          {item.userName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-slate-100 text-sm truncate">{item.userName}</span>
                            <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          </div>
                          
                          <div className="flex items-center space-x-2 space-x-reverse mt-1.5">
                            <div className="p-1 px-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
                              <p className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                                {HABIT_LABELS[item.habitId] || item.habitId}
                              </p>
                            </div>
                            <span className="text-slate-400 dark:text-slate-600 text-[10px] font-bold">أتمَّ بفضل الله</span>
                          </div>
                          
                          <div className="flex items-center space-x-1.5 space-x-reverse mt-2 text-slate-400 dark:text-slate-500">
                            <Clock size={10} />
                            <p className="text-[9px] font-bold">
                              {new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(item.timestamp))}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                          <motion.button 
                            whileTap={{ scale: 0.7 }}
                            onClick={() => handleLikeLog(item)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
                              item.likes.includes(firebaseUser?.uid || auth.currentUser?.uid || '')
                                ? 'bg-rose-500 text-white shadow-rose-200'
                                : 'bg-rose-50 dark:bg-rose-900/10 text-rose-300 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/20'
                            }`}
                          >
                            <Heart size={20} className={item.likes.includes(firebaseUser?.uid || auth.currentUser?.uid || '') ? 'fill-white' : 'transition-colors'} />
                          </motion.button>
                          <span className={`text-[9px] font-black ${item.likes.length > 0 ? 'text-rose-500' : 'text-rose-300'}`}>
                            {item.likes.length > 0 ? `${item.likes.length} إعجاب` : 'نال إعجاباً'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          ) : viewMode === 'leaderboard' ? (
            /* Leaderboard View */
            <div key="leaderboard-container" className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-bold text-lg">ترتيب اليوم</h4>
                <Crown size={20} className="text-amber-500" />
              </div>
              
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                {members.length === 0 ? (
                   <div className="py-12 text-center text-slate-400 text-sm">لا يوجد أعضاء في هذه الدائرة</div>
                ) : (
                  members.map((member, idx) => {
                    const memberLogs = dailyLogs.filter(l => l.userId === member.id);
                    const isExpanded = expandedMember === member.id;
                    
                    return (
                      <div key={member.id} className="flex flex-col">
                        <div 
                          onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                          className={`flex items-center p-5 space-x-4 space-x-reverse cursor-pointer transition-colors ${member.id === userId ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'}`}
                        >
                          <div className="w-8 flex justify-center font-black text-slate-300 dark:text-slate-700 italic text-xl">
                            {idx + 1}
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black relative shadow-sm">
                            {member.name.charAt(0)}
                            {idx === 0 && <Crown size={14} className="absolute -top-2 -right-2 text-amber-500 fill-amber-500 drop-shadow-sm" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-emerald-900 dark:text-emerald-100">{member.name} {member.id === userId && <span className="text-[10px] text-emerald-500">(أنت)</span>}</p>
                            <div className="flex items-center space-x-1 space-x-reverse">
                               <Trophy size={10} className="text-amber-500" />
                               <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">أتم {member.points} عبادات اليوم</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                             <div className="flex items-center space-x-1 space-x-reverse">
                              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{member.points * 10}</span>
                              <ChevronLeft size={16} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : '-rotate-90'}`} />
                             </div>
                             <span className="text-[8px] uppercase font-bold tracking-tighter text-slate-400">نقطة</span>
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-slate-50/50 dark:bg-slate-900/20 px-12 pb-5"
                            >
                              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                <p className="text-[10px] font-black text-slate-400 mb-3 flex items-center gap-2">
                                  <Calendar size={12} />
                                  حصاد اليوم:
                                </p>
                                {memberLogs.length === 0 ? (
                                  <p className="text-[10px] text-slate-400 italic font-bold">لم يسجل أي عبادات اليوم بعد</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {memberLogs.map(log => (
                                      <div key={log.habitId} className="flex items-center space-x-1.5 space-x-reverse bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-95">
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{HABIT_LABELS[log.habitId] || log.habitId}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                 <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed text-center italic">
                   "وفِي ذَلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ" - سورة المطففين
                 </p>
              </div>
            </div>
          ) : (
            /* Competitions View */
            <div key="competitions-container" className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-bold text-lg">المسابقات</h4>
                <button 
                  onClick={() => setShowCreateComp(true)}
                  className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-105 transition-transform flex items-center space-x-1 space-x-reverse"
                >
                  <Plus size={18} />
                  <span className="text-[10px] font-bold">مسابقة جديدة</span>
                </button>
              </div>

              {selectedCompetition ? (
                <div key="competition-details" className="space-y-4">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setSelectedCompetition(null)} className="text-slate-400 hover:text-emerald-500 transition-colors">
                        <ArrowRight size={20} className="rotate-0" />
                      </button>
                      <h5 className="font-bold text-emerald-900 dark:text-emerald-100">{selectedCompetition.name}</h5>
                      <div className="w-8" /> {/* Spacer */}
                    </div>
                    
                    <div className="flex justify-center space-x-8 space-x-reverse mb-8">
                       <div className="text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">البداية</p>
                          <p className="font-bold text-emerald-600">{selectedCompetition.startDate}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">النهاية</p>
                          <p className="font-bold text-emerald-600">{selectedCompetition.endDate}</p>
                       </div>
                    </div>

                    {selectedCompetition.allowedHabits && selectedCompetition.allowedHabits.length > 0 && (
                      <div className="mb-6 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">العبادات المحتسبة:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCompetition.allowedHabits.map(hId => (
                            <span key={hId} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-lg font-bold">
                              {HABIT_LABELS[hId] || hId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {compLeaderboard.map((entry, idx) => (
                        <div key={entry.userId} className="flex items-center p-3 border-b border-slate-50 dark:border-slate-700/50">
                          <span className={`w-6 font-black text-xs ${idx < 3 ? 'text-amber-500' : 'text-slate-300'}`}>{idx + 1}</span>
                          <span className="flex-1 font-bold text-sm">{entry.userName}</span>
                          <span className="font-black text-emerald-600">{entry.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div key="competitions-list" className="space-y-3">
                  {competitions.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                      <Target className="mx-auto text-slate-200 dark:text-slate-900/20 mb-4" size={48} />
                      <p className="text-slate-400 text-sm italic">لا توجد مسابقات نشطة حالياً</p>
                    </div>
                  ) : (
                    competitions.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedCompetition(comp)}
                        className="w-full bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors"
                      >
                        <div className="flex items-center space-x-4 space-x-reverse text-right">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                            <Trophy size={24} />
                          </div>
                          <div>
                            <h5 className="font-bold text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-600 transition-colors">{comp.name}</h5>
                            <p className="text-[10px] text-slate-400 font-medium">ينتهي في {comp.endDate}</p>
                          </div>
                        </div>
                        <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-all rotate-180" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        ) : (
          <div key="empty-circle-view" className="text-center py-20 bg-white dark:bg-slate-800 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-700">
           <Users className="mx-auto text-emerald-100 dark:text-emerald-900/20 mb-6" size={80} />
           <h3 className="text-xl font-bold mb-2">تابع عبادات أحبائك</h3>
           <p className="text-gray-400 text-sm px-8 leading-relaxed mb-8">
             أنشئ دائرة جديدة وادعُ عائلتك وأصدقائك لنشجع بعضنا البعض على ذكر الله وطاعته
           </p>
           <div className="flex justify-center space-x-4 space-x-reverse">
             <button 
              onClick={() => setShowCreate(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center space-x-2 space-x-reverse shadow-lg shadow-emerald-200 dark:shadow-none"
             >
               <Plus size={20} />
               <span>إنشاء دائرة</span>
             </button>
             <button 
              onClick={() => setShowJoin(true)}
              className="bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-slate-600 px-6 py-3 rounded-2xl font-bold"
             >
               انضم لآخرين
             </button>
           </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence key="modals-presence">
        {(showCreate || showJoin || showCreateComp) && (
          <div key="modal-portal" className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-24">
            <motion.div 
              key="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCreate(false); setShowJoin(false); setShowCreateComp(false); setError(null); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              key="modal-content"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl space-y-6"
            >
              <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 text-center">
                {showCreate ? 'دائرة جديدة' : showJoin ? 'انضم لدائرة' : 'مسابقة جديدة'}
              </h3>
              
              <div className="space-y-4">
                {showCreateComp ? (
                  <>
                    <div className="space-y-4 text-right">
                      <label className="text-xs font-bold text-slate-400 px-1">اسم المسابقة</label>
                      <input 
                        type="text" 
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        placeholder="تحدي العشر الأوائل"
                        className="w-full bg-emerald-50 dark:bg-slate-900 px-6 py-4 rounded-2xl outline-none border-2 border-transparent focus:border-emerald-200 dark:focus:border-emerald-800 font-bold text-center"
                      />
                      <label className="text-xs font-bold text-slate-400 px-1 mt-4 block">المدة (أيام)</label>
                      <select 
                        value={newCompDays}
                        onChange={(e) => setNewCompDays(e.target.value)}
                        className="w-full bg-emerald-50 dark:bg-slate-900 px-6 py-4 rounded-2xl outline-none border-2 border-transparent focus:border-emerald-200 dark:focus:border-emerald-800 font-bold text-center appearance-none"
                      >
                        <option value="3">3 أيام</option>
                        <option value="7">أسبوع</option>
                        <option value="15">15 يوم</option>
                        <option value="30">شهر</option>
                      </select>

                      <label className="text-xs font-bold text-slate-400 px-1 mt-4 block">اختر العبادات المحتسبة</label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                        {Object.entries(HABIT_LABELS).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => {
                              setAllowedHabits(prev => 
                                prev.includes(id) 
                                  ? prev.filter(item => item !== id) 
                                  : [...prev, id]
                              )
                            }}
                            className={`p-2 text-[10px] rounded-xl font-bold transition-all border ${
                              allowedHabits.includes(id)
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <input 
                    type="text" 
                    value={showCreate ? newCircleName : inviteCode}
                    onChange={(e) => showCreate ? setNewCircleName(e.target.value) : setInviteCode(e.target.value)}
                    placeholder={showCreate ? "اسم الدائرة (مثلاً: العائلة)" : "أدخل كود الدعوة"}
                    className="w-full bg-emerald-50 dark:bg-slate-900 px-6 py-4 rounded-2xl outline-none border-2 border-transparent focus:border-emerald-200 dark:focus:border-emerald-800 font-bold text-center uppercase"
                  />
                )}
                
                {error && (
                  <p className="text-center text-rose-500 text-xs font-bold animate-pulse">
                    {error}
                  </p>
                )}
                
                <button 
                  onClick={showCreate ? createCircle : showJoin ? joinCircle : createCompetition}
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-200 dark:shadow-none flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{showCreate ? 'تأكيد الإنشاء' : showJoin ? 'انضمام الآن' : 'بدء المسابقة'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
