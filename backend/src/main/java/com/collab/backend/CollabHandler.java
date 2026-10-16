package com.collab.backend;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

@Component
public class CollabHandler extends BinaryWebSocketHandler {

    private static final byte TYPE_DOC_UPDATE = 0;

    private static class Room {
        final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
        final List<byte[]> updates = new ArrayList<>();
    }

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Room room = rooms.computeIfAbsent(roomId(session), id -> new Room());
        synchronized (room) {
            room.sessions.add(session);
            // Replay history so the new client gets the current document
            for (byte[] update : room.updates) {
                send(session, update);
            }
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        ByteBuffer buf = message.getPayload();
        byte[] data = new byte[buf.remaining()];
        buf.get(data);
        if (data.length == 0) return;

        Room room = rooms.get(roomId(session));
        if (room == null) return;

        synchronized (room) {
            if (data[0] == TYPE_DOC_UPDATE) {
                room.updates.add(data);
            }
            for (WebSocketSession other : room.sessions) {
                if (!other.getId().equals(session.getId())) {
                    send(other, data);
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Room room = rooms.get(roomId(session));
        if (room != null) {
            room.sessions.remove(session);
        }
    }

    private void send(WebSocketSession session, byte[] data) {
        try {
            synchronized (session) { // a session can't send from two threads at once
                if (session.isOpen()) {
                    session.sendMessage(new BinaryMessage(data));
                }
            }
        } catch (IOException e) {
            System.err.println("Send failed: " + e.getMessage());
        }
    }

    private String roomId(WebSocketSession session) {
        String path = session.getUri().getPath(); // e.g. /ws/room123
        return path.substring(path.lastIndexOf('/') + 1);
    }
}