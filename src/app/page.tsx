import HomeClient from "@/components/home/HomeClient";

export default function HomePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const age =
    typeof searchParams?.age === "string"
      ? (searchParams.age as string)
      : undefined;

  return <HomeClient age={age} />;
}
