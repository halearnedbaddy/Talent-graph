'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { ClubMember, AthleteProfile, UserAccount } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';
import { useToast } from '@/hooks/use-toast';

const cardReasons = ['Foul', 'Dissent', 'Time Wasting', 'Handball', 'Simulation', 'Violent Conduct', 'Two Yellow Cards'];
const goalTypes = ['Open Play', 'Penalty', 'Free Kick', 'Header', 'Own Goal', 'Counter Attack'];

type SquadPlayer = { id: string; name: string; number: number | null; position: string };

type PlayerStat = {
  id: string;
  athleteId?: string;
  apps: number;
  sub: number;
  subbed: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  pom: boolean;
  rating: number;
  yellowCards: number;
  redCards: number;
  mins: number;
};

type GoalEvent = { id: number; scorer: string | null; assister: string | null; minute: string; type: string; ownGoal: boolean };
type CardEvent  = { id: number; player: string | null; type: string; minute: string; reason: string };

function PlayerPicker({ players, value, onChange, placeholder = 'Select player...' }: {
  players: SquadPlayer[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = players.find(p => p.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8,
          padding: '10px 14px', cursor: 'pointer', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', color: selected ? '#fff' : '#555',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selected?.number != null && (
            <span style={{ background: '#00d4aa', color: '#000', fontWeight: 800, borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>
              {selected.number}
            </span>
          )}
          {selected ? `${selected.name} · ${selected.position}` : placeholder}
        </span>
        <span style={{ color: '#00d4aa', fontSize: 12 }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 10,
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ padding: '10px 14px', color: '#555', cursor: 'pointer', borderBottom: '1px solid #1a1a3a', fontSize: 13 }}
          >— None —</div>
          {players.map(p => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              style={{
                padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 12, color: '#e0e0f0', background: value === p.id ? '#1e1e40' : 'transparent',
                borderBottom: '1px solid #1a1a3a', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1e40')}
              onMouseLeave={e => (e.currentTarget.style.background = value === p.id ? '#1e1e40' : 'transparent')}
            >
              {p.number != null && (
                <span style={{ background: '#00d4aa', color: '#000', fontWeight: 800, borderRadius: 4, padding: '2px 7px', fontSize: 11, minWidth: 28, textAlign: 'center' }}>
                  {p.number}
                </span>
              )}
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ marginLeft: 'auto', color: '#00d4aa', fontSize: 11, fontWeight: 700 }}>{p.position}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatInput({ label, value, onChange, min = 0, max = 99 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 30, height: 30, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 6, color: '#00d4aa', fontSize: 16, cursor: 'pointer' }}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 30, height: 30, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 6, color: '#00d4aa', fontSize: 16, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Rating</label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
              background: n <= value ? (value >= 8 ? '#00d4aa' : value >= 5 ? '#f5a623' : '#e74c3c') : '#1a1a2e',
              border: `1px solid ${n <= value ? 'transparent' : '#2a2a4a'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: n <= value ? '#000' : '#444', fontSize: 9, fontWeight: 800, transition: 'all 0.15s',
            }}
          >{n}</div>
        ))}
      </div>
    </div>
  );
}

export default function CoachMatchEntryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [page, setPage]       = useState(1);
  const [statsTab, setStatsTab] = useState('player');
  const [saving, setSaving]   = useState(false);

  const [match, setMatch] = useState({
    date: new Date().toISOString().slice(0, 10),
    opponent: '', venue: 'Home', competition: '',
    kickoff: '', season: '2025/26',
  });

  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);

  const [teamStats, setTeamStats] = useState({
    goalsFor: 0, goalsAgainst: 0, result: 'Draw',
    cleanSheet: false, failedToScore: false, possession: 50,
    shotsOnTarget: 0, shotsOffTarget: 0, corners: 0, fouls: 0,
    attendance: 0, matchReport: '',
  });

  const [goals, setGoals]           = useState<GoalEvent[]>([]);
  const [newGoal, setNewGoal]       = useState<GoalEvent>({ id: 0, scorer: null, assister: null, minute: '', type: 'Open Play', ownGoal: false });
  const [discipline, setDiscipline] = useState<CardEvent[]>([]);
  const [newCard, setNewCard]       = useState<CardEvent>({ id: 0, player: null, type: 'Yellow', minute: '', reason: 'Foul' });
  const [motm, setMotm]             = useState<string | null>(null);

  // Firebase data
  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<any>(matchesQuery);

  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => b.date?.localeCompare(a.date ?? '') ?? 0);
  }, [matches]);

  // Map athletes to squad players
  const squadPlayers: SquadPlayer[] = useMemo(() => {
    if (!athletes) return [];
    return athletes.map(a => ({
      id: a.uid,
      name: `${a.firstName} ${a.lastName}`,
      number: a.jerseyNumber ?? null,
      position: a.position ?? '',
    }));
  }, [athletes]);

  // Init player stats when athletes load or when entering page 2
  const initPlayerStats = () => {
    if (!athletes) return;
    setPlayerStats(athletes.map(a => ({
      id: a.uid,
      athleteId: a.uid,
      apps: 1, sub: 0, subbed: 0,
      goals: 0, assists: 0,
      cleanSheet: false, pom: false,
      rating: 7, yellowCards: 0, redCards: 0, mins: 90,
    })));
  };

  const updatePlayerStat = (playerId: string, field: keyof PlayerStat, value: any) => {
    setPlayerStats(prev => prev.map(p => p.id === playerId ? { ...p, [field]: value } : p));
  };

  const addGoal = () => {
    if (!newGoal.minute) return;
    const entry = { ...newGoal, id: Date.now() };
    setGoals(prev => [...prev, entry]);
    if (newGoal.scorer) {
      const cur = playerStats.find(p => p.id === newGoal.scorer)?.goals ?? 0;
      updatePlayerStat(newGoal.scorer, 'goals', cur + 1);
    }
    if (newGoal.assister) {
      const cur = playerStats.find(p => p.id === newGoal.assister)?.assists ?? 0;
      updatePlayerStat(newGoal.assister, 'assists', cur + 1);
    }
    if (!newGoal.ownGoal) {
      setTeamStats(prev => ({ ...prev, goalsFor: prev.goalsFor + 1 }));
    }
    setNewGoal({ id: 0, scorer: null, assister: null, minute: '', type: 'Open Play', ownGoal: false });
  };

  const addCard = () => {
    if (!newCard.player || !newCard.minute) return;
    setDiscipline(prev => [...prev, { ...newCard, id: Date.now() }]);
    const field: keyof PlayerStat = newCard.type === 'Red' ? 'redCards' : 'yellowCards';
    const cur = (playerStats.find(p => p.id === newCard.player)?.[field] as number) ?? 0;
    updatePlayerStat(newCard.player, field, cur + 1);
    setNewCard({ id: 0, player: null, type: 'Yellow', minute: '', reason: 'Foul' });
  };

  const getPlayer = (id: string | null) => squadPlayers.find(p => p.id === id);

  // Export
  const exportData = () => {
    const data = {
      match, teamStats,
      playerStats: playerStats.map(ps => ({ ...ps, playerName: getPlayer(ps.id)?.name })),
      goals: goals.map(g => ({ ...g, scorerName: getPlayer(g.scorer)?.name, assisterName: getPlayer(g.assister)?.name })),
      discipline: discipline.map(d => ({ ...d, playerName: getPlayer(d.player)?.name })),
      motm: getPlayer(motm)?.name ?? null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `match_${match.opponent || 'entry'}_${match.date || 'draft'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.match)      setMatch(data.match);
        if (data.teamStats)  setTeamStats(data.teamStats);
        if (data.goals)      setGoals(data.goals);
        if (data.discipline) setDiscipline(data.discipline);
        toast({ title: '✅ Data imported successfully!' });
      } catch {
        toast({ title: '❌ Invalid file format', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save to Firestore
  const handleSave = async (draft = false) => {
    if (!firestore || !clubId || !user) return;
    setSaving(true);
    try {
      const resultMap: Record<string, string> = { Win: 'W', Draw: 'D', Loss: 'L' };
      const motmPlayer = playerStats.find(ps => ps.pom);
      const matchData = {
        clubId,
        opponent: match.opponent,
        competition: match.competition,
        category: 'league',
        date: match.date,
        venue: match.venue,
        kickoff: match.kickoff || null,
        season: match.season,
        result: resultMap[teamStats.result] ?? 'D',
        score: `${teamStats.goalsFor}-${teamStats.goalsAgainst}`,
        goalsFor: teamStats.goalsFor,
        goalsAgainst: teamStats.goalsAgainst,
        possession: teamStats.possession,
        cleanSheet: teamStats.cleanSheet,
        failedToScore: teamStats.failedToScore,
        shotsOnTarget: teamStats.shotsOnTarget,
        shotsOffTarget: teamStats.shotsOffTarget,
        corners: teamStats.corners,
        fouls: teamStats.fouls,
        attendance: teamStats.attendance || null,
        matchReport: teamStats.matchReport || null,
        totalYellowCards: discipline.filter(d => d.type === 'Yellow' || d.type === '2nd Yellow').length,
        totalRedCards: discipline.filter(d => d.type === 'Red').length,
        goals: goals.map(g => ({
          scorerId: g.scorer, scorerName: getPlayer(g.scorer)?.name ?? null,
          assisterId: g.assister, assisterName: getPlayer(g.assister)?.name ?? null,
          minute: g.minute, type: g.type, ownGoal: g.ownGoal,
        })),
        motmPlayerName: motmPlayer ? getPlayer(motmPlayer.id)?.name ?? null : null,
        motmPlayerId: motmPlayer?.athleteId ?? null,
        isDraft: draft,
        createdAt: new Date().toISOString(),
      };

      const matchRef = await addDoc(collection(firestore, 'matches'), matchData);

      if (!draft) {
        for (const ps of playerStats) {
          if (!ps.athleteId || !athletes) continue;
          const athlete = athletes.find(a => a.uid === ps.athleteId);
          if (!athlete) continue;
          const existing = athlete.matchHistory ?? [];
          const newEntry = {
            id: matchRef.id, competition: match.competition, category: 'league',
            opponent: match.opponent, apps: ps.apps, minutes: ps.mins, rating: ps.rating,
            goals: ps.goals, assists: ps.assists, shots: 0, duelsWon: 0, fouls: 0,
            saves: 0, yellowCards: ps.yellowCards, redCards: ps.redCards,
            cleanSheet: ps.cleanSheet, manOfTheMatch: ps.pom,
            isVerified: true, statsLogged: true,
            updatedAt: new Date().toISOString(), clubMatchId: matchRef.id,
          };
          const updatedHistory = [...existing, newEntry];
          let scoreUpdates: Record<string, any> = {};
          try {
            const userSnap = await getDoc(doc(firestore, 'users', ps.athleteId));
            const userAccount = (userSnap.exists() ? userSnap.data() : {}) as UserAccount;
            scoreUpdates = calculateTalentGraphScore({ ...athlete, matchHistory: updatedHistory }, userAccount);
          } catch {}
          await updateDoc(doc(firestore, 'athletes', ps.athleteId), {
            matchHistory: updatedHistory, ...scoreUpdates, updatedAt: new Date().toISOString(),
          });
          try {
            await addDoc(collection(firestore, 'match_confirmations'), {
              athleteId: ps.athleteId, matchId: matchRef.id, clubId,
              opponent: match.opponent, competition: match.competition,
              date: match.date, category: 'league',
              stats: {
                goals: ps.goals, assists: ps.assists, minutes: ps.mins, rating: ps.rating,
                yellowCards: ps.yellowCards, redCards: ps.redCards,
                shots: 0, duelsWon: 0, fouls: 0, saves: 0,
                cleanSheet: ps.cleanSheet, manOfTheMatch: ps.pom,
              },
              status: 'pending', enteredBy: user.uid, enteredByRole: 'coach',
              createdAt: new Date().toISOString(),
            });
          } catch {}
        }
      }

      toast({ title: draft ? '💾 Saved as draft' : '✓ Match published!', description: draft ? 'You can continue editing later.' : `${playerStats.filter(p => p.athleteId).length} player profiles updated.` });
      // Reset
      setPage(1);
      setMatch({ date: new Date().toISOString().slice(0, 10), opponent: '', venue: 'Home', competition: '', kickoff: '', season: '2025/26' });
      setTeamStats({ goalsFor: 0, goalsAgainst: 0, result: 'Draw', cleanSheet: false, failedToScore: false, possession: 50, shotsOnTarget: 0, shotsOffTarget: 0, corners: 0, fouls: 0, attendance: 0, matchReport: '' });
      setGoals([]); setDiscipline([]); setMotm(null); setPlayerStats([]);
    } catch {
      toast({ title: 'Error', description: 'Could not save match.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8,
    color: '#fff', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none',
    fontFamily: "'Rajdhani', sans-serif", boxSizing: 'border-box',
  };
  const sectionStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0d0d1f 0%, #12122a 100%)',
    border: '1px solid #1e1e3a', borderRadius: 12, padding: 18, marginBottom: 14,
  };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 4px', background: active ? '#00d4aa' : 'transparent',
    border: 'none', borderRadius: 8, color: active ? '#000' : '#666',
    fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
    textTransform: 'uppercase', transition: 'all 0.2s', fontFamily: "'Rajdhani', sans-serif",
  });
  const labelStyle: React.CSSProperties = {
    color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1,
    textTransform: 'uppercase', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080818', fontFamily: "'Rajdhani', 'Oswald', sans-serif", color: '#e0e0f0', maxWidth: 520, margin: '0 auto' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0a0a20 0%, #0d1635 100%)', borderBottom: '2px solid #00d4aa', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Talent Graph</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>Match Entry</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#aaa', letterSpacing: 1 }}>
            ⬆ IMPORT
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
          <button onClick={exportData} style={{ background: 'linear-gradient(135deg, #00d4aa, #00a882)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#000', letterSpacing: 1 }}>
            ⬇ EXPORT
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', padding: '14px 20px', gap: 6 }}>
        {['Match Details', 'Stats Entry', 'Save Match'].map((label, i) => (
          <div key={i} onClick={() => setPage(i + 1)} style={{ flex: 1, cursor: 'pointer' }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: page > i ? '#00d4aa' : page === i + 1 ? '#00d4aa' : '#1a1a3a', opacity: page === i + 1 ? 1 : page > i ? 0.7 : 0.3 }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: page === i + 1 ? '#00d4aa' : page > i ? '#555' : '#333', textAlign: 'center' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 120px' }}>

        {/* ── PAGE 1: MATCH DETAILS ── */}
        {page === 1 && (
          <div>
            <div style={sectionStyle}>
              <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>⚽ Match Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={match.date} onChange={e => setMatch({ ...match, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Kickoff</label>
                  <input type="time" value={match.kickoff} onChange={e => setMatch({ ...match, kickoff: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>🏟️ Fixture Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Opponent</label>
                  <input placeholder="e.g. Gor Mahia FC" value={match.opponent} onChange={e => setMatch({ ...match, opponent: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Venue</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Home', 'Away', 'Neutral'].map(v => (
                      <button key={v} onClick={() => setMatch({ ...match, venue: v })} style={{ flex: 1, padding: '10px 0', background: match.venue === v ? '#00d4aa' : '#1a1a2e', border: `1px solid ${match.venue === v ? '#00d4aa' : '#2a2a4a'}`, borderRadius: 8, color: match.venue === v ? '#000' : '#666', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}>
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Competition</label>
                  <input placeholder="e.g. Kenya Premier League" value={match.competition} onChange={e => setMatch({ ...match, competition: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Season</label>
                  <input value={match.season} onChange={e => setMatch({ ...match, season: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>📊 Result</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>YOUR TEAM</div>
                  <input
                    type="number" min="0" max="20"
                    value={teamStats.goalsFor}
                    onChange={e => setTeamStats({ ...teamStats, goalsFor: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: 36, textAlign: 'center', padding: '14px 0', fontWeight: 800 }}
                  />
                </div>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 20 }}>—</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>OPPONENT</div>
                  <input
                    type="number" min="0" max="20"
                    value={teamStats.goalsAgainst}
                    onChange={e => setTeamStats({ ...teamStats, goalsAgainst: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: 36, textAlign: 'center', padding: '14px 0', fontWeight: 800 }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Possession %</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="0" max="100" value={teamStats.possession}
                    onChange={e => setTeamStats({ ...teamStats, possession: parseInt(e.target.value) })}
                    style={{ flex: 1, accentColor: '#00d4aa' } as any} />
                  <span style={{ color: '#00d4aa', fontWeight: 800, fontSize: 18, minWidth: 44 }}>{teamStats.possession}%</span>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>🏆 Man of the Match</div>
              {athletesLoading ? (
                <div style={{ color: '#555', fontSize: 13 }}>Loading squad...</div>
              ) : (
                <PlayerPicker players={squadPlayers} value={motm} onChange={setMotm} placeholder="Select man of the match..." />
              )}
            </div>
          </div>
        )}

        {/* ── PAGE 2: STATS ENTRY ── */}
        {page === 2 && (
          <div>
            <div style={{ display: 'flex', gap: 4, background: '#0d0d1f', borderRadius: 10, padding: 4, marginBottom: 16 }}>
              {(['player', 'team', 'goal', 'discipline'] as const).map(tab => (
                <button key={tab} onClick={() => setStatsTab(tab)} style={tabStyle(statsTab === tab)}>
                  {tab === 'player' ? '👤' : tab === 'team' ? '🏟️' : tab === 'goal' ? '⚽' : '🟨'} {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* PLAYER STATS */}
            {statsTab === 'player' && (
              <div>
                {athletesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <Loader2 style={{ width: 32, height: 32, color: '#00d4aa', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : squadPlayers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#888' }}>No squad athletes yet</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Add athletes via My Squad first.</div>
                  </div>
                ) : (
                  squadPlayers.map(player => {
                    let ps = playerStats.find(p => p.id === player.id);
                    if (!ps) {
                      const defaultStat: PlayerStat = { id: player.id, athleteId: player.id, apps: 1, sub: 0, subbed: 0, goals: 0, assists: 0, cleanSheet: false, pom: false, rating: 7, yellowCards: 0, redCards: 0, mins: 90 };
                      ps = defaultStat;
                    }
                    const psFinal = ps;
                    return (
                      <div key={player.id} style={{ ...sectionStyle, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #00a882)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: 14, flexShrink: 0 }}>
                            {player.number ?? player.name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{player.name}</div>
                            <div style={{ fontSize: 11, color: '#00d4aa', fontWeight: 700, letterSpacing: 1 }}>{player.position}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => {
                                setPlayerStats(prev => {
                                  const exists = prev.find(p => p.id === player.id);
                                  if (exists) return prev.map(p => p.id === player.id ? { ...p, pom: !p.pom } : p);
                                  return [...prev, { id: player.id, athleteId: player.id, apps: 1, sub: 0, subbed: 0, goals: 0, assists: 0, cleanSheet: false, pom: true, rating: 7, yellowCards: 0, redCards: 0, mins: 90 }];
                                });
                              }}
                              style={{ padding: '4px 10px', background: psFinal.pom ? '#f5a623' : '#1a1a2e', border: `1px solid ${psFinal.pom ? '#f5a623' : '#2a2a4a'}`, borderRadius: 6, color: psFinal.pom ? '#000' : '#555', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
                              🏆 POM
                            </button>
                            <button
                              onClick={() => {
                                setPlayerStats(prev => {
                                  const exists = prev.find(p => p.id === player.id);
                                  if (exists) return prev.map(p => p.id === player.id ? { ...p, cleanSheet: !p.cleanSheet } : p);
                                  return [...prev, { id: player.id, athleteId: player.id, apps: 1, sub: 0, subbed: 0, goals: 0, assists: 0, cleanSheet: true, pom: false, rating: 7, yellowCards: 0, redCards: 0, mins: 90 }];
                                });
                              }}
                              style={{ padding: '4px 10px', background: psFinal.cleanSheet ? '#00d4aa' : '#1a1a2e', border: `1px solid ${psFinal.cleanSheet ? '#00d4aa' : '#2a2a4a'}`, borderRadius: 6, color: psFinal.cleanSheet ? '#000' : '#555', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
                              🧤 CS
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                          <StatInput label="Goals"  value={psFinal.goals}       onChange={v => updatePlayerStat(player.id, 'goals', v)} />
                          <StatInput label="Assists" value={psFinal.assists}     onChange={v => updatePlayerStat(player.id, 'assists', v)} />
                          <StatInput label="Yellow"  value={psFinal.yellowCards} onChange={v => updatePlayerStat(player.id, 'yellowCards', v)} max={2} />
                          <StatInput label="Red"     value={psFinal.redCards}    onChange={v => updatePlayerStat(player.id, 'redCards', v)} max={1} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                          <StatInput label="Mins Played" value={psFinal.mins} onChange={v => updatePlayerStat(player.id, 'mins', v)} max={120} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Status</label>
                            <select
                              value={psFinal.sub === 1 ? 'sub' : psFinal.subbed === 1 ? 'subbed' : 'starter'}
                              onChange={e => {
                                setPlayerStats(prev => {
                                  const ensure = (arr: PlayerStat[]) => arr.find(p => p.id === player.id) ? arr : [...arr, { id: player.id, athleteId: player.id, apps: 1, sub: 0, subbed: 0, goals: 0, assists: 0, cleanSheet: false, pom: false, rating: 7, yellowCards: 0, redCards: 0, mins: 90 }];
                                  return ensure(prev).map(p => p.id === player.id ? { ...p, sub: e.target.value === 'sub' ? 1 : 0, subbed: e.target.value === 'subbed' ? 1 : 0, apps: e.target.value === 'sub' ? 0 : 1 } : p);
                                });
                              }}
                              style={{ ...inputStyle, padding: '8px 10px' }}
                            >
                              <option value="starter">Starter</option>
                              <option value="sub">Substitute In</option>
                              <option value="subbed">Substituted Off</option>
                            </select>
                          </div>
                        </div>
                        <RatingInput value={psFinal.rating} onChange={v => updatePlayerStat(player.id, 'rating', v)} />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TEAM STATS */}
            {statsTab === 'team' && (
              <div style={sectionStyle}>
                <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>🏟️ Team Stats Overview</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <StatInput label="Goals For"      value={teamStats.goalsFor}      onChange={v => setTeamStats({ ...teamStats, goalsFor: v })} />
                  <StatInput label="Goals Against"  value={teamStats.goalsAgainst}  onChange={v => setTeamStats({ ...teamStats, goalsAgainst: v })} />
                  <StatInput label="Shots On Target" value={teamStats.shotsOnTarget} onChange={v => setTeamStats({ ...teamStats, shotsOnTarget: v })} />
                  <StatInput label="Shots Off Target" value={teamStats.shotsOffTarget} onChange={v => setTeamStats({ ...teamStats, shotsOffTarget: v })} />
                  <StatInput label="Corners"         value={teamStats.corners}       onChange={v => setTeamStats({ ...teamStats, corners: v })} />
                  <StatInput label="Fouls"           value={teamStats.fouls}         onChange={v => setTeamStats({ ...teamStats, fouls: v })} />
                  <StatInput label="Attendance"      value={teamStats.attendance}    onChange={v => setTeamStats({ ...teamStats, attendance: v })} max={99999} />
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Result</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Win', 'Draw', 'Loss'].map(r => (
                      <button key={r} onClick={() => setTeamStats({ ...teamStats, result: r })} style={{ flex: 1, padding: '12px 0', background: teamStats.result === r ? (r === 'Win' ? '#00d4aa' : r === 'Loss' ? '#e74c3c' : '#f5a623') : '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: teamStats.result === r ? '#000' : '#555', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    {([['cleanSheet', 'Clean Sheet 🧤'], ['failedToScore', 'Failed to Score ❌']] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setTeamStats({ ...teamStats, [key]: !teamStats[key] })} style={{ flex: 1, padding: '12px 0', background: teamStats[key] ? '#00d4aa' : '#1a1a2e', border: `1px solid ${teamStats[key] ? '#00d4aa' : '#2a2a4a'}`, borderRadius: 8, color: teamStats[key] ? '#000' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={labelStyle}>Possession %</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="range" min="0" max="100" value={teamStats.possession}
                        onChange={e => setTeamStats({ ...teamStats, possession: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: '#00d4aa' } as any} />
                      <span style={{ color: '#00d4aa', fontWeight: 800, fontSize: 18, minWidth: 44 }}>{teamStats.possession}%</span>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Match Report</label>
                    <textarea
                      placeholder="Optional match notes..."
                      value={teamStats.matchReport}
                      onChange={e => setTeamStats({ ...teamStats, matchReport: e.target.value })}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* GOAL EVENTS */}
            {statsTab === 'goal' && (
              <div>
                <div style={sectionStyle}>
                  <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>⚽ Add Goal Event</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Scorer</label>
                      <PlayerPicker players={squadPlayers} value={newGoal.scorer} onChange={v => setNewGoal({ ...newGoal, scorer: v, ownGoal: false })} placeholder="Select scorer from squad..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Assist</label>
                      <PlayerPicker players={squadPlayers} value={newGoal.assister} onChange={v => setNewGoal({ ...newGoal, assister: v })} placeholder="Select assister (optional)..." />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Minute</label>
                        <input type="number" min="1" max="120" placeholder="45'" value={newGoal.minute}
                          onChange={e => setNewGoal({ ...newGoal, minute: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Type</label>
                        <select value={newGoal.type} onChange={e => setNewGoal({ ...newGoal, type: e.target.value })} style={{ ...inputStyle, padding: '10px 10px' }}>
                          {goalTypes.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => setNewGoal({ ...newGoal, ownGoal: !newGoal.ownGoal })}
                      style={{ padding: '10px 0', background: newGoal.ownGoal ? '#e74c3c' : '#1a1a2e', border: `1px solid ${newGoal.ownGoal ? '#e74c3c' : '#2a2a4a'}`, borderRadius: 8, color: newGoal.ownGoal ? '#fff' : '#555', fontWeight: 800, fontSize: 12, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
                      OWN GOAL {newGoal.ownGoal ? '✓' : ''}
                    </button>
                    <button onClick={addGoal} style={{ padding: '14px 0', background: 'linear-gradient(135deg, #00d4aa, #00a882)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
                      + ADD GOAL
                    </button>
                  </div>
                </div>
                {goals.length > 0 && (
                  <div style={sectionStyle}>
                    <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>Goal Log</div>
                    {goals.map(g => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a1a3a' }}>
                        <span style={{ background: g.ownGoal ? '#e74c3c' : '#00d4aa', color: '#000', fontWeight: 800, borderRadius: 6, padding: '4px 8px', fontSize: 12, minWidth: 36, textAlign: 'center' }}>{g.minute}'</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>⚽ {getPlayer(g.scorer)?.name || 'Unknown'}</span>
                        {g.assister && <span style={{ color: '#888', fontSize: 12 }}>↳ {getPlayer(g.assister)?.name}</span>}
                        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>{g.type}</span>
                        <button onClick={() => setGoals(prev => prev.filter(x => x.id !== g.id))} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DISCIPLINE */}
            {statsTab === 'discipline' && (
              <div>
                <div style={sectionStyle}>
                  <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>🟨 Add Card Event</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Player</label>
                      <PlayerPicker players={squadPlayers} value={newCard.player} onChange={v => setNewCard({ ...newCard, player: v })} placeholder="Select player from squad..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Card Type</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Yellow', 'Red', '2nd Yellow'].map(t => (
                          <button key={t} onClick={() => setNewCard({ ...newCard, type: t })} style={{ flex: 1, padding: '12px 0', background: newCard.type === t ? (t === 'Red' ? '#e74c3c' : '#f5a623') : '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: newCard.type === t ? '#000' : '#555', fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Minute</label>
                        <input type="number" min="1" max="120" placeholder="67'" value={newCard.minute}
                          onChange={e => setNewCard({ ...newCard, minute: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Reason</label>
                        <select value={newCard.reason} onChange={e => setNewCard({ ...newCard, reason: e.target.value })} style={{ ...inputStyle, padding: '10px 10px' }}>
                          {cardReasons.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={addCard} style={{ padding: '14px 0', background: 'linear-gradient(135deg, #f5a623, #e09000)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
                      + ADD CARD
                    </button>
                  </div>
                </div>
                {discipline.length > 0 && (
                  <div style={sectionStyle}>
                    <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>Card Log</div>
                    {discipline.map(d => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a1a3a' }}>
                        <span style={{ background: d.type === 'Yellow' ? '#f5a623' : '#e74c3c', width: 18, height: 24, borderRadius: 3, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#fff' }}>{getPlayer(d.player)?.name}</span>
                        <span style={{ color: '#888', fontSize: 12 }}>{d.minute}' · {d.reason}</span>
                        <button onClick={() => setDiscipline(prev => prev.filter(x => x.id !== d.id))} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PAGE 3: SAVE MATCH ── */}
        {page === 3 && (
          <div>
            <div style={{ ...sectionStyle, background: 'linear-gradient(135deg, #0d1a0d, #0a1a0a)', border: '1px solid #1a3a1a', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>📋 Match Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>YOUR TEAM</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: '#00d4aa' }}>{teamStats.goalsFor}</div>
                </div>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 24 }}>:</div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{match.opponent || 'OPPONENT'}</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: '#fff' }}>{teamStats.goalsAgainst}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[['Date', match.date || '—'], ['Venue', match.venue], ['Competition', match.competition || '—'], ['Season', match.season]].map(([k, v]) => (
                  <div key={k} style={{ background: '#0a1a0a', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{k.toUpperCase()}</div>
                    <div style={{ color: '#ccc', fontWeight: 600, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {motm && (
              <div style={{ ...sectionStyle, background: 'linear-gradient(135deg, #1a1500, #201a00)', border: '1px solid #3a3000', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#f5a623', fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>🏆 Man of the Match</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f5a623, #e09000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: 16, flexShrink: 0 }}>
                    {getPlayer(motm)?.number ?? getPlayer(motm)?.name[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#f5a623' }}>{getPlayer(motm)?.name}</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>{getPlayer(motm)?.position}</div>
                  </div>
                </div>
              </div>
            )}

            {goals.length > 0 && (
              <div style={{ ...sectionStyle, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>⚽ Goals ({goals.length})</div>
                {goals.map(g => (
                  <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a3a' }}>
                    <span style={{ color: '#00d4aa', fontWeight: 800, minWidth: 36 }}>{g.minute}'</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{getPlayer(g.scorer)?.name || '?'}</span>
                    {g.assister && <span style={{ color: '#888', fontSize: 12 }}>↳ {getPlayer(g.assister)?.name}</span>}
                    <span style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>{g.type}</span>
                  </div>
                ))}
              </div>
            )}

            {discipline.length > 0 && (
              <div style={{ ...sectionStyle, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#f5a623', fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>🟨 Cards ({discipline.length})</div>
                {discipline.map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a3a' }}>
                    <span style={{ background: d.type === 'Yellow' ? '#f5a623' : '#e74c3c', width: 14, height: 18, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontWeight: 600 }}>{getPlayer(d.player)?.name}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>{d.minute}' · {d.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Previous matches */}
            {sortedMatches.length > 0 && (
              <div style={sectionStyle}>
                <div style={{ fontSize: 13, color: '#00d4aa', fontWeight: 700, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>📁 Match History ({sortedMatches.length})</div>
                {sortedMatches.slice(0, 5).map((m: any) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a1a3a' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: m.result === 'W' ? '#00d4aa22' : m.result === 'L' ? '#e74c3c22' : '#f5a62322', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: m.result === 'W' ? '#00d4aa' : m.result === 'L' ? '#e74c3c' : '#f5a623', fontSize: 13, flexShrink: 0 }}>
                      {m.result || '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {m.opponent}</div>
                      <div style={{ color: '#555', fontSize: 11 }}>{m.competition} · {m.date}</div>
                    </div>
                    {m.score && <div style={{ fontWeight: 800, color: '#00d4aa', fontSize: 15 }}>{m.score}</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{ padding: '16px 0', background: saving ? '#005544' : 'linear-gradient(135deg, #00d4aa, #00a882)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: 2, fontFamily: "'Rajdhani', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> SAVING...</> : '✓ SAVE & PUBLISH MATCH'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{ padding: '14px 0', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, color: '#888', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 2, fontFamily: "'Rajdhani', sans-serif" }}>
                💾 SAVE AS DRAFT
              </button>
              <button
                onClick={exportData}
                style={{ padding: '14px 0', background: 'transparent', border: '1px solid #00d4aa', borderRadius: 12, color: '#00d4aa', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 2, fontFamily: "'Rajdhani', sans-serif" }}>
                ⬇ EXPORT AS JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, background: '#080818', borderTop: '1px solid #1a1a3a', padding: '12px 16px', display: 'flex', gap: 10, zIndex: 40 }}>
        {page > 1 && (
          <button onClick={() => setPage(page - 1)} style={{ flex: 1, padding: '14px 0', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
            ← BACK
          </button>
        )}
        {page < 3 && (
          <button
            onClick={() => { if (page === 1) initPlayerStats(); setPage(page + 1); }}
            style={{ flex: 2, padding: '14px 0', background: 'linear-gradient(135deg, #00d4aa, #00a882)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
            NEXT →
          </button>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
