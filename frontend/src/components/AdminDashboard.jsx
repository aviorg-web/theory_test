import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function AdminDashboard({ onLogout, onEnterAcademy }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('focus');
  
  // Login / Auth states
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regSchool, setRegSchool] = useState('');
  const [regRole, setRegRole] = useState('TEACHER');
  const [authError, setAuthError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Dashboard Data states
  const [chapters, setChapters] = useState([]);
  const [blockedChapters, setBlockedChapters] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [learningResults, setLearningResults] = useState([]);

  // Questions Database states (Super Admin)
  const [allQuestions, setAllQuestions] = useState([]);
  const [dbSearch, setDbSearch] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [qPage, setQPage] = useState(0);

  // Academy Editing states
  const [studyChapters, setStudyChapters] = useState([]);
  const [editingChapter, setEditingChapter] = useState(null);

  // Forgot Password state
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Check initial session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && loadProfile) loadProfile(session);
    });
  }, []);

  async function loadProfile(currentSession) {
    const userEmail = currentSession.user.email;
    setLoading(true); setProfileError(null);
    
    // אנו משתמשים ב-maybeSingle במקום single כדי למנוע קריסה מוחלטת
    const { data, error } = await supabase.from('teachers').select('*').eq('email', userEmail).maybeSingle();
    
    if (error || !data) {
      setProfileError(`חסר רישום בטבלת teachers עבור המייל ${userEmail}. רשום את עצמך במסך הכניסה או פנה למנהל.`);
    } else {
      setProfile(data);
      if (data.status === 'approved' || String(data.role).toUpperCase() === 'SUPER_ADMIN') {
        const roleUp = String(data.role).toUpperCase();
        if (roleUp === 'SUPER_ADMIN') loadSuperAdminData();
        if (['SUPER_ADMIN', 'PRINCIPAL'].includes(roleUp)) loadPendingUsers(data);
        if (['TEACHER', 'PRINCIPAL', 'SUPER_ADMIN'].includes(roleUp)) {
          loadMyClasses(data.id);
        }
      }
    }
    setLoading(false);
  }

  const loadSuperAdminData = async () => {
    const { data: qData } = await supabase.from('questions').select('chapter_number');
    if (qData) {
      const unique = [...new Set(qData.map(q => String(q.chapter_number)))].filter(Boolean).sort();
      setChapters(unique);
    }
    const { data: sData } = await supabase.from('test_settings').select('excluded_chapters').single();
    if (sData && sData.excluded_chapters) setBlockedChapters(sData.excluded_chapters);
  };

  const loadPendingUsers = async (prf) => {
    let query = supabase.from('teachers').select('*').eq('status', 'pending');
    // אם הוא מנהל רגיל, הוא יראה רק ממתינים מבית הספר שלו
    if (prf.role === 'PRINCIPAL') {
      query = query.eq('school_symbol_1', prf.school_symbol_1);
    }
    const { data } = await query;
    if (data) setPendingUsers(data);
  };

  const loadMyClasses = async (userId) => {
    const { data } = await supabase.from('classes').select('*').eq('teacher_id', userId).order('id', { ascending: false });
    if (data) {
      setMyClasses(data);
      // במקביל שואבים תוצאות מבחן והתקדמות למידה של התלמידים בכיתות אלו
      const classIds = data.map(c => c.id);
      if (classIds.length > 0) {
        const { data: resData } = await supabase.from('test_results').select('*').in('class_id', classIds).order('created_at', { ascending: false });
        if (resData) setTestResults(resData);
        
        const { data: learnData } = await supabase.from('learning_progress').select('*').in('class_id', classIds).order('last_activity', { ascending: false });
        if (learnData) setLearningResults(learnData);
      }
    }
  };

  const deleteClass = async (classId) => {
    if (!window.confirm('האם לחלוטין למחוק כיתה זו?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) {
      alert("שגיאה במחיקת כיתה: " + error.message);
    } else {
      setMyClasses(prev => prev.filter(c => c.id !== classId));
      setTestResults(prev => prev.filter(r => r.class_id !== classId));
    }
  };

  const handleLogin = async () => {
    setLoading(true); setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("שגיאת התחברות: " + error.message);
    else {
      setSession(data.session);
      loadProfile(data.session);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !regName || !regSchool) {
      setAuthError("חובה למלא את כל השדות להרשמה (כולל סמל מוסד)."); return;
    }
    setLoading(true); setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { 
      setAuthError("שגיאת הרשמה: " + error.message); 
    } else if (data.user) {
      // Create user row in teachers
      const { error: dbError } = await supabase.from('teachers').insert([{
        id: data.user.id,
        email: email,
        full_name: regName,
        school_symbol_1: regSchool,
        role: regRole,
        status: regRole === 'SUPER_ADMIN' ? 'approved' : 'pending' // סופר אדמין יאושר אוטומטית רק לצורך טסטים, אחרת בהמתנה
      }]);
      if (dbError) setAuthError("שגיאת מסד נתונים: " + dbError.message);
      else {
        setSession(data.session);
        loadProfile(data.session);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setProfileError(null);
    onLogout();
  };

  // --- Actions ---
  const saveFocus = async () => {
    await supabase.from('test_settings').upsert({ id: 1, excluded_chapters: blockedChapters });
    alert("המיקוד נשמר בהצלחה בענן!");
  };

  const toggleChapter = (chap) => {
    setBlockedChapters(prev => prev.includes(chap) ? prev.filter(c => c !== chap) : [...prev, chap]);
  };

  const loadQuestionsDB = async () => {
    setLoading(true);
    const { data } = await supabase.from('questions').select('*').order('id', { ascending: false });
    if (data) setAllQuestions(data);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'questions' && profile?.role === 'SUPER_ADMIN') {
      loadQuestionsDB();
    }
    if (activeTab === 'academy_admin') {
      loadStudyChapters();
    }
  }, [activeTab, profile]);

  const loadStudyChapters = async () => {
    setLoading(true);
    const { data } = await supabase.from('study_chapters').select('*').order('chapter_number');
    if (data) setStudyChapters(data);
    setLoading(false);
  };

  const handleSaveChapter = async () => {
    setLoading(true);
    const { error } = await supabase.from('study_chapters').update({
      title: editingChapter.title,
      content_md: editingChapter.content_md
    }).eq('id', editingChapter.id);
    if (!error) {
      setEditingChapter(null);
      loadStudyChapters();
    } else {
      alert("שגיאה בעדכון: " + error.message);
    }
    setLoading(false);
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion.question_text || !editingQuestion.chapter_number) return alert("שדות חובה חסרים");
    
    const payload = {
      chapter_number: Number(editingQuestion.chapter_number),
      question_text: editingQuestion.question_text,
      option_1: editingQuestion.option_1 || '',
      option_2: editingQuestion.option_2 || '',
      option_3: editingQuestion.option_3 || '',
      option_4: editingQuestion.option_4 || '',
      correct_answer_index: Number(editingQuestion.correct_answer_index) || 1,
      image_url: editingQuestion.image_url || null
    };

    setLoading(true);
    if (editingQuestion.id) {
       await supabase.from('questions').update(payload).eq('id', editingQuestion.id);
    } else {
       await supabase.from('questions').insert([payload]);
    }
    setEditingQuestion(null);
    loadQuestionsDB(); // reload
  };

  const handleDeleteQuestion = async (qId) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק שאלה זו לצמיתות?")) {
      await supabase.from('questions').delete().eq('id', qId);
      loadQuestionsDB();
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError("אנא הזן כתובת אימייל כדי לשחזר את הסיסמה.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) {
      setAuthError("שגיאה שליחת מייל לשחזור: " + error.message);
    } else {
      setResetSent(true);
      setAuthError(null);
    }
    setLoading(false);
  };

  const approveUser = async (tId) => {
    await supabase.from('teachers').update({ status: 'approved' }).eq('id', tId);
    loadPendingUsers(profile);
  };

  const deleteUser = async (tId) => {
    if (window.confirm('למחוק/לדחות בקשה זו? הפעולה תסיר את המשתמש מהרשימה.')) {
      await supabase.from('teachers').delete().eq('id', tId);
      loadPendingUsers(profile);
    }
  };

  const createClass = async () => {
    if (!newClassName.trim()) {
      alert("אנא הקלד את שם או מספר הכיתה בתיבת הטקסט הלבנה לפני יצירת כיתה.");
      return;
    }
    // גינרוט קוד PIN של 5 תווים מונע בלבול (ללא O ו-0)
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
    let pin = "";
    for (let i = 0; i < 5; i++) pin += charset.charAt(Math.floor(Math.random() * charset.length));
    
    const { error } = await supabase.from('classes').insert([{
      teacher_id: profile.id,
      class_name: newClassName.trim(),
      pin_code: pin
    }]);

    if (error) {
      console.error("Error creating class:", error);
      alert("שגיאה ביצירת הכיתה: " + error.message);
      return;
    }

    setNewClassName('');
    loadMyClasses(profile.id);
  };


  // ================= RENDER BLOCKS =================
  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 rtl font-sans bg-cover bg-center relative" style={{ backgroundImage: "url('/login-bg.jpg')" }}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-0"></div>
        <div className="w-full max-w-md bg-white/80 p-10 rounded-[2.5rem] shadow-2xl text-center border border-white/50 backdrop-blur-xl relative z-10 transition-all duration-300 hover:shadow-blue-900/20 hover:bg-white/90">
          <h2 className="text-3xl font-black text-slate-800 mb-8">{isRegistering ? 'הרשמה לצוות' : 'כניסת צוות הוראה'}</h2>
          
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-bold border border-red-100">{authError}</div>}
          {resetSent && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm mb-4 font-bold border border-emerald-200">מייל לשחזור סיסמה נשלח בהצלחה לכתובת {email}. בדוק את תיבת הדואר הנכנס.</div>}
          
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="אימייל" className="w-full bg-slate-50 p-4 rounded-xl mb-4 text-slate-900 border border-slate-100 outline-none text-left" dir="ltr" />
          
          {!isResetting && (
            <div className="relative mb-2 w-full">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="סיסמה" className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-100 outline-none text-left" dir="ltr" />
              <button tabindex="-1" type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-50 px-2">
                {showPassword ? 'הסתר' : 'הצג'}
              </button>
            </div>
          )}

          {!isRegistering && !isResetting && (
            <button onClick={() => { setIsResetting(true); setAuthError(null); setResetSent(false); }} className="text-blue-500 font-semibold text-xs mb-4 text-left w-full hover:underline">
              שכחתי סיסמה
            </button>
          )}

          {isRegistering && !isResetting && (
            <div className="space-y-4 mb-6 mt-2 border-t border-slate-100 pt-6">
              <input type="text" value={regName} onChange={e=>setRegName(e.target.value)} placeholder="שם מלא" className="w-full bg-blue-50/50 p-4 rounded-xl border border-blue-200 outline-none text-right font-bold text-slate-900 placeholder-slate-500 focus:bg-white focus:border-blue-400 transition-all shadow-sm" />
              <input type="text" value={regSchool} onChange={e=>setRegSchool(e.target.value)} placeholder="סמל מוסד (משתמש לשיוך)" className="w-full bg-blue-50/50 p-4 rounded-xl border border-blue-200 outline-none text-right font-bold text-slate-900 placeholder-slate-500 focus:bg-white focus:border-blue-400 transition-all shadow-sm" />
              <select value={regRole} onChange={e=>setRegRole(e.target.value)} className="w-full bg-blue-50/50 p-4 rounded-xl border border-blue-200 outline-none text-right appearance-none font-bold text-slate-900 focus:bg-white focus:border-blue-400 transition-all shadow-sm">
                <option value="TEACHER">אני מורה</option>
                <option value="PRINCIPAL">אני מנהל מוסד</option>
              </select>
            </div>
          )}

          {isResetting ? (
            <button onClick={handleResetPassword} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 mb-4 hover:bg-blue-700 transition">{loading ? 'טוען...' : 'שלח קישור איפוס'}</button>
          ) : isRegistering ? (
            <button onClick={handleRegister} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 mb-4 hover:bg-blue-700 transition">{loading ? 'טוען...' : 'הגש בקשת הצטרפות'}</button>
          ) : (
             <button onClick={handleLogin} disabled={loading} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 mb-4 hover:bg-slate-700 transition">{loading ? 'טוען...' : 'התחבר למערכת'}</button>
          )}

          <div className="flex justify-between items-center px-2">
             <button onClick={() => { setIsRegistering(!isRegistering); setIsResetting(false); setAuthError(null); setResetSent(false); }} className="text-blue-500 font-bold text-sm hover:underline">
               {isRegistering ? 'יש לך חשבון? התחבר' : isResetting ? 'חזרה להתחברות' : 'מורה חדש? הירשם כאן'}
             </button>
             <button onClick={onLogout} className="text-slate-400 font-bold text-sm hover:text-slate-600">חזור למערכת</button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    if (profileError) {
      return (
        <div className="h-screen bg-[#f0f7ff] flex flex-col justify-center items-center p-6 rtl font-sans">
           <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-xl text-center border border-red-100 relative">
             <div className="text-red-500 text-5xl mb-4">⚠️</div>
             <h2 className="text-2xl font-bold text-slate-800 mb-4">פרופיל חסר או שגוי</h2>
             <p className="text-slate-600 mb-8 font-semibold">{profileError}</p>
             <button onClick={handleLogout} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold transition">ניתוק וחזרה למסך הראשי</button>
           </div>
        </div>
      );
    }
    return <div className="h-screen bg-[#f0f7ff] flex justify-center items-center font-bold text-xl text-blue-600">שואב נתונים מאובטחים מהרשת...</div>;
  }

  if (profile.status === 'pending' && profile.role !== 'SUPER_ADMIN') {
    return (
      <div className="h-screen bg-[#f0f7ff] flex flex-col justify-center items-center p-6 rtl font-sans text-center">
         <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl border border-green-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-green-500"></div>
           <div className="text-6xl mb-6">😊</div>
           <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">נרשמת בהצלחה!</h2>
           <p className="text-slate-600 mb-8 leading-relaxed font-bold text-lg">
             בקשתך נרשמה במערכת.<br/>אישור יתקבל בהקדם!
           </p>
           <div className="bg-slate-50 p-4 rounded-xl mb-8 border border-slate-100">
             <span className="text-sm opacity-60 font-semibold mb-1 block">פרטי הבקשה שנשלחה להנהלה:</span>
             <span className="text-sm font-bold text-slate-700 block">מוסד: {profile.school_symbol_1 || 'לא צוין'} | תקן: {profile.role === 'PRINCIPAL' ? 'מנהל' : 'מורה'}</span>
           </div>
           <button onClick={handleLogout} className="w-full bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 py-4 rounded-2xl font-bold active:scale-95 transition-all">התנתק בינתיים</button>
         </div>
      </div>
    );
  }

  // Permissions Booleans
  const isSA = profile.role === 'SUPER_ADMIN';
  const isPr = profile.role === 'PRINCIPAL';

  return (
    <div className="h-screen bg-[#f0f7ff] p-4 md:p-6 rtl font-sans overflow-hidden flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex justify-between items-center mb-6 bg-white py-4 px-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">TheoryAI Dashboard</h2>
          <p className="text-slate-500 font-medium text-sm">מחובר כ- {profile.full_name} ({profile.role}) <span className="opacity-50">| סמל: {profile.school_symbol_1 || 'ארצי'}</span></p>
        </div>
        <button onClick={handleLogout} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-bold hover:bg-red-100 active:scale-95 transition-all outline-none">יציאה</button>
      </div>

      <div className="max-w-6xl mx-auto w-full flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide snap-x">
        <button onClick={()=>setActiveTab('classes')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='classes' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>🏫 ניהול כיתות</button>
        <button onClick={()=>setActiveTab('learning')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='learning' ? 'bg-purple-600 text-white shadow-purple-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>📚 מעקב תרגול</button>
        <button onClick={()=>setActiveTab('results')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='results' ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>📈 הישגים</button>
        {(isSA || isPr) && <button onClick={()=>setActiveTab('staff')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='staff' ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>👨‍🏫 אישורי סגל <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm mr-1">{pendingUsers.length}</span></button>}
        {isSA && <button onClick={()=>setActiveTab('focus')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='focus' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>🎯 מערך מיקוד</button>}
        {isSA && <button onClick={()=>setActiveTab('questions')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='questions' ? 'bg-pink-600 text-white shadow-pink-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>❔ מאגר שאלות</button>}
        <button onClick={()=>setActiveTab('academy_admin')} className={`flex-none md:flex-1 py-3 px-6 whitespace-nowrap font-bold rounded-2xl transition-all shadow-sm snap-start ${activeTab==='academy_admin' ? 'bg-sky-600 text-white shadow-sky-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}>📚 מודל למידה</button>
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 overflow-y-auto scrollbar-hide pb-10">
        
        {/* ================= CLASSES TAB ================= */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100 flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">פתיחת כיתת מבחן חדשה</h3>
                <p className="text-sm text-slate-500">יוצר קוד PIN ייחודי לשיתוף עם הנבחנים.</p>
              </div>
              <input type="text" value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="רשום כאן את שם / מספר הכיתה" className="flex-1 bg-white p-4 rounded-xl border-2 border-blue-200 outline-none text-right font-bold text-slate-800 placeholder-slate-500 focus:border-blue-400 transition-colors" />
              <button onClick={createClass} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-md hover:bg-blue-700 transition active:scale-95">חולל קוד כיתה</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {myClasses.map(cls => (
                <div key={cls.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden group">
                  <button onClick={() => deleteClass(cls.id)} className="absolute top-3 left-3 z-20 text-slate-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all" title="מחק כיתה">🗑️</button>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
                  <h4 className="font-bold text-xl text-slate-800 mb-2 relative z-10">{cls.class_name || cls.name}</h4>
                  <p className="text-slate-400 text-sm mb-4 relative z-10">מספר סידורי פנימי: {cls.id}</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl py-4 mb-2">
                    <span className="block text-sm text-blue-600 font-bold mb-1">קוד התחברות לתלמיד (PIN)</span>
                    <span className="text-4xl font-black text-blue-900 tracking-[0.2em]">{cls.pin_code}</span>
                  </div>
                </div>
              ))}
              {myClasses.length === 0 && <div className="col-span-3 text-center py-10 text-slate-400 font-bold">לא יצרת אף כיתה במערכת עדיין.</div>}
            </div>
          </div>
        )}

        {/* ================= RESULTS TAB ================= */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
               <h3 className="font-bold text-emerald-900 text-xl">מעקב הישגים וקרדיטציה</h3>
               <span className="text-sm font-semibold bg-emerald-200 text-emerald-800 px-4 py-1 rounded-full">{testResults.length} בחינות הוגשו</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="p-4 font-bold">מזהה מבחן</th>
                    <th className="p-4 font-bold">כיתה (Class)</th>
                    <th className="p-4 font-bold">שם הנבחן</th>
                    <th className="p-4 font-bold">תעודת זהות</th>
                    <th className="p-4 font-bold text-center">ציון במערכת</th>
                    <th className="p-4 font-bold">תאריך הגשה</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map(res => (
                    <tr key={res.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="p-4 font-mono text-xs opacity-50">{res.id}</td>
                      <td className="p-4 font-bold text-slate-700">{myClasses.find(c => c.id === res.class_id)?.class_name || res.class_id}</td>
                      <td className="p-4 font-bold">{res.student_name}</td>
                      <td className="p-4 font-mono">{res.student_id}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-black ${res.score >= 27 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {res.score} / 30
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">{new Date(res.created_at).toLocaleDateString('he-IL')} {new Date(res.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {testResults.length === 0 && <div className="text-center py-20 text-slate-400 font-bold">אין תוצאות להצגה שייכות לכיתות שלך.</div>}
            </div>
          </div>
        )}

        {/* ================= LEARNING PROGRESS TAB ================= */}
        {activeTab === 'learning' && (
          <div className="bg-white rounded-3xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="p-6 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
               <h3 className="font-bold text-purple-900 text-xl">מעקב תרגול באקדמיה</h3>
               <span className="text-sm font-semibold bg-purple-200 text-purple-800 px-4 py-1 rounded-full">{learningResults.length} פעילויות</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="p-4 font-bold">כיתה</th>
                    <th className="p-4 font-bold">שם התלמיד</th>
                    <th className="p-4 font-bold">פרק תעבורה</th>
                    <th className="p-4 font-bold text-center">שאלות שתרגל</th>
                    <th className="p-4 font-bold text-center">ניקוד פנימי</th>
                    <th className="p-4 font-bold">פעילות אחרונה</th>
                  </tr>
                </thead>
                <tbody>
                  {learningResults.map(res => (
                    <tr key={res.id} className="border-b border-slate-50 hover:bg-purple-50/50 transition">
                      <td className="p-4 font-bold text-slate-700">{myClasses.find(c => c.id === res.class_id)?.class_name || res.class_id}</td>
                      <td className="p-4 font-bold">{res.student_name}</td>
                      <td className="p-4 font-bold text-purple-700">פרק {res.chapter_number}</td>
                      <td className="p-4 text-center font-bold text-slate-600">{res.questions_answered}</td>
                      <td className="p-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-full font-black bg-amber-100 text-amber-700">
                          🪙 {res.score}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">{new Date(res.last_activity).toLocaleDateString('he-IL')} {new Date(res.last_activity).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {learningResults.length === 0 && <div className="text-center py-20 text-slate-400 font-bold">אין פעילויות למידה מתועדות לתלמידיך עדיין.</div>}
            </div>
          </div>
        )}

        {/* ================= STAFF APPROVAL TAB ================= */}
        {activeTab === 'staff' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-100">
            <h3 className="font-bold text-indigo-900 text-xl mb-2">ניהול אישורי סגל וטריאז'</h3>
            <p className="text-slate-500 mb-8 text-sm">מורים ממתינים לשייכות קבע למייל. {isPr ? 'מוצגים מורים מסמל המוסד שלך בלבד.' : ''}</p>
            
            <div className="grid gap-4">
              {pendingUsers.map(u => (
                <div key={u.id} className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition shadow-sm">
                  <div>
                    <h4 className="font-bold text-slate-800 text-lg">{u.full_name} <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded ml-2">{u.role}</span></h4>
                    <p className="text-slate-500 text-sm">{u.email} | משויך לסמל מוסד: <b className="text-slate-700">{u.school_symbol_1 || 'חסר'}</b></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => deleteUser(u.id)} className="bg-white border border-red-200 text-red-500 font-bold px-4 py-2 rounded-xl hover:bg-red-50 active:scale-95 shadow-sm transition">דחה בקשה</button>
                    <button onClick={() => approveUser(u.id)} className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-indigo-700 active:scale-95 shadow transition">אשר העסקה</button>
                  </div>
                </div>
              ))}
              {pendingUsers.length === 0 && <div className="text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">נקי! אין חברי צוות בהמתנה לאישור הנהלה בקנה.</div>}
            </div>
          </div>
        )}

        {/* ================= FOCUS TAB ================= */}
        {activeTab === 'focus' && isSA && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-amber-200 text-right">
             <h3 className="text-xl font-bold text-amber-900 mb-2">מערך המיקוד הארצי</h3>
             <p className="text-slate-600 mb-6 text-sm">סמן פרקים כחסומים כדי למנוע ירידתם במחולל האקראי בכל רחבי הארץ.</p>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pr-2 mb-8">
               {chapters.map(ch => (
                 <label key={ch} className={`flex items-center gap-3 p-4 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors ${blockedChapters.includes(ch) ? 'border-amber-300 bg-amber-50' : 'border-slate-100'}`}>
                   <input type="checkbox" checked={blockedChapters.includes(ch)} onChange={() => toggleChapter(ch)} className="w-5 h-5 accent-amber-500" />
                   <span className="font-bold text-slate-700">פרק / נושא {ch}</span>
                 </label>
               ))}
             </div>
             <button onClick={saveFocus} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-xl font-bold shadow-md active:scale-95 transition">שְגַר למסד נתונים סנטרל</button>
          </div>
        )}

        {/* ================= QUESTIONS MANAGER TAB ================= */}
        {activeTab === 'questions' && isSA && (
          <div className="bg-white rounded-3xl shadow-sm border border-pink-100 overflow-hidden relative">
             <div className="p-6 bg-pink-50 border-b border-pink-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-pink-900 text-xl">מאגר שאלות כולל</h3>
                  <span className="bg-pink-200 text-pink-800 px-3 py-1 rounded-full text-xs font-bold">{allQuestions.length} שאלות במערכת</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <input type="text" value={dbSearch} onChange={e=> { setDbSearch(e.target.value); setQPage(0); }} placeholder="חיפוש טקסט חופשי..." className="px-4 py-2 rounded-xl border border-pink-200 outline-none w-full md:w-64" />
                  <button onClick={() => setEditingQuestion({ correct_answer_index: 1 })} className="bg-pink-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-pink-700 active:scale-95 whitespace-nowrap">➕ שאלה חדשה</button>
                </div>
             </div>

             <div className="p-4 grid gap-2">
                {allQuestions.filter(q => (q.question_text||'').includes(dbSearch) || String(q.chapter_number).includes(dbSearch)).slice(qPage*50, (qPage+1)*50).map(q => (
                  <div key={q.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-xl border border-slate-100 hover:border-pink-200 hover:bg-pink-50 transition">
                    <div className="flex-1 pr-2 mb-2 md:mb-0">
                      <p className="font-bold text-sm text-slate-800 line-clamp-2">{q.question_text}</p>
                      <p className="text-xs text-slate-400 mt-1">פרק {q.chapter_number} | מזהה: {q.id}</p>
                    </div>
                    <div className="flex gap-2 self-end mt-2 md:mt-0">
                      <button onClick={() => setEditingQuestion({...q})} className="bg-white border border-slate-200 text-slate-600 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition">ערוך</button>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-50 transition">מחק</button>
                    </div>
                  </div>
                ))}
             </div>
             
             <div className="p-4 flex justify-center gap-4 bg-slate-50 border-t border-slate-100">
               <button disabled={qPage===0} onClick={()=>setQPage(p=>p-1)} className="font-bold text-pink-600 disabled:opacity-30">הקודם</button>
               <span className="font-bold text-slate-500">עמוד {qPage + 1}</span>
               <button disabled={allQuestions.length <= (qPage+1)*50} onClick={()=>setQPage(p=>p+1)} className="font-bold text-pink-600 disabled:opacity-30">הבא</button>
             </div>

             {/* Modal for Edit / Add */}
             {editingQuestion && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rtl font-sans">
                 <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 border border-slate-200 overflow-y-auto max-h-[90vh]">
                   <h3 className="text-xl font-bold mb-4">{editingQuestion.id ? 'עריכת שאלה' : 'יצירת שאלה חדשה'}</h3>
                   <div className="grid gap-4 mb-6">
                     <div><label className="text-sm font-bold opacity-70 mb-1 block">מספר פרק הקשרי</label>
                      <input type="number" value={editingQuestion.chapter_number || ''} onChange={e=>setEditingQuestion({...editingQuestion, chapter_number: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200" />
                     </div>
                     <div><label className="text-sm font-bold opacity-70 mb-1 block">תוכן השאלה המלא</label>
                      <textarea rows="3" value={editingQuestion.question_text || ''} onChange={e=>setEditingQuestion({...editingQuestion, question_text: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200"></textarea>
                     </div>
                     <div className="grid md:grid-cols-2 gap-4">
                       {[1,2,3,4].map(idx => (
                         <div key={idx}><label className="text-sm font-bold opacity-70 mb-1 block">אופציה {idx}</label>
                          <input type="text" value={editingQuestion[`option_${idx}`] || editingQuestion[`option${idx}`] || ''} onChange={e=>setEditingQuestion({...editingQuestion, [`option_${idx}`]: e.target.value})} className={`w-full p-3 rounded-xl bg-slate-50 border ${Number(editingQuestion.correct_answer_index) === idx ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`} />
                         </div>
                       ))}
                     </div>
                     <div className="grid md:grid-cols-2 gap-4">
                       <div><label className="text-sm font-bold opacity-70 mb-1 block">תשובה נכונה (1-4)</label>
                        <select value={editingQuestion.correct_answer_index || 1} onChange={e=>setEditingQuestion({...editingQuestion, correct_answer_index: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold">
                          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                        </select>
                       </div>
                       <div><label className="text-sm font-bold opacity-70 mb-1 block">כתובת תמונה מרושתת (URL) - רשות</label>
                        <input type="text" value={editingQuestion.image_url || ''} onChange={e=>setEditingQuestion({...editingQuestion, image_url: e.target.value})} dir="ltr" className="w-full p-3 text-left rounded-xl bg-slate-50 border border-slate-200" />
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                     <button onClick={() => setEditingQuestion(null)} className="px-6 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-50">ביטול</button>
                     <button onClick={handleSaveQuestion} disabled={loading} className="px-8 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 shadow-md">שמור שינויים במערכת!</button>
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* ================= ACADEMY ADMIN TAB ================= */}
        {activeTab === 'academy_admin' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 text-right">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-sky-50 p-6 rounded-2xl border border-sky-100">
                <div>
                   <h3 className="text-2xl font-black text-sky-900 mb-2">מודל האקדמיה לנהיגה</h3>
                   <p className="text-slate-600 font-medium">כניסה למודל כצופה מאפשרת לחוות את הלמידה בדיוק כמו תלמיד.<br/>כמו כן, ניתן לערוך את חומרי העזר והטקסטים.</p>
                </div>
                {onEnterAcademy && <button onClick={onEnterAcademy} className="bg-sky-600 text-white font-black px-8 py-4 rounded-2xl hover:bg-sky-700 active:scale-95 shadow-xl transition whitespace-nowrap">כניסה למודל תרגול ולמידה 🚀</button>}
             </div>
             
             <h4 className="font-bold text-slate-800 text-xl mb-4">ניהול ועריכת פרקי לימוד</h4>
             <div className="grid gap-3">
               {studyChapters.length === 0 ? (
                 <div className="text-slate-500 bg-slate-50 p-4 rounded-xl border border-dashed text-center">טוען פרקים או שאין פרקים...</div>
               ) : (
                 studyChapters.map(ch => (
                   <div key={ch.id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition">
                     <div>
                       <span className="text-xs font-bold text-sky-600 bg-sky-100 px-2 py-1 rounded-md">פרק {ch.chapter_number}</span>
                       <h5 className="font-bold text-slate-800 mt-1">{ch.title}</h5>
                     </div>
                     <button onClick={() => setEditingChapter({...ch})} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-sky-50 transition shadow-sm">ערוך תוכן</button>
                   </div>
                 ))
               )}
             </div>

             {/* Edit Chapter Modal */}
             {editingChapter && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm rtl font-sans">
                 <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-200 overflow-y-auto max-h-[90vh]">
                   <div className="flex justify-between items-center mb-6">
                     <h3 className="text-2xl font-black text-slate-800">עריכת פרק {editingChapter.chapter_number}</h3>
                     <button onClick={() => setEditingChapter(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
                   </div>
                   <div className="grid gap-6 mb-6">
                     <div>
                      <label className="text-sm font-bold opacity-70 mb-2 block">כותרת הפרק</label>
                      <input type="text" value={editingChapter.title || ''} onChange={e=>setEditingChapter({...editingChapter, title: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-bold text-lg" />
                     </div>
                     <div>
                      <label className="text-sm font-bold opacity-70 mb-2 block flex justify-between">
                        <span>תוכן הפרק (נתמך Markdown עיצוב עשיר)</span>
                      </label>
                      <textarea rows="12" value={editingChapter.content_md || ''} onChange={e=>setEditingChapter({...editingChapter, content_md: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-medium leading-relaxed resize-y" dir="rtl"></textarea>
                     </div>
                   </div>
                   <div className="flex gap-4 justify-end pt-4 border-t border-slate-100">
                     <button onClick={() => setEditingChapter(null)} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition">ביטול</button>
                     <button onClick={handleSaveChapter} disabled={loading} className="px-8 py-3 rounded-xl bg-sky-600 text-white font-black hover:bg-sky-700 shadow-lg active:scale-95 transition">{loading ? 'שומר...' : 'שמור שינויים'}</button>
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
}
