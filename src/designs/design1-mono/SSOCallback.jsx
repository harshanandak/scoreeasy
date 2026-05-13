import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function SSOCallback() {
  return (
    <CloudAuthOnly>
      <AuthenticateWithRedirectCallback />
    </CloudAuthOnly>
  );
}
