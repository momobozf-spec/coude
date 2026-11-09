import { redirect } from "next/navigation";

/**
 * Scannen is waarvoor iemand de app opent, dus de startpagina is de scanner.
 * Een aparte landingspagina met een knop "naar de scanner" zou een extra tik
 * toevoegen aan de enige flow die telt.
 */
export default function HomePage() {
  redirect("/scan");
}
