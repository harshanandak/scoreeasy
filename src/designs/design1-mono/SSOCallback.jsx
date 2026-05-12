import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function SSOCallback() {
  const navigate = useNavigate();
  const { cloudAuthAvailable } = useAuth();

  useEffect(() => {
    if (!cloudAuthAvailable) {
      navigate("/", { replace: true });
    }
  }, [cloudAuthAvailable, navigate]);

  if (!cloudAuthAvailable) {
    return null;
  }

  return <AuthenticateWithRedirectCallback />;
}
