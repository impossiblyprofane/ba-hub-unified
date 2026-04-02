// ══════════════════════════════════════════════════════════════
// ISR Collaborative Session — WebSocket relay
//
// Implements a lightweight Yjs document relay on /ws/isr/:roomId.
// Each room maintains an in-memory Y.Doc that acts as the
// authoritative state.  Clients exchange binary sync & awareness
// messages; the relay broadcasts to all other clients in the room.
//
// Rooms are garbage-collected after ROOM_TTL_MS of inactivity
// (no connected clients).
// ══════════════════════════════════════════════════════════════

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// ── Constants ──

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/** How long (ms) to keep a room alive after the last client disconnects */
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Room state ──

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  /** Cleanup timer — set when the last client leaves */
  ttlTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (room) {
    // Cancel pending cleanup — someone reconnected
    if (room.ttlTimer) {
      clearTimeout(room.ttlTimer);
      room.ttlTimer = null;
    }
    return room;
  }

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  room = { doc, awareness, clients: new Set(), ttlTimer: null };

  // When the doc is updated (by any client's sync message), broadcast
  // that update to every OTHER client so they stay in sync.
  const roomRef = room;
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);

    for (const client of roomRef.clients) {
      // `origin` is the WebSocket that sent the message — skip it
      if (client !== origin) {
        sendMessage(client, msg);
      }
    }
  });

  rooms.set(roomId, room);
  return room;
}

function scheduleRoomCleanup(roomId: string, room: Room): void {
  if (room.clients.size > 0) return;
  room.ttlTimer = setTimeout(() => {
    // Verify still empty before destroying
    if (room.clients.size === 0) {
      room.awareness.destroy();
      room.doc.destroy();
      rooms.delete(roomId);
    }
  }, ROOM_TTL_MS);
}

// ── Message helpers ──

function sendMessage(ws: WebSocket, data: Uint8Array): void {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  } catch {
    // Ignore send errors — the close handler will clean up
  }
}

function broadcastToOthers(room: Room, sender: WebSocket, data: Uint8Array): void {
  for (const client of room.clients) {
    if (client !== sender) {
      sendMessage(client, data);
    }
  }
}

// ── Handle an incoming binary message from a client ──

function handleMessage(room: Room, ws: WebSocket, data: Uint8Array): void {
  const decoder = decoding.createDecoder(data);
  const msgType = decoding.readVarUint(decoder);

  switch (msgType) {
    case MSG_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      // Pass `ws` as transaction origin so the doc 'update' handler
      // can skip broadcasting back to the sender.
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
      const reply = encoding.toUint8Array(encoder);
      // Only send reply if there's actual content (sync step 2 response)
      if (reply.byteLength > 1) {
        sendMessage(ws, reply);
      }
      break;
    }
    case MSG_AWARENESS: {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
      // Broadcast awareness to all other clients
      broadcastToOthers(room, ws, data);
      break;
    }
  }
}

// ── Send initial sync state to newly connected client ──

function sendSyncStep1(room: Room, ws: WebSocket): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  sendMessage(ws, encoding.toUint8Array(encoder));

  // Also send current awareness state
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder2,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys()),
      ),
    );
    sendMessage(ws, encoding.toUint8Array(encoder2));
  }
}

// ── Fastify plugin ──

export async function isrRelayPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/ws/isr/:roomId',
    { websocket: true },
    (socket: WebSocket, req: FastifyRequest<{ Params: { roomId: string } }>) => {
      const roomId = req.params.roomId;

      // Validate room ID format (6-8 alphanumeric)
      if (!/^[A-Za-z0-9]{6,8}$/.test(roomId)) {
        socket.close(4001, 'Invalid room ID');
        return;
      }

      const room = getOrCreateRoom(roomId);
      room.clients.add(socket);

      fastify.log.info({ roomId, clients: room.clients.size }, 'ISR client connected');

      // Send current doc state to the new client
      sendSyncStep1(room, socket);

      // Handle incoming messages
      socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const data = raw instanceof ArrayBuffer
            ? new Uint8Array(raw)
            : raw instanceof Buffer
              ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
              : new Uint8Array(Buffer.concat(raw as Buffer[]));
          handleMessage(room, socket, data);
        } catch (err) {
          fastify.log.warn({ err, roomId }, 'ISR message handling error');
        }
      });

      // Clean up on disconnect
      socket.on('close', () => {
        room.clients.delete(socket);
        fastify.log.info({ roomId, clients: room.clients.size }, 'ISR client disconnected');

        // Remove this client from awareness
        awarenessProtocol.removeAwarenessStates(
          room.awareness,
          [room.doc.clientID],
          'client disconnected',
        );

        // Schedule room cleanup if empty
        scheduleRoomCleanup(roomId, room);
      });

      socket.on('error', (err: Error) => {
        fastify.log.warn({ err, roomId }, 'ISR WebSocket error');
        room.clients.delete(socket);
        scheduleRoomCleanup(roomId, room);
      });
    },
  );
}
