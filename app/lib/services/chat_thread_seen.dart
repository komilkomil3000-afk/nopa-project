import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/chat_models.dart';

/// How many replies under each message this user has already seen, kept on the device, so «ورود به گفتگو»
/// can show how many new ones came in since. Threads that existed before this was first used start as seen,
/// so an update never greets the user with old counts.
class ChatThreadSeen extends ChangeNotifier {
  ChatThreadSeen._();
  static final ChatThreadSeen instance = ChatThreadSeen._();

  static const _prefix = 'chat_thread_seen_';
  final Map<String, int> _seen = {};
  String? _userId;
  DateTime _since = DateTime.now();
  bool _loaded = false;

  Future<void> load(String userId) async {
    if (_loaded && _userId == userId) return;
    _userId = userId;
    _seen.clear();
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_prefix$userId');
      if (raw != null) {
        final data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        _since = DateTime.tryParse(data['since']?.toString() ?? '') ?? DateTime.now();
        (data['seen'] as Map?)?.forEach((k, v) => _seen[k.toString()] = (v as num).toInt());
      } else {
        _since = DateTime.now();
        await _save();
      }
    } catch (e) {
      debugPrint('thread seen load error: $e');
    }
    _loaded = true;
    notifyListeners();
  }

  /// New replies under [root] since the user last opened its conversation.
  int unread(ChatMessage root) {
    if (!_loaded || root.threadReplies <= 0) return 0;
    final seen = _seen[root.id];
    if (seen == null) {
      // Older than this feature: its replies count as already read
      if (root.createdAt.isBefore(_since)) {
        _seen[root.id] = root.threadReplies;
        _scheduleSave();
        return 0;
      }
      return root.threadReplies;
    }
    return root.threadReplies > seen ? root.threadReplies - seen : 0;
  }

  void markSeen(String rootId, int replies) {
    if (_seen[rootId] == replies) return;
    _seen[rootId] = replies;
    _scheduleSave();
    notifyListeners();
  }

  bool _saving = false;
  void _scheduleSave() {
    if (_saving) return;
    _saving = true;
    Future.delayed(const Duration(milliseconds: 400), () async {
      _saving = false;
      await _save();
    });
  }

  Future<void> _save() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      // Keep the map small: the most recent entries are enough
      if (_seen.length > 3000) {
        final keys = _seen.keys.take(_seen.length - 2000).toList();
        keys.forEach(_seen.remove);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_prefix$userId', jsonEncode({'since': _since.toIso8601String(), 'seen': _seen}));
    } catch (e) {
      debugPrint('thread seen save error: $e');
    }
  }
}
