import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SocialCircle from './components/SocialCircle';
import { db, auth } from './lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Sun, 
  Moon, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  Heart, 
  Compass,
  Star,
  Settings,
  Calendar,
  X,
  ChevronRight,
  RotateCcw,
  Bell,
  BellRing,
  Plus,
  Trash2,
  ChevronDown,
  Users,
  Trophy,
  Crown,
  TrendingUp,
  BarChart3,
  Info,
  Music,
  Volume2
} from 'lucide-react';

interface Habit {
  id: string;
  title: string;
  category: 'adhkar' | 'sunnah' | 'quran';
  completed: boolean;
  count?: number;
  target?: number;
  subType?: 'qabliyah' | 'badiyah' | 'main';
  prayerGroup?: 'fajr' | 'dhuhr' | 'maghrib' | 'isha' | 'duha' | 'other';
}

interface Reminder {
  id: string;
  title: string;
  time: string;
  enabled: boolean;
  recurrence: 'daily' | 'weekly' | 'weekdays' | 'custom';
  habitId?: string;
  customDays?: number[]; // [0-6] where 0 is Sunday
}

interface UserDua {
  id: string;
  content: string;
  createdAt: string;
}

const MORNING_ADHKAR = [
  { id: 'm-ayalkursi', text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ، اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ', repeat: 1, title: 'آية الكرسي' },
  { id: 'm-ikhlas', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ ، اللَّهُ الصَّمَدُ ، لَمْ يَلِدْ وَلَمْ يُولَدْ ، وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ', repeat: 3, title: 'سورة الإخلاص' },
  { id: 'm-falaq', text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ، مِنْ شَرِّ مَا خَلَقَ ، وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ، وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ، وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ', repeat: 3, title: 'سورة الفلق' },
  { id: 'm-nas', text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ، مَلِكِ النَّاسِ ، إِلَهِ النَّاسِ ، مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ، الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ، مِنَ الْجِنَّةِ وَالنَّاسِ', repeat: 3, title: 'سورة الناس' },
  { id: 'm1', text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ', repeat: 1 },
  { id: 'm-sayyid', text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ', repeat: 1, title: 'سيد الاستغفار' },
  { id: 'm-raditu', text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا', repeat: 3 },
  { id: 'm-ushiduka', text: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ وَمَلَائِكَتَكَ وَجَمِيعَ خَلْقِكَ أَنَّكَ أنت اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ', repeat: 4, description: 'من قالها أعتقه الله من النار' },
  { id: 'm-nimah', text: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شريك لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ', repeat: 1, description: 'من قالها فقد أدى شكر يومه' },
  { id: 'm-hasbi', text: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', repeat: 7, description: 'من قالها كفاه الله ما أهمه' },
  { id: 'm-bismillah', text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', repeat: 3 },
  { id: 'm-bika-asbahna', text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', repeat: 1 },
  { id: 'm-fitra', text: 'أَصْبَـحْـنا عَلَى فِطْرَةِ الإسْلاَمِ، وَعَلَى كَلِمَةِ الإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ المُشْرِكِينَ.', repeat: 1 },
  { id: 'm-subhanallah-adada', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ', repeat: 3 },
  { id: 'm-afini-badani', text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ.', repeat: 3 },
  { id: 'm-audhu-kufr', text: 'اللّهُـمَّ إِنّـي أَعـوذُ بِكَ مِنَ الْكُـفر ، وَالفَـقْر ، وَأَعـوذُ بِكَ مِنْ عَذابِ القَـبْر ، لا إلهَ إلاّ أَنْـتَ.', repeat: 3 },
  { id: 'm-afwa', text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي', repeat: 1 },
  { id: 'm-hayyu', text: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ', repeat: 3 },
  { id: 'm-asbahna-mulk-long', text: 'أَصْبَـحْـنا وَأَصْبَـحْ المُـلكُ للهِ رَبِّ العـالَمـين ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ خَـيْرَ هـذا الـيَوْم ، فَـتْحَهُ ، وَنَصْـرَهُ ، وَنـورَهُ وَبَـرَكَتَـهُ ، وَهُـداهُ ، وَأَعـوذُ بِـكَ مِـنْ شَـرِّ ما فـيهِ وَشَـرِّ ما بَعْـدَه.', repeat: 1 },
  { id: 'm-alim', text: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ', repeat: 1 },
  { id: 'm-audhu-kalimat', text: 'اَعـوذُ بِكَلِمـاتِ اللّهِ التّـامّـاتِ مِنْ شَـرِّ ما خَلَـق', repeat: 3 },
  { id: 'm-salli', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', repeat: 10 },
  { id: 'm-nushrika', text: 'اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنْ أَنْ نُشْرِكَ بِكَ شَيْئًا نَعْلَمُهُ ، وَنَسْتَغْفِرُكَ لِمَا لَا نَعْلَمُهُ', repeat: 3 },
  { id: 'm-hamm', text: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنْ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنْ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ، وَقَهْرِ الرِّجَالِ.', repeat: 3 },
  { id: 'm-astaghfirullah', text: 'أسْتَغْفِرُ اللهَ العَظِيمَ الَّذِي لاَ إلَهَ إلاَّ هُوَ، الحَيُّ القَيُّومُ، وَأتُوبُ إلَيهِ.', repeat: 3 },
  { id: 'm-rab-alkhamd', text: 'يَا رَبِّ , لَكَ الْحَمْدُ كَمَا يَنْبَغِي لِجَلَالِ وَجْهِكَ , وَلِعَظِيمِ سُلْطَانِكَ.', repeat: 3 },
  { id: 'm-anta-rabbi', text: 'اللَّهُمَّ أَنْتَ رَبِّي لا إِلَهَ إِلا أَنْتَ ، عَلَيْكَ تَوَكَّلْتُ ، وَأَنْتَ رَبُّ الْعَرْشِ الْعَظِيمِ , مَا شَاءَ اللَّهُ كَانَ ، وَمَا لَمْ يَشَأْ لَمْ يَكُنْ ، وَلا حَوْلَ وَلا قُوَّةَ إِلا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ , أَعْلَمُ أَنَّ اللَّهَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ ، وَأَنَّ اللَّهَ قَدْ أَحَاطَ بِكُلِّ شَيْءٍ عِلْمًا , اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي ، وَمِنْ شَرِّ كُلِّ دَابَّةٍ أَنْتَ آخِذٌ بِنَاصِيَتِهَا ، إِنَّ رَبِّي عَلَى صِرَاطٍ مُسْتَقِيمٍ.', repeat: 1 },
  { id: 'm-lailaha-illallah', text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', repeat: 10, description: 'كانت له عدل عشر رقاب، وكُتبت له مائة حسنة' },
  { id: 'm-subhanallah-wa-bihamdihi-100', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', repeat: 100, description: 'من قالها مائة مرة حُطَّت خطاياه وإن كانت مثل زبد البحر' },
];

const EVENING_ADHKAR = [
  { id: 'e-ayalkursi', text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ، اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ', repeat: 1, title: 'آية الكرسي' },
  { id: 'e-baqarah', text: 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنا وَإِلَيْكَ الْمَصِيرُ ﴿٢٨٥﴾ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ ﴿٢٨٦﴾', repeat: 1, title: 'آخر آيتين من سورة البقرة' },
  { id: 'e-ikhlas', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ ، اللَّهُ الصَّمَدُ ، لَمْ يَلِدْ وَلَمْ يُولَدْ ، وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ', repeat: 3, title: 'سورة الإخلاص' },
  { id: 'e-falaq', text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ، مِنْ شَرِّ مَا خَلَقَ ، وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ، وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ، وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ', repeat: 3, title: 'سورة الفلق' },
  { id: 'e-nas', text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ، مَلِكِ النَّاسِ ، إِلَهِ النَّاسِ ، مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ، الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ، مِنَ الْجِنَّةِ وَالنَّاسِ', repeat: 3, title: 'سورة الناس' },
  { id: 'e1', text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ', repeat: 1 },
  { id: 'e-sayyid', text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلقتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ', repeat: 1, title: 'سيد الاستغفار' },
  { id: 'e-raditu', text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا', repeat: 3 },
  { id: 'e-ushiduka', text: 'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ وَمَلَائِكَتَكَ وَجَمِيعَ خَلْقِكَ أَنَّكَ أنت اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ', repeat: 4, description: 'من قالها أعتقه الله من النار' },
  { id: 'e-nimah', text: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شريك لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ', repeat: 1, description: 'من قالها فقد أدى شكر ليلته' },
  { id: 'e-hasbi', text: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', repeat: 7, description: 'من قالها كفاه الله ما أهمه' },
  { id: 'e-bismillah', text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', repeat: 3 },
  { id: 'e-amsayna-bika', text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', repeat: 1 },
  { id: 'e-fitra', text: 'أَمْسَيْنَا عَلَى فِطْرَةِ الإسْلاَمِ، وَعَلَى كَلِمَةِ الإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ المُشْرِكِينَ.', repeat: 1 },
  { id: 'e-subhanallah-adada', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ', repeat: 3 },
  { id: 'e-afini-badani', text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ.', repeat: 3 },
  { id: 'e-audhu-kufr', text: 'اللّهُـمَّ إِنّـي أَعـوذُ بِكَ مِنَ الْكُـفر ، وَالفَـقْر ، وَأَعـوذُ بِكَ مِنْ عَذابِ القَـبْر ، لا إلهَ إلاّ أَنْـتَ.', repeat: 3 },
  { id: 'e-afwa', text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي', repeat: 1 },
  { id: 'e-hayyu', text: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ', repeat: 3 },
  { id: 'e-amsayna-mulk-long', text: 'أَمْسَيْنا وَأَمْسَى الْمُلْكُ للهِ رَبِّ الْعَالَمَيْنِ، اللَّهُمَّ إِنَّي أسْأَلُكَ خَيْرَ هَذَه اللَّيْلَةِ فَتْحَهَا ونَصْرَهَا، ونُوْرَهَا وبَرَكَتهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فيهِا وَشَرَّ مَا بَعْدَهَا.', repeat: 1 },
  { id: 'e-alim', text: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ', repeat: 1 },
  { id: 'e-audhu-kalimat', text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', repeat: 3 },
  { id: 'e-salli', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', repeat: 10 },
  { id: 'e-nushrika', text: 'اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنْ أَنْ نُشْرِكَ بِكَ شَيْئًا نَعْلَمُهُ ، وَنَسْتَغْفِرُكَ لِمَا لَا نَعْلَمُهُ.', repeat: 3 },
  { id: 'e-hamm', text: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنْ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنْ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ، وَقَهْرِ الرِّجَالِ.', repeat: 3 },
  { id: 'e-astaghfirullah', text: 'أسْتَغْفِرُ اللهَ العَظِيمَ الَّذِي لاَ إلَهَ إلاَّ هُوَ، الحَيُّ القَيُّومُ، وَأتُوبُ إلَيهِ.', repeat: 3 },
  { id: 'e-rab-alkhamd', text: 'يَا رَبِّ , لَكَ الْحَمْدُ كَمَا يَنْبَغِي لِجَلَالِ وَجْهِكَ , وَلِعَظِيمِ سُلْطَانِكَ.', repeat: 3 },
  { id: 'e-anta-rabbi', text: 'اللَّهُمَّ أَنْتَ رَبِّي لا إِلَهَ إِلا أَنْتَ ، عَلَيْكَ تَوَكَّلْتُ ، وَأَنْتَ رَبُّ الْعَرْشِ الْعَظِيمِ , مَا شَاءَ اللَّهُ كَانَ ، وَمَا لَمْ يَشَأْ لَمْ يَكُنْ ، وَلا حَوْلَ وَلا قُوَّةَ إِلا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ , أَعْلَمُ أَنَّ اللَّهَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ ، وَأَنَّ اللَّهَ قَدْ أَحَاطَ بِكُلِّ شَيْءٍ عِلْمًا , اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي ، وَمِنْ شَرِّ كُلِّ دَابَّةٍ أَنْتَ آخِذٌ بِنَاصِيَتِهَا ، إِنَّ رَبِّي عَلَى صِرَاطٍ مُسْتَقِيمٍ.', repeat: 1 },
  { id: 'e-lailaha-illallah', text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', repeat: 10 },
  { id: 'e-subhanallah-wa-bihamdihi-100', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', repeat: 100, description: 'من قالها مائة مرة حُطَّت خطاياه وإن كانت مثل زبد البحر' },
];

import { 
  Coordinates, 
  CalculationMethod, 
  PrayerTimes, 
  SunnahTimes, 
  Prayer,
  Qibla
} from 'adhan';

// Helper to get local YYYY-MM-DD
const getLocalDateString = (date: Date = new Date()) => {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '2026-05-16'; // Fallback to safe date from metadata
  }
};

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

const INITIAL_HABITS: Habit[] = [
  { id: 'morning', title: 'أذكار الصباح', category: 'adhkar', completed: false },
  { id: 'evening', title: 'أذكار المساء', category: 'adhkar', completed: false },
  { id: 'duha', title: 'سنة الضحى', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'duha' },
  { id: 'fajr-q', title: 'سنة الفجر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'fajr' },
  { id: 'dhuhr-q', title: 'سنة الظهر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'dhuhr' },
  { id: 'dhuhr-b', title: 'سنة الظهر (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'dhuhr' },
  { id: 'maghrib-b', title: 'سنة المغرب (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'maghrib' },
  { id: 'isha-b', title: 'سنة العشاء (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'isha' },
  { id: 'qiyam', title: 'صلاة القيام', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'other' },
  { id: 'kahf', title: 'سورة الكهف', category: 'quran', completed: false },
  { id: 'quran-wird', title: 'ورد القرآن الكريم', category: 'quran', completed: false, count: 0, target: 4 },
];

export default function App() {
  const [adhkarFontSize, setAdhkarFontSize] = useState(() => {
    return parseInt(localStorage.getItem('adhkar_font_size') || '20');
  });
  const [appFontSize, setAppFontSize] = useState(() => {
    return localStorage.getItem('app_font_size') || 'medium';
  });

  useEffect(() => {
    localStorage.setItem('adhkar_font_size', adhkarFontSize.toString());
  }, [adhkarFontSize]);

  useEffect(() => {
    localStorage.setItem('app_font_size', appFontSize);
  }, [appFontSize]);

  const appFontSizeClass = {
    small: 'text-[12px]',
    medium: 'text-[14px]',
    large: 'text-[16px]'
  }[appFontSize as 'small' | 'medium' | 'large'] || 'text-[14px]';

  const [user, setUser] = useState<{ id: string, name: string } | null>(() => {
    try {
      const saved = localStorage.getItem('zad_user');
      return saved ? JSON.parse(saved) : { id: 'guest_user', name: 'ضيف' };
    } catch (e) {
      return { id: 'guest_user', name: 'ضيف' };
    }
  });

  const [showInfo, setShowInfo] = useState(false);
  const [customSounds, setCustomSounds] = useState<Record<string, string>>({}); // Mapping habit/reminder ID to ObjectURL

  // IndexedDB logic for storing custom sounds
  const saveSoundToIndexedDB = async (id: string, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('zad_sounds', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sounds')) {
          db.createObjectStore('sounds');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sounds', 'readwrite');
        const store = tx.objectStore('sounds');
        store.put(file, id);
        tx.oncomplete = () => {
          // Update state with object URL
          const url = URL.createObjectURL(file);
          setCustomSounds(prev => ({ ...prev, [id]: url }));
          resolve();
        };
      };
      request.onerror = () => reject(request.error);
    });
  };

  const loadSoundsFromIndexedDB = () => {
    const request = indexedDB.open('zad_sounds', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sounds')) {
        db.createObjectStore('sounds');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('sounds', 'readonly');
      const store = tx.objectStore('sounds');
      const getAllRequest = store.openCursor();
      getAllRequest.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          const id = cursor.key as string;
          const blob = cursor.value as Blob;
          const url = URL.createObjectURL(blob);
          setCustomSounds(prev => ({ ...prev, [id]: url }));
          cursor.continue();
        }
      };
    };
  };

  useEffect(() => {
    loadSoundsFromIndexedDB();
  }, []);

  const [activeTab, setActiveTab] = useState('today');
  const [todayDate, setTodayDate] = useState(() => getLocalDateString());
  const isLoadingDay = useRef(false);

  // Force sync date on mount
  useEffect(() => {
    const current = getLocalDateString();
    if (current !== todayDate) {
      setTodayDate(current);
    }
  }, []);

  // Update date if day changes while app is open
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getLocalDateString();
      if (current !== todayDate) {
        setTodayDate(current);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [todayDate]);

  const [habits, setHabits] = useState<Habit[]>(() => {
    const today = getLocalDateString();
    try {
      const saved = localStorage.getItem('zad_daily_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === today && parsed.habits) {
          // Merge saved habits with defaults to ensure new habits (like Qiyam) appear
          const savedHabits = parsed.habits as Habit[];
          const mergedHabits = INITIAL_HABITS.map(defHabit => {
            const savedHabit = savedHabits.find(h => h.id === defHabit.id);
            return savedHabit ? { ...defHabit, ...savedHabit } : defHabit;
          });
          return mergedHabits;
        }
      }
    } catch (e) {
      console.error('Failed to init habits', e);
    }
    return INITIAL_HABITS;
  });

  const [adhkarProgress, setAdhkarProgress] = useState<Record<string, number>>(() => {
    const today = getLocalDateString();
    try {
      const saved = localStorage.getItem('zad_daily_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          return parsed.adhkarProgress || {};
        }
      }
    } catch (e) {}
    return {};
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('zad_daily_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.reminders) return parsed.reminders;
      }
    } catch (e) {}
    return [
      { id: 'r1', title: 'أذكار الصباح', time: '06:00', enabled: true, recurrence: 'daily', habitId: 'morning' },
      { id: 'r2', title: 'سنة الضحى', time: '10:00', enabled: true, recurrence: 'daily', habitId: 'duha' },
      { id: 'r3', title: 'أذكار المساء', time: '17:00', enabled: true, recurrence: 'daily', habitId: 'evening' },
    ];
  });
  const [prayerTimesMode, setPrayerTimesMode] = useState<'auto' | 'manual'>(() => {
    return (localStorage.getItem('zad_prayer_mode') as 'auto' | 'manual') || 'auto';
  });
  const [manualPrayerTimes, setManualPrayerTimes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('zad_manual_prayer_times');
    return saved ? JSON.parse(saved) : {
      fajr: '04:00',
      dhuhr: '12:00',
      asr: '15:30',
      maghrib: '18:30',
      isha: '20:00'
    };
  });

  useEffect(() => {
    localStorage.setItem('zad_prayer_mode', prayerTimesMode);
  }, [prayerTimesMode]);

  useEffect(() => {
    localStorage.setItem('zad_manual_prayer_times', JSON.stringify(manualPrayerTimes));
  }, [manualPrayerTimes]);

  const [prayerTimes, setPrayerTimes] = useState<any>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [prayerAlertsEnabled, setPrayerAlertsEnabled] = useState(() => {
    const saved = localStorage.getItem('zad_prayer_alerts');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('zad_prayer_alerts', JSON.stringify(prayerAlertsEnabled));
  }, [prayerAlertsEnabled]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [location, setLocation] = useState<{lat: number, lng: number} | null>(() => {
    const saved = localStorage.getItem('zad_location');
    return saved ? JSON.parse(saved) : null;
  });
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassPermission, setCompassPermission] = useState<string>('unknown');

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading is available on iOS
      const heading = (e as any).webkitCompassHeading || (360 - (e.alpha || 0));
      setDeviceHeading(heading);
    };

    if (activeTab === 'today' && typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [activeTab]);

  const requestCompassPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        setCompassPermission(permission);
        if (permission === 'granted') {
          window.location.reload(); // Refresh to start listener if needed
        }
      } catch (err) {
        console.error('Compass permission error', err);
      }
    } else {
      setCompassPermission('granted');
    }
  };

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setActiveNotification({ 
            title: 'تم تحديث الموقع', 
            body: 'تم تعديل مواقيت الصلاة والقبلة حسب موقعك الحالي بنجاح.' 
          });
        },
        (err) => {
          console.error('Location update error', err);
          setActiveNotification({ 
            title: 'فشل التحديث', 
            body: 'تأكد من تفعيل نظام تحديد المواقع (GPS) ومنح الصلاحية للتطبيق.' 
          });
        }
      );
    } else {
      setActiveNotification({ 
        title: 'غير مدعوم', 
        body: 'متصفحك لا يدعم خاصية تحديد المواقع.' 
      });
    }
  };

  useEffect(() => {
    // Update date automatically at midnight
    const timer = setInterval(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (dateStr !== todayDate) {
        console.log(`Day changed from ${todayDate} to ${dateStr}. Resetting habits.`);
        // Backup yesterday's data before reset
        const history = JSON.parse(localStorage.getItem('zad_history') || '[]');
        const todayDataBackup = {
          date: todayDate,
          habits,
          adhkarProgress
        };
        localStorage.setItem('zad_history', JSON.stringify([todayDataBackup, ...history].slice(0, 7)));

        setTodayDate(dateStr);
        // Reset habits to default state and clear progress for the new day
        setHabits(prev => prev.map(h => ({ 
          ...h, 
          completed: false, 
          count: h.id === 'quran-wird' ? 0 : undefined 
        })));
        setAdhkarProgress({});
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [todayDate]);

  useEffect(() => {
    // Attempt to get location for prayer times
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Default to Cairo if geolocation fails
          setLocation({ lat: 30.0444, lng: 31.2357 });
        }
      );
    } else {
      setLocation({ lat: 30.0444, lng: 31.2357 });
    }
  }, []);

  useEffect(() => {
    if (location) {
      localStorage.setItem('zad_location', JSON.stringify(location));
      const coordinates = new Coordinates(location.lat, location.lng);
      const params = CalculationMethod.Egyptian();
      const date = new Date(todayDate);
      const pt = new PrayerTimes(coordinates, date, params);
      setPrayerTimes(pt);
      
      const angle = Qibla(coordinates);
      setQiblaAngle(angle);
    }
  }, [location, todayDate]);

  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  
  // 1. Shadow refinement in headers and cards
  // We'll use shadow-xl or shadow-2xl for better depth
  // Also fix saving logic to prevent historical pollution

  const lastSavedDate = useRef(todayDate);
  const userInteracted = useRef(false);

  useEffect(() => {
    if (isLoadingDay.current) return;
    
    // Safety check: if todayDate just changed, habits haven't updated yet.
    if (lastSavedDate.current !== todayDate) {
      lastSavedDate.current = todayDate;
      userInteracted.current = false;
      return;
    }

    const hasCompleted = habits.some(h => h.completed) || Object.keys(adhkarProgress).length > 0;
    const isToday = todayDate === getLocalDateString();
    
    const data = {
      date: todayDate,
      habits,
      adhkarProgress,
      reminders
    };

    // CRITICAL: Only save historical dates if there was an explicit user interaction
    if (isToday || (hasCompleted && userInteracted.current)) {
      localStorage.setItem(`zad_data_${todayDate}`, JSON.stringify(data));
      if (isToday) {
        localStorage.setItem('zad_daily_v3', JSON.stringify(data));
      }
    }
  }, [habits, adhkarProgress, reminders, todayDate]);

  // Update habits and progress when todayDate changes
  useEffect(() => {
    const loadDayData = async () => {
      if (isLoadingDay.current) return;
      isLoadingDay.current = true;
      try {
        const effectiveUserId = auth.currentUser?.uid || firebaseUser?.uid || user?.id;
        
        // 1. Try local storage first (date-specific)
        const storageKey = `zad_data_${todayDate}`;
        const localData = localStorage.getItem(storageKey);
        
        const defaultHabits: Habit[] = [
          { id: 'morning', title: 'أذكار الصباح', category: 'adhkar', completed: false },
          { id: 'evening', title: 'أذكار المساء', category: 'adhkar', completed: false },
          { id: 'duha', title: 'سنة الضحى', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'duha' },
          { id: 'fajr-q', title: 'سنة الفجر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'fajr' },
          { id: 'dhuhr-q', title: 'سنة الظهر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'dhuhr' },
          { id: 'dhuhr-b', title: 'سنة الظهر (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'dhuhr' },
          { id: 'maghrib-b', title: 'سنة المغرب (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'maghrib' },
          { id: 'isha-b', title: 'سنة العشاء (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'isha' },
          { id: 'qiyam', title: 'صلاة القيام', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'other' },
          { id: 'kahf', title: 'سورة الكهف', category: 'quran', completed: false },
          { id: 'quran-wird', title: 'ورد القرآن الكريم', category: 'quran', completed: false, count: 0, target: 4 },
        ];

        if (localData) {
          const parsed = JSON.parse(localData);
          setHabits(parsed.habits || defaultHabits);
          setAdhkarProgress(parsed.adhkarProgress || {});
          return;
        }

        // 2. If not in local storage and user is logged in, try Firestore
        if (effectiveUserId && effectiveUserId !== 'guest_user') {
          try {
            // Use a shorter timeout or handle offline gracefully
            const q = query(
              collection(db, 'habitLogs'),
              where('userId', '==', effectiveUserId),
              where('date', '==', todayDate)
            );
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => doc.data());
            
            if (logs.length > 0) {
              const newHabits = defaultHabits.map(h => {
                const log = logs.find(l => l.habitId === h.id);
                if (log) {
                  return { 
                    ...h, 
                    completed: log.completed, 
                    count: log.count !== undefined ? log.count : h.count 
                  };
                }
                return h;
              });
              setHabits(newHabits);
              
              // Also restore adhkar progress if exists
              const morningLog = logs.find(l => l.habitId === 'morning-progress');
              const eveningLog = logs.find(l => l.habitId === 'evening-progress');
              if (morningLog || eveningLog) {
                setAdhkarProgress({
                  ...(morningLog?.progress || {}),
                  ...(eveningLog?.progress || {})
                });
              }
            } else {
              setHabits(defaultHabits);
              setAdhkarProgress({});
            }
          } catch (e) {
            console.warn("Failed to fetch day data (possibly offline)", e);
            setHabits(defaultHabits);
            setAdhkarProgress({});
          }
        } else {
          setHabits(defaultHabits);
          setAdhkarProgress({});
        }
      } finally {
        isLoadingDay.current = false;
      }
    };

    loadDayData();
  }, [todayDate, firebaseUser?.uid]);

  // Handle Firebase Auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setFirebaseUser(u);
      if (u) {
        const userData = { id: u.uid, name: u.displayName || 'مستخدم' };
        setUser(userData);
        localStorage.setItem('zad_user', JSON.stringify(userData));
      } else {
        // Fallback to guest if no local user exists
        const saved = localStorage.getItem('zad_user');
        if (!saved) {
          setUser({ id: 'guest_user', name: 'ضيف' });
        } else {
          setUser(JSON.parse(saved));
        }
      }
      setIsLoading(false);
    });

    // Safety timeout for loading state
    const timer = setTimeout(() => setIsLoading(false), 5000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  
  // Firestore Error Handler
  const handleFirestoreError = useCallback((error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // throw new Error(JSON.stringify(errInfo)); // Guidelines say throw, but we want to show UI error
    setActiveNotification({ title: 'خطأ في الربط', body: 'تحقق من اتصالك بالإنترنت للمزامنة.' });
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        }
      });
    }
  }, []);

  const handleAppUpdate = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for(let registration of registrations) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.unregister();
        }
        // Clear all caches
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
        // Force reload without cache
        window.location.replace(window.location.href);
      } catch (err) {
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const forceResetDay = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'إعادة ضبط اليوم',
      message: 'هل أنت متأكد من تصفير كافة عبادات اليوم؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: () => {
        const defaultHabits: Habit[] = [
          { id: 'morning', title: 'أذكار الصباح', category: 'adhkar', completed: false },
          { id: 'evening', title: 'أذكار المساء', category: 'adhkar', completed: false },
          { id: 'duha', title: 'سنة الضحى', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'duha' },
          { id: 'fajr-q', title: 'سنة الفجر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'fajr' },
          { id: 'dhuhr-q', title: 'سنة الظهر (قبلية)', category: 'sunnah', completed: false, subType: 'qabliyah', prayerGroup: 'dhuhr' },
          { id: 'dhuhr-b', title: 'سنة الظهر (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'dhuhr' },
          { id: 'maghrib-b', title: 'سنة المغرب (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'maghrib' },
          { id: 'isha-b', title: 'سنة العشاء (بعدية)', category: 'sunnah', completed: false, subType: 'badiyah', prayerGroup: 'isha' },
          { id: 'qiyam', title: 'صلاة القيام', category: 'sunnah', completed: false, subType: 'main', prayerGroup: 'other' },
          { id: 'kahf', title: 'سورة الكهف', category: 'quran', completed: false },
          { id: 'quran-wird', title: 'ورد القرآن الكريم', category: 'quran', completed: false, count: 0, target: 4 },
        ];
        setHabits(defaultHabits);
        setAdhkarProgress({});
        userInteracted.current = true;
        setActiveNotification({ title: 'تمت إعادة الضبط', body: 'تم تصفير جميع عبادات اليوم بنجاح.' });
      }
    });
  };

  useEffect(() => {
    // Reset state when user changes to prevent cross-contamination
    // Important for shared devices
    setHabits(prev => prev.map(h => ({ ...h, completed: false, count: h.id === 'quran-wird' ? 0 : h.count })));
    setAdhkarProgress({});
    setWeeklyStats([]);
    
    // Start listener if we have a user identity (either from auth or storage)
    const effectiveUserId = firebaseUser?.uid || user?.id;

    if (effectiveUserId) {
      const today = todayDate;
      const q = query(
        collection(db, 'habitLogs'), 
        where('userId', '==', effectiveUserId),
        where('date', '==', today)
      );

      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        if (today !== todayDate) return;

        const logs = snapshot.docs.map(doc => doc.data());
        
        setHabits(prev => {
          return prev.map(h => {
            const log = logs.find(l => l.habitId === h.id);
            if (log) {
              return { 
                ...h, 
                completed: log.completed,
                count: log.count !== undefined ? log.count : h.count 
              };
            }
            return h;
          });
        });

        const morningLog = logs.find(l => l.habitId === 'morning-progress');
        const eveningLog = logs.find(l => l.habitId === 'evening-progress');
        
        if (morningLog || eveningLog) {
          setAdhkarProgress(prev => ({
            ...prev,
            ...(morningLog?.progress || {}),
            ...(eveningLog?.progress || {})
          }));
        }
      }, (error) => {
        // Log to console for debugging offline state
        console.warn('Firestore Snapshot Status:', error.message);
        if (!error.message?.includes('offline') && !error.message?.includes('insufficient permissions')) {
          handleFirestoreError(error, 'get', 'habitLogs');
        }
      });

      return () => unsubscribe();
    }
  }, [user?.id, firebaseUser?.uid, handleFirestoreError, todayDate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      
      // Clear all local storage related to the app
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('zad_') || key.startsWith('last_triggered_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Reset user state to guest
      setUser({ id: 'guest_user', name: 'ضيف' });
      setFirebaseUser(null);
      
      // Reset all habit progress
      setHabits(INITIAL_HABITS);
      setAdhkarProgress({});
      setFavoriteDuas([]);
      setWeeklyStats([]);
      
      setActiveNotification({ title: 'تم تسجيل الخروج', body: 'نشكرك على استخدام زاد. تم مسح بياناتك المحلية بنجاح.' });
      
      // Optional: reload for complete cleanup
      // window.location.reload();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const getAdhkarProgressPercentage = (type: 'morning' | 'evening' | null) => {
    if (!type) return 0;
    const list = type === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
    const completedCount = list.filter(item => (adhkarProgress[item.id] || 0) >= item.repeat).length;
    return Math.round((completedCount / list.length) * 100);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    console.log('Dark mode changed:', isDarkMode);
  }, [isDarkMode]);

  const [filter, setFilter] = useState<'all' | 'adhkar' | 'sunnah' | 'quran'>('all');
  const [selectedAdhkar, setSelectedAdhkar] = useState<'morning' | 'evening' | null>(null);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [favoriteDuas, setFavoriteDuas] = useState<UserDua[]>([]);
  const [newDuaContent, setNewDuaContent] = useState('');
  const [isAddingDua, setIsAddingDua] = useState(false);

  const [activeNotification, setActiveNotification] = useState<{title: string, body: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [totalQuran, setTotalQuran] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const triggerRealNotification = (title: string, body: string, soundId?: string) => {
    console.log('Triggering notification:', title, body);
    
    // 1. Play Sound
    const playAdhan = async () => {
      try {
        const audio = new Audio('/adhans/1.mp3'); 
        await audio.play();
        sessionStorage.setItem('audio_unlocked', 'true');
        setShowAudioHint(false);
      } catch (e) {
        console.warn('Audio play blocked:', e);
        if ((e as Error).name === 'NotAllowedError') {
          setShowAudioHint(true);
        }
      }
    };

    if (soundId === 'prayer_alerts') {
      playAdhan();
    } else {
      // Default notification sound using oscillator
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          setShowAudioHint(true);
        } else {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.5);
        }
      } catch (e) {
        console.error('Oscillator failed', e);
      }
    }

    // 2. System Notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const options = {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913008.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2913/2913008.png',
        dir: 'rtl' as NotificationDirection,
        tag: soundId || 'zad-general',
        renotify: true,
        vibrate: [200, 100, 200]
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, options);
        }).catch(() => {
          new Notification(title, options);
        });
      } else {
        new Notification(title, options);
      }
    }
    
    // 3. In-app notification
    setActiveNotification({ title, body });

    // Clear after 4 seconds
    setTimeout(() => {
      setActiveNotification(null);
    }, 4000);
  };


  const habitDefaultTimes: Record<string, string> = {
    'morning': '05:30',
    'evening': '17:00',
    'duha': '09:00',
    'fajr-q': '04:30',
    'dhuhr-q': '12:15',
    'dhuhr-b': '12:45',
    'maghrib-b': '18:50',
    'isha-b': '20:15',
  };

  const testNotification = (title: string, id?: string) => {
    triggerRealNotification(title, 'حان الآن موعد هذه العبادة، لا تنسَ نيل الأجر والثواب ✨', id);
  };

  const lastKnownLikeCounts = useRef<Record<string, number>>({});
  const isInitialLikesLoad = useRef(true);
  const workerRef = useRef<Worker | null>(null);

  const checkReminders = useCallback(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = getLocalDateString();
    
    // 1. Check Custom Reminders
    reminders.forEach(reminder => {
      if (reminder.enabled && reminder.time === currentTime) {
        const dayOfWeek = now.getDay();
        let shouldTrigger = false;

        if (reminder.recurrence === 'daily') {
          shouldTrigger = true;
        } else if (reminder.recurrence === 'weekdays') {
          shouldTrigger = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (reminder.recurrence === 'weekly') {
          shouldTrigger = true; 
        } else if (reminder.recurrence === 'custom' && reminder.customDays) {
          shouldTrigger = reminder.customDays.includes(dayOfWeek);
        }

        if (shouldTrigger) {
          const lastTriggered = localStorage.getItem(`last_triggered_${reminder.id}`);
          if (lastTriggered !== `${today}_${currentTime}`) {
            triggerRealNotification(reminder.title, 'حان الآن موعد هذه العبادة، لا تنسَ نيل الأجر والثواب ✨', reminder.id);
            localStorage.setItem(`last_triggered_${reminder.id}`, `${today}_${currentTime}`);
          }
        }
      }
    });

    // 2. Check Prayer Times
    if (prayerAlertsEnabled && (prayerTimes || prayerTimesMode === 'manual')) {
      const prayers = [
        { id: 'fajr', title: 'صلاة الفجر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.fajr : prayerTimes?.fajr },
        { id: 'dhuhr', title: 'صلاة الظهر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.dhuhr : prayerTimes?.dhuhr },
        { id: 'asr', title: 'صلاة العصر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.asr : prayerTimes?.asr },
        { id: 'maghrib', title: 'صلاة المغرب', time: prayerTimesMode === 'manual' ? manualPrayerTimes.maghrib : prayerTimes?.maghrib },
        { id: 'isha', title: 'صلاة العشاء', time: prayerTimesMode === 'manual' ? manualPrayerTimes.isha : prayerTimes?.isha },
      ];

      prayers.forEach(prayer => {
        if (!prayer.time) return;
        
        let pTime = '';
        if (prayerTimesMode === 'manual') {
          pTime = prayer.time as string;
        } else {
          const pDate = new Date(prayer.time as any);
          pTime = `${String(pDate.getHours()).padStart(2, '0')}:${String(pDate.getMinutes()).padStart(2, '0')}`;
        }
        
        if (pTime === currentTime) {
          const lastTriggered = localStorage.getItem(`last_triggered_prayer_${prayer.id}`);
          if (lastTriggered !== `${today}_${currentTime}`) {
            triggerRealNotification(prayer.title, `حان الآن موعد ${prayer.title}، تقبل الله منا ومنكم صالح الأعمال ✨`, 'prayer_alerts');
            localStorage.setItem(`last_triggered_prayer_${prayer.id}`, `${today}_${currentTime}`);
          }
        }
      });
    }
  }, [reminders, prayerTimes, prayerTimesMode, manualPrayerTimes, prayerAlertsEnabled]);

  // Monitor likes on user's own logs for real-time notifications
  useEffect(() => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || user?.id;
    if (!effectiveUserId || effectiveUserId === 'guest_user') return;

    const today = todayDate;
    const q = query(
      collection(db, 'habitLogs'),
      where('userId', '==', effectiveUserId),
      where('date', '==', today)
    );

    isInitialLikesLoad.current = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLikesLoad.current) {
        snapshot.docs.forEach(doc => {
          lastKnownLikeCounts.current[doc.id] = (doc.data().likes || []).length;
        });
        isInitialLikesLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const newData = change.doc.data();
        const newLikes = newData.likes || [];
        const newLikesCount = newLikes.length;
        const prevLikesCount = lastKnownLikeCounts.current[docId] || 0;

        if (change.type === 'modified' || change.type === 'added') {
          if (newLikesCount > prevLikesCount) {
             const habitName = HABIT_LABELS[newData.habitId] || newData.habitId;
             const lastLikerId = newLikes[newLikesCount - 1];
             
             if (lastLikerId !== effectiveUserId) {
               triggerRealNotification('تفاعل جديد! ❤️', `شخص ما أعجب بإنجازك في ${habitName}. استمر في الخير!`);
             }
          }
          lastKnownLikeCounts.current[docId] = newLikesCount;
        } else if (change.type === 'removed') {
          delete lastKnownLikeCounts.current[docId];
        }
      });
    });

    return () => unsubscribe();
  }, [user, firebaseUser, todayDate]);

  const [showAudioHint, setShowAudioHint] = useState(false);

  // Web Worker and Service Worker registration
  useEffect(() => {
    // 1. Service Worker Registration for better background notifications
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('SW registered:', reg.scope))
          .catch(err => console.log('SW registration failed:', err));
      });
    }

    // 2. Audio Heuristic with Session Memory
    const checkAudio = async () => {
       const alreadyUnlocked = sessionStorage.getItem('audio_unlocked');
       if (alreadyUnlocked === 'true') return;

       const audio = new Audio();
       try {
         await audio.play();
         sessionStorage.setItem('audio_unlocked', 'true');
       } catch (e) {
         if ((e as Error).name === 'NotAllowedError') {
           setShowAudioHint(true);
         }
       }
    };
    checkAudio();

    // 3. Web Worker for timing
    try {
      workerRef.current = new Worker('/timerWorker.js');
      workerRef.current.onmessage = (e) => {
        if (e.data === 'tick') {
          checkReminders();
        }
      };
      workerRef.current.postMessage('start');
    } catch (err) {
      console.error('Failed to start Web Worker', err);
    }
    
    // Fallback interval
    const interval = setInterval(checkReminders, 60000);

    return () => {
      workerRef.current?.postMessage('stop');
      workerRef.current?.terminate();
      clearInterval(interval);
    };
  }, [checkReminders]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      
      const userData = { id: u.uid, name: u.displayName || 'مستخدم جديد' };
      
      // Update or create user in Firestore
      await setDoc(doc(db, 'users', u.uid), {
        ...userData,
        email: u.email,
        lastSeen: serverTimestamp()
      }, { merge: true });
      
      setUser(userData);
      localStorage.setItem('zad_user', JSON.stringify(userData));
    } catch (err: any) {
      console.error('Google Sign-in failed', err);
      // Don't show confusing error if user just closed the popup
      if (err.code !== 'auth/popup-closed-by-user') {
        setActiveNotification({ 
          title: 'خطأ في تسجيل الدخول', 
          body: 'فشل الاتصال بـ Google. تأكد من تفعيل خاصية تسجيل الدخول في Firebase.' 
        });
      }
    }
  };

  const toggleHabit = async (id: string, customCompleted?: boolean) => {
    const now = todayDate;
    const h = habits.find(habit => habit.id === id);
    if (!h) return;

    const isCompleted = customCompleted !== undefined ? customCompleted : !h.completed;

    // Confirm if unchecking a completed habit (to prevent accidental unchecks)
    if (!isCompleted && h.completed) {
      setConfirmDialog({
        isOpen: true,
        title: 'تأكيد التراجع',
        message: 'هل تريد فعلاً إلغاء إتمام هذه العبادة؟',
        onConfirm: () => executeToggleHabit(id, isCompleted)
      });
      return;
    }

    executeToggleHabit(id, isCompleted);
  };

  const executeToggleHabit = async (id: string, isCompleted: boolean) => {
    const now = todayDate;
    const h = habits.find(habit => habit.id === id);
    if (!h) return;

    userInteracted.current = true;

    // 1. Update locally first for instant feedback (Optimistic UI)
    setHabits(prev => {
      const newState = prev.map(habit => habit.id === id ? { ...habit, completed: isCompleted } : habit);
      const data = {
        date: todayDate,
        habits: newState,
        adhkarProgress
      };
      localStorage.setItem('zad_daily_v3', JSON.stringify(data));
      return newState;
    });

    // 2. Identity
    const effectiveUserId = auth.currentUser?.uid || firebaseUser?.uid || user?.id;
    const effectiveUserName = auth.currentUser?.displayName || user?.name || firebaseUser?.displayName || 'مستخدم';

    if (effectiveUserId && effectiveUserId !== 'guest_user') {
      const logId = `${effectiveUserId}-${id}-${now}`;
      try {
        await setDoc(doc(db, 'habitLogs', logId), {
          userId: effectiveUserId,
          userName: effectiveUserName,
          habitId: id,
          date: now,
          completed: isCompleted,
          timestamp: serverTimestamp()
        }, { merge: true });
      } catch (err: any) {
        console.warn('Silent sync error (expected offline):', err.message);
      }
    }
  };

  const updateQuranArba = async (increment: boolean) => {
    const now = todayDate;
    const h = habits.find(habit => habit.id === 'quran-wird');
    if (!h || h.count === undefined || h.target === undefined) return;

    const newCount = increment ? h.count + 1 : Math.max(h.count - 1, 0);
    const isCompleted = newCount >= h.target;

    if (!increment && h.count > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'حذف من الورد',
        message: 'هل تريد حذف ربع من وردك القرآني؟',
        onConfirm: () => executeUpdateWird(newCount, isCompleted)
      });
      return;
    }

    executeUpdateWird(newCount, isCompleted);
  };

  const executeUpdateWird = async (newCount: number, isCompleted: boolean) => {
    userInteracted.current = true;
    // Optimistic UI update
    setHabits(prev => prev.map(habit => habit.id === 'quran-wird' ? { ...habit, count: newCount, completed: isCompleted } : habit));

    const currentUser = auth.currentUser;
    const effectiveUserId = currentUser?.uid || firebaseUser?.uid || user?.id;
    const effectiveUserName = currentUser?.displayName || user?.name || firebaseUser?.displayName || 'مستخدم';

    if (effectiveUserId && effectiveUserId !== 'guest_user') {
      const logId = `${effectiveUserId}-quran-wird-${todayDate}`;
      try {
        await setDoc(doc(db, 'habitLogs', logId), {
          userId: effectiveUserId,
          userName: effectiveUserName,
          habitId: 'quran-wird',
          date: todayDate,
          completed: isCompleted,
          count: newCount,
          timestamp: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update Quran progress offline:', err);
      }
    }
  };

  const setQuranWirdDirectly = async (val: number) => {
    const currentCount = habits.find(h => h.id === 'quran-wird')?.count || 0;
    if (currentCount === val) {
      // If re-clicking same value, maybe they want to clear it?
      executeUpdateWird(0, false);
    } else {
      executeUpdateWird(val, val > 0);
    }
  };

  const handleSoundUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setActiveNotification({ title: 'خطأ في الرفع', body: 'حجم الملف كبير جداً، يرجى اختيار ملف أقل من 5 ميجابايت' });
        return;
      }
      try {
        await saveSoundToIndexedDB(id, file);
        setActiveNotification({ title: 'تم الحفظ', body: 'تم تعيين نغمة التنبيه بنجاح' });
      } catch (err) {
        console.error('Failed to save sound', err);
      }
    }
  };

  const removeSound = async (id: string) => {
    return new Promise<void>((resolve) => {
      const request = indexedDB.open('zad_sounds', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sounds', 'readwrite');
        const store = tx.objectStore('sounds');
        store.delete(id);
        tx.oncomplete = () => {
          setCustomSounds(prev => {
            const next = { ...prev };
            if (next[id]) {
              URL.revokeObjectURL(next[id]);
              delete next[next[id]];
            }
            return next;
          });
          setActiveNotification({ title: 'تم الحذف', body: 'تمت العودة للنغمة الافتراضية' });
          resolve();
        };
      };
    });
  };

  const updateQuranTarget = (newTarget: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === 'quran-wird') {
        return { ...h, target: newTarget, completed: (h.count || 0) >= newTarget };
      }
      return h;
    }));
  };

  const handleAdhkarClick = (type: 'morning' | 'evening') => {
    setSelectedAdhkar(type);
  };

  const incrementAdhkar = async (id: string, max: number, type: 'morning' | 'evening') => {
    const nextProgress = { ...adhkarProgress, [id]: Math.min((adhkarProgress[id] || 0) + 1, max) };
    setAdhkarProgress(nextProgress);

    const effectiveUserId = auth.currentUser?.uid || firebaseUser?.uid || user?.id;

    if (effectiveUserId) {
      const today = todayDate;
      const logId = `${effectiveUserId}-${type}-progress-${today}`;
      
      // Filter progress for only this type to keep logs clean
      const typeIds = (type === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR).map(a => a.id);
      const typeProgress = Object.keys(nextProgress)
        .filter(k => typeIds.includes(k))
        .reduce((res, key) => ({ ...res, [key]: nextProgress[key] }), {});

      try {
        await setDoc(doc(db, 'habitLogs', logId), {
          userId: effectiveUserId,
          habitId: `${type}-progress`,
          date: today,
          progress: typeProgress,
          timestamp: serverTimestamp()
        }, { merge: true });

        // Check if 50% or more of adhkar items of this type are completed
        const list = type === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
        const completedItems = list.filter(item => (nextProgress[item.id] || 0) >= item.repeat).length;
        const isFiftyPercentDone = completedItems >= (list.length / 2);
        
        // Update habit completion status optimistically
        toggleHabit(type, isFiftyPercentDone);
      } catch (err: any) {
        console.warn('Silent adhkar sync error:', err.message);
      }
    }
  };

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const addReminder = () => {
    const newReminder: Reminder = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'تنبيه جديد',
      time: '12:00',
      enabled: true,
      recurrence: 'daily',
      habitId: 'none'
    };
    setReminders([...reminders, newReminder]);
  };

  const deleteReminder = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف التنبيه',
      message: 'هل أنت متأكد من حذف هذا التنبيه؟',
      onConfirm: () => {
        setReminders(prev => prev.filter(r => r.id !== id));
        setActiveNotification({ title: 'تم الحذف', body: 'تم حذف التنبيه بنجاح' });
      }
    });
  };

  const fetchDuas = useCallback(async () => {
    if (!user || !firebaseUser) return;
    try {
      const q = query(
        collection(db, 'duas'),
        where('userId', '==', user.id)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserDua[];
      setFavoriteDuas(data);
    } catch (err) {
      console.error('Failed to fetch duas', err);
      handleFirestoreError(err, 'get', 'duas');
      setFavoriteDuas([]);
    }
  }, [user, firebaseUser, handleFirestoreError]);

  const fetchStats = useCallback(async () => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || user?.id;
    try {
      const logs: any[] = [];
      
      // 1. Fetch from Firestore if user is logged in
      if (effectiveUserId && effectiveUserId !== 'guest_user') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = getLocalDateString(weekAgo);

        const q = query(
          collection(db, 'habitLogs'),
          where('userId', '==', effectiveUserId),
          where('date', '>=', weekAgoStr)
        );
        let snapshot;
        try {
          snapshot = await getDocs(q);
          logs.push(...snapshot.docs.map(d => d.data()));
        } catch (e) {
          console.warn('Firestore fetch failed for stats, relying on local data');
        }
      }
      
      const days = [];
      const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        
        // Try to find in firestore logs first
        let dayLogs = logs.filter(l => l.date === dateStr && l.completed);
        
        // If no firestore logs OR user is guest, check local storage
        if (dayLogs.length === 0) {
          const localDataStr = localStorage.getItem(`zad_data_${dateStr}`);
          if (localDataStr) {
            const localData = JSON.parse(localDataStr);
            const completedHabits = localData.habits?.filter((h: any) => h.completed) || [];
            const hasAdhkar = Object.values(localData.adhkarProgress || {}).some((v: any) => v > 0);
            
            if (completedHabits.length > 0 || hasAdhkar) {
              dayLogs = completedHabits;
            }
          }
        }

        days.push({
          date: dateStr,
          name: dayNames[d.getDay()],
          count: dayLogs.length,
          percent: Math.round((dayLogs.length / (d.getDay() === 5 ? habits.length : habits.length - 1)) * 100)
        });
      }
      setWeeklyStats(days);
      setTotalToday(days[6].count);
      
      // Calculate total Quran portions
      const quranFromLogs = logs.filter(l => l.habitId === 'quran-wird').reduce((acc, l) => acc + (l.count || 0), 0);
      setTotalQuran(quranFromLogs);
      
      // Calculate streak
      let streak = 0;
      let checkDate = new Date();
      while (true) {
        const ds = getLocalDateString(checkDate);
        const hasLogs = logs.some(l => l.date === ds && l.completed);
        const hasLocal = localStorage.getItem(`zad_data_${ds}`) && JSON.parse(localStorage.getItem(`zad_data_${ds}`)!).habits?.some((h: any) => h.completed);
        
        if (hasLogs || hasLocal) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
        if (streak > 30) break;
      }
      setCurrentStreak(streak);
      
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, [user?.id, firebaseUser?.uid, habits.length, getLocalDateString]);

  useEffect(() => {
    if (user && firebaseUser && activeTab === 'stats') {
      fetchDuas();
      fetchStats();
    }
  }, [user, firebaseUser, activeTab, fetchDuas, fetchStats]);

  const addDua = async () => {
    const effectiveUserId = firebaseUser?.uid || auth.currentUser?.uid || user?.id;
    if (!effectiveUserId || !newDuaContent.trim()) return;
    try {
      const newDuaRef = doc(collection(db, 'duas'));
      const newDua = {
        userId: effectiveUserId,
        content: newDuaContent,
        createdAt: new Date().toISOString()
      };
      await setDoc(newDuaRef, newDua);
      
      setFavoriteDuas([{ id: newDuaRef.id, ...newDua }, ...favoriteDuas]);
      setNewDuaContent('');
      setIsAddingDua(false);
    } catch (err) {
      console.error('Failed to add dua', err);
      handleFirestoreError(err, 'write', 'duas');
    }
  };

  const deleteDua = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'duas', id));
      setFavoriteDuas(favoriteDuas.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete dua', err);
    }
  };

  const isFriday = new Date().getDay() === 5;
  const activeHabits = habits.filter(h => h.id !== 'kahf' || isFriday);
  const completedCount = activeHabits.filter(h => h.completed).length;
  const progressPercent = Math.round((completedCount / activeHabits.length) * 100);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-emerald-700 flex flex-col items-center justify-center text-white p-8 font-sans" dir="rtl">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-lg"
        >
          <Trophy size={48} className="text-white" />
        </motion.div>
        <h1 className="text-3xl font-black mb-2">زاد</h1>
        <p className="text-emerald-100/70 font-bold animate-pulse">جاري تحضير زادك اليومي...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col font-sans text-slate-950 dark:text-slate-100 max-w-md mx-auto relative overflow-hidden shadow-sm border-x border-slate-200 dark:border-slate-900 transition-colors duration-300 ${appFontSizeClass}`} dir="rtl">
      {!isOnline && (
        <div className="bg-amber-500 text-white text-[10px] py-1 text-center font-bold z-[100] animate-in slide-in-from-top duration-300">
          أنت الآن تعمل في وضع عدم الاتصال. ستتم مزامنة البيانات عند العودة.
        </div>
      )}
      <AnimatePresence>
        {activeNotification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            style={{ zIndex: 99999 }}
            className="fixed bottom-24 left-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl text-slate-900 dark:text-white rounded-3xl shadow-lg p-5 flex items-center space-x-4 space-x-reverse border border-slate-200 dark:border-white/10"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 text-right">
              <h4 className="font-bold text-white text-xs">{activeNotification.title}</h4>
              <p className="text-white/70 text-[10px] leading-tight mt-0.5">{activeNotification.body}</p>
            </div>
            <button 
              onClick={() => setActiveNotification(null)} 
              className="text-white/30 hover:text-white p-2"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 left-0 w-full h-[44rem] bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 dark:from-slate-900 dark:to-slate-950 rounded-b-[4rem] transition-all pointer-events-none" />

      {/* Header Content */}
      <header className="relative z-10 px-6 pt-12 pb-6 text-white text-right">
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold font-display tracking-tight text-white">زاد</h1>
            <div className="flex items-center space-x-1 space-x-reverse justify-end">
              <button 
                onClick={() => {
                  const d = new Date(todayDate);
                  d.setDate(d.getDate() - 1);
                  setTodayDate(getLocalDateString(d));
                }}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <p className="text-emerald-100 dark:text-emerald-300 text-xs font-bold opacity-90">
                {todayDate === getLocalDateString() ? 'اليوم، ' : ''}
                {new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(todayDate))}
              </p>
              <button 
                onClick={() => {
                  const d = new Date(todayDate);
                  d.setDate(d.getDate() + 1);
                  setTodayDate(getLocalDateString(d));
                }}
                disabled={todayDate === getLocalDateString()}
                className={`p-1 hover:bg-white/10 rounded-full transition-colors ${todayDate === getLocalDateString() ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            {updateAvailable && (
              <motion.button 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleAppUpdate}
                className="mt-3 flex items-center space-x-2 space-x-reverse bg-amber-400 text-amber-950 px-4 py-2 rounded-2xl text-[11px] font-black shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                <RotateCcw size={14} className="animate-spin-slow" />
                <span>تحديث الموقع متوفر (اضغط هنا)</span>
              </motion.button>
            )}
            {isOffline && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex items-center space-x-1.5 space-x-reverse bg-amber-500/20 backdrop-blur-sm text-amber-500 px-3 py-1.5 rounded-full text-[10px] font-black border border-amber-500/30"
              >
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                <span>وضع الأوفلاين نشط (بياناتك محفوظة محلياً)</span>
              </motion.div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="flex space-x-2 space-x-reverse mb-3">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95 shadow-sm"
                title="تغيير المظهر"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button 
                onClick={() => setShowReminderSettings(true)}
                className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95 shadow-sm"
                title="الإعدادات والتنبيهات"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={async () => {
                  const permission = await Notification.requestPermission();
                  setNotificationPermission(permission);
                  if (permission === 'granted') {
                    setActiveNotification({ title: 'رائع!', body: 'تنبيهات الأذان والأذكار ستصلك الآن في شريط الإشعارات بنجاح.' });
                  }
                }}
                className={`p-2.5 rounded-xl backdrop-blur-xl border transition-all active:scale-95 shadow-sm ${notificationPermission === 'granted' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                title="تفعيل إشعارات المتصفح"
              >
                <Bell size={18} className={notificationPermission === 'granted' ? '' : 'animate-bell-ring'} />
              </button>
              {user && (
                <button 
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95 shadow-sm"
                  title="تسجيل الخروج"
                >
                  <RotateCcw size={18} className="scale-x-[-1]" />
                </button>
              )}
            </div>
            {user && (
              <span className="text-[11px] text-emerald-100 font-bold drop-shadow-sm">مرحباً، {user.name}</span>
            )}
          </div>
        </div>

        {/* Quick Stats Grid - Prayer Times */}
        <div className="relative z-10 px-6 mb-8">
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-100 font-bold opacity-80 uppercase tracking-widest leading-none">مواقيت الصلاة</span>
              <span className="text-[9px] text-emerald-200/60 font-bold mt-0.5">{prayerTimesMode === 'auto' ? 'تلقائي حسب الموقع' : 'يدوي حسب اختيارك'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const newMode = prayerTimesMode === 'auto' ? 'manual' : 'auto';
                  setPrayerTimesMode(newMode);
                  setActiveNotification({ 
                    title: 'تغيير النمط', 
                    body: newMode === 'auto' ? 'تم تفعيل المواقيت التلقائية حسب موقعك.' : 'يمكنك الآن تعديل المواقيت يدوياً من الإعدادات.' 
                  });
                }}
                className={`p-1.5 rounded-lg border transition-all active:scale-95 flex items-center gap-1.5 ${prayerTimesMode === 'auto' ? 'bg-white/10 border-white/20' : 'bg-amber-500/20 border-amber-500/30'}`}
              >
                <RotateCcw size={10} className={prayerTimesMode === 'manual' ? 'text-amber-400' : 'text-emerald-300'} />
                <span className="text-[9px] font-bold text-white tracking-tighter">{prayerTimesMode === 'auto' ? 'تفعيل اليدوي' : 'العودة للتلقائي'}</span>
              </button>
              {prayerTimesMode === 'auto' && (
                <button 
                  onClick={updateLocation}
                  className="flex items-center space-x-1.5 space-x-reverse bg-white/10 hover:bg-white/20 active:scale-95 transition-all py-1.5 px-2.5 rounded-lg border border-white/10"
                  title="تحديث الموقع الجغرافي"
                >
                  <Compass size={10} className="text-emerald-300" />
                  <span className="text-[9px] font-bold text-white/90">تحديث</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'fajr', label: 'الفجر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.fajr : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.fajr) : '--:--') },
              { id: 'sunrise', label: 'الإشراق', time: prayerTimesMode === 'manual' ? '--:--' : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.sunrise) : '--:--') },
              { id: 'dhuhr', label: 'الظهر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.dhuhr : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.dhuhr) : '--:--') },
              { id: 'asr', label: 'العصر', time: prayerTimesMode === 'manual' ? manualPrayerTimes.asr : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.asr) : '--:--') },
              { id: 'maghrib', label: 'المغرب', time: prayerTimesMode === 'manual' ? manualPrayerTimes.maghrib : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.maghrib) : '--:--') },
              { id: 'isha', label: 'العشاء', time: prayerTimesMode === 'manual' ? manualPrayerTimes.isha : (prayerTimes ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(prayerTimes.isha) : '--:--') },
            ].map((p, i) => {
              let displayTime = p.time;
              if (prayerTimesMode === 'manual' && p.id !== 'sunrise') {
                const [h, m] = p.time.split(':');
                const d = new Date();
                d.setHours(parseInt(h), parseInt(m));
                displayTime = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(d);
              }
              return (
                <div key={i} className={`bg-white/10 backdrop-blur-md p-3 rounded-2xl flex flex-col items-center border ${prayerTimesMode === 'manual' && p.id !== 'sunrise' ? 'border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-white/5'}`}>
                  <span className="text-[10px] opacity-70 mb-1">{p.label}</span>
                  <span className="text-xs font-bold">{displayTime}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 relative z-10 pb-32 space-y-8 mt-4">
          <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={() => setShowReminderSettings(true)}
               className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-[2rem] text-right flex flex-col group active:scale-95 transition-all"
             >
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:bg-white/30 transition-colors">
                  <Settings size={18} />
                </div>
                <span className="text-[11px] font-black text-white">إعدادات الأذان</span>
                <span className="text-[9px] text-white/60 font-bold">تعديل المواعيد والتنبيهات</span>
             </button>
             <button 
               onClick={updateLocation}
               className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-[2rem] text-right flex flex-col group active:scale-95 transition-all"
             >
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:bg-white/30 transition-colors">
                  <Compass size={18} />
                </div>
                <span className="text-[11px] font-black text-white">تحديث الموقع</span>
                <span className="text-[9px] text-white/60 font-bold">لضمان دقة مواقيت الصلاة</span>
             </button>
          </div>

          {/* Progress Card */}
          <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 shadow-sm dark:shadow-none text-emerald-950 dark:text-emerald-50 transition-all border border-emerald-100 dark:border-slate-700 relative overflow-hidden group"
        >
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl opacity-50 group-hover:bg-emerald-100 transition-all"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center space-x-3 space-x-reverse">
               <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 border border-amber-100 dark:border-amber-900/50">
                  <Trophy size={20} />
               </div>
               <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">إنجاز اليوم</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-emerald-600 dark:text-emerald-400 font-black text-2xl drop-shadow-sm">{progressPercent}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">مكتمل</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-emerald-900/30 h-5 rounded-full overflow-hidden mb-4 p-1 shadow-inner border border-slate-200 dark:border-emerald-800/30">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            />
          </div>
          <div className="flex justify-between items-center px-1 relative z-10">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">جزاك الله خيراً، تبقى لك {activeHabits.length - completedCount} عبادات</p>
            <div className="flex space-x-1 space-x-reverse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${progressPercent > (i * 33) ? 'bg-emerald-500 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}`} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pt-4 pb-28 space-y-6">
        {!user && (
          <div className="flex flex-col items-center justify-center space-y-8 py-12 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="w-32 h-32 rounded-[3.5rem] bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                 <Trophy size={64} />
              </div>
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute -top-4 -right-1"
              >
                <div className="bg-amber-400 text-white p-2 rounded-2xl shadow-sm">
                  <Star size={16} fill="white" />
                </div>
              </motion.div>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl font-black font-display text-emerald-900 dark:text-emerald-50 drop-shadow-sm">زادُ المسلم</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm px-6 leading-relaxed max-w-xs mx-auto font-bold">
                رفيق طاعتك في الحل والترحال. وثق عباداتك وشاركها مع أحبائك في دوائر الخير.
              </p>
            </div>

            <div className="w-full pt-4 max-w-sm mx-auto">
              <button 
                onClick={signInWithGoogle}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-[2.5rem] font-bold text-lg shadow-sm dark:shadow-none flex items-center justify-center space-x-4 space-x-reverse transition-all transform active:scale-95"
              >
                <div className="bg-white p-1 rounded-full flex items-center justify-center">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                </div>
                <span>ابدأ الآن بذكر الله</span>
              </button>
              <p className="mt-8 text-[10px] text-gray-400 dark:text-slate-500 font-bold opacity-75">
                زادُك اليومي لطاعة تدوم.. بادر بالانضمام
              </p>
            </div>
          </div>
        )}

        {activeTab === 'today' && (
          <div key="tab-today" className="space-y-6 animate-in fade-in duration-300">
            {/* Guest Welcome / Login Prompt if not logged in */}
            {user?.id === 'guest_user' && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-emerald-600/10 border border-emerald-500/20 p-5 rounded-3xl flex items-center justify-between"
               >
                 <div className="flex items-center space-x-3 space-x-reverse">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                     <Star size={20} fill="white" />
                   </div>
                   <div>
                     <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">سجل دخولك لحفظ بياناتك سحابياً</h4>
                     <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">يمكنك المتابعة حالياً وستُحفظ بياناتك محلياً</p>
                   </div>
                 </div>
                 <button 
                   onClick={signInWithGoogle}
                   className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                 >
                   دخول
                 </button>
               </motion.div>
            )}
            {/* Categories / Quick Filter */}
            <div className="flex space-x-2 space-x-reverse overflow-x-auto pb-2 scrollbar-hide">
              {[
                { id: 'all', label: 'الجميع' },
                { id: 'adhkar', label: 'الأذكار' },
                { id: 'sunnah', label: 'السنن' },
                { id: 'quran', label: 'القرآن' }
              ].map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setFilter(cat.id as any)}
                  className={`px-4 py-2 rounded-xl text-sm capitalize whitespace-nowrap transition-all ${
                    filter === cat.id 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                      : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-emerald-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Adhkar Section */}
            {(filter === 'all' || filter === 'adhkar') && (
              <section className="space-y-3">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                <Sun className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-lg">الأذكار</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {habits.filter(h => h.category === 'adhkar').map(habit => (
                  <motion.button 
                    key={habit.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAdhkarClick(habit.id as 'morning' | 'evening')}
                    className={`p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 border transition-all ${
                      habit.completed 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800/50 shadow-inner' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${habit.completed ? 'bg-emerald-500 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {habit.id === 'morning' ? <Sun size={20} /> : <Moon size={20} />}
                    </div>
                    <span className={`text-sm font-bold ${habit.completed ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-slate-300'}`}>
                      {habit.title}
                    </span>
                    <div className="flex items-center space-x-1 space-x-reverse">
                       <p className="text-[10px] text-gray-400 dark:text-slate-500">انقر للقراءة</p>
                       {habit.completed ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-gray-300 dark:text-slate-600" />}
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
            )}

            {/* Qibla Section (Real Compass) */}
            {qiblaAngle !== null && (filter === 'all' || filter === 'adhkar') && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                      <Compass size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">اتجاه القبلة</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">بوصلة تفاعلية حقيقية</p>
                    </div>
                  </div>
                  {deviceHeading === null && (
                    <button 
                      onClick={requestCompassPermission}
                      className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl font-bold"
                    >
                      تفعيل البوصلة
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-48 h-48">
                    {/* Outer static ring */}
                    <div className="absolute inset-0 border-[6px] border-slate-50 dark:border-slate-900/50 rounded-full shadow-inner" />
                    
                    {/* Compass Face that rotates with the phone's heading */}
                    <motion.div 
                      animate={{ rotate: -(deviceHeading || 0) }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {/* Direction labels */}
                      <span className="absolute top-4 text-xs font-black text-rose-500">N</span>
                      <span className="absolute bottom-4 text-xs font-bold text-slate-300">S</span>
                      <span className="absolute right-4 text-xs font-bold text-slate-300">E</span>
                      <span className="absolute left-4 text-xs font-bold text-slate-300">W</span>
                      
                      {/* Degrees ticks would go here but kept clean for design */}
                    </motion.div>

                    {/* Qibla Needle (Points toward Qibla angle relative to North) */}
                    <motion.div 
                      animate={{ rotate: qiblaAngle - (deviceHeading || 0) }}
                      transition={{ type: 'spring', damping: 15, stiffness: 80 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="relative h-32 w-2 flex items-center justify-center">
                         {/* Needle top half (Emerald) */}
                         <div className="absolute top-0 w-3 h-16 bg-emerald-500 rounded-t-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                         {/* Needle bottom half (Gray) */}
                         <div className="absolute bottom-0 w-3 h-16 bg-slate-200 dark:bg-slate-700 rounded-b-full" />
                         
                         {/* Center pin */}
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-800 rounded-full border-2 border-emerald-500 z-10" />
                      </div>
                    </motion.div>
                  </div>
                  
                  <div className="mt-6 text-center space-y-1">
                    <p className="text-xl font-black text-emerald-800 dark:text-emerald-100">
                      {Math.round(qiblaAngle)}° <span className="text-xs font-bold text-slate-400">من الشمال</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">وجه الهاتف للجهة الخضراء بدقة</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sunnah Section */}
            {(filter === 'all' || filter === 'sunnah') && (
              <section className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Heart className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-lg">السنن والرواتب</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                {[
                  { id: 'fajr', label: 'صلاة الفجر' },
                  { id: 'duha', label: 'صلاة الضحى' },
                  { id: 'dhuhr', label: 'صلاة الظهر' },
                  { id: 'maghrib', label: 'صلاة المغرب' },
                  { id: 'isha', label: 'صلاة العشاء' },
                  { id: 'other', label: 'قيام الليل' }
                ].map(group => {
                  const groupHabits = habits.filter(h => h.category === 'sunnah' && h.prayerGroup === group.id);
                  if (groupHabits.length === 0) return null;

                  return (
                    <div key={group.id} className="space-y-2">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 bg-emerald-50 dark:bg-emerald-900/30 w-max rounded-md">{group.label}</p>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden transition-colors">
                        {groupHabits.map((habit, idx) => (
                          <SunnahItem 
                            key={habit.id} 
                            habit={habit} 
                            idx={idx} 
                            total={groupHabits.length} 
                            onToggle={toggleHabit} 
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            )}

            {/* Quran Wird Section */}
            {(filter === 'all' || filter === 'quran') && (
              <section className="space-y-3">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                < BookOpen className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-lg">ورد القرآن</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden transition-colors mb-4">
                <div className="flex flex-col">
                  {activeHabits.filter(h => h.category === 'quran' && h.id !== 'quran-wird').map((habit, idx, arr) => (
                    <div 
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={`flex items-center justify-between p-5 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/30 transition-all ${
                        idx !== arr.length - 1 ? 'border-b border-slate-200 dark:border-slate-800' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-4 space-x-reverse">
                        <div className={`w-2.5 h-12 rounded-full shadow-sm transition-all ${habit.completed ? 'bg-emerald-500 shadow-emerald-200' : 'bg-slate-200 dark:bg-slate-700'} ${habit.id === 'kahf' && new Date().getDay() === 5 && !habit.completed ? 'animate-pulse bg-amber-400 shadow-amber-100' : ''}`} />
                        <div>
                          <h4 className={`font-bold text-lg ${habit.completed ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-300'}`}>
                            {habit.title}
                            {habit.id === 'kahf' && new Date().getDay() === 5 && !habit.completed && <span className="mr-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">سنة اليوم</span>}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold opacity-80">
                            {habit.id === 'kahf' ? 'يوم الجمعة طهرة للمؤمن' : 'طاعة مباركة'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-2xl flex items-center justify-center border-2 shadow-sm transition-all ${
                        habit.completed ? 'bg-emerald-500 border-emerald-500 text-white scale-110' : 'border-slate-200 dark:border-slate-700'
                      }`}>
                        {habit.completed && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div 
                className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none relative overflow-hidden transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-1">
                      <h4 className="font-bold text-xl dark:text-slate-100">ورد القرآن:</h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">اختر إنجازك اليومي المحقق:</p>
                    </div>
                  </div>
                  <BookOpen className="w-10 h-10 text-emerald-100 dark:text-emerald-900/20 absolute -left-2 -top-2" />
                </div>
                
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { label: 'ربع حزب', val: 1 },
                    { label: 'نصف حزب', val: 2 },
                    { label: 'ثلاثة أرباع', val: 3 },
                    { label: 'حـزب كامل', val: 4 },
                    { label: 'حزب ونصف', val: 6 },
                    { label: 'جزء كامل', val: 8 },
                    { label: 'جزئين', val: 16 },
                    { label: '٣ أجزاء', val: 24 },
                    { label: 'ختمة مباركة!', val: 240 },
                  ].map((opt) => {
                    const currentCount = habits.find(h => h.id === 'quran-wird')?.count || 0;
                    const isSelected = currentCount === opt.val;
                    return (
                      <button
                        key={opt.val}
                        onClick={() => setQuranWirdDirectly(opt.val)}
                        className={`p-3 rounded-2xl text-xs font-black transition-all border ${
                          isSelected 
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-[1.02]' 
                          : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold px-1">
                  <span>الإجمالي المسجل:</span>
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <span className="text-emerald-600 dark:text-emerald-400">{habits.find(h => h.id === 'quran-wird')?.count} ربعاً</span>
                    <button 
                      onClick={() => executeUpdateWird(0, false)}
                      className="text-gray-300 hover:text-rose-500 transition-colors ml-2"
                    >
                      (تصفير)
                    </button>
                  </div>
                </div>
              </motion.div>
            </section>
            )}

            {/* End of Day Summary (Muhasaba Reflection) */}
            {completedCount > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 mt-12 pb-12">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full mb-8 opacity-50" />
                  <div className="bg-white dark:bg-slate-900 w-full p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-lg relative">
                    <div className="absolute -top-6 right-8 bg-emerald-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-sm">حصاد يومك</div>
                    <h3 className="font-bold text-xl mb-4">ماذا أنجزت اليوم؟</h3>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        "حاسبوا أنفسكم قبل أن تُحاسبوا، وزنوا أعمالكم قبل أن تُوزن عليكم"
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeHabits.filter(h => h.completed).map(h => (
                          <div key={h.id} className="flex items-center space-x-2 space-x-reverse bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">{h.title}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-bold">إجمالي الطاعات</span>
                        <div className="flex items-baseline space-x-1 space-x-reverse">
                          <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
                          <span className="text-[10px] text-slate-400 font-bold">/ {activeHabits.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {user && activeTab === 'social' && (
          <div key="tab-social" className="animate-in fade-in duration-300">
            <SocialCircle userId={user.id} userName={user.name} firebaseUser={firebaseUser} />
          </div>
        )}

        {user && activeTab === 'stats' && (
          <div key="tab-stats" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
               <h3 className="font-bold text-2xl text-emerald-800 dark:text-emerald-400 transition-colors">لوحة إنجازاتي</h3>
               <div className="flex items-center space-x-2 space-x-reverse bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800/30">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{currentStreak > 10 ? 'عابد متميز' : 'مبتدئ طموح'}</span>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[2.5rem] text-white shadow-sm flex flex-col items-center justify-center text-center transition-all cursor-default"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <RotateCcw size={24} className="text-white" />
              </div>
              <span className="text-4xl font-bold mb-1">{currentStreak}</span>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">أيام متتالية</span>
            </motion.div>
            
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center transition-all cursor-default"
            >
               <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{totalToday}</span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">طاعات اليوم</span>
            </motion.div>
          </div>

            {/* Additional Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                  <BookOpen size={20} />
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{totalQuran}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">أرباع القرآن</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                  <Star size={20} />
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{currentStreak * 50}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">نقاط الصبر</p>
                </div>
              </div>
            </div>

            {/* Visual Charts */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-6">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-bold flex items-center space-x-2 space-x-reverse">
                  <TrendingUp size={18} className="text-emerald-500" />
                  <span>تطور الأداء الأسبوعي</span>
                </h4>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyStats}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                      dy={10} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                        borderRadius: '16px', 
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        direction: 'rtl'
                      }}
                      itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorCount)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-6">
               <div className="flex justify-between items-center px-2">
                  <h4 className="font-bold flex items-center space-x-2 space-x-reverse">
                    <BarChart3 size={18} className="text-amber-500" />
                    <span>نسبة الإنجاز %</span>
                  </h4>
               </div>
               <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                      />
                      <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
                        {weeklyStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 6 ? '#10b981' : '#cbd5e1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Favorite Duas Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-bold text-lg flex items-center space-x-2 space-x-reverse">
                  <Heart size={20} className="text-rose-500 fill-rose-500" />
                  <span>أدعيتي المفضلة</span>
                </h4>
                <button 
                  onClick={() => setIsAddingDua(!isAddingDua)}
                  className="text-emerald-600 dark:text-emerald-400 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>

              <AnimatePresence>
                {isAddingDua && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-emerald-100 dark:border-slate-700 shadow-inner space-y-3"
                  >
                    <textarea 
                      placeholder="اكتب دعاءً يحبه قلبك لتردده دائماً..."
                      value={newDuaContent}
                      onChange={(e) => setNewDuaContent(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-emerald-900 dark:text-emerald-100 font-serif leading-relaxed text-lg text-center"
                      rows={3}
                    />
                    <div className="flex space-x-2 space-x-reverse">
                       <button 
                         onClick={addDua}
                         disabled={!newDuaContent.trim()}
                         className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold shadow-md shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                       >
                         حفظ في القلب
                       </button>
                       <button 
                         onClick={() => setIsAddingDua(false)}
                         className="px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-2xl font-bold"
                       >
                         إلغاء
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {favoriteDuas.length === 0 ? !isAddingDua && (
                <div className="text-center py-8 bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                  <p className="text-gray-400 text-sm">لم تضف أي أدعية مفضلة بعد</p>
                </div>
              ) : (
                <div className="space-y-3">
                   {favoriteDuas.map((dua) => (
                     <motion.div 
                        key={dua.id}
                        layout
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-emerald-50 dark:border-slate-700 shadow-sm dark:shadow-none relative group"
                     >
                       <button 
                          onClick={() => deleteDua(dua.id)}
                          className="absolute top-4 left-4 p-1 text-gray-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                       <p className="text-lg text-center font-serif leading-relaxed text-emerald-900 dark:text-emerald-100">
                         "{dua.content}"
                       </p>
                     </motion.div>
                   ))}
                </div>
              )}
            </div>

            {/* Achievement Board Sections */}
            <div className="space-y-4">
              <h4 className="font-bold text-lg px-2 flex items-center space-x-2 space-x-reverse">
                <Crown size={20} className="text-amber-500" />
                <span>إنجازات الدرب</span>
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { title: 'الصلاة في وقتها', progress: prayerTimes ? 100 : 0, color: 'bg-blue-500', icon: <Clock /> },
                  { title: 'الإخلاص والسر', progress: (favoriteDuas.length / 5) * 100, color: 'bg-rose-500', icon: <Heart /> },
                  { title: 'التنافس في الخير', progress: (currentStreak / 30) * 100, color: 'bg-emerald-500', icon: <Users /> }
                ].map((ach, i) => (
                  <div 
                    key={i}
                    className={`bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none transition-colors`}>
                    <div className="flex items-center space-x-3 space-x-reverse mb-3">
                      <div className={`p-2 rounded-xl bg-opacity-10 ${ach.color.replace('bg-', 'text-')} ${ach.color}`}>
                        {React.cloneElement(ach.icon as React.ReactElement, { size: 18 })}
                      </div>
                      <span className="font-bold text-sm flex-1">{ach.title}</span>
                      <span className="text-xs font-bold text-slate-400">{Math.min(Math.round(ach.progress), 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(ach.progress, 100)}%` }}
                        className={`h-full ${ach.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges Section */}
            <div className="space-y-4">
              <h4 className="font-bold text-lg px-2 flex items-center space-x-2 space-x-reverse">
                <Trophy size={20} className="text-amber-500" />
                <span>أوسمة الشرف</span>
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'المصلّي', icon: <Sun className="text-amber-500" />, unlocked: habits.filter(h => h.category === 'sunnah' && h.completed).length >= 1, desc: 'أتممت صلاة السنة' },
                  { name: 'حافظ الورد', icon: <BookOpen className="text-emerald-500" />, unlocked: habits.find(h => h.id === 'quran-wird')?.completed, desc: 'أتممت وردك القرآني' },
                  { name: 'المسبّح', icon: <Moon className="text-indigo-400" />, unlocked: habits.find(h => h.id === 'evening')?.completed, desc: 'أتممت أذكار المساء' },
                  { name: 'الفجر', icon: <Clock className="text-orange-400" />, unlocked: habits.find(h => h.id === 'morning')?.completed, desc: 'أتممت أذكار الصباح' },
                  { name: 'المهتم', icon: <Heart className="text-rose-400" />, unlocked: habits.filter(h => h.completed).length >= 5, desc: 'أنجزت ٥ عبادات' },
                  { name: 'المثابر', icon: <Crown className="text-yellow-400" />, unlocked: true, desc: 'مسجل في زاد' },
                ].map((badge, i) => (
                  <motion.div 
                    key={i} 
                    className={`p-4 rounded-[2rem] border flex flex-col items-center space-y-2 text-center transition-all ${
                      badge.unlocked 
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-md' 
                        : 'bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-slate-800 opacity-40 grayscale'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${badge.unlocked ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                      {React.cloneElement(badge.icon as React.ReactElement, { size: 28 })}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-gray-800 dark:text-slate-200">{badge.name}</span>
                      <p className="text-[8px] text-gray-400 dark:text-slate-500 line-clamp-1">{badge.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Weekly Summary */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-6 transition-colors">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-400">التقرير الأسبوعي</h4>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 px-3 py-1 rounded-full font-bold">أداء متميز</span>
              </div>
              <div className="flex items-end justify-between h-32 px-4">
                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                  <div key={i} className="flex flex-col items-center space-y-3 group">
                    <div className="relative w-8 flex flex-col items-center">
                       <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        className={`w-full rounded-full transition-all duration-700 ${i === 3 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/50'}`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                      {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'][i]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed italic">
                 "أحب الأعمال إلى الله أدومها وإن قل" - حديث شريف
              </p>
            </div>
            
            <div className="h-10" />
          </div>
        )}
      </main>

      {/* Adhkar Modal */}
      <AnimatePresence>
        {selectedAdhkar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#020617] transition-colors"
          >
            <div className="p-6 flex flex-col border-b border-emerald-50 dark:border-slate-800 bg-emerald-700 dark:bg-emerald-950 text-white transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <button onClick={() => setSelectedAdhkar(null)} className="p-2 hover:bg-white/10 rounded-full">
                    <ChevronRight />
                  </button>
                  <h2 className="text-xl font-bold">{selectedAdhkar === 'morning' ? 'أذكار الصباح' : 'أذكار المساء'}</h2>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="flex bg-white/10 rounded-xl overflow-hidden p-0.5 ml-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdhkarFontSize(prev => Math.max(prev - 2, 14));
                      }}
                      className="p-1 px-2.5 hover:bg-white/20 transition-colors text-white font-bold"
                    >
                      أ-
                    </button>
                    <div className="w-[1px] bg-white/10" />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdhkarFontSize(prev => Math.min(prev + 2, 40));
                      }}
                      className="p-1 px-2.5 hover:bg-white/20 transition-colors text-white font-bold"
                    >
                      أ+
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                        setConfirmDialog({
                            isOpen: true,
                            title: 'إعادة ضبط التقدم',
                            message: 'هل تريد إعادة تعيين تقدم هذا الذكر؟',
                            onConfirm: () => {
                                setAdhkarProgress({});
                                userInteracted.current = true;
                            }
                        });
                    }}
                    className="p-2 hover:bg-white/10 rounded-full text-emerald-200 dark:text-emerald-400"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold opacity-80 mb-1 px-1">
                  <span>تم إنجاز {getAdhkarProgressPercentage(selectedAdhkar)}%</span>
                  <span>{selectedAdhkar === 'morning' ? MORNING_ADHKAR.length : EVENING_ADHKAR.length} ذكر</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${getAdhkarProgressPercentage(selectedAdhkar)}%` }}
                     className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 dark:bg-[#020617]">
              {(selectedAdhkar === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR).map((dikr: any) => (
                <motion.div 
                   key={dikr.id}
                   className={`p-6 rounded-3xl border-2 transition-all cursor-pointer select-none ${
                     (adhkarProgress[dikr.id] || 0) >= dikr.repeat 
                       ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-500/30' 
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none hover:border-emerald-200 dark:hover:border-emerald-800'
                   }`}
                   onClick={() => incrementAdhkar(dikr.id, dikr.repeat, selectedAdhkar)}
                >
                  {dikr.title && (
                    <h3 className="text-emerald-600 dark:text-emerald-400 font-bold text-center mb-2">{dikr.title}</h3>
                  )}
                  <p 
                    className="leading-relaxed mb-4 text-emerald-900 dark:text-emerald-100 font-serif text-center"
                    style={{ fontSize: `${adhkarFontSize}px` }}
                  >
                    {dikr.text}
                  </p>
                  {dikr.description && (
                     <p className="text-[10px] text-emerald-500/80 dark:text-emerald-400/60 text-center mb-4 italic italic-arabic">
                       {dikr.description}
                     </p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-slate-400">التكرار: {dikr.repeat} / {adhkarProgress[dikr.id] || 0}</span>
                    <div className="flex flex-wrap flex-row-reverse justify-start max-w-[200px] gap-1">
                      {Array.from({ length: dikr.repeat }).map((_, i) => (
                        <div 
                           key={i} 
                           className={`w-7 h-7 rounded-lg flex items-center justify-center border-2 transition-all ${
                             (adhkarProgress[dikr.id] || 0) > i 
                               ? 'bg-emerald-500 border-emerald-500 text-white scale-90' 
                               : 'border-emerald-100 dark:border-emerald-800/50 text-gray-300 dark:text-slate-600 text-[10px]'
                           }`}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="h-24" />
            </div>

            <button 
              onClick={() => setSelectedAdhkar(null)}
              className="absolute bottom-6 left-6 right-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-md shadow-emerald-200"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showAudioHint && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-amber-500 text-white p-4 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/30 backdrop-blur-lg">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-2xl">
                <Volume2 size={24} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                 <p className="text-[10px] font-black leading-tight text-white">المتصفح يمنع الصوت تلقائياً</p>
                 <p className="text-[9px] font-bold opacity-90">اضغط هنا لتفعيل تنبيهات الأذان 🔊</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowAudioHint(false);
                sessionStorage.setItem('audio_unlocked', 'true');
                const audio = new Audio();
                audio.play().catch(() => {});
                setActiveNotification({ title: 'نظام الصوت جاهز', body: 'ستسمع صوت الأذان في مواقيته بنجاح إن شاء الله.' });
              }}
              className="bg-white text-amber-600 px-5 py-2.5 rounded-2xl text-[11px] font-black shadow-lg transform active:scale-95 transition-all"
            >
              تفعيل
            </button>
          </div>
        </div>
      )}

      {/* Reminder Settings Modal */}
      <AnimatePresence>
        {showReminderSettings && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-white dark:bg-[#020617] flex flex-col transition-colors"
          >
            <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 transition-colors">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center space-x-2 space-x-reverse">
                <BellRing className="text-emerald-600 dark:text-emerald-400" />
                <span>إعدادات التنبيهات</span>
              </h2>
              <div className="flex items-center space-x-2 space-x-reverse">
                {notificationPermission !== 'granted' && (
                  <button 
                    onClick={requestPermission}
                    className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-bold animate-pulse"
                  >
                    تفعيل التنبيهات
                  </button>
                )}
                <button 
                  onClick={() => setShowReminderSettings(false)}
                  className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-[#020617]">
              {/* Current Location & Prayer Mode Setting */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-5">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                      <Compass size={16} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">مواقيت الصلاة والقبلة</h3>
                  </div>
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                    <button 
                      onClick={() => setPrayerTimesMode('auto')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${prayerTimesMode === 'auto' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      تلقائي
                    </button>
                    <button 
                      onClick={() => setPrayerTimesMode('manual')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${prayerTimesMode === 'manual' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      يدوي
                    </button>
                  </div>
                </div>

                {prayerTimesMode === 'auto' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold opacity-80 leading-relaxed max-w-[60%] text-right ml-auto">
                        يستخدم زاد موقعك لتحديد مواقيت الصلاة واتجاه القبلة بدقة. قم بالتحديث عند السفر لمكان جديد.
                      </p>
                      <button 
                        onClick={updateLocation}
                        className="text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all shrink-0"
                      >
                        تحديث الموقع
                      </button>
                    </div>
                    {location && (
                      <div className="text-[9px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-center border border-slate-100 dark:border-slate-800">
                        الموقع الحالي: {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400/80 font-bold bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      في الوضع اليدوي، يمكنك تحديد أوقات الأذان بنفسك. يرجى التأكد من دقة المواعيد لضمان صحة التنبيهات. (القبلة تظل تعتمد على آخر موقع مسجل).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'fajr', label: 'الفجر' },
                        { id: 'dhuhr', label: 'الظهر' },
                        { id: 'asr', label: 'العصر' },
                        { id: 'maghrib', label: 'المغرب' },
                        { id: 'isha', label: 'العشاء' },
                      ].map(p => (
                        <div key={p.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl space-y-1">
                          <label className="text-[9px] font-black text-slate-400 block">{p.label}</label>
                          <input 
                            type="time" 
                            value={manualPrayerTimes[p.id]}
                            onChange={(e) => setManualPrayerTimes(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* App Font Size Setting */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">حجم خط التطبيق</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'small', label: 'صغير' },
                    { id: 'medium', label: 'متوسط' },
                    { id: 'large', label: 'كبير' }
                  ].map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setAppFontSize(size.id)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        appFontSize === size.id 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400 border border-transparent dark:border-slate-800'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reminders section starts here */}

              {/* Prayer Times Toggle */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white text-sm">تنبيهات الأذان</h3>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">تنبيه تلقائي عند دخول وقت كل صلاة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => triggerRealNotification('تجربة تنبيه الأذان', 'الله أكبر الله أكبر.. هذا تنبيه تجريبي للأذان', 'prayer_alerts')}
                      className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      تجربة
                    </button>
                    <label className={`p-1.5 rounded-lg cursor-pointer transition-colors ${customSounds['prayer_alerts'] ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-emerald-500'}`}>
                      <Music size={14} />
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={(e) => handleSoundUpload('prayer_alerts', e)}
                      />
                    </label>
                    <button 
                      onClick={() => {
                          setPrayerAlertsEnabled(!prayerAlertsEnabled);
                          if (!prayerAlertsEnabled && Notification.permission !== 'granted') {
                              Notification.requestPermission();
                          }
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${prayerAlertsEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                    >
                      <motion.div 
                        animate={{ x: prayerAlertsEnabled ? -24 : 4 }}
                        className="absolute top-1 right-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </div>

                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <p className="text-sm text-gray-400 dark:text-slate-500 font-bold">تنبيهات مخصصة لواجباتك</p>
                    <div className="relative">
                      <button 
                        onClick={() => setShowInfo(!showInfo)}
                        className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-help border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 transition-colors"
                      >
                        <Info size={12} className="text-emerald-500 dark:text-emerald-400" />
                      </button>
                      <AnimatePresence>
                        {showInfo && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="absolute bottom-full right-0 mb-2 w-48 p-4 bg-slate-800 dark:bg-slate-900 text-[11px] text-white rounded-2xl shadow-2xl border border-slate-700 z-50 leading-relaxed"
                          >
                            <p>لإضافة صوت مخصص (مثل الأذان)، يجب إضافة ملف الصوتي في إعدادات المتصفح أو ربط التطبيق بملف MP3 خارجي.</p>
                            <p className="mt-2 text-emerald-400">حالياً نستخدم نغمة تنبيه تقنية لضمان الخصوصية وسرعة التنبيه.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <button 
                    onClick={addReminder}
                    className="flex items-center space-x-1 space-x-reverse text-emerald-600 dark:text-emerald-400 font-bold text-sm"
                  >
                    <Plus size={18} />
                    <span>إضافة مـوعد</span>
                  </button>
                </div>

              {reminders.map((reminder) => (
                <motion.div 
                  key={reminder.id}
                  layout
                  className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none space-y-4 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input 
                          type="text" 
                          value={reminder.title} 
                          placeholder="اسم التنبيه"
                          onChange={(e) => setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, title: e.target.value } : r))}
                          className="font-bold text-gray-700 dark:text-slate-100 bg-transparent border-b border-transparent focus:border-emerald-200 dark:focus:border-emerald-800 outline-none flex-1"
                        />
                        <button 
                          onClick={() => testNotification(reminder.title, reminder.id)}
                          className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full font-bold hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                        >
                          تجربة
                        </button>
                      </div>
                      
                      {/* Audio File Picker */}
                      <div className="flex items-center gap-2 mt-2">
                        <label className={`flex items-center gap-2 cursor-pointer border px-3 py-1.5 rounded-xl transition-all ${customSounds[reminder.id] ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-700 hover:bg-emerald-50'}`}>
                          <Music size={12} className={customSounds[reminder.id] ? 'text-amber-500' : 'text-slate-400'} />
                          <span className={`text-[10px] font-bold ${customSounds[reminder.id] ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {customSounds[reminder.id] ? 'تغيير الصوت' : 'صوت مخصص (MP3)'}
                          </span>
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            onChange={(e) => handleSoundUpload(reminder.id, e)}
                          />
                        </label>
                        {customSounds[reminder.id] && (
                           <button 
                             onClick={() => removeSound(reminder.id)}
                             className="text-[9px] text-rose-500 font-black hover:underline px-1"
                           >
                             حذف
                           </button>
                        )}
                      </div>

                      <select 
                        value={reminder.habitId || 'none'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const h = habits.find(habit => habit.id === val);
                          const defaultTime = habitDefaultTimes[val] || reminder.time;
                          setReminders(prev => prev.map(r => r.id === reminder.id ? { 
                            ...r, 
                            habitId: val === 'none' ? undefined : val,
                            title: h ? h.title : (val === 'none' ? 'تنبيه جديد' : r.title),
                            time: val !== 'none' ? defaultTime : r.time
                          } : r));
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded px-2 py-0.5 outline-none border-none"
                      >
                        <option value="none">بدون ربط بعبادة</option>
                        {habits.map(h => (
                          <option key={h.id} value={h.id}>{h.title}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={() => deleteReminder(reminder.id)}
                      className="text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <div className="relative">
                        <input 
                          type="time" 
                          value={reminder.time}
                          onChange={(e) => setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, time: e.target.value } : r))}
                          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 font-bold outline-none"
                        />
                      </div>
                      <select 
                        value={reminder.recurrence}
                        onChange={(e) => setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, recurrence: e.target.value as any, customDays: e.target.value === 'custom' ? [0,1,2,3,4,5,6] : r.customDays } : r))}
                        className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-slate-400 text-xs px-2 py-2 rounded-xl outline-none"
                      >
                        <option value="daily">يومياً</option>
                        <option value="weekdays">أيام العمل</option>
                        <option value="weekly">أسبوعياً</option>
                        <option value="custom">أيام مخصصة</option>
                      </select>
                    </div>

                    <button 
                      onClick={() => toggleReminder(reminder.id)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${reminder.enabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                    >
                      <motion.div 
                        animate={{ x: reminder.enabled ? -24 : 4 }}
                        className="absolute top-1 right-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {reminder.recurrence === 'custom' && (
                    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, idx) => {
                        const isSelected = reminder.customDays?.includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const currentDays = reminder.customDays || [];
                              const newDays = isSelected 
                                ? currentDays.filter(d => d !== idx)
                                : [...currentDays, idx];
                              setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, customDays: newDays } : r));
                            }}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-gray-100 dark:bg-slate-900 text-gray-400 dark:text-slate-600'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Maintenance / Danger Zone */}
              <div className="bg-rose-50/30 dark:bg-rose-950/10 p-6 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/30 space-y-4">
                <h3 className="font-bold text-rose-800 dark:text-rose-400 text-sm">منطقة الصيانة</h3>
                <button 
                  onClick={forceResetDay}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-rose-100 dark:border-rose-900/20 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all group"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm">
                      <RotateCcw size={20} />
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-900 dark:text-rose-100 text-xs">تصفير عبادات اليوم</p>
                      <p className="text-[9px] text-rose-500 opacity-80">استخدمه إذا واجهت مشكلة في التحديث التلقائي</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-rose-300" />
                </button>
              </div>

              <div key="reminder-bottom-spacer" className="h-10" />
            </div>

            <button 
              onClick={() => setShowReminderSettings(false)}
              className="m-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-md shadow-emerald-200/50"
            >
              حفظ التغييرات
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-slate-700"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex space-x-3 space-x-reverse">
                <button 
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-md shadow-emerald-200 dark:shadow-none"
                >
                  تأكيد
                </button>
                <button 
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-4 rounded-2xl font-bold"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-emerald-50 dark:border-slate-800 flex items-center justify-around px-4 z-50 max-w-md mx-auto transition-colors">
        <button onClick={() => setActiveTab('today')} className={`flex flex-col items-center space-y-1 ${activeTab === 'today' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-slate-600'}`}>
          <Calendar size={20} />
          <span className="text-[9px] font-black">اليوم</span>
        </button>
        <button onClick={() => setActiveTab('social')} className={`flex flex-col items-center space-y-1 ${activeTab === 'social' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-slate-600'}`}>
          <Users size={20} />
          <span className="text-[9px] font-black">الأهل</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center space-y-1 ${activeTab === 'stats' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-slate-600'}`}>
          <Star size={20} />
          <span className="text-[9px] font-black">إنجازاتي</span>
        </button>
        <button onClick={() => setShowReminderSettings(true)} className="flex flex-col items-center space-y-1 text-gray-300 dark:text-slate-600 hover:text-emerald-500 transition-colors">
          <Settings size={20} />
          <span className="text-[9px] font-black">الإعدادات</span>
        </button>
      </nav>
    </div>
  );
}

interface SunnahItemProps {
  habit: Habit;
  idx: number;
  total: number;
  onToggle: (id: string) => void;
  key?: string | number;
}

function SunnahItem({ habit, idx, total, onToggle }: SunnahItemProps) {
  return (
    <div 
      onClick={() => onToggle(habit.id)}
      className={`flex items-center justify-between p-5 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/30 transition-all ${
        idx !== total - 1 ? 'border-b border-slate-200 dark:border-slate-800' : ''
      }`}
    >
      <div className="flex items-center space-x-4 space-x-reverse">
        <div className={`w-2.5 h-12 rounded-full shadow-sm transition-all ${habit.completed ? 'bg-emerald-500 shadow-emerald-200' : 'bg-slate-200 dark:bg-slate-700'}`} />
        <div>
          <h4 className={`font-bold text-lg ${habit.completed ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-300'}`}>{habit.title}</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold opacity-80">سنة مؤكدة</p>
        </div>
      </div>
      <div className={`w-8 h-8 rounded-2xl flex items-center justify-center border-2 shadow-sm transition-all ${
        habit.completed ? 'bg-emerald-500 border-emerald-500 text-white scale-110' : 'border-slate-200 dark:border-slate-700'
      }`}>
        {habit.completed && <CheckCircle2 size={16} className="text-white" />}
      </div>
    </div>
  );
}


