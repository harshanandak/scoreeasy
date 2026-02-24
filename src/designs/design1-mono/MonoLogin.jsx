import { SignIn } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { monoClerkAppearance } from "./clerkTheme";

export default function MonoLogin() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "#fafafa" }}>
      <div className="max-w-sm mx-auto">
        <button
          onClick={() => navigate("/")}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 block"
          style={{ color: "#888" }}
        >
          &larr; Back
        </button>

        <SignIn
          appearance={monoClerkAppearance}
          routing="path"
          path="/login"
          signUpUrl="/signup"
          forceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
