import ServiceCard from "@/components/services/ServiceCard";
import type { ServiceWithRelations } from "@/types";

export default function ServiceGrid({ services }: { services: ServiceWithRelations[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  );
}
