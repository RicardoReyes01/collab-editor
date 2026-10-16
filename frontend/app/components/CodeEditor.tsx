"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useRef, useEffect } from "react";
import * as Y from "yjs";
import { WsProvider } from "../lib/provider";

export default function CodeEditor({ roomId = "test" }: { roomId?: string }) {
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const handleMount: OnMount = async (editor) => {
    // y-monaco touches `window`, so import it only in the browser
    const { MonacoBinding } = await import("y-monaco");

    const doc = new Y.Doc();
    const provider = new WsProvider(`ws://localhost:8080/ws/${roomId}`, doc);
    const text = doc.getText("monaco");

    const binding = new MonacoBinding(
      text,
      editor.getModel()!,
      new Set([editor]),
      provider.awareness
    );

    cleanup.current = () => {
      binding.destroy();
      provider.destroy();
      doc.destroy();
    };
  };

  return (
    <Editor
      height="80vh"
      defaultLanguage="javascript"
      defaultValue=""
      theme="vs-dark"
      onMount={handleMount}
    />
  );
}