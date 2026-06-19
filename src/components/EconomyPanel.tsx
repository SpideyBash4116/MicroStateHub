import React, { useState, useEffect } from 'react';
import { Micronation, Resources, TradeOffer } from '../types';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Coins, 
  Flame, 
  Hammer, 
  Apple, 
  ArrowLeftRight, 
  Wrench, 
  Factory, 
  BadgeAlert,
  Inbox,
  ShoppingBag,
  Clock
} from 'lucide-react';

interface EconomyPanelProps {
  myMicronation: Micronation;
  allMicronations: Micronation[];
  isLeader: boolean;
  onRefreshNations: () => void;
}

export default function EconomyPanel({ 
  myMicronation, 
  allMicronations, 
  isLeader,
  onRefreshNations
}: EconomyPanelProps) {

  const [tradeOffers, setTradeOffers] = useState<TradeOffer[]>([]);
  const [recipientNationId, setRecipientNationId] = useState('');
  
  // Resources composed for outgoing trade proposal
  const [offerFood, setOfferFood] = useState(0);
  const [offerEnergy, setOfferEnergy] = useState(0);
  const [offerMaterials, setOfferMaterials] = useState(0);
  const [offerTreasury, setOfferTreasury] = useState(0);

  const [askFood, setAskFood] = useState(0);
  const [askEnergy, setAskEnergy] = useState(0);
  const [askMaterials, setAskMaterials] = useState(0);
  const [askTreasury, setAskTreasury] = useState(0);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workingType, setWorkingType] = useState<string | null>(null);

  // Sync trade proposals involving my nation
  useEffect(() => {
    const q1 = query(collection(db, 'tradeOffers'), where('senderId', '==', myMicronation.id));
    const q2 = query(collection(db, 'tradeOffers'), where('receiverId', '==', myMicronation.id));

    const uns1 = onSnapshot(q1, (snap) => {
      const listOut = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeOffer));
      setTradeOffers(prev => {
        const filtered = prev.filter(t => t.senderId !== myMicronation.id);
        const unique = [...filtered, ...listOut].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        return unique;
      });
    });

    const uns2 = onSnapshot(q2, (snap) => {
      const listIn = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeOffer));
      setTradeOffers(prev => {
        const filtered = prev.filter(t => t.receiverId !== myMicronation.id);
        const unique = [...filtered, ...listIn].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        return unique;
      });
    });

    return () => {
      uns1();
      uns2();
    };
  }, [myMicronation.id]);

  // Active clicker worker mechanism: Citizen "Runs a shift"
  const handleWorkShift = async (type: 'food' | 'energy' | 'materials' | 'treasury') => {
    setWorkingType(type);
    
    // Simulate shift delay
    setTimeout(async () => {
      try {
        const nationRef = doc(db, 'micronations', myMicronation.id);
        const updatedResources = { ...myMicronation.resources };
        
        let delta = 5;
        let eventName = "";

        if (type === 'food') {
          updatedResources.food += delta;
          eventName = "Harvested +5 Food units in community greenhouse.";
        } else if (type === 'energy') {
          updatedResources.energy += delta;
          eventName = "Generated +5 Energy kW with dynamic hand-cranks.";
        } else if (type === 'materials') {
          updatedResources.materials += delta;
          eventName = "Recycled +5 Material bricks from domestic scrap piles.";
        } else if (type === 'treasury') {
          updatedResources.treasury += delta;
          eventName = `Minted +5 ${myMicronation.currencyName || 'MicroCredits'} in Treasury.`;
        }

        const logItem = {
          id: crypto.randomUUID(),
          event: `👷 citizen Shift Complete: ${eventName}`,
          timestamp: new Date().toISOString()
        };

        await updateDoc(nationRef, {
          resources: updatedResources,
          historyLog: [logItem, ...(myMicronation.historyLog || [])]
        });

        onRefreshNations();
        setStatusMessage(`Shift complete! ${eventName}`);
      } catch (err) {
        console.error(err);
        setStatusMessage("Failed to log shifts.");
      } finally {
        setWorkingType(null);
      }
    }, 850);
  };

  // Commission Industries (Idle automated builders)
  const handleBuildIndustry = async (type: 'hydroponic' | 'solar' | 'forge' | 'mint') => {
    try {
      const nationRef = doc(db, 'micronations', myMicronation.id);
      const updatedResources = { ...myMicronation.resources };
      
      let costMaterials = 30;
      let costEnergy = 20;

      if (updatedResources.materials < costMaterials || updatedResources.energy < costEnergy) {
        setStatusMessage(`Insufficient state assets. Building costs ${costMaterials} materials & ${costEnergy} energy.`);
        return;
      }

      // Deduct cost
      updatedResources.materials -= costMaterials;
      updatedResources.energy -= costEnergy;

      // Increment population policies or record as custom law/history event which ticks automatically in App.tsx
      // Let's store dynamic industry counts inside the policy or resource object so App.tsx can use them!
      // Since policy field is a map, we can expand it to store industries info or just increment them there!
      const currentPolicies = { ...myMicronation.policies } as any;
      if (!currentPolicies.industries) {
        currentPolicies.industries = { hydroponic: 0, solar: 0, forge: 0, mint: 0 };
      }
      currentPolicies.industries[type] = (currentPolicies.industries[type] || 0) + 1;

      const logItem = {
        id: crypto.randomUUID(),
        event: `🏗️ CAPITAL PROJECT: Commissioned new State Industry: ${type.toUpperCase()} module. Automated production expanded.`,
        timestamp: new Date().toISOString()
      };

      await updateDoc(nationRef, {
        resources: updatedResources,
        policies: currentPolicies,
        historyLog: [logItem, ...(myMicronation.historyLog || [])]
      });

      onRefreshNations();
      setStatusMessage(`Commission successful! Commissioned ${type} array.`);
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to commission industry.");
    }
  };

  const currentIndustries = () => {
    const rawPolicies = myMicronation.policies as any;
    return rawPolicies.industries || { hydroponic: 0, solar: 0, forge: 0, mint: 0 };
  };

  // Compose & Dispatch Trade Deal
  const handleProposeTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientNationId) {
      setStatusMessage("Please select a partner nation.");
      return;
    }
    const partner = allMicronations.find(m => m.id === recipientNationId);
    if (!partner) return;

    // Check if sender actually has the resources they are proposing to sell
    if (
      myMicronation.resources.food < offerFood ||
      myMicronation.resources.energy < offerEnergy ||
      myMicronation.resources.materials < offerMaterials ||
      myMicronation.resources.treasury < offerTreasury
    ) {
      setStatusMessage("Administrative Error: You cannot offer assets we do not own in our treasury.");
      return;
    }

    try {
      await addDoc(collection(db, 'tradeOffers'), {
        senderId: myMicronation.id,
        senderName: myMicronation.name,
        receiverId: partner.id,
        receiverName: partner.name,
        senderOffer: { food: offerFood, energy: offerEnergy, materials: offerMaterials, treasury: offerTreasury },
        receiverOffer: { food: askFood, energy: askEnergy, materials: askMaterials, treasury: askTreasury },
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setStatusMessage(`Trade protocol proposal dispatched to ${partner.name}.`);

      // Reset trade compose form
      setOfferFood(0); setOfferEnergy(0); setOfferMaterials(0); setOfferTreasury(0);
      setAskFood(0); setAskEnergy(0); setAskMaterials(0); setAskTreasury(0);
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to submit trade offer.");
    }
  };

  // Accept Trade Deal (Deduct/Add exchange resources on both safely)
  const handleAcceptTrade = async (offer: TradeOffer) => {
    // Re-verify assets on both sides using active snapshot values
    const senderNation = allMicronations.find(m => m.id === offer.senderId);
    const receiverNation = myMicronation;

    if (!senderNation) {
      setStatusMessage("Sender country dissolved.");
      return;
    }

    // Double check sender has what they promised
    if (
      senderNation.resources.food < offer.senderOffer.food ||
      senderNation.resources.energy < offer.senderOffer.energy ||
      senderNation.resources.materials < offer.senderOffer.materials ||
      senderNation.resources.treasury < offer.senderOffer.treasury
    ) {
      setStatusMessage("Trade Cancelled: Partner nation lacks resources to complete the transaction.");
      return;
    }

    // Double check recipient (us) has what they asked
    if (
      receiverNation.resources.food < offer.receiverOffer.food ||
      receiverNation.resources.energy < offer.receiverOffer.energy ||
      receiverNation.resources.materials < offer.receiverOffer.materials ||
      receiverNation.resources.treasury < offer.receiverOffer.treasury
    ) {
      setStatusMessage("Trade Blocked: Your treasury possesses insufficient funds to close this deal.");
      return;
    }

    try {
      // 1. Deduct from Sender, Add to us
      const senderNewRes: Resources = {
        food: senderNation.resources.food - offer.senderOffer.food + offer.receiverOffer.food,
        energy: senderNation.resources.energy - offer.senderOffer.energy + offer.receiverOffer.energy,
        materials: senderNation.resources.materials - offer.senderOffer.materials + offer.receiverOffer.materials,
        treasury: senderNation.resources.treasury - offer.senderOffer.treasury + offer.receiverOffer.treasury
      };

      // 2. Add to Sender, Deduct from us
      const receiverNewRes: Resources = {
        food: receiverNation.resources.food - offer.receiverOffer.food + offer.senderOffer.food,
        energy: receiverNation.resources.energy - offer.receiverOffer.energy + offer.senderOffer.energy,
        materials: receiverNation.resources.materials - offer.receiverOffer.materials + offer.senderOffer.materials,
        treasury: receiverNation.resources.treasury - offer.receiverOffer.treasury + offer.senderOffer.treasury
      };

      // Update Database
      await updateDoc(doc(db, 'micronations', senderNation.id), {
        resources: senderNewRes,
        historyLog: [{
          id: crypto.randomUUID(),
          event: `🤝 TRADE RATIFIED: Trade with ${receiverNation.name} completed and settled.`,
          timestamp: new Date().toISOString()
        }, ...(senderNation.historyLog || [])]
      });

      await updateDoc(doc(db, 'micronations', receiverNation.id), {
        resources: receiverNewRes,
        historyLog: [{
          id: crypto.randomUUID(),
          event: `🤝 TRADE RATIFIED: Trade with ${senderNation.name} completed and settled.`,
          timestamp: new Date().toISOString()
        }, ...(receiverNation.historyLog || [])]
      });

      await updateDoc(doc(db, 'tradeOffers', offer.id), {
        status: 'accepted'
      });

      onRefreshNations();
      setStatusMessage("Commerce closed successfully! Treasury updated.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Internal error processing asset swap.");
    }
  };

  const handleRejectTrade = async (offerId: string) => {
    try {
      await updateDoc(doc(db, 'tradeOffers', offerId), {
        status: 'rejected'
      });
      setStatusMessage("Trade bid declined.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="economy-main-layout">
      
      {/* Citizens Manual Work Shift module & Commission Industry (Left) */}
      <div className="lg:col-span-4 space-y-6" id="work-and-industries">
        
        {/* Clicker Work Shifts */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md">
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
            <Clock className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Citizens Production Center</h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4 font-mono">
            Citizens can manually execute production shifts to inject resources and currency into the national reserve.
          </p>

          <div className="grid grid-cols-2 gap-3" id="work-actions-grid">
            <button
              id="btn-work-food"
              onClick={() => handleWorkShift('food')}
              disabled={workingType !== null}
              className="py-3 px-2 bg-slate-900 border border-slate-700 hover:border-teal-500/55 hover:bg-slate-850 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <Apple className="w-4 h-4 mx-auto mb-1.5 text-lime-400" />
              <span>{workingType === 'food' ? "Mining..." : "Greenhouse Shift"}</span>
            </button>

            <button
              id="btn-work-energy"
              onClick={() => handleWorkShift('energy')}
              disabled={workingType !== null}
              className="py-3 px-2 bg-slate-900 border border-slate-700 hover:border-teal-500/55 hover:bg-slate-850 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <Flame className="w-4 h-4 mx-auto mb-1.5 text-orange-400" />
              <span>{workingType === 'energy' ? "Generating..." : "Energy Crank"}</span>
            </button>

            <button
              id="btn-work-materials"
              onClick={() => handleWorkShift('materials')}
              disabled={workingType !== null}
              className="py-3 px-2 bg-slate-900 border border-slate-700 hover:border-teal-500/55 hover:bg-slate-850 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <Hammer className="w-4 h-4 mx-auto mb-1.5 text-blue-400" />
              <span>{workingType === 'materials' ? "Scraping..." : "Forge Salvage"}</span>
            </button>

            <button
              id="btn-work-treasury"
              onClick={() => handleWorkShift('treasury')}
              disabled={workingType !== null}
              className="py-3 px-2 bg-slate-900 border border-slate-700 hover:border-teal-500/55 hover:bg-slate-850 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <Coins className="w-4 h-4 mx-auto mb-1.5 text-amber-400" />
              <span>{workingType === 'treasury' ? "Minting..." : `Stamp ${myMicronation.currencyName || 'Credits'}`}</span>
            </button>
          </div>

          {statusMessage && (
            <div className="mt-4 bg-slate-950 p-2 text-center rounded border border-slate-850 text-[10px] text-teal-400 font-mono" id="economy-notice-bar">
              {statusMessage}
            </div>
          )}
        </div>

        {/* State Automated Idle Industries */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md">
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
            <Factory className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Commissions Base</h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4 font-mono">
            Setup autonomous mills. (Fee: <span className="text-white">30 Mat + 20 Energy</span> each). Ticks every 8 seconds.
          </p>

          <div className="space-y-3" id="industries-commission-list">
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-800" id="ind-row-hydro">
              <div>
                <span className="text-xs text-white block">Hydroponics Pod ({currentIndustries().hydroponic || 0})</span>
                <span className="text-[10px] font-mono text-slate-500">Yields +1 Food / tick</span>
              </div>
              <button
                id="btn-build-hydro"
                onClick={() => handleBuildIndustry('hydroponic')}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs text-slate-300 font-mono rounded cursor-pointer"
              >
                Comms
              </button>
            </div>

            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-800" id="ind-row-solar">
              <div>
                <span className="text-xs text-white block">Solar Collector ({currentIndustries().solar || 0})</span>
                <span className="text-[10px] font-mono text-slate-500">Yields +1 Energy / tick</span>
              </div>
              <button
                id="btn-build-solar"
                onClick={() => handleBuildIndustry('solar')}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs text-slate-300 font-mono rounded cursor-pointer"
              >
                Comms
              </button>
            </div>

            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-800" id="ind-row-forge">
              <div>
                <span className="text-xs text-white block">Sovereign Forge ({currentIndustries().forge || 0})</span>
                <span className="text-[10px] font-mono text-slate-500">Yields +1 Materials / tick</span>
              </div>
              <button
                id="btn-build-forge"
                onClick={() => handleBuildIndustry('forge')}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs text-slate-300 font-mono rounded cursor-pointer"
              >
                Comms
              </button>
            </div>

            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-800" id="ind-row-mint">
              <div>
                <span className="text-xs text-white block">Royalty Minting Center ({currentIndustries().mint || 0})</span>
                <span className="text-[10px] font-mono text-slate-500">Yields +2 Currency / tick</span>
              </div>
              <button
                id="btn-build-mint"
                onClick={() => handleBuildIndustry('mint')}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs text-slate-300 font-mono rounded cursor-pointer"
              >
                Comms
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Global Trade & Cargo dispatcher (Right - takes 8 columns) */}
      <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6" id="trade-and-market">
        
        {/* Trade Dispatch Center Form */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md space-y-4" id="compose-trade-form">
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-2">
            <ArrowLeftRight className="w-5 h-5 text-teal-400" />
            <h3 className="font-sans font-semibold text-white">Consular Trade Dispatch</h3>
          </div>

          <form onSubmit={handleProposeTrade} className="space-y-4" id="trade-propose-form">
            <div className="space-y-1" id="recipient-nation-group">
              <label className="text-xs font-mono text-slate-400 block" htmlFor="recipient-nation-select">Recipient Nation</label>
              <select
                id="recipient-nation-select"
                required
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-400 cursor-pointer"
                value={recipientNationId}
                onChange={(e) => setRecipientNationId(e.target.value)}
              >
                <option value="">-- Choose Import/Export Partner --</option>
                {allMicronations
                  .filter(m => m.id !== myMicronation.id)
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.currencyName})</option>
                  ))}
              </select>
            </div>

            {/* Split layout for offering and asking */}
            <div className="grid grid-cols-2 gap-4" id="exchange-cargo-grid">
              
              {/* What we send */}
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3.5" id="offer-assets-container">
                <span className="text-[10px] font-mono text-teal-400 font-bold tracking-wider uppercase block border-b border-slate-800 pb-1">Our Export Cargo</span>
                
                <div className="space-y-1" id="export-food">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-offer-food">Food</label>
                  <input
                    id="input-offer-food"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={offerFood}
                    onChange={(e) => setOfferFood(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="export-energy">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-offer-energy">Energy</label>
                  <input
                    id="input-offer-energy"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={offerEnergy}
                    onChange={(e) => setOfferEnergy(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="export-materials">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-offer-materials">Materials</label>
                  <input
                    id="input-offer-materials"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={offerMaterials}
                    onChange={(e) => setOfferMaterials(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="export-treasury">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-offer-treasury">{myMicronation.currencyName || 'Treasury'}</label>
                  <input
                    id="input-offer-treasury"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={offerTreasury}
                    onChange={(e) => setOfferTreasury(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* What we want */}
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3.5" id="ask-assets-container">
                <span className="text-[10px] font-mono text-rose-400 font-bold tracking-wider uppercase block border-b border-slate-800 pb-1">Partner Import Cargo</span>
                
                <div className="space-y-1" id="import-food">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-ask-food">Food</label>
                  <input
                    id="input-ask-food"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={askFood}
                    onChange={(e) => setAskFood(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="import-energy">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-ask-energy">Energy</label>
                  <input
                    id="input-ask-energy"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={askEnergy}
                    onChange={(e) => setAskEnergy(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="import-materials">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-ask-materials">Materials</label>
                  <input
                    id="input-ask-materials"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={askMaterials}
                    onChange={(e) => setAskMaterials(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1" id="import-treasury">
                  <label className="text-[10px] font-mono text-slate-400 block" htmlFor="input-ask-treasury">Their Cash</label>
                  <input
                    id="input-ask-treasury"
                    type="number"
                    min="0"
                    className="w-full py-1 px-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                    value={askTreasury}
                    onChange={(e) => setAskTreasury(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

            </div>

            {isLeader ? (
              <button
                id="btn-dispatch-trade"
                type="submit"
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg text-xs transition-transform cursor-pointer text-center"
              >
                Inaugurate Commerce Proposal
              </button>
            ) : (
              <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 text-center rounded border border-slate-800 font-mono" id="trade-leader-warn">
                🔒 Standard citizens must seek export permits from the Sovereign.
              </div>
            )}
          </form>
        </div>

        {/* Trade Inbox (Pending offers to accept) */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between" id="trade-inbox">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-700/40 pb-3 mb-4">
              <Inbox className="w-5 h-5 text-teal-400" />
              <h3 className="font-sans font-semibold text-white">Pending Bilateral Trades</h3>
            </div>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1" id="pending-trades-list">
              {tradeOffers
                .filter(t => t.status === 'pending')
                .map(t => {
                  const isOutgoing = t.senderId === myMicronation.id;
                  const opponent = isOutgoing ? t.receiverName : t.senderName;
                  return (
                    <div key={t.id} className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-3" id={`trade-offer-${t.id}`}>
                      <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800" id="trade-row-head">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400">
                          {isOutgoing ? `Export Proposal` : `Import Proposal`}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                          To: {opponent}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400" id="trade-items-summary">
                        {/* Offered */}
                        <div className="bg-slate-950 p-2 rounded" id="summary-export">
                          <strong className="text-teal-400 text-[9px] block uppercase mb-1">Send Cargo:</strong>
                          <div>🍎 Food: {t.senderOffer.food}</div>
                          <div>⚡ Energy: {t.senderOffer.energy}</div>
                          <div>🔨 Materials: {t.senderOffer.materials}</div>
                          <div>🪙 Currency: {t.senderOffer.treasury}</div>
                        </div>

                        {/* Asked */}
                        <div className="bg-slate-950 p-2 rounded" id="summary-import">
                          <strong className="text-rose-400 text-[9px] block uppercase mb-1">Receive Cargo:</strong>
                          <div>🍎 Food: {t.receiverOffer.food}</div>
                          <div>⚡ Energy: {t.receiverOffer.energy}</div>
                          <div>🔨 Materials: {t.receiverOffer.materials}</div>
                          <div>🪙 Currency: {t.receiverOffer.treasury}</div>
                        </div>
                      </div>

                      {/* Trade Actions */}
                      {!isOutgoing && isLeader && (
                        <div className="grid grid-cols-2 gap-2 pt-1" id="trade-actions-buttons">
                          <button
                            id={`btn-accept-trade-${t.id}`}
                            onClick={() => handleAcceptTrade(t)}
                            className="py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-900 text-[10px] font-bold rounded cursor-pointer text-center"
                          >
                            Accept Deal
                          </button>
                          <button
                            id={`btn-reject-trade-${t.id}`}
                            onClick={() => handleRejectTrade(t.id)}
                            className="py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-mono rounded cursor-pointer border border-slate-700 text-center"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {isOutgoing && (
                        <div className="text-[10px] text-slate-500 font-mono text-center" id="outgoing-trade-stamp">
                          ⏳ Cargo bound in harbor. Awaiting response.
                        </div>
                      )}
                    </div>
                  );
                })}

              {tradeOffers.filter(t => t.status === 'pending').length === 0 && (
                <div className="text-center py-16 text-slate-500 font-mono text-xs" id="empty-trade-bell">
                  <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span>No commerce proposals currently listed.</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
