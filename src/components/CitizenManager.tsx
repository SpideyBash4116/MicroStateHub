import React, { useState, useEffect } from 'react';
import { Micronation, UserRecord } from '../types';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Users, 
  Settings2, 
  Award, 
  UserPlus, 
  Activity, 
  Smile, 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CitizenManagerProps {
  myMicronation: Micronation;
  isLeader: boolean;
  onRefreshNations: () => void;
}

export default function CitizenManager({ 
  myMicronation, 
  isLeader,
  onRefreshNations
}: CitizenManagerProps) {

  const [citizens, setCitizens] = useState<UserRecord[]>([]);
  const [selectedCitizenId, setSelectedCitizenId] = useState('');
  const [assignedRank, setAssignedRank] = useState<UserRecord['rank']>('Citizen');
  const [assignedTitle, setAssignedTitle] = useState('');
  
  // Policies state
  const [taxRate, setTaxRate] = useState(myMicronation.policies?.taxRate ?? 10);
  const [openness, setOpenness] = useState(myMicronation.policies?.openness ?? 50);
  const [basicIncome, setBasicIncome] = useState(myMicronation.policies?.basicIncome ?? 5);
  const [propaganda, setPropaganda] = useState(myMicronation.policies?.propaganda ?? 10);

  const [policyMessage, setPolicyMessage] = useState<string | null>(null);

  // Sync citizens
  useEffect(() => {
    const citizensQuery = query(
      collection(db, 'users'), 
      where('micronationId', '==', myMicronation.id)
    );

    const uns = onSnapshot(citizensQuery, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || '',
          displayName: data.displayName || '',
          micronationId: data.micronationId || null,
          rank: data.rank || 'Citizen',
          title: data.title || '',
          joinedAt: data.joinedAt || ''
        } as UserRecord;
      });
      setCitizens(list);
    });

    return () => uns();
  }, [myMicronation.id]);

  // Sync state values when other nodes change rules
  useEffect(() => {
    if (myMicronation.policies) {
      setTaxRate(myMicronation.policies.taxRate);
      setOpenness(myMicronation.policies.openness);
      setBasicIncome(myMicronation.policies.basicIncome);
      setPropaganda(myMicronation.policies.propaganda);
    }
  }, [myMicronation]);

  // Handle policy changes
  const handleSavePolicies = async () => {
    try {
      const nationRef = doc(db, 'micronations', myMicronation.id);
      
      const newPolicies = {
        taxRate,
        openness,
        basicIncome,
        propaganda,
        // preserve current industries
        industries: (myMicronation.policies as any)?.industries || { hydroponic: 0, solar: 0, forge: 0, mint: 0 }
      };

      const auditEventText = `📜 POLICY CHANGE: Taxes set to ${taxRate}%, Border Openness at ${openness}%, Basic Income at ${basicIncome} credits, Propaganda Level at ${propaganda}%.`;
      const logItem = {
        id: crypto.randomUUID(),
        event: auditEventText,
        timestamp: new Date().toISOString()
      };

      await updateDoc(nationRef, {
        policies: newPolicies,
        historyLog: [logItem, ...(myMicronation.historyLog || [])]
      });

      onRefreshNations();
      setPolicyMessage("Policies saved and enacted nationwide!");
      setTimeout(() => setPolicyMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setPolicyMessage("Failed to enact policy decrees.");
    }
  };

  // Assign roles / titles to citizens
  const handleModifyCitizen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCitizenId) return;

    try {
      const citizenRef = doc(db, 'users', selectedCitizenId);
      const targetCit = citizens.find(c => c.uid === selectedCitizenId);
      if (!targetCit) return;

      await updateDoc(citizenRef, {
        rank: assignedRank,
        title: assignedTitle || 'Loyal Citizen'
      });

      // Log in history logs
      const nationRef = doc(db, 'micronations', myMicronation.id);
      const eventText = `👑 DECREE: ${targetCit.displayName} promoted to [${assignedRank}] and awarded custom title: "${assignedTitle || 'Loyal Citizen'}"!`;
      const logItem = {
        id: crypto.randomUUID(),
        event: eventText,
        timestamp: new Date().toISOString()
      };

      await updateDoc(nationRef, {
        historyLog: [logItem, ...(myMicronation.historyLog || [])]
      });

      setSelectedCitizenId('');
      setAssignedTitle('');
      onRefreshNations();
      setPolicyMessage(`Citizen ${targetCit.displayName} credentials updated.`);
      setTimeout(() => setPolicyMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setPolicyMessage("Failed to assign crown roles.");
    }
  };

  // Convert history logs to a simplified visual chart of historical states
  const getDemographicsTimeline = () => {
    const baseObj = [
      { name: 'Jan', population: 2, happiness: 80, stability: 90 },
      { name: 'Feb', population: Math.round(myMicronation.population * 0.4 + 2), happiness: Math.round(myMicronation.happiness * 0.7 + 10), stability: Math.round(myMicronation.stability * 0.5 + 40) },
      { name: 'Mar', population: Math.round(myMicronation.population * 0.7 + 1), happiness: Math.round(myMicronation.happiness * 0.9 + 5), stability: Math.round(myMicronation.stability * 0.8 + 10) },
      { name: 'Current', population: myMicronation.population, happiness: myMicronation.happiness, stability: myMicronation.stability }
    ];
    return baseObj;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="citizen-manager-main">
      
      {/* Policy Decrees Panel (Left - 5 cols) */}
      <div className="lg:col-span-5 bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between" id="policies-slider-column">
        <div>
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
            <Settings2 className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Consular Policy Decrees</h3>
          </div>

          {policyMessage && (
            <div className="bg-slate-900 border border-teal-500/20 text-teal-400 text-xs p-3 rounded-lg mb-4 text-center font-mono" id="policy-log">
              {policyMessage}
            </div>
          )}

          <div className="space-y-4" id="policies-form-sliders">
            {/* Tax Rate */}
            <div className="space-y-1" id="slider-tax">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Domestic Income Tax</span>
                <span className="text-white font-bold">{taxRate}%</span>
              </div>
              <input 
                id="input-tax-slider"
                type="range" 
                min="0" 
                max="80" 
                className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg cursor-pointer"
                disabled={!isLeader}
                value={taxRate} 
                onChange={(e) => setTaxRate(parseInt(e.target.value))} 
              />
              <div className="text-[10px] text-slate-500 font-mono leading-snug">
                Generates treasury income from citizens, but lowers domestic happiness dramatically.
              </div>
            </div>

            {/* Border Openness */}
            <div className="space-y-1" id="slider-openness">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Border Openness</span>
                <span className="text-white font-bold">{openness}%</span>
              </div>
              <input 
                id="input-openness-slider"
                type="range" 
                min="0" 
                max="100" 
                className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg cursor-pointer"
                disabled={!isLeader}
                value={openness} 
                onChange={(e) => setOpenness(parseInt(e.target.value))} 
              />
              <div className="text-[10px] text-slate-500 font-mono leading-snug">
                Increases incoming immigration rates, but reduces total inner stability if food reserves are depleted.
              </div>
            </div>

            {/* Basic Income */}
            <div className="space-y-1" id="slider-income">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">State Dividends (UBI)</span>
                <span className="text-white font-bold">{basicIncome} credits / citizen</span>
              </div>
              <input 
                id="input-ubi-slider"
                type="range" 
                min="0" 
                max="50" 
                className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg cursor-pointer"
                disabled={!isLeader}
                value={basicIncome} 
                onChange={(e) => setBasicIncome(parseInt(e.target.value))} 
              />
              <div className="text-[10px] text-slate-500 font-mono leading-snug">
                Drains state treasury over time, but grants massive citizen happiness multipliers.
              </div>
            </div>

            {/* Propaganda */}
            <div className="space-y-1" id="slider-propaganda">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Consular Broadcast Level</span>
                <span className="text-white font-bold">{propaganda}%</span>
              </div>
              <input 
                id="input-propaganda-slider"
                type="range" 
                min="0" 
                max="100" 
                className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg cursor-pointer"
                disabled={!isLeader}
                value={propaganda} 
                onChange={(e) => setPropaganda(parseInt(e.target.value))} 
              />
              <div className="text-[10px] text-slate-500 font-mono leading-snug">
                Suppresses rebel factions and yields stability gains, but dampens citizen happiness.
              </div>
            </div>
          </div>
        </div>

        {isLeader ? (
          <button
            id="btn-policy-save"
            onClick={handleSavePolicies}
            className="w-full mt-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg text-xs transition-transform cursor-pointer"
          >
            Enact Consolidated Policies
          </button>
        ) : (
          <div className="mt-6 text-[10px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 text-center uppercase font-mono" id="policy-lock-warning">
            🔒 Only Sovereign executives can mandate policies.
          </div>
        )}
      </div>

      {/* Demographic Real-time Simulation & Roles (Right - 7 cols) */}
      <div className="lg:col-span-7 space-y-6" id="demographic-roles-layout">
        
        {/* Real-time simulation trend lines */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              <h3 className="font-sans font-semibold text-white">Demographics Simulator</h3>
            </div>
            <div className="flex gap-4 text-[10px] font-mono" id="sim-top-scores">
              <span className="flex items-center gap-1"><Smile className="w-3.5 h-3.5 text-lime-400" /> Happiness: {myMicronation.happiness}%</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> Stability: {myMicronation.stability}%</span>
            </div>
          </div>

          {/* Recharts demographic timeline */}
          <div className="h-[140px] w-full" id="demographics-chart-layout">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getDemographicsTimeline()}>
                <defs>
                  <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="hapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="population" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#popGrad)" name="Population" />
                <Area type="monotone" dataKey="happiness" stroke="#84cc16" strokeWidth={1.5} fillOpacity={1} fill="url(#hapGrad)" name="Happiness %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-slate-500 flex justify-between mt-2" id="sim-status-indicators">
            <span>Natural growth model active</span>
            <span className="flex items-center gap-1">Population: <span className="text-white font-bold">{myMicronation.population} citizens</span></span>
          </div>
        </div>

        {/* Citizenship directory list & crown roles */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col md:flex-row gap-5" id="citizenship-board">
          
          {/* List of current users/citizens */}
          <div className="flex-1 space-y-3" id="citizens-list-section">
            <div className="flex items-center gap-2 border-b border-slate-700/20 pb-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-sans font-semibold text-slate-200">State Citizen Assembly</span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1" id="citizen-ledger-scroll">
              {citizens.map(cit => (
                <div 
                  key={cit.uid} 
                  onClick={() => setSelectedCitizenId(cit.uid)}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    selectedCitizenId === cit.uid 
                      ? 'bg-teal-500/10 border-teal-500/40' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                  id={`citizen-card-${cit.uid}`}
                >
                  <div className="flex justify-between items-start" id="citizen-header">
                    <span className="text-xs font-bold text-white block">{cit.displayName}</span>
                    <span className="text-[9px] font-mono bg-slate-950 px-1.5 py-0.5 rounded text-white border border-slate-800/80 uppercase">
                      {cit.rank}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block pb-0.5">Title: "{cit.title || 'Unassigned citizen'}"</span>
                  <span className="text-[8px] font-mono text-slate-600">Joined: {new Date(cit.joinedAt).toLocaleDateString()}</span>
                </div>
              ))}
              
              {citizens.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-10" id="no-citizens">No other official citizens registered.</div>
              )}
            </div>
          </div>

          {/* Promotion / Demotion Action form */}
          <div className="flex-1 bg-slate-900/60 border border-slate-750 p-4 rounded-xl space-y-3" id="roles-promotion-form">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Award className="w-4 h-4 text-teal-400" />
              <span>Crown Ranks & Titles</span>
            </div>

            {selectedCitizenId ? (
              <form onSubmit={handleModifyCitizen} className="space-y-3" id="modify-citizen-form">
                <div className="space-y-1" id="assignee-details">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Assignee</span>
                  <span className="text-xs font-bold text-white block bg-slate-950 py-1.5 px-2 rounded border border-slate-800">
                    {citizens.find(c => c.uid === selectedCitizenId)?.displayName}
                  </span>
                </div>

                <div className="space-y-1" id="assign-role-group">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-assigned-rank">Consular Rank</label>
                  <select
                    id="input-assigned-rank"
                    className="w-full py-1.5 px-2 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-300 cursor-pointer"
                    value={assignedRank}
                    onChange={(e) => setAssignedRank(e.target.value as any)}
                  >
                    <option value="Sovereign">Sovereign (Leader)</option>
                    <option value="Minister">Minister</option>
                    <option value="Officer">Officer</option>
                    <option value="Citizen">Citizen</option>
                    <option value="Resident">Resident</option>
                  </select>
                </div>

                <div className="space-y-1" id="assign-title-group">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-assigned-title">Award Custom Title</label>
                  <input
                    id="input-assigned-title"
                    type="text"
                    required
                    placeholder="e.g. Commander of Guard"
                    className="w-full py-1.5 px-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    value={assignedTitle}
                    onChange={(e) => setAssignedTitle(e.target.value)}
                  />
                </div>

                {isLeader ? (
                  <button
                    id="btn-update-citizen-role"
                    type="submit"
                    className="w-full py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded text-xs cursor-pointer text-center"
                  >
                    Bestow Rank & Seals
                  </button>
                ) : (
                  <div className="text-[9px] text-slate-500 font-mono text-center leading-snug" id="promotion-lock">
                    🔒 Commission changes of nobility require Sovereign high command authorize.
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center py-12 text-slate-500 text-[11px] font-mono" id="no-citizen-selected-prompt">
                Tap any citizen card on the left to adjust their rank or assign state titles.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
