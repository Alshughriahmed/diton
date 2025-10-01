import HomeClient from "@/components/home/HomeClient";

export default function HomePage({ 
  searchParams 
}: { 
  searchParams?: Record<string, string | string[] | undefined> 
}) {
  const ageParam = searchParams?.age;
  const showAgePrompt = ageParam === "required";

  return <HomeClient showAgePrompt={showAgePrompt} />;
}
