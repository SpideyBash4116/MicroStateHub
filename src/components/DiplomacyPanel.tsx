import React, { useState, useEffect } from 'react';
import { Micronation, DiplomaticRequest, WarRecord } from '../types';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ShieldAlert, Users, Swords, FileText, Send, CheckCircle2, XCircle, RefreshCw, MessageSquare } from 'lucide-react';

interface DiplomacyPanelProps {
  myMicronation: Micronation;
  allMicronations: Micronation[];
  isLeader: boolean;
}

export default function DiplomacyPanel({ 
  myMicronation, 
  allMicronations, 
  isLeader 
}: DiplomacyPanelProps) {
  
  const [requests, setRequests] = useState<DiplomaticRequest[]>([]);
  const [wars, setWars] = useState<WarRecord[]>([]);
  const [targetNationId, setTargetNationId] = useState('');
  const [reqType, setReqType] = useState<'alliance' | 'non_aggression' | 'peace_treaty'>('alliance');
  const [reqMessage, setReqMessage] = useState('');
  const [counterText, setCounterText] = useState<{ [reqId: string]: string }>({});
  const [showCounterInput, setShowCounterInput] = useState<{ [reqId: string]: boolean }>({});
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  // Sync diplomatic requests and wars
  useEffect(() => {
    // Listen for requests involving my nation
    const reqQuery1 = query(
      collection(db, 'diplomaticRequests'), 
      where('senderId', '==', myMicronation.id)
    );
    const reqQuery2 = query(
      collection(db, 'diplomaticRequests'), 
      where('receiverId', '==', myMicronation.id)
    );

    const uns1 = onSnapshot(reqQuery1, (snap) => {
      const listOuter = snap.docs.map(d => ({ id: d.id, ...d.data() } as DiplomaticRequest));
      setRequests(prev => {
        const filtered = prev.filter(r => r.senderId !== myMicronation.id);
        const unique = [...filtered, ...listOuter].sort((a,b) => b.sentAt.localeCompare(a.sentAt));
        return unique;
      });
    });

    const uns2 = onSnapshot(reqQuery2, (snap) => {
      const listInner = snap.docs.map(d => ({ id: d.id, ...d.data() } as DiplomaticRequest));
      setRequests(prev => {
        const filtered = prev.filter(r => r.receiverId !== myMicronation.id);
        const unique = [...filtered, ...listInner].sort((a,b) => b.sentAt.localeCompare(a.sentAt));
        return unique;
      });
    });

    // Listen for ongoing wars
    const warQuery1 = query(
      collection(db, 'wars'),
      where('attackerId', '==', myMicronation.id)
    );
    const warQuery2 = query(
      collection(db, 'wars'),
      where('defenderId', '==', myMicronation.id)
    );

    const unsWar1 = onSnapshot(warQuery1, (snap) => {
      const listAtt = snap.docs.map(d => ({ id: d.id, ...d.data() } as WarRecord));
      setWars(prev => {
        const filtered = prev.filter(w => w.attackerId !== myMicronation.id);
        return [...filtered, ...listAtt];
      });
    });

    const unsWar2 = onSnapshot(warQuery2, (snap) => {
      const listDef = snap.docs.map(d => ({ id: d.id, ...d.data() } as WarRecord));
      setWars(prev => {
        const filtered = prev.filter(w => w.defenderId !== myMicronation.id);
        return [...filtered, ...listDef];
      });
    });

    return () => {
      uns1();
      uns2();
      unsWar1();
      unsWar2();
    };
  }, [myMicronation.id]);

  const handleSendDiplomacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNationId) {
      setSystemMessage("Please select a target micronation.");
      return;
    }
    if (targetNationId === myMicronation.id) {
      setSystemMessage("Self-diplomacy is disabled. Expand beyond your borders.");
      return;
    }

    const targetNation = allMicronations.find(m => m.id === targetNationId);
    if (!targetNation) {
      setSystemMessage("Target micronation not found.");
      return;
    }

    try {
      await addDoc(collection(db, 'diplomaticRequests'), {
        senderId: myMicronation.id,
        senderName: myMicronation.name,
        receiverId: targetNation.id,
        receiverName: targetNation.name,
        type: reqType,
        status: 'pending',
        message: reqMessage || `Formal proposal of ${reqType.replace('_', ' ')}: Greetings from the Sovereign of ${myMicronation.name}.`,
        sentAt: new Date().toISOString()
      });

      // Log to history logs of sender nation
      const updateRef = doc(db, 'micronations', myMicronation.id);
      const newLog = {
        id: crypto.randomUUID(),
        event: `Dispatched formal ${reqType.replace('_', ' ')} proposal to ${targetNation.name}`,
        timestamp: new Date().toISOString()
      };
      await updateDoc(updateRef, {
        historyLog: [newLog, ...myMicronation.historyLog]
      });

      setReqMessage('');
      setSystemMessage(`Diplomatic document dispatched to ${targetNation.name}.`);
    } catch (err: any) {
      console.error(err);
      setSystemMessage("Failed to file diplomatic paper.");
    }
  };

  const handleUpdateStatus = async (reqId: string, status: 'accepted' | 'rejected' | 'countered', counterValue?: string) => {
    try {
      const reqDocRef = doc(db, 'diplomaticRequests', reqId);
      const requestToUpdate = requests.find(r => r.id === reqId);
      if (!requestToUpdate) return;

      const updatePayload: any = { status };
      if (status === 'countered' && counterValue) {
        updatePayload.counterOffer = counterValue;
        updatePayload.message = `[Counter-Proposal] ${counterValue}`;
      }

      await updateDoc(reqDocRef, updatePayload);

      // If accepted, add history logs and also implement alliances or wars if applicable
      if (status === 'accepted') {
        const myUpdateRef = doc(db, 'micronations', myMicronation.id);
        const foreignUpdateRef = doc(db, 'micronations', requestToUpdate.senderId);

        // Record history logs on both
        const eventText = `Harmonized relations with ${requestToUpdate.senderName}: Enacted ${requestToUpdate.type.replace('_', ' ')}`;
        const localLog = { id: crypto.randomUUID(), event: eventText, timestamp: new Date().toISOString() };
        const foreignLog = { id: crypto.randomUUID(), event: `Enacted ${requestToUpdate.type.replace('_', ' ')} alliance with ${myMicronation.name}`, timestamp: new Date().toISOString() };

        await updateDoc(myUpdateRef, {
          historyLog: [localLog, ...myMicronation.historyLog]
        });

        // Fetch foreign nation’s current logs to update safely
        const foreignNation = allMicronations.find(m => m.id === requestToUpdate.senderId);
        if (foreignNation) {
          await updateDoc(foreignUpdateRef, {
            historyLog: [foreignLog, ...foreignNation.historyLog]
          });
        }

        // If it's a peace treaty, find ongoing wars between these two nations and end them
        if (requestToUpdate.type === 'peace_treaty') {
          const ongoingConflict = wars.find(w => 
            w.status === 'ongoing' && 
            ((w.attackerId === myMicronation.id && w.defenderId === requestToUpdate.senderId) ||
             (w.defenderId === myMicronation.id && w.attackerId === requestToUpdate.senderId))
          );
          if (ongoingConflict) {
            await updateDoc(doc(db, 'wars', ongoingConflict.id), {
              status: 'peace',
              endedAt: new Date().toISOString(),
              terms: requestToUpdate.counterOffer || "Immediate cease-fire, demarcation of respective border sectors"
            });
          }
        }
      }

      setSystemMessage(`Diplomatic request updated to [${status.toUpperCase()}].`);
      // Reset counter inputs
      setShowCounterInput(prev => ({ ...prev, [reqId]: false }));
    } catch (err: any) {
      console.error(err);
      setSystemMessage("Failed to update treaty status.");
    }
  };

  const handleDeclareWar = async (defenderId: string) => {
    if (defenderId === myMicronation.id) return;
    const defender = allMicronations.find(m => m.id === defenderId);
    if (!defender) return;

    try {
      // Add war ticket
      await addDoc(collection(db, 'wars'), {
        attackerId: myMicronation.id,
        attackerName: myMicronation.name,
        defenderId: defender.id,
        defenderName: defender.name,
        status: 'ongoing',
        startedAt: new Date().toISOString()
      });

      // Update both history states
      const warEntryMy = {
        id: crypto.randomUUID(),
        event: `⚠️ SOVEREIGN DECREE: Formal Declaration of War launched against ${defender.name}! National Emergency enacted!`,
        timestamp: new Date().toISOString()
      };
      await updateDoc(doc(db, 'micronations', myMicronation.id), {
        historyLog: [warEntryMy, ...myMicronation.historyLog]
      });

      const warEntryDef = {
        id: crypto.randomUUID(),
        event: `🚨 INVASION THREAT: Sovereign state ${myMicronation.name} has formally declared WAR! Defense shields online!`,
        timestamp: new Date().toISOString()
      };
      await updateDoc(doc(db, 'micronations', defender.id), {
        historyLog: [warEntryDef, ...(defender.historyLog || [])]
      });

      setSystemMessage(`⚠️ Conflict officially declared with ${defender.name}!`);
    } catch (err: any) {
      console.error(err);
      setSystemMessage("War declaration failed.");
    }
  };

  const getOngoingWars = () => {
    return wars.filter(w => w.status === 'ongoing');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="diplomacy-main">
      
      {/* Foreign Embassy Send Treaty form */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between" id="diplomacy-composer">
        <div>
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
            <Send className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Consular Dispatch Desk</h3>
          </div>

          {systemMessage && (
            <div className="bg-slate-900/90 border border-teal-500/20 text-teal-400 text-xs p-3 rounded-lg mb-4 font-mono leading-relaxed" id="dip-notice">
              {systemMessage}
            </div>
          )}

          <form onSubmit={handleSendDiplomacy} className="space-y-4" id="treaty-composer-form">
            <div className="space-y-1" id="composer-nation">
              <label className="text-xs font-mono text-slate-400 block" htmlFor="target-nation-select">Target Country</label>
              <select
                id="target-nation-select"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-400 cursor-pointer"
                value={targetNationId}
                onChange={(e) => setTargetNationId(e.target.value)}
              >
                <option value="">-- Choose Sovereign State --</option>
                {allMicronations
                  .filter(m => m.id !== myMicronation.id)
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.motto || 'No motto'})</option>
                  ))}
              </select>
            </div>

            <div className="space-y-1" id="composer-treaty-type">
              <label className="text-xs font-mono text-slate-400 block" htmlFor="treaty-type-select">Treaty Treaty Type</label>
              <select
                id="treaty-type-select"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-400 cursor-pointer"
                value={reqType}
                onChange={(e) => setReqType(e.target.value as any)}
              >
                <option value="alliance">Mutual Alliance Accord</option>
                <option value="non_aggression">Non-Aggression Pact</option>
                <option value="peace_treaty">Formal Peace Treaty</option>
              </select>
            </div>

            <div className="space-y-1" id="composer-message">
              <label className="text-xs font-mono text-slate-400 block" htmlFor="treaty-message-text">Diplomatic Dispatch Message</label>
              <textarea
                id="treaty-message-text"
                rows={4}
                maxLength={400}
                placeholder="Compose majestic or tactical opening words... State your border demands, resource terms, etc."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs placeholder-slate-500 text-slate-200 focus:outline-none focus:border-teal-400 resize-none"
                value={reqMessage}
                onChange={(e) => setReqMessage(e.target.value)}
              />
            </div>

            {isLeader ? (
              <button
                id="btn-treaty-submit"
                type="submit"
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg text-xs transition-transform cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch Accord Paper
              </button>
            ) : (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center leading-relaxed" id="composer-warning">
                🔒 Diplomatic dispatches must carry the Sovereign Seal. You do not have these credentials.
              </div>
            )}
          </form>
        </div>

        {/* Global War Declaring Box */}
        <div className="mt-6 pt-4 border-t border-slate-700/40" id="tactical-threat-desk">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-2 font-mono uppercase tracking-wider">
            <Swords className="w-3.5 h-3.5" />
            <span>War Declaration Desk</span>
          </div>
          {isLeader ? (
            <div className="space-y-2" id="leader-war-options">
              <p className="text-[10px] text-slate-400 font-mono">
                Select a nation below to declare war immediately. This affects stability, happiness, and activates defensive combat state.
              </p>
              <div className="flex gap-2" id="war-selection-layout">
                <select
                  id="war-target-select"
                  className="flex-1 py-1.5 px-2.5 bg-slate-900 border border-rose-500/30 rounded-lg text-xs font-mono text-rose-300 focus:outline-none cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDeclareWar(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Declare War ON --</option>
                  {allMicronations
                    .filter(m => m.id !== myMicronation.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>⚔️ {m.name}</option>
                    ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-red-400/80 bg-red-500/5 px-2.5 py-2 rounded-lg border border-red-500/10 font-mono text-center" id="peacenik-label">
              🔒 War declarations require Sovereign high command authorize.
            </div>
          )}
        </div>
      </div>

      {/* Relations & Active conflicts column */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md space-y-5" id="conflict-registry">
        
        {/* Active conflicts register */}
        <div>
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-3">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="font-sans font-semibold text-white">Conflicts Registry</h3>
          </div>

          <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1" id="active-wars-list">
            {getOngoingWars().map(w => {
              const opponent = w.attackerId === myMicronation.id ? w.defenderName : w.attackerName;
              return (
                <div key={w.id} className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-3 flex justify-between items-center" id={`war-card-${w.id}`}>
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase font-mono tracking-wider font-bold text-rose-400">ACTIVE WAR RECORD</span>
                    <h4 className="text-xs font-bold text-white uppercase">{myMicronation.name} vs {opponent}</h4>
                    <span className="text-[10px] font-mono text-slate-500 block">Inception: {new Date(w.startedAt).toLocaleDateString()}</span>
                  </div>
                  {isLeader && (
                    <button
                      id={`btn-peace-war-${w.id}`}
                      onClick={() => {
                        setTargetNationId(w.attackerId === myMicronation.id ? w.defenderId : w.attackerId);
                        setReqType('peace_treaty');
                        setReqMessage('We seek to end the hostilites. We proposal the ceasefire terms as mapped.');
                        setSystemMessage("Diplomatic peace proposal drafted. Click 'Dispatch Accord Paper' to send.");
                      }}
                      className="py-1 px-2.5 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded text-[10px] font-bold font-mono transition-transform cursor-pointer"
                    >
                      Offer Peace
                    </button>
                  )}
                </div>
              );
            })}

            {getOngoingWars().length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs font-mono" id="peaceful-globe-notice">
                🕊️ Peaceful global state. No declared micro-wars.
              </div>
            )}
          </div>
        </div>

        {/* Global Treaty Archive ledger */}
        <div className="pt-2 border-t border-slate-700/40" id="treaty-archives">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-sans font-semibold text-slate-300">Sovereign Alliance Ledger</span>
          </div>

          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs font-mono text-slate-400" id="alliances-ledger-list">
            {requests
              .filter(r => r.status === 'accepted')
              .map(r => {
                const opponent = r.senderId === myMicronation.id ? r.receiverName : r.senderName;
                return (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between" id={`alliance-${r.id}`}>
                    <span className="text-white text-[11px] font-semibold">{opponent}</span>
                    <span className="text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-teal-500/10">
                      {r.type.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}

            {requests.filter(r => r.status === 'accepted').length === 0 && (
              <div className="text-slate-500 text-center py-4 text-[11px]" id="empty-ledger-notice">No treaties of alliance current.</div>
            )}
          </div>
        </div>
      </div>

      {/* Diplomatic Mailbox (Treaty Proposals) Column */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md" id="diplomatic-mailbox">
        <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
          <Users className="w-5 h-5 text-teal-400" />
          <h3 className="font-sans font-semibold text-white">Embassies Inbox</h3>
        </div>

        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1" id="mailbox-list">
          {requests
            .filter(r => r.status === 'pending' || r.status === 'countered')
            .map(r => {
              const isOutgoing = r.senderId === myMicronation.id;
              const opponent = isOutgoing ? r.receiverName : r.senderName;
              return (
                <div 
                  key={r.id} 
                  className={`bg-slate-900 border ${r.status === 'countered' ? 'border-orange-500/30 bg-amber-500/[0.02]' : 'border-slate-800'} rounded-lg p-3 space-y-2`}
                  id={`request-mailbox-row-${r.id}`}
                >
                  <div className="flex items-center justify-between" id="mailbox-row-header">
                    <span className="text-[10px] font-mono text-slate-500">
                      {isOutgoing ? 'OUTGOING PROPOSAL' : 'INCOMING ACCORD'}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      r.type === 'alliance' ? 'bg-teal-500/10 text-teal-400' :
                      r.type === 'non_aggression' ? 'bg-lime-500/10 text-lime-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {r.type.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200">
                    {isOutgoing ? `To: ${opponent}` : `From: ${opponent}`}
                  </h4>

                  <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-850/40 italic leading-relaxed">
                    "{r.message}"
                  </p>

                  {r.status === 'countered' && r.counterOffer && (
                    <div className="bg-amber-500/5 text-amber-400 text-[10px] font-mono p-2 rounded border border-amber-500/10 leading-snug" id="counter-offer-display">
                      <strong>⚠️ COUNTER terms asked:</strong> "{r.counterOffer}"
                    </div>
                  )}

                  {/* Actions */}
                  {!isOutgoing && isLeader && r.status !== 'countered' && (
                    <div className="space-y-2 pt-2 border-t border-slate-800" id="treaty-mailbox-actions">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          id={`btn-accept-treaty-${r.id}`}
                          onClick={() => handleUpdateStatus(r.id, 'accepted')}
                          className="flex items-center justify-center gap-1.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded text-[10px] transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          id={`btn-reject-treaty-${r.id}`}
                          onClick={() => handleUpdateStatus(r.id, 'rejected')}
                          className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded text-[10px] transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          Reject
                        </button>
                      </div>

                      {/* Counter Proposal action */}
                      {!showCounterInput[r.id] ? (
                        <button
                          id={`btn-open-counter-treaty-${r.id}`}
                          onClick={() => setShowCounterInput(prev => ({ ...prev, [r.id]: true }))}
                          className="w-full py-1 bg-slate-900 hover:bg-slate-850 text-[9px] font-mono border border-slate-758 rounded text-slate-400 hover:text-white transition-colors cursor-pointer text-center"
                        >
                          ⚖️ Offer Counter Terms
                        </button>
                      ) : (
                        <div className="space-y-1.5 p-2 bg-slate-950 rounded border border-slate-800 animate-fadeIn" id="counter-proposal-control">
                          <label className="text-[9px] font-mono text-slate-500 block" htmlFor={`counter-input-${r.id}`}>Your Counter-Terms</label>
                          <input
                            id={`counter-input-${r.id}`}
                            type="text"
                            placeholder="e.g. We require 200 food and defensive backup."
                            className="w-full py-1 px-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200 focus:outline-none focus:border-teal-400"
                            value={counterText[r.id] || ''}
                            onChange={(e) => setCounterText(prev => ({ ...prev, [r.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <button
                              id={`btn-send-counter-treaty-${r.id}`}
                              onClick={() => handleUpdateStatus(r.id, 'countered', counterText[r.id])}
                              className="flex-1 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 font-mono text-[9px] rounded border border-teal-500/20 cursor-pointer text-center"
                            >
                              Dispatch Counter
                            </button>
                            <button
                              id={`btn-cancel-counter-treaty-${r.id}`}
                              onClick={() => setShowCounterInput(prev => ({ ...prev, [r.id]: false }))}
                              className="py-1 px-2 bg-slate-800 hover:bg-slate-750 text-slate-500 hover:text-white font-mono text-[9px] rounded border border-slate-705 cursor-pointer text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isOutgoing && !isLeader && (
                    <div className="text-[10px] text-slate-500 font-mono text-center pt-1" id="citizen-inbox-lock">
                      🔒 Only Sovereign state seals can counter/sign treaties.
                    </div>
                  )}

                  {isOutgoing && (
                    <div className="text-[10px] text-slate-500 font-mono text-center pt-2 border-t border-slate-800/20" id="outgoing-pending-stamp">
                      ⚡ Pending target response.
                    </div>
                  )}
                </div>
              );
            })}

          {requests.filter(r => r.status === 'pending' || r.status === 'countered').length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono" id="empty-mailbox-bell">
              📬 Consular postbox is clear. No active proposals.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
