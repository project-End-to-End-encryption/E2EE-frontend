import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import {
    Hero,
    VisionBand,
    FeatureBlock,
    FeatureCards,
    SecuritySection,
    AboutSection
} from "./home/HomeSections";
import { DISPLAY_FONT } from "../shared/constants/theme";

export default function E2EEHomepage() {
    const navigate = useNavigate();

    const handleSignup = () => navigate("/signup/username");
    const handleLogin = () => navigate("/login");

    return (
        <div style={{ fontFamily: DISPLAY_FONT }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');
                html {
                    scroll-behavior: smooth;
                }
                @keyframes E2EE-twinkle {
                    0%, 100% { opacity: 0.15; transform: scale(0.75) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1.15) rotate(8deg); }
                }
                .E2EE-twinkle {
                    animation-name: E2EE-twinkle;
                    animation-iteration-count: infinite;
                    animation-timing-function: ease-in-out;
                }
                @media (prefers-reduced-motion: reduce) {
                    .E2EE-twinkle { animation: none !important; }
                }
            `}</style>

            <Navbar onSignup={handleSignup} onLogin={handleLogin} />
            <Hero onSignup={handleSignup} />
            <VisionBand />
            <FeatureBlock />
            <FeatureCards />
            <SecuritySection />
            <AboutSection />
            <Footer />
        </div>
    );
}