import Image from 'next/image'
import AudioPlayer from '@/components/AudioPlayer'
import LiveChat from '@/components/LiveChat'

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="container">
      <header>
        <h1 className="glow-text">L.A <span>Live Radio</span></h1>
        <p style={{color: 'var(--text-secondary)', marginTop: '10px'}}>Discord Stage Broadcasting Dashboard</p>
      </header>

      <div className="player-wrapper">
        <div className="on-air-badge">ON AIR</div>
        <div className="player-container">
          <Image
            src="/radio_banner.png"
            alt="Radio Banner"
            fill
            className="player-banner"
            priority
          />
          <AudioPlayer />
        </div>
      </div>

      <div className="glass-panel">
        <LiveChat />
      </div>
    </div>
  )
}
