import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>404</h1>
      <p className="lead">Deze pagina bestaat niet. · Cette page n'existe pas.</p>
      <Link className="btn btn-primary" style={{ justifySelf: "start" }} href="/">Huurklaar</Link>
    </div>
  );
}
