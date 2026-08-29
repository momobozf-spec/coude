import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PropertyForm } from '@/components/properties/property-form';
import { updatePropertyAction } from '@/app/[locale]/(app)/properties/actions';

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!property) notFound();

  const action = updatePropertyAction.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {locale === 'nl' ? 'Woning bewerken' : 'Modifier le logement'}
      </h1>

      <PropertyForm
        locale={locale}
        messages={t}
        action={action}
        property={property}
      />
    </div>
  );
}
