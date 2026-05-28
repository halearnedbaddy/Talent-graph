import { useState } from "react";

const CLUB_PLAYERS = [
  { id: 1, name: "H. Nzai", number: 1, position: "GK" },
  { id: 2, name: "H. Randu", number: 4, position: "CB" },
  { id: 3, name: "N. Randu", number: 5, position: "CB" },
  { id: 4, name: "R. Harun", number: 7, position: "MF" },
  { id: 5, name: "R. Nzai", number: 10, position: "FW" },
  { id: 6, name: "K. Mwenda", number: 11, position: "FW" },
  { id: 7, name: "J. Otieno", number: 6, position: "MF" },
  { id: 8, name: "P. Kamau", number: 3, position: "LB" },
  { id: 9, name: "S. Wekesa", number: 2, position: "RB" },
  { id: 10, name: "M. Odhiambo", number: 8, position: "MF" },
  { id: 11, name: "T. Mutua", number: 9, position: "FW" },
];

const positions = ["GK", "CB", "LB", "RB", "MF", "FW"];
const cardReasons = ["Foul", "Dissent", "Time Wasting", "Handball", "Simulation", "Violent Conduct", "Two Yellow Cards"];
const goalTypes = ["Open Play", "Penalty", "Free Kick", "Header", "Own Goal", "Counter Attack"];

function PlayerPicker({ label, value, onChange, placeholder = "Select player..." }) {
  const [open, setOpen] = useState(false);
  const selected = CLUB_PLAYERS.find(p => p.id === value);
  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8,
          padding: "10px 14px", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", color: selected ? "#fff" : "#555"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selected && (
            <span style={{
              background: "#00d4aa", color: "#000", fontWeight: 800,
              borderRadius: 4, padding: "2px 7px", fontSize: 11
            }}>{selected.number}</span>
          )}
          {selected ? `${selected.name} · ${selected.position}` : placeholder}
        </span>
        <span style={{ color: "#00d4aa", fontSize: 12 }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#12122a", border: "1px solid #2a2a4a", borderRadius: 10,
          maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
        }}>
          <div
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ padding: "10px 14px", color: "#555", cursor: "pointer", borderBottom: "1px solid #1a1a3a", fontSize: 13 }}
          >— None —</div>
          {CLUB_PLAYERS.map(p => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              style={{
                padding: "10px 14px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 12, color: "#e0e0f0",
                background: value === p.id ? "#1e1e40" : "transparent",
                borderBottom: "1px solid #1a1a3a", transition: "background 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#1e1e40"}
              onMouseLeave={e => e.currentTarget.style.background = value === p.id ? "#1e1e40" : "transparent"}
            >
              <span style={{
                background: "#00d4aa", color: "#000", fontWeight: 800,
                borderRadius: 4, padding: "2px 7px", fontSize: 11, minWidth: 28, textAlign: "center"
              }}>{p.number}</span>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ marginLeft: "auto", color: "#00d4aa", fontSize: 11, fontWeight: 700 }}>{p.position}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatInput({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={{
          width: 30, height: 30, background: "#1a1a2e", border: "1px solid #2a2a4a",
          borderRadius: 6, color: "#00d4aa", fontSize: 16, cursor: "pointer"
        }}>−</button>
        <span style={{
          minWidth: 36, textAlign: "center", color: "#fff", fontWeight: 700,
          fontSize: 16, fontFamily: "'Rajdhani', sans-serif"
        }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={{
          width: 30, height: 30, background: "#1a1a2e", border: "1px solid #2a2a4a",
          borderRadius: 6, color: "#00d4aa", fontSize: 16, cursor: "pointer"
        }}>+</button>
      </div>
    </div>
  );
}

function RatingInput({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Rating</label>
      <div style={{ display: "flex", gap: 4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 24, height: 24, borderRadius: 4, cursor: "pointer",
              background: n <= value ? (value >= 8 ? "#00d4aa" : value >= 5 ? "#f5a623" : "#e74c3c") : "#1a1a2e",
              border: `1px solid ${n <= value ? "transparent" : "#2a2a4a"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: n <= value ? "#000" : "#444", fontSize: 9, fontWeight: 800, transition: "all 0.15s"
            }}
          >{n}</div>
        ))}
      </div>
    </div>
  );
}

export default function MatchEntry() {
  const [page, setPage] = useState(1);
  const [statsTab, setStatsTab] = useState("player");

  // Page 1 state
  const [match, setMatch] = useState({
    date: "", opponent: "", venue: "Home", competition: "",
    kickoff: "", season: "2025/26", result: ""
  });

  // Player stats
  const [playerStats, setPlayerStats] = useState(
    CLUB_PLAYERS.map(p => ({
      id: p.id, apps: 1, sub: 0, subbed: 0, goals: 0,
      assists: 0, cleanSheet: false, pom: false, rating: 7,
      yellowCards: 0, redCards: 0, mins: 90
    }))
  );

  // Team stats
  const [teamStats, setTeamStats] = useState({
    goalsFor: 0, goalsAgainst: 0, result: "Draw",
    biggestWin: 0, cleanSheet: false, failedToScore: false, possession: 50
  });

  // Goal events
  const [goals, setGoals] = useState([]);
  const [newGoal, setNewGoal] = useState({ scorer: null, assister: null, minute: "", type: "Open Play", ownGoal: false });

  // Discipline events
  const [discipline, setDiscipline] = useState([]);
  const [newCard, setNewCard] = useState({ player: null, type: "Yellow", minute: "", reason: "Foul" });

  // MOTM
  const [motm, setMotm] = useState(null);

  const updatePlayerStat = (playerId, field, value) => {
    setPlayerStats(prev => prev.map(p => p.id === playerId ? { ...p, [field]: value } : p));
  };

  const addGoal = () => {
    if (!newGoal.minute) return;
    setGoals(prev => [...prev, { ...newGoal, id: Date.now() }]);
    setNewGoal({ scorer: null, assister: null, minute: "", type: "Open Play", ownGoal: false });
    if (newGoal.scorer) {
      updatePlayerStat(newGoal.scorer, "goals", (playerStats.find(p => p.id === newGoal.scorer)?.goals || 0) + 1);
    }
    if (newGoal.assister) {
      updatePlayerStat(newGoal.assister, "assists", (playerStats.find(p => p.id === newGoal.assister)?.assists || 0) + 1);
    }
    setTeamStats(prev => ({ ...prev, goalsFor: prev.goalsFor + (newGoal.ownGoal ? 0 : 1) }));
  };

  const addCard = () => {
    if (!newCard.player || !newCard.minute) return;
    setDiscipline(prev => [...prev, { ...newCard, id: Date.now() }]);
    const field = newCard.type === "Red" ? "redCards" : "yellowCards";
    updatePlayerStat(newCard.player, field, (playerStats.find(p => p.id === newCard.player)?.[field] || 0) + 1);
    setNewCard({ player: null, type: "Yellow", minute: "", reason: "Foul" });
  };

  const exportData = () => {
    const data = {
      match, playerStats: playerStats.map(ps => ({
        ...ps, player: CLUB_PLAYERS.find(p => p.id === ps.id)?.name
      })),
      teamStats, goals: goals.map(g => ({
        ...g,
        scorer: CLUB_PLAYERS.find(p => p.id === g.scorer)?.name,
        assister: CLUB_PLAYERS.find(p => p.id === g.assister)?.name
      })),
      discipline: discipline.map(d => ({
        ...d, player: CLUB_PLAYERS.find(p => p.id === d.player)?.name
      })),
      motm: CLUB_PLAYERS.find(p => p.id === motm)?.name
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `match_${match.opponent || "entry"}_${match.date || "draft"}.json`;
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.match) setMatch(data.match);
        if (data.teamStats) setTeamStats(data.teamStats);
        if (data.goals) setGoals(data.goals);
        if (data.discipline) setDiscipline(data.discipline);
        alert("✅ Data imported successfully!");
      } catch { alert("❌ Invalid file format"); }
    };
    reader.readAsText(file);
  };

  const getPlayer = (id) => CLUB_PLAYERS.find(p => p.id === id);

  const inputStyle = {
    background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8,
    color: "#fff", padding: "10px 14px", fontSize: 14, width: "100%", outline: "none",
    fontFamily: "'Rajdhani', sans-serif"
  };

  const sectionStyle = {
    background: "linear-gradient(135deg, #0d0d1f 0%, #12122a 100%)",
    border: "1px solid #1e1e3a", borderRadius: 12, padding: 18, marginBottom: 14
  };

  const tabStyle = (active) => ({
    flex: 1, padding: "10px 4px", background: active ? "#00d4aa" : "transparent",
    border: "none", borderRadius: 8, color: active ? "#000" : "#666",
    fontWeight: 800, fontSize: 11, cursor: "pointer", letterSpacing: 1,
    textTransform: "uppercase", transition: "all 0.2s", fontFamily: "'Rajdhani', sans-serif"
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#080818",
      fontFamily: "'Rajdhani', 'Oswald', sans-serif",
      color: "#e0e0f0", maxWidth: 480, margin: "0 auto"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0a0a20 0%, #0d1635 100%)",
        borderBottom: "2px solid #00d4aa", padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Talent Graph</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>Match Entry</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{
            background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8,
            padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            color: "#aaa", letterSpacing: 1
          }}>
            ⬆ IMPORT
            <input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
          </label>
          <button onClick={exportData} style={{
            background: "linear-gradient(135deg, #00d4aa, #00a882)", border: "none",
            borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 800,
            cursor: "pointer", color: "#000", letterSpacing: 1
          }}>⬇ EXPORT</button>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: "flex", padding: "14px 20px", gap: 6 }}>
        {["Match Details", "Stats Entry", "Save Match"].map((label, i) => (
          <div key={i} onClick={() => setPage(i + 1)} style={{ flex: 1, cursor: "pointer" }}>
            <div style={{
              height: 4, borderRadius: 2, marginBottom: 6,
              background: page > i ? "#00d4aa" : page === i + 1 ? "#00d4aa" : "#1a1a3a",
              opacity: page === i + 1 ? 1 : page > i ? 0.7 : 0.3
            }} />
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: page === i + 1 ? "#00d4aa" : page > i ? "#555" : "#333", textAlign: "center"
            }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 16px 100px" }}>

        {/* PAGE 1 — MATCH DETAILS */}
        {page === 1 && (
          <div>
            <div style={{ ...sectionStyle }}>
              <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>⚽ Match Information</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Date</label>
                  <input type="date" value={match.date} onChange={e => setMatch({ ...match, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Kickoff</label>
                  <input type="time" value={match.kickoff} onChange={e => setMatch({ ...match, kickoff: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>🏟️ Fixture Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Opponent</label>
                  <input placeholder="e.g. Chelsea FC" value={match.opponent} onChange={e => setMatch({ ...match, opponent: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Venue</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["Home", "Away", "Neutral"].map(v => (
                      <button key={v} onClick={() => setMatch({ ...match, venue: v })} style={{
                        flex: 1, padding: "10px 0", background: match.venue === v ? "#00d4aa" : "#1a1a2e",
                        border: `1px solid ${match.venue === v ? "#00d4aa" : "#2a2a4a"}`,
                        borderRadius: 8, color: match.venue === v ? "#000" : "#666",
                        fontWeight: 800, fontSize: 12, cursor: "pointer", letterSpacing: 1,
                        fontFamily: "'Rajdhani', sans-serif"
                      }}>{v.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Competition</label>
                  <input placeholder="e.g. Kenya Premier League" value={match.competition} onChange={e => setMatch({ ...match, competition: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Season</label>
                  <input value={match.season} onChange={e => setMatch({ ...match, season: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>📊 Result</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>YOUR TEAM</div>
                  <input
                    type="number" min="0" max="20"
                    value={teamStats.goalsFor}
                    onChange={e => setTeamStats({ ...teamStats, goalsFor: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: 36, textAlign: "center", padding: "14px 0", fontWeight: 800 }}
                  />
                </div>
                <div style={{ color: "#333", fontWeight: 800, fontSize: 20 }}>—</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>OPPONENT</div>
                  <input
                    type="number" min="0" max="20"
                    value={teamStats.goalsAgainst}
                    onChange={e => setTeamStats({ ...teamStats, goalsAgainst: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: 36, textAlign: "center", padding: "14px 0", fontWeight: 800 }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Possession %</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min="0" max="100" value={teamStats.possession}
                    onChange={e => setTeamStats({ ...teamStats, possession: parseInt(e.target.value) })}
                    style={{ flex: 1, accentColor: "#00d4aa" }} />
                  <span style={{ color: "#00d4aa", fontWeight: 800, fontSize: 18, minWidth: 44 }}>{teamStats.possession}%</span>
                </div>
              </div>
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>🏆 Man of the Match</div>
              <PlayerPicker label="MOTM" value={motm} onChange={setMotm} placeholder="Select man of the match..." />
            </div>

            <div style={{ ...sectionStyle, background: "linear-gradient(135deg, #0d1a2e, #0a1525)", border: "1px solid #1a3a5a" }}>
              <div style={{ fontSize: 13, color: "#4a9eff", fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>🔗 Live Import</div>
              <div style={{ color: "#4a7aaa", fontSize: 13, lineHeight: 1.6 }}>
                Link to your Club Dashboard to fetch live lineup & events during a match.
              </div>
              <button style={{
                marginTop: 12, width: "100%", padding: "12px 0", background: "transparent",
                border: "1px solid #1a3a5a", borderRadius: 8, color: "#4a9eff",
                fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1,
                fontFamily: "'Rajdhani', sans-serif"
              }}>CONNECT CLUB DASHBOARD →</button>
            </div>
          </div>
        )}

        {/* PAGE 2 — STATS ENTRY */}
        {page === 2 && (
          <div>
            {/* Tab Navigation */}
            <div style={{ display: "flex", gap: 4, background: "#0d0d1f", borderRadius: 10, padding: 4, marginBottom: 16 }}>
              {["player", "team", "goal", "discipline"].map(tab => (
                <button key={tab} onClick={() => setStatsTab(tab)} style={tabStyle(statsTab === tab)}>
                  {tab === "player" ? "👤" : tab === "team" ? "🏟️" : tab === "goal" ? "⚽" : "🟨"} {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* PLAYER STATS TAB */}
            {statsTab === "player" && (
              <div>
                {CLUB_PLAYERS.map(player => {
                  const ps = playerStats.find(p => p.id === player.id);
                  return (
                    <div key={player.id} style={{ ...sectionStyle, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: "linear-gradient(135deg, #00d4aa, #00a882)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, color: "#000", fontSize: 14
                        }}>{player.number}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{player.name}</div>
                          <div style={{ fontSize: 11, color: "#00d4aa", fontWeight: 700, letterSpacing: 1 }}>{player.position}</div>
                        </div>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                          <button
                            onClick={() => updatePlayerStat(player.id, "pom", !ps.pom)}
                            style={{
                              padding: "4px 10px", background: ps.pom ? "#f5a623" : "#1a1a2e",
                              border: `1px solid ${ps.pom ? "#f5a623" : "#2a2a4a"}`,
                              borderRadius: 6, color: ps.pom ? "#000" : "#555",
                              fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: 1
                            }}>🏆 POM</button>
                          <button
                            onClick={() => updatePlayerStat(player.id, "cleanSheet", !ps.cleanSheet)}
                            style={{
                              padding: "4px 10px", background: ps.cleanSheet ? "#00d4aa" : "#1a1a2e",
                              border: `1px solid ${ps.cleanSheet ? "#00d4aa" : "#2a2a4a"}`,
                              borderRadius: 6, color: ps.cleanSheet ? "#000" : "#555",
                              fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: 1
                            }}>🧤 CS</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                        <StatInput label="Goals" value={ps.goals} onChange={v => updatePlayerStat(player.id, "goals", v)} />
                        <StatInput label="Assists" value={ps.assists} onChange={v => updatePlayerStat(player.id, "assists", v)} />
                        <StatInput label="Yellow" value={ps.yellowCards} onChange={v => updatePlayerStat(player.id, "yellowCards", v)} max={2} />
                        <StatInput label="Red" value={ps.redCards} onChange={v => updatePlayerStat(player.id, "redCards", v)} max={1} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                        <StatInput label="Mins Played" value={ps.mins} onChange={v => updatePlayerStat(player.id, "mins", v)} max={120} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Status</label>
                          <select
                            value={ps.sub === 1 ? "sub" : ps.subbed === 1 ? "subbed" : "starter"}
                            onChange={e => {
                              updatePlayerStat(player.id, "sub", e.target.value === "sub" ? 1 : 0);
                              updatePlayerStat(player.id, "subbed", e.target.value === "subbed" ? 1 : 0);
                              updatePlayerStat(player.id, "apps", e.target.value === "sub" ? 0 : 1);
                            }}
                            style={{ ...inputStyle, padding: "8px 10px" }}
                          >
                            <option value="starter">Starter</option>
                            <option value="sub">Substitute In</option>
                            <option value="subbed">Substituted Off</option>
                          </select>
                        </div>
                      </div>
                      <RatingInput value={ps.rating} onChange={v => updatePlayerStat(player.id, "rating", v)} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* TEAM STATS TAB */}
            {statsTab === "team" && (
              <div style={{ ...sectionStyle }}>
                <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>🏟️ Team Stats Overview</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <StatInput label="Goals For" value={teamStats.goalsFor} onChange={v => setTeamStats({ ...teamStats, goalsFor: v })} />
                  <StatInput label="Goals Against" value={teamStats.goalsAgainst} onChange={v => setTeamStats({ ...teamStats, goalsAgainst: v })} />
                </div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Result</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["Win", "Draw", "Loss"].map(r => (
                      <button key={r} onClick={() => setTeamStats({ ...teamStats, result: r })} style={{
                        flex: 1, padding: "12px 0",
                        background: teamStats.result === r ? (r === "Win" ? "#00d4aa" : r === "Loss" ? "#e74c3c" : "#f5a623") : "#1a1a2e",
                        border: "1px solid #2a2a4a", borderRadius: 8,
                        color: teamStats.result === r ? "#000" : "#555",
                        fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: 1,
                        fontFamily: "'Rajdhani', sans-serif"
                      }}>{r.toUpperCase()}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    {[["cleanSheet", "Clean Sheet 🧤"], ["failedToScore", "Failed to Score ❌"]].map(([key, label]) => (
                      <button key={key} onClick={() => setTeamStats({ ...teamStats, [key]: !teamStats[key] })} style={{
                        flex: 1, padding: "12px 0",
                        background: teamStats[key] ? "#00d4aa" : "#1a1a2e",
                        border: `1px solid ${teamStats[key] ? "#00d4aa" : "#2a2a4a"}`,
                        borderRadius: 8, color: teamStats[key] ? "#000" : "#555",
                        fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif"
                      }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Possession %</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min="0" max="100" value={teamStats.possession}
                        onChange={e => setTeamStats({ ...teamStats, possession: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: "#00d4aa" }} />
                      <span style={{ color: "#00d4aa", fontWeight: 800, fontSize: 18, minWidth: 44 }}>{teamStats.possession}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GOAL STATS TAB */}
            {statsTab === "goal" && (
              <div>
                <div style={{ ...sectionStyle }}>
                  <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>⚽ Add Goal Event</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Scorer</label>
                      <PlayerPicker value={newGoal.scorer} onChange={v => setNewGoal({ ...newGoal, scorer: v, ownGoal: false })} placeholder="Select scorer from squad..." />
                    </div>
                    <div>
                      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Assist</label>
                      <PlayerPicker value={newGoal.assister} onChange={v => setNewGoal({ ...newGoal, assister: v })} placeholder="Select assister (optional)..." />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Minute</label>
                        <input type="number" min="1" max="120" placeholder="45'" value={newGoal.minute}
                          onChange={e => setNewGoal({ ...newGoal, minute: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Type</label>
                        <select value={newGoal.type} onChange={e => setNewGoal({ ...newGoal, type: e.target.value })} style={{ ...inputStyle, padding: "10px 10px" }}>
                          {goalTypes.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => setNewGoal({ ...newGoal, ownGoal: !newGoal.ownGoal })}
                      style={{
                        padding: "10px 0", background: newGoal.ownGoal ? "#e74c3c" : "#1a1a2e",
                        border: `1px solid ${newGoal.ownGoal ? "#e74c3c" : "#2a2a4a"}`,
                        borderRadius: 8, color: newGoal.ownGoal ? "#fff" : "#555",
                        fontWeight: 800, fontSize: 12, cursor: "pointer", letterSpacing: 1,
                        fontFamily: "'Rajdhani', sans-serif"
                      }}>OWN GOAL {newGoal.ownGoal ? "✓" : ""}</button>
                    <button onClick={addGoal} style={{
                      padding: "14px 0", background: "linear-gradient(135deg, #00d4aa, #00a882)",
                      border: "none", borderRadius: 10, color: "#000",
                      fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 1,
                      fontFamily: "'Rajdhani', sans-serif"
                    }}>+ ADD GOAL</button>
                  </div>
                </div>
                {goals.length > 0 && (
                  <div style={{ ...sectionStyle }}>
                    <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Goal Log</div>
                    {goals.map(g => (
                      <div key={g.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                        borderBottom: "1px solid #1a1a3a"
                      }}>
                        <span style={{
                          background: g.ownGoal ? "#e74c3c" : "#00d4aa", color: "#000",
                          fontWeight: 800, borderRadius: 6, padding: "4px 8px", fontSize: 12, minWidth: 36, textAlign: "center"
                        }}>{g.minute}'</span>
                        <span style={{ fontWeight: 700, color: "#fff" }}>⚽ {getPlayer(g.scorer)?.name || "Unknown"}</span>
                        {g.assister && <span style={{ color: "#888", fontSize: 12 }}>↳ {getPlayer(g.assister)?.name}</span>}
                        <span style={{ marginLeft: "auto", color: "#555", fontSize: 11 }}>{g.type}</span>
                        <button onClick={() => setGoals(prev => prev.filter(x => x.id !== g.id))}
                          style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DISCIPLINE TAB */}
            {statsTab === "discipline" && (
              <div>
                <div style={{ ...sectionStyle }}>
                  <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>🟨 Add Card Event</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Player</label>
                      <PlayerPicker value={newCard.player} onChange={v => setNewCard({ ...newCard, player: v })} placeholder="Select player from squad..." />
                    </div>
                    <div>
                      <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Card Type</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {["Yellow", "Red", "2nd Yellow"].map(t => (
                          <button key={t} onClick={() => setNewCard({ ...newCard, type: t })} style={{
                            flex: 1, padding: "12px 0",
                            background: newCard.type === t ? (t === "Red" ? "#e74c3c" : t === "Yellow" ? "#f5a623" : "#e74c3c") : "#1a1a2e",
                            border: "1px solid #2a2a4a", borderRadius: 8,
                            color: newCard.type === t ? "#000" : "#555",
                            fontWeight: 800, fontSize: 11, cursor: "pointer", letterSpacing: 1,
                            fontFamily: "'Rajdhani', sans-serif"
                          }}>{t.toUpperCase()}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Minute</label>
                        <input type="number" min="1" max="120" placeholder="67'" value={newCard.minute}
                          onChange={e => setNewCard({ ...newCard, minute: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Reason</label>
                        <select value={newCard.reason} onChange={e => setNewCard({ ...newCard, reason: e.target.value })} style={{ ...inputStyle, padding: "10px 10px" }}>
                          {cardReasons.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={addCard} style={{
                      padding: "14px 0", background: "linear-gradient(135deg, #f5a623, #e09000)",
                      border: "none", borderRadius: 10, color: "#000",
                      fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 1,
                      fontFamily: "'Rajdhani', sans-serif"
                    }}>+ ADD CARD</button>
                  </div>
                </div>
                {discipline.length > 0 && (
                  <div style={{ ...sectionStyle }}>
                    <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Card Log</div>
                    {discipline.map(d => (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a3a" }}>
                        <span style={{
                          background: d.type === "Yellow" ? "#f5a623" : "#e74c3c",
                          width: 18, height: 24, borderRadius: 3, display: "inline-block"
                        }} />
                        <span style={{ fontWeight: 700, color: "#fff" }}>{getPlayer(d.player)?.name}</span>
                        <span style={{ color: "#888", fontSize: 12 }}>{d.minute}' · {d.reason}</span>
                        <button onClick={() => setDiscipline(prev => prev.filter(x => x.id !== d.id))}
                          style={{ marginLeft: "auto", background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PAGE 3 — SAVE MATCH */}
        {page === 3 && (
          <div>
            {/* Summary */}
            <div style={{ ...sectionStyle, background: "linear-gradient(135deg, #0d1a0d, #0a1a0a)", border: "1px solid #1a3a1a", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>📋 Match Summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>YOUR TEAM</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: "#00d4aa" }}>{teamStats.goalsFor}</div>
                </div>
                <div style={{ color: "#333", fontWeight: 800, fontSize: 24 }}>:</div>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{match.opponent || "OPPONENT"}</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>{teamStats.goalsAgainst}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                {[["Date", match.date || "—"], ["Venue", match.venue], ["Competition", match.competition || "—"], ["Season", match.season]].map(([k, v]) => (
                  <div key={k} style={{ background: "#0a1a0a", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ color: "#555", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{k.toUpperCase()}</div>
                    <div style={{ color: "#ccc", fontWeight: 600, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {motm && (
              <div style={{ ...sectionStyle, background: "linear-gradient(135deg, #1a1500, #201a00)", border: "1px solid #3a3000", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#f5a623", fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>🏆 Man of the Match</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "linear-gradient(135deg, #f5a623, #e09000)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, color: "#000", fontSize: 16
                  }}>{getPlayer(motm)?.number}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: "#f5a623" }}>{getPlayer(motm)?.name}</div>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>{getPlayer(motm)?.position}</div>
                  </div>
                </div>
              </div>
            )}

            {goals.length > 0 && (
              <div style={{ ...sectionStyle, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>⚽ Goals ({goals.length})</div>
                {goals.map(g => (
                  <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a3a" }}>
                    <span style={{ color: "#00d4aa", fontWeight: 800, minWidth: 36 }}>{g.minute}'</span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{getPlayer(g.scorer)?.name || "?"}</span>
                    {g.assister && <span style={{ color: "#888", fontSize: 12 }}>↳ {getPlayer(g.assister)?.name}</span>}
                    <span style={{ marginLeft: "auto", color: "#555", fontSize: 11 }}>{g.type}</span>
                  </div>
                ))}
              </div>
            )}

            {discipline.length > 0 && (
              <div style={{ ...sectionStyle, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#f5a623", fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>🟨 Cards ({discipline.length})</div>
                {discipline.map(d => (
                  <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a3a" }}>
                    <span style={{
                      background: d.type === "Yellow" ? "#f5a623" : "#e74c3c",
                      width: 14, height: 18, borderRadius: 2, flexShrink: 0
                    }} />
                    <span style={{ color: "#fff", fontWeight: 600 }}>{getPlayer(d.player)?.name}</span>
                    <span style={{ color: "#888", fontSize: 12 }}>{d.minute}' · {d.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={{
                padding: "16px 0", background: "linear-gradient(135deg, #00d4aa, #00a882)",
                border: "none", borderRadius: 12, color: "#000",
                fontWeight: 800, fontSize: 16, cursor: "pointer", letterSpacing: 2,
                fontFamily: "'Rajdhani', sans-serif"
              }}>✓ SAVE & PUBLISH MATCH</button>
              <button style={{
                padding: "14px 0", background: "#1a1a2e",
                border: "1px solid #2a2a4a", borderRadius: 12, color: "#888",
                fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 2,
                fontFamily: "'Rajdhani', sans-serif"
              }}>💾 SAVE AS DRAFT</button>
              <button onClick={exportData} style={{
                padding: "14px 0", background: "transparent",
                border: "1px solid #00d4aa", borderRadius: 12, color: "#00d4aa",
                fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 2,
                fontFamily: "'Rajdhani', sans-serif"
              }}>⬇ EXPORT AS JSON</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: "#080818",
        borderTop: "1px solid #1a1a3a", padding: "12px 16px",
        display: "flex", gap: 10
      }}>
        {page > 1 && (
          <button onClick={() => setPage(page - 1)} style={{
            flex: 1, padding: "14px 0", background: "#1a1a2e",
            border: "1px solid #2a2a4a", borderRadius: 10, color: "#888",
            fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 1,
            fontFamily: "'Rajdhani', sans-serif"
          }}>← BACK</button>
        )}
        {page < 3 && (
          <button onClick={() => setPage(page + 1)} style={{
            flex: 2, padding: "14px 0", background: "linear-gradient(135deg, #00d4aa, #00a882)",
            border: "none", borderRadius: 10, color: "#000",
            fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 1,
            fontFamily: "'Rajdhani', sans-serif"
          }}>NEXT →</button>
        )}
      </div>
    </div>
  );
}
