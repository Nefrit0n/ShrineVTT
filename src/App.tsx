import {
  IconRulerMeasure,
  IconBrush,
  IconUsersGroup,
  IconLayersIntersect,
  IconSettings,
  IconSparkles,
  IconFlame,
  IconDice6,
  IconWriting,
  IconDownload,
  IconPrompt
} from '@tabler/icons-react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import clsx from 'clsx';

const sceneTools = [
  { label: 'Select', icon: IconPrompt, active: true },
  { label: 'Measure', icon: IconRulerMeasure },
  { label: 'Draw', icon: IconBrush },
  { label: 'Actors', icon: IconUsersGroup },
  { label: 'Tiles', icon: IconLayersIntersect },
  { label: 'Effects', icon: IconSparkles },
  { label: 'Lights', icon: IconFlame },
  { label: 'Config', icon: IconSettings }
];

const players = [
  { name: 'Aster', character: 'Seren of the Veil', role: 'GM', color: '#60a5fa' },
  { name: 'Mira', character: 'Ilyra Dawnpetal', role: 'Artificer', color: '#a855f7' },
  { name: 'Corin', character: 'Thalos Emberborn', role: 'Paladin', color: '#f97316' },
  { name: 'Jun', character: 'Ashen Whisper', role: 'Rogue', color: '#38bdf8' }
];

const macros = [
  'Arcane Blast',
  'Healing Word',
  'Flame Strike',
  'Shadowstep',
  'Divine Shield',
  'Summon Sprite',
  'Chrono Shift',
  'Lunar Arrow',
  'Crystal Barrier',
  'Guidance'
];

const sidebarEntries = [
  {
    title: 'Getting Started',
    items: [
      'Open the Scene Tools to reveal interaction layers.',
      'Invite players from the lobby section and assign characters.',
      'Upload battlemaps, then drag them into the canvas to stage the scene.'
    ]
  },
  {
    title: 'Session Beats',
    items: [
      'The party awakens within the Shrine of Echoes.',
      'Solve the mirrored sigil puzzle to reveal the inner sanctum.',
      'Defeat the guardian warden to recover the Astral Keystone.'
    ]
  }
];

const quickNotes = [
  {
    heading: 'Macro Tips',
    body: 'Drag abilities or dice expressions onto the macro bar to bind them for the whole party.'
  },
  {
    heading: 'Scene Status',
    body: 'Pause the game from the canvas overlay to freeze tokens and hide GM-only updates.'
  }
];

function App() {
  return (
    <div className="app-shell">
      <nav className={clsx('panel', 'scene-tools')} aria-label="Scene tools">
        {sceneTools.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={clsx('scene-tool-button', { active })}
            type="button"
            aria-pressed={active}
            title={label}
          >
            <Icon size={26} stroke={1.7} />
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </nav>

      <section className={clsx('panel', 'canvas')} aria-label="Scene canvas">
        <div className="canvas-content">
          <div className="canvas-status">
            <IconDice6 size={20} />
            Game Paused
          </div>
          <h1 className="canvas-title">Shrine VTT</h1>
          <p>
            Craft scenes, manage encounters and keep your friends immersed in your adventures with
            this bespoke tabletop experience.
          </p>
        </div>
      </section>

      <aside className={clsx('panel', 'sidebar')} aria-label="Game sidebar">
        <div className="sidebar-section">
          <header>
            <h2>Reference</h2>
          </header>
          <ScrollArea.Root className={clsx('scroll-area')} type="auto">
            <ScrollArea.Viewport style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: 8 }}>
                {sidebarEntries.map(({ title, items }) => (
                  <section key={title} className="sidebar-card">
                    <h3>{title}</h3>
                    <ul>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
                {quickNotes.map(({ heading, body }) => (
                  <section key={heading} className="sidebar-card">
                    <h3>{heading}</h3>
                    <p>{body}</p>
                  </section>
                ))}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
              <ScrollArea.Thumb className="scrollbar-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
        <div className="sidebar-section">
          <header>
            <h2>Session Log</h2>
          </header>
          <div className="sidebar-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tag">
              <IconWriting size={16} />
              Last updated 5m ago
            </div>
            <p>
              The mirrored hallway hums with latent energy as the party approaches the shrine altar.
              Arcane light gathers around the keystone, awaiting the final incantation.
            </p>
            <button
              type="button"
              className="scene-tool-button"
              style={{
                alignSelf: 'flex-start',
                paddingInline: 16,
                width: 'auto',
                height: 42,
                display: 'inline-flex',
                gap: 8,
                fontSize: '0.85rem',
                letterSpacing: '0.04em'
              }}
            >
              <IconDownload size={18} /> Export Notes
            </button>
          </div>
        </div>
      </aside>

      <footer className={clsx('panel', 'macro-bar')} aria-label="Macro bar">
        {macros.map((macro) => (
          <button key={macro} type="button" className="macro-slot">
            {macro}
          </button>
        ))}
      </footer>

      <section className={clsx('players-list')} aria-label="Players online">
        <header className="players-header">
          <span>Players</span>
          <span>{players.length} Online</span>
        </header>
        {players.map(({ name, character, role, color }) => (
          <article key={name} className="player-card" style={{ borderColor: `${color}33` }}>
            <div
              className="player-avatar"
              style={{
                background: `linear-gradient(135deg, ${color}, rgba(255,255,255,0.7))`
              }}
            >
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
    </div>
  );
}

export default App;
