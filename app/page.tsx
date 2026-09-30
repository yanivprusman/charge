import ChargeScreen from "./_components/ChargeScreen";

/**
 * The web version of גבייה.
 *
 * A browser only arrives here signed in — `proxy.ts` shows everyone else the
 * sign-in form at this same address.
 */
export default function Home() {
  return <ChargeScreen />;
}
