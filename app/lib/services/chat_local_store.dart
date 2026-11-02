import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// On-device copy of recent messages and the messages waiting to be sent.
/// Chat keeps working without it: every failure here is logged and ignored.
class ChatLocalStore {
  static const int _keepPerConversation = 200;
  Database? _db;
  String? _userId;

  Future<Database?> _open(String userId) async {
    if (_db != null && _userId == userId) return _db;
    await close();
    try {
      final path = p.join(await getDatabasesPath(), 'chat_$userId.db');
      _db = await openDatabase(path, version: 1, onCreate: (db, _) async {
        await db.execute('''CREATE TABLE messages (
          id TEXT PRIMARY KEY, spaceId TEXT NOT NULL, threadRootId TEXT, seq INTEGER NOT NULL, json TEXT NOT NULL)''');
        await db.execute('CREATE INDEX messages_space ON messages (spaceId, threadRootId, seq)');
        await db.execute('CREATE TABLE outbox (clientId TEXT PRIMARY KEY, spaceId TEXT NOT NULL, json TEXT NOT NULL)');
      });
      _userId = userId;
    } catch (e) {
      debugPrint('chat store open error: $e');
    }
    return _db;
  }

  Future<void> close() async {
    try {
      await _db?.close();
    } catch (_) {}
    _db = null;
    _userId = null;
  }

  Future<void> saveMessages(String userId, List<Map<String, dynamic>> messages) async {
    final db = await _open(userId);
    if (db == null || messages.isEmpty) return;
    try {
      final batch = db.batch();
      for (final m in messages) {
        batch.insert(
          'messages',
          {'id': m['id'], 'spaceId': m['spaceId'], 'threadRootId': m['threadRootId'], 'seq': m['seq'], 'json': jsonEncode(m)},
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await batch.commit(noResult: true);
      final spaceId = messages.first['spaceId'];
      await db.delete(
        'messages',
        where: 'spaceId = ? AND id NOT IN (SELECT id FROM messages WHERE spaceId = ? ORDER BY seq DESC LIMIT ?)',
        whereArgs: [spaceId, spaceId, _keepPerConversation],
      );
    } catch (e) {
      debugPrint('chat store save error: $e');
    }
  }

  Future<List<Map<String, dynamic>>> loadMessages(String userId, String spaceId, String? threadRootId) async {
    final db = await _open(userId);
    if (db == null) return [];
    try {
      final rows = await db.query(
        'messages',
        where: threadRootId == null ? 'spaceId = ? AND threadRootId IS NULL' : 'spaceId = ? AND threadRootId = ?',
        whereArgs: threadRootId == null ? [spaceId] : [spaceId, threadRootId],
        orderBy: 'seq DESC',
        limit: 40,
      );
      return rows.reversed.map((r) => Map<String, dynamic>.from(jsonDecode(r['json'] as String))).toList();
    } catch (e) {
      debugPrint('chat store load error: $e');
      return [];
    }
  }

  Future<void> addToOutbox(String userId, String clientId, String spaceId, Map<String, dynamic> payload) async {
    final db = await _open(userId);
    try {
      await db?.insert(
        'outbox',
        {'clientId': clientId, 'spaceId': spaceId, 'json': jsonEncode(payload)},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    } catch (e) {
      debugPrint('chat store outbox error: $e');
    }
  }

  Future<void> removeFromOutbox(String userId, String clientId) async {
    final db = await _open(userId);
    try {
      await db?.delete('outbox', where: 'clientId = ?', whereArgs: [clientId]);
    } catch (e) {
      debugPrint('chat store outbox error: $e');
    }
  }

  Future<List<Map<String, dynamic>>> loadOutbox(String userId) async {
    final db = await _open(userId);
    if (db == null) return [];
    try {
      final rows = await db.query('outbox');
      return rows
          .map((r) => {'clientId': r['clientId'], 'spaceId': r['spaceId'], 'payload': jsonDecode(r['json'] as String)})
          .toList();
    } catch (e) {
      debugPrint('chat store outbox error: $e');
      return [];
    }
  }
}
