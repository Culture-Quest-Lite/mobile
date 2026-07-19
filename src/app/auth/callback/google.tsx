import { Redirect } from "expo-router";

// Nuốt deep link culturequestlitemobile://auth/callback/google khi expo-router
// xử lý redirect từ Keycloak, tránh flash màn not-found.
export default function GoogleAuthCallback() {
  return <Redirect href="/home" />;
}
