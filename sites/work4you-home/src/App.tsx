import { Bots } from './components/Bots'
import { Channels } from './components/Channels'
import { CloseCta } from './components/CloseCta'
import { Features } from './components/Features'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Schedule } from './components/Schedule'
import { Tools } from './components/Tools'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Bots />
        <Channels />
        <Tools />
        <Schedule />
        <Features />
        <CloseCta />
      </main>
      <Footer />
    </>
  )
}
