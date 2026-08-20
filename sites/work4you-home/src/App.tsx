import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Pillars } from './components/Pillars'
import { Surfaces } from './components/Surfaces'
import { Install } from './components/Install'
import { FinalCta } from './components/FinalCta'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Pillars />
        <Surfaces />
        <Install />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
