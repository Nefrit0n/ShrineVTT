import type { PlayerPresence } from "./PlayersOnline.types";

type PlayersOnlineProps = {
  players: PlayerPresence[];
};

export default function PlayersOnline({ players }: PlayersOnlineProps) {
  return (
    <section className="players-list" aria-label="Players online">
      <header className="players-header">
        <span>Players</span>
        <span>{players.length} Online</span>
      </header>
      {players.map(({ id, name, character, role, color }) => (
        <article key={id} className="player-card" style={{ borderColor: `${color}33` }}>
          <div className="player-avatar" style={{ background: `linear-gradient(135deg, ${color}, rgba(255,255,255,0.7))` }}>
            {name[0]}
          </div>
          <div className="player-info">
            <strong>{character}</strong>
            <span className="player-role">
              {role} · {name}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}
