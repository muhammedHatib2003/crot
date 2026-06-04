import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Packages from "./components/Packages";
import DemoLinks from "./components/DemoLinks";
import About from "./components/About";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Packages />
        <DemoLinks />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
