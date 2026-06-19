import React, { useState } from 'react';
import { Micronation, Law } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Gavel, Plus, Trash2, FileSignature, CheckCircle, Scale } from 'lucide-react';

interface LawsConstitutionProps {
  myMicronation: Micronation;
  isLeader: boolean;
  onRefreshNations: () => void;
}

export default function LawsConstitution({ 
  myMicronation, 
  isLeader,
  onRefreshNations
}: LawsConstitutionProps) {

  const [lawTitle, setLawTitle] = useState('');
  const [lawText, setLawText] = useState('');
  const [lawCategory, setLawCategory] = useState<Law['category']>('social');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDraftLaw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawTitle || !lawText) return;

    try {
      const nationRef = doc(db, 'micronations', myMicronation.id);
      
      const newLaw: Law = {
        id: crypto.randomUUID(),
        title: lawTitle,
        description: lawText,
        category: lawCategory,
        enactedAt: new Date().toISOString()
      };

      const updatedLaws = [newLaw, ...(myMicronation.laws || [])];
      
      const logItem = {
        id: crypto.randomUUID(),
        event: `⚖️ LAW PASSED: Passed law "${lawTitle}" under category [${lawCategory.toUpperCase()}]!`,
        timestamp: new Date().toISOString()
      };

      await updateDoc(nationRef, {
        laws: updatedLaws,
        historyLog: [logItem, ...(myMicronation.historyLog || [])]
      });

      setLawTitle('');
      setLawText('');
      onRefreshNations();
      setSuccessMessage(`Decree "${lawTitle}" successfully passed!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setSuccessMessage("Failed to code statutory laws.");
    }
  };

  const handleRepealLaw = async (lawId: string) => {
    try {
      const nationRef = doc(db, 'micronations', myMicronation.id);
      
      const lawToRepeal = myMicronation.laws.find(l => l.id === lawId);
      if (!lawToRepeal) return;

      const filteredLaws = myMicronation.laws.filter(l => l.id !== lawId);
      
      const logItem = {
        id: crypto.randomUUID(),
        event: `⚖️ LAW REPEALED: Sovereign legislature struck down law: "${lawToRepeal.title}"!`,
        timestamp: new Date().toISOString()
      };

      await updateDoc(nationRef, {
        laws: filteredLaws,
        historyLog: [logItem, ...(myMicronation.historyLog || [])]
      });

      onRefreshNations();
      setSuccessMessage(`Decree successfully repealed.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setSuccessMessage("Failed to repeal law.");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="laws-main">
      
      {/* Draft New laws (Left) */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md space-y-4" id="laws-composer-panel">
        <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-2">
          <FileSignature className="w-5 h-5 text-teal-400" />
          <h3 className="font-sans font-semibold text-white">Consular Legislative Desk</h3>
        </div>

        {successMessage && (
          <div className="bg-slate-900 border border-teal-500/20 text-teal-400 text-xs p-3 rounded-lg text-center font-mono animate-pulse" id="laws-notice">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleDraftLaw} className="space-y-4" id="law-composer-form">
          <div className="space-y-1" id="law-title-group">
            <label className="text-xs font-mono text-slate-400 block" htmlFor="input-law-title">Statute Title</label>
            <input
              id="input-law-title"
              type="text"
              required
              placeholder="e.g. Clean Soil Initiative, Zero Tariffs"
              className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              value={lawTitle}
              onChange={(e) => setLawTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1" id="law-category-group">
            <label className="text-xs font-mono text-slate-400 block" htmlFor="input-law-category">Legislation Category</label>
            <select
              id="input-law-category"
              className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-400 cursor-pointer"
              value={lawCategory}
              onChange={(e) => setLawCategory(e.target.value as any)}
            >
              <option value="economy">Economy & Trade Tax Laws</option>
              <option value="social">Social & Citizen Happiness Laws</option>
              <option value="foreign">Foreign Alliances Laws</option>
              <option value="defense">Military Defense & Stability Laws</option>
            </select>
          </div>

          <div className="space-y-1" id="law-text-group">
            <label className="text-xs font-mono text-slate-400 block" htmlFor="input-law-description">Statute Legal Text / Proclamation</label>
            <textarea
              id="input-law-description"
              rows={4}
              required
              placeholder="Provide exact provisions, penalty guidelines, state credits or benefits of passing this law..."
              className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-400 resize-none/y"
              value={lawText}
              onChange={(e) => setLawText(e.target.value)}
            />
          </div>

          {isLeader ? (
            <button
              id="btn-law-draft-submit"
              type="submit"
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <Gavel className="w-3.5 h-3.5" />
              Proclaim Enacted Law
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 text-center uppercase font-mono" id="legislator-lock">
              🔒 Standard citizens are not authorized to frame state statutes.
            </div>
          )}
        </form>
      </div>

      {/* Active Constitution & Statutes (Right) */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between" id="active-laws-panel">
        <div>
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
            <Scale className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Active State Constitution</h3>
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1" id="active-laws-scroll">
            {myMicronation.laws && myMicronation.laws.map(l => (
              <div key={l.id} className="bg-slate-900 border border-slate-850 p-3.5 rounded-lg space-y-1.5" id={`law-card-${l.id}`}>
                <div className="flex justify-between items-start" id="law-card-head">
                  <h4 className="text-xs font-bold text-white uppercase">{l.title}</h4>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    l.category === 'economy' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' :
                    l.category === 'social' ? 'bg-[#84cc16]/10 text-[#84cc16]' :
                    l.category === 'foreign' ? 'bg-[#eab308]/10 text-[#eab308]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                  }`}>
                    {l.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-350 leading-relaxed font-mono">
                  "{l.description}"
                </p>
                <div className="flex justify-between items-center pt-2 text-[8px] font-mono text-slate-650 border-t border-slate-850/40" id="law-footer">
                  <span>Enacted: {new Date(l.enactedAt).toLocaleDateString()}</span>
                  {isLeader && (
                    <button
                      id={`btn-repeal-${l.id}`}
                      onClick={() => handleRepealLaw(l.id)}
                      className="text-rose-400 hover:text-rose-300 font-bold uppercase cursor-pointer"
                    >
                      Repeal Statute
                    </button>
                  )}
                </div>
              </div>
            ))}

            {(!myMicronation.laws || myMicronation.laws.length === 0) && (
              <div className="text-center py-20 text-slate-500 font-mono text-xs" id="empty-constitution">
                ⚖️ No state laws proclaimed yet. The land governed under tribal customary code rules.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
