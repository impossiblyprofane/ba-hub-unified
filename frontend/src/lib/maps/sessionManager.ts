// ══════════════════════════════════════════════════════════════
// SessionManager — Yjs-based collaborative session for the maps page
//
// Manages a local Y.Doc with shapes stored as Y.Map<Y.Map>.
// Runs in both local (solo) and collaborative (WebSocket relay) modes.
// Undo/redo is always handled by Y.UndoManager.
//
// This class is NOT serializable — must be wrapped in noSerialize()
// when stored in a Qwik signal.
// ══════════════════════════════════════════════════════════════

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Shape, SessionUser, PingData, SessionMode } from './types';
import { SESSION_USER_COLORS, generateSessionId, isValidSessionId } from './constants';

// ── Y-protocols are loaded dynamically to avoid SSR issues ──

type SyncModule = typeof import('y-protocols/sync');
type AwarenessModule = typeof import('y-protocols/awareness');
type EncodingModule = typeof import('lib0/encoding');
type DecodingModule = typeof import('lib0/decoding');

let syncProtocol: SyncModule | null = null;
let awarenessProtocol: AwarenessModule | null = null;
let encodingLib: EncodingModule | null = null;
let decodingLib: DecodingModule | null = null;

async function ensureProtocols(): Promise<void> {
  if (!syncProtocol) {
    [syncProtocol, awarenessProtocol, encodingLib, decodingLib] = await Promise.all([
      import('y-protocols/sync') as Promise<SyncModule>,
      import('y-protocols/awareness') as Promise<AwarenessModule>,
      import('lib0/encoding') as Promise<EncodingModule>,
      import('lib0/decoding') as Promise<DecodingModule>,
    ]);
  }
}

// ── Message type constants (must match backend relay) ──

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ── Callbacks interface ──

export interface SessionManagerCallbacks {
  onShapesChanged: (shapes: Shape[]) => void;
  onSessionUsersChanged: (users: SessionUser[]) => void;
  onPingReceived: (ping: PingData) => void;
  onConnectionStatusChanged: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onUndoStackChanged: (canUndo: boolean, canRedo: boolean) => void;
  onSessionStateChanged: (mode: SessionMode, sessionId: string | null, isHost: boolean) => void;
  /** Fired when the synced map metadata changes (e.g. a joining client receives the host's map) */
  onMapChanged: (mapKey: string | null) => void;
}

// ── Shape ↔ Y.Map serialization ──

/** Flatten a Shape into a Y.Map-compatible Record */
function shapeToRecord(shape: Shape): Record<string, string | number | boolean | null> {
  const rec: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(shape)) {
    if (Array.isArray(v)) {
      // Serialize arrays (e.g. points, unitOptions) as JSON strings
      rec[k] = JSON.stringify(v);
    } else if (v !== undefined) {
      rec[k] = v as string | number | boolean | null;
    }
  }
  return rec;
}

/** Reconstruct a Shape from a Y.Map */
function ymapToShape(ymap: Y.Map<unknown>): Shape {
  const obj: Record<string, unknown> = {};
  ymap.forEach((value, key) => {
    if (typeof value === 'string') {
      // Try to parse JSON arrays
      if (value.startsWith('[')) {
        try {
          obj[key] = JSON.parse(value);
          return;
        } catch {
          // Not JSON — keep as string
        }
      }
    }
    obj[key] = value;
  });
  return obj as unknown as Shape;
}

// ══════════════════════════════════════════════════════════════

export class SessionManager {
  private ydoc: Y.Doc;
  private shapesMap: Y.Map<Y.Map<unknown>>;
  private metadataMap: Y.Map<unknown>;
  private undoManager: Y.UndoManager;
  private callbacks: SessionManagerCallbacks;

  // Collaborative state
  private ws: WebSocket | null = null;
  private awareness: InstanceType<AwarenessModule['Awareness']> | null = null;
  private idbPersistence: IndexeddbPersistence | null = null;
  private _isHost = false;
  private _sessionId: string | null = null;
  private _connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private _localUserName = 'Anonymous';
  private _localColor: string = SESSION_USER_COLORS[0];
  private _destroyed = false;

  // Reconnection
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private wsUrl = '';

  // Ping cleanup timers
  private pingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Awareness keepalive interval
  private awarenessInterval: ReturnType<typeof setInterval> | null = null;

  constructor(callbacks: SessionManagerCallbacks) {
    this.callbacks = callbacks;
    this.ydoc = new Y.Doc();
    this.shapesMap = this.ydoc.getMap('shapes');
    this.metadataMap = this.ydoc.getMap('metadata');

    // Y.UndoManager tracks local operations only
    this.undoManager = new Y.UndoManager([this.shapesMap, this.metadataMap], {
      captureTimeout: 500,
      trackedOrigins: new Set([this.ydoc.clientID, null]),
    });

    // Observe shape changes
    this.shapesMap.observeDeep(() => {
      this.callbacks.onShapesChanged(this.getShapes());
    });

    // Observe metadata changes (e.g. map selection synced from another client)
    this.metadataMap.observe(() => {
      const mapKey = this.metadataMap.get('mapKey') as string | undefined;
      this.callbacks.onMapChanged(mapKey ?? null);
    });

    // Observe undo stack changes
    this.undoManager.on('stack-item-added', () => {
      this.emitUndoState();
    });
    this.undoManager.on('stack-item-popped', () => {
      this.emitUndoState();
    });
  }

  // ── Shape CRUD ──

  addShape(shape: Shape): void {
    this.ydoc.transact(() => {
      const ymap = new Y.Map<unknown>();
      const rec = shapeToRecord(shape);
      for (const [k, v] of Object.entries(rec)) {
        ymap.set(k, v);
      }
      this.shapesMap.set(shape.id, ymap);
    });
  }

  updateShape(shape: Shape): void {
    this.ydoc.transact(() => {
      const ymap = this.shapesMap.get(shape.id);
      if (!ymap) return;
      const rec = shapeToRecord(shape);
      for (const [k, v] of Object.entries(rec)) {
        if (ymap.get(k) !== v) {
          ymap.set(k, v);
        }
      }
    });
  }

  deleteShape(id: string): void {
    this.ydoc.transact(() => {
      this.shapesMap.delete(id);
    });
  }

  deleteShapes(ids: string[]): void {
    this.ydoc.transact(() => {
      for (const id of ids) {
        this.shapesMap.delete(id);
      }
    });
  }

  getShapes(): Shape[] {
    const shapes: Shape[] = [];
    this.shapesMap.forEach((ymap) => {
      shapes.push(ymapToShape(ymap));
    });
    // Sort by createdAt to preserve insertion order
    shapes.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return shapes;
  }

  clear(): void {
    this.ydoc.transact(() => {
      const keys = Array.from(this.shapesMap.keys());
      for (const key of keys) {
        this.shapesMap.delete(key);
      }
    });
  }

  // ── Undo / Redo ──

  undo(): void {
    this.undoManager.undo();
  }

  redo(): void {
    this.undoManager.redo();
  }

  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  private emitUndoState(): void {
    this.callbacks.onUndoStackChanged(this.canUndo(), this.canRedo());
  }

  // ── Metadata ──

  setMapMetadata(mapKey: string): void {
    this.ydoc.transact(() => {
      this.metadataMap.set('mapKey', mapKey);
      this.metadataMap.set('lastModified', Date.now());
    });
  }

  // ── Session lifecycle ──

  async startSession(): Promise<string> {
    const sessionId = generateSessionId();
    this._isHost = true;
    this._sessionId = sessionId;

    this.metadataMap.set('mode', 'collaborative' satisfies SessionMode);
    this.metadataMap.set('sessionId', sessionId);

    this.callbacks.onSessionStateChanged('collaborative', sessionId, true);
    await this.connectToRelay(sessionId);
    return sessionId;
  }

  async joinSession(sessionId: string): Promise<boolean> {
    if (!isValidSessionId(sessionId)) return false;

    this._isHost = false;
    this._sessionId = sessionId;

    this.metadataMap.set('mode', 'collaborative' satisfies SessionMode);
    this.metadataMap.set('sessionId', sessionId);

    this.callbacks.onSessionStateChanged('collaborative', sessionId, false);
    await this.connectToRelay(sessionId);
    return true;
  }

  leaveSession(): void {
    this.disconnectRelay();
    this._sessionId = null;
    this._isHost = false;

    this.metadataMap.set('mode', 'local' satisfies SessionMode);
    this.metadataMap.set('sessionId', null);

    this.setConnectionStatus('disconnected');
    this.callbacks.onSessionStateChanged('local', null, false);
    this.callbacks.onSessionUsersChanged([]);
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get isHost(): boolean {
    return this._isHost;
  }

  get connectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this._connectionStatus;
  }

  get mode(): SessionMode {
    return this._sessionId ? 'collaborative' : 'local';
  }

  // ── User identity ──

  setLocalUserName(name: string): void {
    this._localUserName = name || 'Anonymous';
    this.updateAwarenessLocal();
  }

  get localUserName(): string {
    return this._localUserName;
  }

  // ── Ping ──

  sendPing(x: number, y: number): void {
    if (!this.awareness) return;

    this.awareness.setLocalStateField('ping', {
      x,
      y,
      color: this._localColor,
      senderId: String(this.ydoc.clientID),
      senderName: this._localUserName,
    });

    // Clear ping after 1 second
    setTimeout(() => {
      if (this.awareness && !this._destroyed) {
        const state = this.awareness.getLocalState();
        if (state?.ping) {
          // Remove just the ping field
          this.awareness.setLocalStateField('ping', null);
        }
      }
    }, 1000);
  }

  // ── WebSocket relay connection ──

  private async connectToRelay(sessionId: string): Promise<void> {
    await ensureProtocols();

    this.setConnectionStatus('connecting');
    this.reconnectAttempts = 0;

    // Determine WebSocket URL from the API URL
    const apiUrl = (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__VITE_API_URL as string)
      || import.meta.env?.VITE_API_URL
      || 'http://localhost:3001';
    // Convert http(s) → ws(s)
    const base = apiUrl.replace(/\/graphql$/, '').replace(/^http/, 'ws');
    this.wsUrl = `${base}/ws/isr/${sessionId}`;

    // Create IndexedDB persistence for offline continuity
    this.idbPersistence = new IndexeddbPersistence(`isr_${sessionId}`, this.ydoc);

    // Create awareness
    if (awarenessProtocol) {
      this.awareness = new awarenessProtocol.Awareness(this.ydoc);
      this.assignColor();
      this.updateAwarenessLocal();

      // Listen for awareness changes
      this.awareness.on('change', () => {
        this.emitUsers();
        this.checkRemotePings();
      });

      // Keepalive: re-send local awareness state every 15s to prevent
      // the default 30s inactivity timeout from removing peers.
      this.awarenessInterval = setInterval(() => {
        this.sendAwarenessUpdate();
      }, 15_000);
    }

    this.openWebSocket();
  }

  private openWebSocket(): void {
    if (this._destroyed) return;

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionStatus('connected');

        if (!syncProtocol || !encodingLib) return;

        // Send sync step 1
        const encoder = encodingLib.createEncoder();
        encodingLib.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeSyncStep1(encoder, this.ydoc);
        this.wsSend(encodingLib.toUint8Array(encoder));

        // Send awareness
        this.sendAwarenessUpdate();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (!syncProtocol || !encodingLib || !decodingLib || !awarenessProtocol) return;

        const data = new Uint8Array(event.data as ArrayBuffer);
        const decoder = decodingLib.createDecoder(data);
        const msgType = decodingLib.readVarUint(decoder);

        switch (msgType) {
          case MSG_SYNC: {
            const encoder = encodingLib.createEncoder();
            encodingLib.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, this.ydoc, null);
            const reply = encodingLib.toUint8Array(encoder);
            if (reply.byteLength > 1) {
              this.wsSend(reply);
            }
            break;
          }
          case MSG_AWARENESS: {
            if (this.awareness) {
              const update = decodingLib.readVarUint8Array(decoder);
              awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this);
            }
            break;
          }
        }
      };

      this.ws.onclose = () => {
        this.setConnectionStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };

      // Wire doc updates → WebSocket
      this.ydoc.on('update', this.handleDocUpdate);
    } catch {
      this.setConnectionStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleDocUpdate = (update: Uint8Array, _origin: unknown): void => {
    if (!syncProtocol || !encodingLib || !this.ws) return;
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const encoder = encodingLib.createEncoder();
    encodingLib.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.wsSend(encodingLib.toUint8Array(encoder));
  };

  private wsSend(data: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private sendAwarenessUpdate(): void {
    if (!this.awareness || !awarenessProtocol || !encodingLib) return;

    const encoder = encodingLib.createEncoder();
    encodingLib.writeVarUint(encoder, MSG_AWARENESS);
    encodingLib.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        [this.ydoc.clientID],
      ),
    );
    this.wsSend(encodingLib.toUint8Array(encoder));
  }

  private scheduleReconnect(): void {
    if (this._destroyed || !this._sessionId) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectTimer = setTimeout(() => {
      if (!this._destroyed && this._sessionId) {
        this.setConnectionStatus('connecting');
        this.openWebSocket();
      }
    }, delay);
  }

  private disconnectRelay(): void {
    // Stop reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Stop awareness keepalive
    if (this.awarenessInterval) {
      clearInterval(this.awarenessInterval);
      this.awarenessInterval = null;
    }

    // Remove doc update listener
    this.ydoc.off('update', this.handleDocUpdate);

    // Close WebSocket
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    // Destroy awareness
    if (this.awareness) {
      this.awareness.destroy();
      this.awareness = null;
    }

    // Destroy IndexedDB persistence
    if (this.idbPersistence) {
      this.idbPersistence.destroy();
      this.idbPersistence = null;
    }
  }

  // ── Awareness helpers ──

  private assignColor(): void {
    if (!this.awareness) return;
    const usedColors = new Set<string>();
    this.awareness.getStates().forEach((state) => {
      if (state?.user?.color) usedColors.add(state.user.color);
    });
    // Pick first unused color, or round-robin by clientID
    const available = SESSION_USER_COLORS.filter(c => !usedColors.has(c));
    this._localColor = available.length > 0
      ? available[0]
      : SESSION_USER_COLORS[this.ydoc.clientID % SESSION_USER_COLORS.length];
  }

  private updateAwarenessLocal(): void {
    if (!this.awareness) return;
    this.awareness.setLocalStateField('user', {
      name: this._localUserName,
      color: this._localColor,
      isHost: this._isHost,
    });
  }

  private emitUsers(): void {
    if (!this.awareness) return;
    const users: SessionUser[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (state?.user) {
        users.push({
          clientId,
          name: state.user.name ?? 'Anonymous',
          color: state.user.color ?? SESSION_USER_COLORS[0],
          isHost: state.user.isHost ?? false,
        });
      }
    });
    this.callbacks.onSessionUsersChanged(users);
  }

  /** Check for new remote pings in awareness state */
  private checkRemotePings(): void {
    if (!this.awareness) return;
    const localId = this.ydoc.clientID;

    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === localId) return; // Skip own pings
      if (!state?.ping) return;

      const pingKey = `${clientId}_${state.ping.x}_${state.ping.y}`;
      if (this.pingTimers.has(pingKey)) return; // Already processing this ping

      // Emit the ping
      this.callbacks.onPingReceived(state.ping as PingData);

      // Clear after 2.5 seconds
      this.pingTimers.set(pingKey, setTimeout(() => {
        this.pingTimers.delete(pingKey);
      }, 2500));
    });
  }

  // ── Connection status ──

  private setConnectionStatus(status: 'disconnected' | 'connecting' | 'connected'): void {
    this._connectionStatus = status;
    this.callbacks.onConnectionStatusChanged(status);
  }

  // ── Cleanup ──

  destroy(): void {
    this._destroyed = true;
    this.disconnectRelay();

    // Clear ping timers
    for (const timer of this.pingTimers.values()) {
      clearTimeout(timer);
    }
    this.pingTimers.clear();

    this.undoManager.destroy();
    this.ydoc.destroy();
  }
}
