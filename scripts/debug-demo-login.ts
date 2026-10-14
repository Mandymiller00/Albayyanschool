import "dotenv/config";
import { authOptions } from "../lib/auth";

(async () => {
  const provider = authOptions.providers[0];
  if (provider.type !== "credentials") throw new Error("The configured authentication provider is not credentials-based");

  const result = await provider.authorize(
    { email: "demo@albayyan.edu", password: "Albayyan-Demo-2026!" },
    { body: {}, query: {}, headers: new Headers(), method: "POST" },
  );

  console.log(JSON.stringify({ result }, null, 2));
})();
