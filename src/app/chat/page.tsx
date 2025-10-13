import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <ChatClient />;
}
