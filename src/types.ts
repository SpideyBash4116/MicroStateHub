export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  micronationId: string | null;
  rank: 'Sovereign' | 'Minister' | 'Officer' | 'Citizen' | 'Resident';
  title: string;
  joinedAt: string;
}

export interface BorderPoint {
  lat: number;
  lng: number;
}

export interface Resources {
  food: number;
  energy: number;
  materials: number;
  treasury: number;
}

export interface Policies {
  taxRate: number;      // 0 to 100 percentage
  openness: number;     // 0 to 100 (immigration open)
  basicIncome: number;  // 0 to 100
  propaganda: number;   // 0 to 100
}

export interface Law {
  id: string;
  title: string;
  description: string;
  category: 'economy' | 'social' | 'foreign' | 'defense';
  enactedAt: string;
}

export interface HistoryItem {
  id: string;
  event: string;
  timestamp: string;
}

export interface Micronation {
  id: string;
  name: string;
  motto: string;
  description: string;
  sovereignId: string;
  currencyName: string;
  latitude: number;
  longitude: number;
  borderPoints: BorderPoint[];
  resources: Resources;
  policies: Policies;
  population: number;
  happiness: number;   // 0 to 100
  stability: number;   // 0 to 100
  laws: Law[];
  historyLog: HistoryItem[];
  createdAt: string;
}

export interface DiplomaticRequest {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  type: 'alliance' | 'non_aggression' | 'peace_treaty';
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  message: string;
  counterOffer?: string; // Counter proposal conditions
  sentAt: string;
}

export interface WarRecord {
  id: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  status: 'ongoing' | 'peace';
  startedAt: string;
  endedAt?: string;
  terms?: string;
}

export interface TradeOffer {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  senderOffer: Resources;
  receiverOffer: Resources;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}
