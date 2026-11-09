type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export function LegalDoc({ doc }: { doc: Doc }) {
  return (
    <article className="prose">
      <h1>{doc.title}</h1>
      <p className="small">{doc.updated}</p>
      {doc.sections.map((s) => (
        <section key={s.h} style={{ display: "grid", gap: 8 }}>
          <h2>{s.h}</h2>
          {s.p.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
    </article>
  );
}
