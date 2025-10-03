import HomeClient from "@/components/home/HomeClient";

export default async function HomePage({ 
  searchParams 
}: { 
  searchParams?: Promise<Record<string, string | string[] | undefined>> 
}) {
  const params = await searchParams;
  const ageParam = params?.age;
  const showAgePrompt = ageParam === "required";

  return <HomeClient showAgePrompt={showAgePrompt} />;
}
