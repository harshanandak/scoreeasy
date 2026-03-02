import { useState, useEffect } from "react";
import { SignIn } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { monoClerkAppearance } from "./clerkTheme";
import BackArrow from "./components/BackArrow";
import SportIcon from "./SportIcon";

export default function MonoLogin() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-6 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
      style={{ background: "#fafafa" }}
    >
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-10">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <SportIcon name="Volleyball" size={24} color="#111" />
            <h1
              className="font-mono"
              style={{ fontSize: '0.875rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111', lineHeight: 1.1 }}
            >
              SCORE<br />EASY
            </h1>
          </div>
          <p className="text-sm font-swiss" style={{ color: "#888" }}>
            Sign in to continue
          </p>
        </div>

        {/* Layered card wrapper */}
        <div style={{
          border: '1.5px solid #1a1a1a',
          boxShadow: '6px 6px 0 -1.5px #fafafa, 6px 6px 0 0 #0066ff',
        }}>
          <SignIn
            appearance={monoClerkAppearance}
            routing="path"
            path="/login"
            signUpUrl="/signup"
            forceRedirectUrl="/"
          />
        </div>

        {/* Back link */}
        <div className="text-center mt-10">
          <button
            onClick={() => navigate("/")}
            className="text-xs bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1 mx-auto"
            style={{ color: "#888" }}
          >
            <BackArrow /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
