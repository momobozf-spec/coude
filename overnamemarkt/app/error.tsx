"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="empty" style={{ marginTop: 32 }}>
      <strong>Er ging iets mis</strong>
      <p>Probeer het opnieuw. Blijft het fout lopen, kom dan later terug.</p>
      <div><button className="btn" type="button" onClick={() => reset()}>Opnieuw proberen</button></div>
    </section>
  );
}
