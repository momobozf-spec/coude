import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty" style={{ marginTop: 32 }}>
      <strong>Deze pagina bestaat niet (meer)</strong>
      <p>De aanbieding is misschien verkocht of ingetrokken. <Link href="/">Bekijk het actuele aanbod</Link>.</p>
    </section>
  );
}
