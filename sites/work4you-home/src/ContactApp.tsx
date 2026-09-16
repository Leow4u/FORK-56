import { ContactSoon } from './components/ContactSoon'
import { Footer } from './components/Footer'
import { Nav } from './components/Nav'

export function ContactApp() {
  return (
    <>
      <Nav />
      <main>
        <ContactSoon />
      </main>
      <Footer />
    </>
  )
}
