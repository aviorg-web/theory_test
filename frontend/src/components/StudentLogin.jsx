import React, { useState } from 'react';
import { supabase } from '../supabase';

export function StudentLogin({ onLogin, onCancel, intendedView }) {
  const [name, setName] = useState('');
  const [tz, setTz] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    if (!name.trim() || tz.length < 8 || !pin.trim()) {
      setError("אנא ודא שהזנת שם, תעודת זהות תקינה ופין-קוד.");
      return;
    }

    setLoading(true);
    // חיפוש בטבלת classes את ה- PIN שהזנת
    const { data: classData, error: dbError } = await supabase
      .from('classes')
      .select('id, class_name')
      .eq('pin_code', pin.trim())
      .single();

    setLoading(false);

    if (dbError || !classData) {
      setError("קוד המבחן (PIN) לא נמצא או שאינו חוקי. בדוק שוב.");
      return;
    }

    // שולחים ל- App את מזהה הכיתה שנמתא (uuid) יחד עם הפרטים
    onLogin({ name: name.trim(), tz: tz.trim(), class_id: classData.id });
  };

  return (
    <div className="h-screen flex items-center justify-center p-6 rtl font-sans relative bg-cover bg-center" style={{ backgroundImage: "url('/login-bg.jpg')" }}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-0"></div>
      
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl text-center relative z-10 border border-white/50 transition-all duration-300 hover:shadow-blue-900/20 hover:bg-white/90">
        <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">{intendedView === 'academy' ? 'כניסה לאקדמיה' : 'כניסת תלמיד'}</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-bold border border-red-100">{error}</div>}

        <input 
          value={name} onChange={e => setName(e.target.value)}
          placeholder="שם מלא" 
          className="w-full bg-blue-50 p-4 rounded-xl mb-4 text-slate-900 font-bold outline-none border border-blue-100 text-right" 
        />
        <input 
          value={tz} onChange={e => setTz(e.target.value)}
          placeholder="תעודת זהות (9 ספרות)" 
          maxLength="9" 
          type="tel" 
          className="w-full bg-blue-50 p-4 rounded-xl mb-4 text-slate-900 font-bold outline-none border border-blue-100 text-right" 
        />
        <input 
          value={pin} onChange={e => setPin(e.target.value)}
          placeholder={intendedView === 'academy' ? "קוד גישה מהמורה (PIN)" : "קוד מבחן מהמורה (PIN)"}
          className="w-full bg-blue-50 p-4 rounded-xl mb-8 text-blue-900 font-black tracking-widest text-center text-lg outline-none border-2 border-blue-200 focus:border-blue-500 transition-colors placeholder:text-blue-200 placeholder:tracking-normal placeholder:font-normal" 
        />
        
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-blue-600/30 shadow-lg active:scale-95 mb-4 hover:bg-blue-700 transition disabled:opacity-70"
        >
          {loading ? 'מאמת נתונים...' : intendedView === 'academy' ? 'היכנס ללמידה 📚' : 'הזנק מבחן 🚀'}
        </button>
        
        <button onClick={onCancel} className="text-slate-600 font-bold hover:text-slate-900 transition-colors">חזור למסך ראשי</button>
      </div>
    </div>
  );
}
