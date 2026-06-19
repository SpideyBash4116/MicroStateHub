import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { UserRecord, Micronation } from './types';
import AuthScreen from './components/AuthScreen';
import MapPlanner from './components/MapPlanner';
import EconomyPanel from './components/EconomyPanel';
import DiplomacyPanel from './components/DiplomacyPanel';
import CitizenManager from './components/CitizenManager';
import LawsConstitution from './components/LawsConstitution';

import { 
  Globe, 
  Compass, 
  Coins, 
  Users, 
  Gavel, 
  LogOut, 
  Terminal, 
  MapPin, 
  Apple, 
  Flame, 
  Hammer, 
  TrendingUp, 
  Smile, 
  ShieldCheck, 
  Plus, 
  RefreshCw,
  Award
} from 'lucide-react';

export default function App() {
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Micronation selection
  const [myMicronation, setMyMicronation] = useState<Micronation | null>(null);
  const [allMicronations, setAllMicronations] = useState<Micronation[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'borders' | 'economy' | 'diplomacy' | 'citizenry' | 'constitution'>('dashboard');

  // Creation state
  const [newMicroName, setNewMicroName] = useState('');
  const [newMicroMotto, setNewMicroMotto] = useState('');
  const [newMicroDesc, setNewMicroDesc] = useState('');
  const [newMicroCurrency, setNewMicroCurrency] = useState('');
  const [creating, setCreating] = useState(false);

  // Joining state
  const [joiningTitle, setJoiningTitle] = useState('Senior Diplomat');
  const [joiningRank, setJoiningRank] = useState<UserRecord['rank']>('Citizen');
  const [consentText, setConsentText] = useState(false);

  // Connection check
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.error("Please check your Firebase configuration: client appears offline.");
        }
      }
    }
    testConnection();
  }, []);

  // Sync auth and user directory record
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user doc
        const userRef = doc(db, 'users', user.uid);
        
        // Listen to active user changes in real-time!
        const unsubUser = onSnapshot(userRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserRecord;
            setActiveUser(data);
            
            // Sync user's micronation details if they belong to one
            if (data.micronationId) {
              const microRef = doc(db, 'micronations', data.micronationId);
              // Listen to micronation changes in real-time!
              onSnapshot(microRef, (mSnap) => {
                if (mSnap.exists()) {
                  setMyMicronation({ id: mSnap.id, ...mSnap.data() } as Micronation);
                }
              }, (error) => {
                handleFirestoreError(error, OperationType.GET, `micronations/${data.micronationId}`);
              });
            } else {
              setMyMicronation(null);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });

        return () => unsubUser();
      } else {
        setActiveUser(null);
        setMyMicronation(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Sync global directory of all micronations
  useEffect(() => {
    if (!activeUser) return;
    const microCollection = collection(db, 'micronations');
    const unsubGlobal = onSnapshot(microCollection, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Micronation));
      setAllMicronations(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'micronations');
    });
    return unsubGlobal;
  }, [activeUser]);

  // NATURAL POPULATION FLUCTUATIONS & AUTOMATED IDLE STATE INDUSTRIES GENERATOR TICK
  // Simulated demographics and resource growth ticks every 15 seconds!
  useEffect(() => {
    if (!myMicronation) return;
    
    // Only compile tick if logged-in user is Sovereign (Leader) of this micronation,
    // to avoid redundant concurrent write collisions from other citizens!
    if (activeUser?.uid !== myMicronation.sovereignId) return;

    const sim = setInterval(async () => {
      try {
        const nationRef = doc(db, 'micronations', myMicronation.id);
        
        // Load active values
        const currentRes = { ...myMicronation.resources };
        const policies = myMicronation.policies || { taxRate: 10, openness: 50, basicIncome: 5, propaganda: 10 };
        const ind = (policies as any).industries || { hydroponic: 0, solar: 0, forge: 0, mint: 0 };

        // 1. Industry Ticks
        const foodAdded = (ind.hydroponic || 0) * 1;
        const energyAdded = (ind.solar || 0) * 1;
        const materialsAdded = (ind.forge || 0) * 1;
        const treasuryMinted = (ind.mint || 0) * 2;

        currentRes.food += foodAdded;
        currentRes.energy += energyAdded;
        currentRes.materials += materialsAdded;

        // 2. Fiscal policy dynamic: Tax Rate builds cash / Basic Income distributes cost
        const taxGain = Math.round(myMicronation.population * (policies.taxRate || 10) * 0.1);
        const basicExpenses = Math.round(myMicronation.population * (policies.basicIncome || 5) * 0.15);

        const netTreasury = treasuryMinted + taxGain - basicExpenses;
        currentRes.treasury = Math.max(0, currentRes.treasury + netTreasury);

        // 3. Happiness dynamic: Boosted by basic income & low tax / decays if food starves or propaganda forces high
        let hapShift = 0;
        if (policies.basicIncome > 10) hapShift += 2;
        if (policies.taxRate > 35) hapShift -= 3;
        if (policies.propaganda > 50) hapShift -= 1;
        if (currentRes.food === 0) hapShift -= 6; // starvation

        const calculatedHap = Math.min(100, Math.max(0, myMicronation.happiness + hapShift));

        // 4. Stability dynamic: Boosted by propaganda campaigns & legislative laws passing
        let stabShift = 0;
        if (policies.propaganda > 30) stabShift += 2;
        if (policies.taxRate > 50) stabShift -= 2;
        if (myMicronation.laws?.length > 1) stabShift += 1;

        const calculatedStab = Math.min(100, Math.max(0, myMicronation.stability + stabShift));

        // 5. Demographic Natural growth changes
        let popDelta = 0;
        if (calculatedHap < 30) {
          popDelta = -Math.round(myMicronation.population * 0.08) - 1; // negative growth
        } else {
          // positive migration based on borders openness
          const opennessFactor = (policies.openness || 50) * 0.01;
          popDelta = Math.round(myMicronation.population * 0.04 * opennessFactor) + 1;
        }

        const calculatedPop = Math.max(1, myMicronation.population + popDelta);

        // State log triggers
        const logs = [...(myMicronation.historyLog || [])];
        
        if (foodAdded > 0 || energyAdded > 0 || materialsAdded > 0) {
          logs.unshift({
            id: crypto.randomUUID(),
            event: `⚙️ HARVEST COMPLETE: Automated state arrays generated values: ${foodAdded} F, ${energyAdded} E, ${materialsAdded} M.`,
            timestamp: new Date().toISOString()
          });
        }

        if (netTreasury !== 0) {
          logs.unshift({
            id: crypto.randomUUID(),
            event: `📊 FINANCIAL STATEMENT: Net treasury generated ${netTreasury > 0 ? '+' : ''}${netTreasury} ${myMicronation.currencyName || 'Credits'} (Tax Yield: +${taxGain} / Dividend payouts: -${basicExpenses}).`,
            timestamp: new Date().toISOString()
          });
        }

        if (popDelta !== 0) {
          logs.unshift({
            id: crypto.randomUUID(),
            event: `📈 NATURAL POPULATION SHIFT: State demographics modified by ${popDelta > 0 ? '+' : ''}${popDelta} citizens (Global happiness: ${calculatedHap}%).`,
            timestamp: new Date().toISOString()
          });
        }

        // Write updates in background
        await updateDoc(nationRef, {
          resources: currentRes,
          happiness: calculatedHap,
          stability: calculatedStab,
          population: calculatedPop,
          historyLog: logs.slice(0, 30) // keep max 30 items
        });

      } catch (err) {
        console.error("Simulation ticker error:", err);
      }
    }, 15000);

    return () => clearInterval(sim);
  }, [myMicronation, activeUser]);

  // Handle Micronation Creation
  const handleCreateMicronation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMicroName || !newMicroCurrency || !activeUser) return;

    setCreating(true);
    const docId = crypto.randomUUID();

    // Query core user position coordinates to establish core mapping coordinate
    let defLat = 37.7749;
    let defLng = -122.4194;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        defLat = pos.coords.latitude;
        defLng = pos.coords.longitude;
        writeDoc();
      }, () => {
        writeDoc(); // fallback
      });
    } else {
      writeDoc();
    }

    async function writeDoc() {
      try {
        const borderOutline = [
          { lat: defLat - 0.0001, lng: defLng - 0.0001 },
          { lat: defLat - 0.0001, lng: defLng + 0.0001 },
          { lat: defLat + 0.0001, lng: defLng + 0.0001 },
          { lat: defLat + 0.0001, lng: defLng - 0.0001 },
        ];

        const microPayload: Micronation = {
          id: docId,
          name: newMicroName,
          motto: newMicroMotto || 'Custom Sovereign Rule',
          description: newMicroDesc || 'Unrecognized micro-republic established on independent localized territory.',
          sovereignId: activeUser.uid,
          currencyName: newMicroCurrency,
          latitude: defLat,
          longitude: defLng,
          borderPoints: borderOutline,
          resources: { food: 100, energy: 100, materials: 100, treasury: 1000 },
          policies: { taxRate: 15, openness: 50, basicIncome: 5, propaganda: 10 },
          population: 12,
          happiness: 85,
          stability: 90,
          laws: [
            { id: crypto.randomUUID(), title: "Sovereignty Proclamation", description: "This state declares full localized sovereignty from municipal oversight.", category: "social", enactedAt: new Date().toISOString() }
          ],
          historyLog: [
            { id: crypto.randomUUID(), event: `👑 FOUND STATEHOOD: Sovereign State of ${newMicroName} established formally! Capital coordinate: [${defLat.toFixed(4)}, ${defLng.toFixed(4)}]`, timestamp: new Date().toISOString() }
          ],
          createdAt: new Date().toISOString()
        };

        // Write micronation
        await setDoc(doc(db, 'micronations', docId), microPayload);

        // Update user profile
        await updateDoc(doc(db, 'users', activeUser.uid), {
          micronationId: docId,
          rank: 'Sovereign',
          title: 'Emperor Sovereign'
        });

        // Reset inputs
        setNewMicroName(''); setNewMicroMotto(''); setNewMicroDesc(''); setNewMicroCurrency('');
        setCreating(false);
      } catch (err) {
        console.error(err);
        setCreating(false);
      }
    }
  };

  // Join existing Micronation as ANY chosen citizen rank instantly/seamlessly
  const handleJoinMicronation = async (targetId: string) => {
    if (!activeUser) return;
    try {
      await updateDoc(doc(db, 'users', activeUser.uid), {
        micronationId: targetId,
        rank: joiningRank,
        title: joiningTitle || 'Loyal Defender'
      });

      // Add to country history logs
      const selectedNation = allMicronations.find(m => m.id === targetId);
      if (selectedNation) {
        const additionEvent = `👤 POPULATION GROWTH: ${activeUser.displayName} has sworn allegiance to the state as a [${joiningRank}], awarded title: "${joiningTitle || 'Defender'}"!`;
        const logItem = {
          id: crypto.randomUUID(),
          event: additionEvent,
          timestamp: new Date().toISOString()
        };
        await updateDoc(doc(db, 'micronations', targetId), {
          population: (selectedNation.population || 0) + 1,
          historyLog: [logItem, ...(selectedNation.historyLog || [])]
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveMicronation = async () => {
    if (!activeUser || !myMicronation) return;
    const leaveText = confirm("Are you sure you want to renounce your citizenship credentials?");
    if (!leaveText) return;

    try {
      // Log event inside micronation histories
      const leaveLog = {
        id: crypto.randomUUID(),
        event: `👤 EMIGRATION: Citizen ${activeUser.displayName} renounced state citizenship papers.`,
        timestamp: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'micronations', myMicronation.id), {
        population: Math.max(1, (myMicronation.population || 0) - 1),
        historyLog: [leaveLog, ...(myMicronation.historyLog || [])]
      });

      await updateDoc(doc(db, 'users', activeUser.uid), {
        micronationId: null,
        rank: 'Resident',
        title: 'Aspiring Citizen'
      });
      
      setMyMicronation(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Sign Out
  const handleSignOut = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4" id="launch-loader">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-4" />
        <span className="text-sm font-mono text-slate-400">Booting Sovereign Console...</span>
      </div>
    );
  }

  // Not logged in -> Show Sign-In screen
  if (!activeUser) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // Logged-in, but has NO micronationId -> Choose Create or Join Screen
  if (!myMicronation) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-slate-900" id="welcome-board-layout">
        
        {/* Header */}
        <header className="border-b border-slate-800/80 bg-slate-950/60 p-4 sticky top-0 backdrop-blur" id="board-topbar">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-400" />
              <span className="font-sans font-extrabold text-white tracking-tight uppercase">Micronation Hub</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">Consular: <strong>{activeUser.displayName}</strong></span>
              <button 
                id="btn-signout-lobby"
                onClick={handleSignOut}
                className="p-1 px-2 border border-slate-700 rounded text-[11px] font-mono hover:text-white hover:border-slate-500 transition-colors cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-3 h-3 text-rose-500" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-start" id="welcome-canvas">
          
          {/* Create custom Statehood forms (Left) */}
          <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 md:p-6 shadow-xl space-y-4" id="section-found-nation">
            <div className="flex items-center gap-2.5 border-b border-slate-700/40 pb-3">
              <Plus className="w-5 h-5 text-teal-400" />
              <h2 className="font-sans font-bold text-white text-lg">Found Selected statehood</h2>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Proclaim dynamic micro-sovereignty. Coordinates are synchronized directly from your current position grid.
            </p>

            <form onSubmit={handleCreateMicronation} className="space-y-4" id="form-found-micronation">
              <div className="space-y-1" id="group-microname">
                <label className="text-xs font-mono text-slate-400 block" htmlFor="input-mname">Micronation Name</label>
                <input
                  id="input-mname"
                  type="text"
                  required
                  placeholder="e.g. Principality of Sealand, Republic of Molossia"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-400"
                  value={newMicroName}
                  onChange={(e) => setNewMicroName(e.target.value)}
                />
              </div>

              <div className="space-y-1" id="group-currency">
                <label className="text-xs font-mono text-slate-400 block" htmlFor="input-mcurr">Sovereign Currency Name</label>
                <input
                  id="input-mcurr"
                  type="text"
                  required
                  placeholder="e.g. Imperial Doubloons, Zeta Credits"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-400"
                  value={newMicroCurrency}
                  onChange={(e) => setNewMicroCurrency(e.target.value)}
                />
              </div>

              <div className="space-y-1" id="group-motto">
                <label className="text-xs font-mono text-slate-400 block" htmlFor="input-mmotto">National Motto</label>
                <input
                  id="input-mmotto"
                  type="text"
                  placeholder="e.g. Liberty and Sovereignty, For the Soil"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-400"
                  value={newMicroMotto}
                  onChange={(e) => setNewMicroMotto(e.target.value)}
                />
              </div>

              <div className="space-y-1" id="group-mdesc">
                <label className="text-xs font-mono text-slate-400 block" htmlFor="textarea-mdesc">Proclamation Description</label>
                <textarea
                  id="textarea-mdesc"
                  rows={3}
                  placeholder="Draft details on borders, community facilities, declarations..."
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-400 resize-none"
                  value={newMicroDesc}
                  onChange={(e) => setNewMicroDesc(e.target.value)}
                />
              </div>

              <button
                id="btn-create-micronation-submit"
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg text-xs tracking-wider transition-colors cursor-pointer"
              >
                {creating ? 'Proclaiming statehood...' : 'Proclaim Independent Micronation'}
              </button>
            </form>
          </div>

          {/* Join existing Micronations board (Right) */}
          <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 md:p-6 shadow-xl space-y-4" id="section-join-nation">
            <div className="flex items-center gap-2.5 border-b border-slate-700/40 pb-3">
              <Users className="w-5 h-5 text-teal-400" />
              <h2 className="font-sans font-bold text-white text-lg">Enlist in Existing Alliances</h2>
            </div>

            {/* Custom Join-rank parameters */}
            <div className="bg-slate-900/60 border border-slate-755 p-3 rounded-lg space-y-3" id="joining-credentials-box">
              <span className="text-xs font-mono text-slate-200 block border-b border-slate-800 pb-1">Our Citizenship Credentials</span>
              
              <div className="grid grid-cols-2 gap-3" id="joining-credentials-fields">
                <div className="space-y-1" id="join-title">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-jtitle">Custom Sovereign Title</label>
                  <input
                    id="input-jtitle"
                    type="text"
                    required
                    placeholder="e.g. Commander of Guard"
                    className="w-full py-1.5 px-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    value={joiningTitle}
                    onChange={(e) => setJoiningTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1" id="join-rank">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-jrank">Enlistment Rank</label>
                  <select
                    id="input-jrank"
                    className="w-full py-1.5 px-2 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-300 cursor-pointer"
                    value={joiningRank}
                    onChange={(e) => setJoiningRank(e.target.value as any)}
                  >
                    <option value="Minister">Minister</option>
                    <option value="Officer">Officer</option>
                    <option value="Citizen">Citizen</option>
                    <option value="Resident">Resident</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1" id="existing-nations-board-cards">
              {allMicronations.map((m) => (
                <div key={m.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-2" id={`join-card-${m.id}`}>
                  <div className="flex justify-between items-center" id="join-card-header">
                    <h3 className="font-sans font-bold text-teal-400 text-sm italic">{m.name}</h3>
                    <span className="font-mono text-[9px] bg-slate-850 px-2 py-0.5 rounded text-slate-450 border border-slate-800 uppercase">
                      Pop: {m.population || 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-350">{m.description}</p>
                  <div className="text-[10px] font-mono text-slate-500" id="join-card-footer">
                    Motto: <span className="text-slate-400 italic">"{m.motto || 'None'}"</span>
                  </div>

                  <button
                    id={`btn-join-this-${m.id}`}
                    onClick={() => handleJoinMicronation(m.id)}
                    className="w-full py-2 bg-slate-800 hover:bg-teal-500 hover:text-slate-950 font-bold border border-slate-700 hover:border-teal-400 text-xs text-slate-300 rounded-lg transition-all cursor-pointer text-center"
                  >
                    Enlist as {joiningRank} with title "{joiningTitle}"
                  </button>
                </div>
              ))}

              {allMicronations.length === 0 && (
                <div className="text-center py-16 text-slate-500 text-xs font-mono" id="no-micronations-to-join">
                  No other micronations current. Be the first to proclaim sovereignty!
                </div>
              )}
            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-950/20 py-4 text-center text-[10px] font-mono text-slate-600" id="board-footer">
          Micronation Command Hub © 2026. All international declarations non-binding.
        </footer>
      </div>
    );
  }

  // Active user belongs to a Micronation -> Show Central Sovereign Console
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-slate-900" id="main-admin-layout">
      
      {/* Top Console Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-950 p-4 sticky top-0 z-30" id="console-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl" id="logo-badge">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-sans font-bold text-white tracking-tight leading-4 italic flex items-center gap-1">
                {myMicronation.name} 
                <span className="text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded px-1 px-1.5 uppercase tracking-wide py-0.5">UNRECOGNIZED STATE</span>
              </h1>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Motto: "{myMicronation.motto}"</span>
            </div>
          </div>

          {/* Quick Consular Credentials Cards */}
          <div className="flex items-center gap-3" id="user-executive-card">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2" id="credentials-inner">
              <Award className="w-4 h-4 text-teal-400" />
              <div className="text-left font-mono">
                <span className="text-[9px] text-slate-500 block uppercase">Rank Credentials</span>
                <span className="text-[10px] font-bold text-white">{activeUser.displayName} [{activeUser.rank}] ({activeUser.title})</span>
              </div>
            </div>

            <button 
              id="btn-leave-citizenship"
              onClick={handleLeaveMicronation}
              className="px-2 py-1.5 bg-slate-950 border border-slate-800 hover:border-red-500/40 hover:text-red-400 font-mono text-[10px] rounded transition-colors cursor-pointer"
            >
              Expatriate
            </button>
            
            <button 
              id="btn-signout-main"
              onClick={handleSignOut}
              className="p-1 px-2 uppercase text-[9px] font-mono text-slate-500 hover:text-slate-350 tracking-wider flex items-center gap-1 cursor-pointer"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="bg-slate-950 border-b border-slate-800/80 p-1" id="console-sub-navigation">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-1">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            Dashboard & History
          </button>
          <button
            id="tab-borders"
            onClick={() => setActiveTab('borders')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'borders' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            Tactical Borders
          </button>
          <button
            id="tab-economy"
            onClick={() => setActiveTab('economy')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'economy' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            Economy & Trade Harbor
          </button>
          <button
            id="tab-diplomacy"
            onClick={() => setActiveTab('diplomacy')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'diplomacy' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            Bilateral Diplomacy
          </button>
          <button
            id="tab-citizenry"
            onClick={() => setActiveTab('citizenry')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'citizenry' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            Citizens & Policies
          </button>
          <button
            id="tab-constitution"
            onClick={() => setActiveTab('constitution')}
            className={`py-2 px-4 rounded text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'constitution' ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500/80' : 'text-slate-400 hover:text-teal-400'
            }`}
          >
            State Statutes
          </button>
        </div>
      </nav>

      {/* Main Container / Router View */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 items-start" id="view-routes-container">
        
        {/* TAB 1: DASHBOARD & HISTORY STATE LOGS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6" id="dashboard-view">
            
            {/* Scorecard grids of global resources */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="scorecard-grid">
              
              <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-xl flex items-center gap-4 shadow-md" id="stat-card-food">
                <div className="p-3 bg-lime-500/10 text-lime-400 border border-lime-500/20 rounded-xl" id="food-badge">
                  <Apple className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">Food Reserves</span>
                  <span className="text-xl font-bold font-mono text-white leading-5">{myMicronation.resources?.food ?? 0}</span>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-xl flex items-center gap-4 shadow-md" id="stat-card-energy">
                <div className="p-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl" id="energy-badge">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">Energy Grid</span>
                  <span className="text-xl font-bold font-mono text-white leading-5">{myMicronation.resources?.energy ?? 0}</span>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-xl flex items-center gap-4 shadow-md" id="stat-card-materials">
                <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl" id="materials-badge">
                  <Hammer className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">Materials Stack</span>
                  <span className="text-xl font-bold font-mono text-white leading-5">{myMicronation.resources?.materials ?? 0}</span>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-xl flex items-center gap-4 shadow-md" id="stat-card-treasury">
                <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl" id="treasury-badge">
                  <Coins className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">{myMicronation.currencyName || 'Treasury'}</span>
                  <span className="text-xl font-bold font-mono text-white leading-5">{myMicronation.resources?.treasury ?? 0}</span>
                </div>
              </div>

            </div>

            {/* Demographics Scorecards & Live history terminal logs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-details-grid">
              
              {/* Demographics Scorecards */}
              <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md space-y-4" id="demographic-scorecards">
                <div className="flex items-center gap-2 border-b border-slate-700/40 pb-2.5">
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                  <h3 className="font-sans font-bold text-white">Demographic Indices</h3>
                </div>

                <div className="space-y-3" id="indices-list">
                  <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg flex justify-between items-center" id="index-pop">
                    <span className="text-xs font-mono text-slate-400 block">Sovereign Citizens</span>
                    <span className="text-sm font-bold font-mono text-white">{myMicronation.population} citizens</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg flex justify-between items-center" id="index-hap">
                    <span className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5 text-lime-400" /> Gross Happiness Index
                    </span>
                    <span className="text-sm font-bold font-mono text-[#a3e635]">{myMicronation.happiness}%</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg flex justify-between items-center" id="index-stab">
                    <span className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> State Defense Stability
                    </span>
                    <span className="text-sm font-bold font-mono text-teal-450">{myMicronation.stability}%</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-[11px] text-slate-400 leading-relaxed font-mono" id="demographic-legend">
                  💡 Setup commissions under <strong>Economy & Trade Harbor</strong> to grow food and power reserves automatically. If food starves, happiness decreases and populations leave.
                </div>
              </div>

              {/* Live terminal of state historical logs */}
              <div className="md:col-span-2 bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-lg flex flex-col justify-between" id="state-terminal-container">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-700/40 pb-2.5 mb-3">
                    <Terminal className="w-5 h-5 text-teal-400 animate-pulse" />
                    <h3 className="font-sans font-bold text-white">Sovereign State Telegram Log</h3>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1" id="state-terminal-logs">
                    {myMicronation.historyLog && myMicronation.historyLog.map((log) => (
                      <div key={log.id} className="bg-slate-950/70 p-2 text-[10px] rounded border border-slate-900/80 text-slate-350 font-mono flex items-start gap-3" id={`log-card-${log.id}`}>
                        <span className="text-teal-400/85 whitespace-nowrap lowercase underline">[{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                        <span className="leading-relaxed text-slate-300">{log.event}</span>
                      </div>
                    ))}
                    {(!myMicronation.historyLog || myMicronation.historyLog.length === 0) && (
                      <div className="text-slate-550 text-center py-10 font-mono text-xs" id="empty-history">
                        No transactions registered in registry logs.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: TACTICAL BORDERS MAP CANVASES */}
        {activeTab === 'borders' && (
          <MapPlanner 
            initialBorders={myMicronation.borderPoints || []}
            centerLat={myMicronation.latitude}
            centerLng={myMicronation.longitude}
            onSaveBorders={async (pts, lat, lng) => {
              try {
                const nationRef = doc(db, 'micronations', myMicronation.id);
                // record logs
                const auditLog = {
                  id: crypto.randomUUID(),
                  event: `📜 GEOMETRY MODIFICATION: Sovereign demarcated new territory borders. Mapped Area expanded.`,
                  timestamp: new Date().toISOString()
                };
                await updateDoc(nationRef, {
                  borderPoints: pts,
                  latitude: lat,
                  longitude: lng,
                  historyLog: [auditLog, ...(myMicronation.historyLog || [])]
                });
              } catch (err) {
                console.error(err);
              }
            }}
            isLeader={activeUser.uid === myMicronation.sovereignId || activeUser.rank === 'Sovereign'}
          />
        )}

        {/* TAB 3: ECONOMY & INDUSTRY MARKETS */}
        {activeTab === 'economy' && (
          <EconomyPanel 
            myMicronation={myMicronation}
            allMicronations={allMicronations}
            isLeader={activeUser.uid === myMicronation.sovereignId || activeUser.rank === 'Sovereign' || activeUser.rank === 'Minister'}
            onRefreshNations={() => {}}
          />
        )}

        {/* TAB 4: BILATERAL DIPLOMACY LABS */}
        {activeTab === 'diplomacy' && (
          <DiplomacyPanel 
            myMicronation={myMicronation}
            allMicronations={allMicronations}
            isLeader={activeUser.uid === myMicronation.sovereignId || activeUser.rank === 'Sovereign' || activeUser.rank === 'Minister'}
          />
        )}

        {/* TAB 5: CITIZENS ASSEMBLY */}
        {activeTab === 'citizenry' && (
          <CitizenManager 
            myMicronation={myMicronation}
            isLeader={activeUser.uid === myMicronation.sovereignId || activeUser.rank === 'Sovereign'}
            onRefreshNations={() => {}}
          />
        )}

        {/* TAB 6: DRAFT LAWS & STATUTES */}
        {activeTab === 'constitution' && (
          <LawsConstitution 
            myMicronation={myMicronation}
            isLeader={activeUser.uid === myMicronation.sovereignId || activeUser.rank === 'Sovereign' || activeUser.rank === 'Minister'}
            onRefreshNations={() => {}}
          />
        )}

      </main>

      {/* Primary Administrator Global Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 p-4 text-center text-mono text-[10px] text-slate-550 space-y-1" id="footer-main">
        <span>Micronation sovereign Command Console. Location coordinates tracked for localized security sectors. All rights reserved.</span>
      </footer>

    </div>
  );
}
