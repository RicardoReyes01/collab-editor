import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";

const TYPE_DOC = 0;
const TYPE_AWARENESS = 1;

function frame(type: number, payload: Uint8Array) {
  const out = new Uint8Array(payload.length + 1);
  out[0] = type;
  out.set(payload, 1);
  return out;
}

export class WsProvider {
  ws: WebSocket;
  awareness: Awareness;

  constructor(url: string, public doc: Y.Doc) {
    this.awareness = new Awareness(doc);
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onmessage = (e) => {
      const data = new Uint8Array(e.data as ArrayBuffer);
      const payload = data.subarray(1);
      if (data[0] === TYPE_DOC) {
        Y.applyUpdate(doc, payload, this); // origin = this, so we don't echo it back
      } else if (data[0] === TYPE_AWARENESS) {
        applyAwarenessUpdate(this.awareness, payload, this);
      }
    };

    this.ws.onopen = () => {
      // Share our current cursor/presence with others
      this.sendAwareness([doc.clientID]);
    };

    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame(TYPE_DOC, update));
    }
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this) return;
    this.sendAwareness([...added, ...updated, ...removed]);
  };

  private sendAwareness(clients: number[]) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(frame(TYPE_AWARENESS, encodeAwarenessUpdate(this.awareness, clients)));
  }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    this.ws.close();
  }
}