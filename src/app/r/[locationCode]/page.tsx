import CustomerMenuPage from '@/app/sites/[domain]/r/[locationCode]/page';

export default async function DirectLocationMenuPage({ 
  params 
}: { 
  params: Promise<{ locationCode: string }> 
}) {
  const resolved = await params;
  return <CustomerMenuPage params={Promise.resolve({ domain: 'direct', locationCode: resolved.locationCode })} />;
}
