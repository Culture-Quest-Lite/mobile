import { Redirect } from "expo-router";

// Nuốt deep link culturequestlitemobile://auth/callback/facebook khi expo-router
// xử lý redirect từ Keycloak, tránh flash màn not-found.
export default function FacebookAuthCallback() {
  return <Redirect href="/home" />;
}
