import CodeEditor from "./components/CodeEditor";

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Collab Editor</h1>
      <CodeEditor />
    </main>
  );
}