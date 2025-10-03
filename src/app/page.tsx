import HomeClient from "@/components/home/HomeClient";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const age =
    typeof params?.age === "string"
      ? (params.age as string)
      : undefined;

  return <HomeClient age={age} />;
}
