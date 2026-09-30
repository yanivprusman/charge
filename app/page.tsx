import ChargeScreen from "./_components/ChargeScreen";

/**
 * The web version of גבייה.
 *
 * A browser only arrives here signed in — `proxy.ts` shows everyone else the
 * sign-in form at this same address. This component deliberately awaits
 * nothing: see `proxy.ts` for why that is load-bearing.
 */
export default function Home() {
  return <ChargeScreen />;
}
