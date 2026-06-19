import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from 'firebase/auth';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Shield, Sparkles, Globe, User, Lock, Mail } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (uid: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to ensure user profile exists in Firestore /users/{uid}
  const createProfileIfMissing = async (uid: string, emailStr: string | null, nameStr: string | null) => {
    const userRef = doc(db, 'users', uid);
    let userDoc;
    try {
      userDoc = await getDoc(userRef);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }

    if (!userDoc.exists()) {
      try {
        await setDoc(userRef, {
          uid,
          email: emailStr || `guest_${uid.substring(0, 5)}@micronation.net`,
          displayName: nameStr || `Citizen #${uid.substring(0, 4)}`,
          micronationId: null,
          rank: 'Resident',
          title: 'Aspiring Citizen',
          joinedAt: new Date().toISOString()
        });
      } catch (err: any) {
        console.error("Error creating profile:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await createProfileIfMissing(result.user.uid, result.user.email, result.user.displayName);
        onAuthSuccess(result.user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Authentication failed. If popups are blocked inside this frame, please use Email or Guest mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await createProfileIfMissing(result.user.uid, email, displayName || email.split('@')[0]);
        onAuthSuccess(result.user.uid);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await createProfileIfMissing(result.user.uid, email, null);
        onAuthSuccess(result.user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Double check your email/password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInAnonymously(auth);
      if (result.user) {
        await createProfileIfMissing(
          result.user.uid, 
          `guest_${result.user.uid.substring(0, 5)}@micronation.net`, 
          displayName || `Commander ${result.user.uid.substring(0, 4)}`
        );
        onAuthSuccess(result.user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Guest Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 selection:bg-teal-500 selection:text-slate-900" id="auth-screen-container">
      <div className="w-full max-w-lg bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 md:p-8 shadow-xl backdrop-blur-md" id="auth-card">
        
        {/* Title / Logo Header */}
        <div className="text-center mb-8" id="logo-header">
          <div className="inline-flex items-center justify-center p-3.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl mb-4 animate-pulse">
            <Globe className="w-8 h-8" id="globe-icon" />
          </div>
          <h1 className="text-3xl font-sans font-bold tracking-tight text-white mb-2" id="app-title">
            Micronation Hub
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto" id="app-subtitle">
            Govern local soil, shape borders, run specialized economies, draft laws, and manage citizens of your unrecognized country.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-6 text-center leading-relaxed" id="auth-error">
            {error}
          </div>
        )}

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-4" id="auth-form">
          {isSignUp && (
            <div className="space-y-1.5" id="group-displayname">
              <label className="text-xs font-mono text-slate-400 block" htmlFor="input-displayName">Sovereign / Citizen Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="input-displayName"
                  type="text"
                  placeholder="e.g. Emperor Josh"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 text-white placeholder-slate-500"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5" id="group-email">
            <label className="text-xs font-mono text-slate-400 block" htmlFor="input-email">Secretariat Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="input-email"
                type="email"
                required
                placeholder="republic@sovereign.org"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 text-white placeholder-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5" id="group-password">
            <label className="text-xs font-mono text-slate-400 block" htmlFor="input-password">Secure Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="input-password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 text-white placeholder-slate-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-medium rounded-xl text-sm transition-colors duration-200 mt-2 disabled:bg-slate-700 disabled:text-slate-400 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? 'Processing...' : isSignUp ? 'Inaugurate Micronation' : 'Log Into Sovereignty'}
          </button>
        </form>

        <div className="text-center mt-4" id="is-signup-toggle">
          <button
            id="btn-toggle-mode"
            type="button"
            className="text-xs text-slate-400 hover:text-teal-400 transition-colors uppercase tracking-wider font-mono cursor-pointer"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Already registered? Log In' : 'Need state papers? Enlist Here'}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6" id="auth-divider">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-800 px-3 text-mono text-slate-500">OR PROCEED SECURELY WITH</span>
          </div>
        </div>

        {/* OAuth/Alternative buttons */}
        <div className="grid grid-cols-2 gap-3" id="oauth-grid">
          <button
            id="btn-google-signin"
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-750 border border-slate-700 hover:border-slate-650 rounded-xl text-xs font-medium text-slate-200 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Google Login
          </button>

          <button
            id="btn-fast-sandbox"
            type="button"
            disabled={loading}
            onClick={handleGuestSignIn}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-750 border border-slate-700 hover:border-slate-650 rounded-xl text-xs font-medium text-slate-200 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-teal-400" />
            Quick Guest (Demo)
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-500 font-mono mt-6 leading-relaxed" id="security-assurance">
          <Sparkles className="w-3 h-3 text-teal-500 inline-block mr-1" />
          Secured via Firebase Shield. Perfect for micro-state leaders.
        </p>
      </div>
    </div>
  );
}
