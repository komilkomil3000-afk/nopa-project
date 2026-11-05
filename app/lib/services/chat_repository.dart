import 'dart:async';
import 'dart:convert';
import 'dart:io' as io;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../core/constants/api_constants.dart';
import '../models/chat_models.dart';
import 'api_service.dart';
import 'chat_local_store.dart';

/// All chat state: conversations, open message lists, the socket and the send queue.
class ChatRepository extends ChangeNotifier {
  ChatRepository._();
  static final ChatRepository instance = ChatRepository._();

  final HttpApiService _api = HttpApiService();
  final ChatLocalStore _store = ChatLocalStore();
  final Random _random = Random();
  sio.Socket? _socket;
  String? _userId;
  bool _flushing = false;
  /// The private answer to a moderator's command, for the conversation on screen.
  final ValueNotifier<String?> commandResult = ValueNotifier(null);
  Timer? _offlineTimer;
  bool _offlineRoundRunning = false;
  final Map<String, int> _watching = {};
  static const Duration offlinePollInterval = Duration(seconds: 3);
  DateTime _lastTokenRenewal = DateTime.fromMillisecondsSinceEpoch(0);

  List<ChatSpace> spaces = [];
  bool loadingSpaces = false;
  bool connected = false;

  /// The last HTTP call to the chat API got an answer: chat works (by polling) even when the socket is refused.
  bool serverReachable = false;

  /// What the user sees as "connected": the live socket, or the HTTP fallback answering.
  bool get online => connected || serverReachable;
  final Map<String, List<ChatMessage>> _lists = {};
  final Map<String, List<Map<String, dynamic>>> _staffTags = {};
  bool _foreground = true;
  final Map<String, String> _typing = {};
  final Map<String, Timer> _typingTimers = {};
  DateTime _lastTypingSent = DateTime.fromMillisecondsSinceEpoch(0);

  static String _key(String spaceId, String? threadRootId) => '$spaceId|${threadRootId ?? ''}';

  /// The app went to the background or came back: without a socket, polling waits for its return.
  void setForeground(bool value) {
    _foreground = value;
    if (value) _reconnectNow();
  }

  /// Back in the app with no live connection: renew the login if it ran out and try again at once,
  /// instead of waiting for the reconnect timer (whose delay grows up to 20 s).
  Future<void> _reconnectNow() async {
    final socket = _socket;
    if (socket == null || socket.connected) return;
    await _renewTokenForSocket(force: false);
    if (!socket.connected) socket.connect();
  }

  /// A socket that was refused for its token keeps retrying with the same one for ever: get a fresh token first.
  Future<void> _renewTokenForSocket({required bool force}) async {
    final expiry = _api.tokenExpiry;
    final stale = force || _api.token == null || (expiry != null && expiry.isBefore(DateTime.now().add(const Duration(minutes: 1))));
    if (!stale || DateTime.now().difference(_lastTokenRenewal).inSeconds < 15) return;
    _lastTokenRenewal = DateTime.now();
    await _api.silentRefreshToken();
    _socket?.auth = {'token': _api.token ?? ''};
  }

  List<Map<String, dynamic>> staffTagsOf(String messageId) => _staffTags[messageId] ?? const [];

  List<ChatMessage> messagesOf(String spaceId, {String? threadRootId}) => _lists[_key(spaceId, threadRootId)] ?? const [];
  String? typingIn(String spaceId) => _typing[spaceId];

  /// The signed-in user chat is running for.
  String? get userId => _userId;
  int get totalUnread => spaces.where((s) => !s.muted).fold(0, (sum, s) => sum + s.unread);
  ChatSpace? spaceById(String id) {
    for (final s in spaces) {
      if (s.id == id) return s;
    }
    return null;
  }

  /// Follows the admin's switch: connects when chat is available to this user, otherwise cleans up.
  void setEnabled(bool enabled, String userId) {
    if (enabled && (_socket == null || _userId != userId)) {
      _userId = userId;
      _connect();
      refreshSpaces();
      _offlineTimer ??= Timer.periodic(offlinePollInterval, (_) => _pollWhileOffline());
    } else if (!enabled && _socket != null) {
      reset();
    }
  }

  /// Without a socket (a proxy may refuse WebSocket) chat still works, a few seconds behind:
  /// the conversation on screen and the list are fetched over HTTP, and the queue is retried.
  Future<void> _pollWhileOffline() async {
    if (connected || !_foreground || _offlineRoundRunning || _userId == null) return;
    _offlineRoundRunning = true;
    try {
      await refreshSpaces();
      for (final key in _watching.keys.toList()) {
        final parts = key.split('|');
        await loadNewer(parts[0], threadRootId: parts[1].isEmpty ? null : parts[1]);
      }
      await flushOutbox();
    } finally {
      _offlineRoundRunning = false;
    }
  }

  /// The screen showing a conversation says so, so that it is kept fresh without a socket.
  void watch(String spaceId, {String? threadRootId}) {
    final key = _key(spaceId, threadRootId);
    _watching[key] = (_watching[key] ?? 0) + 1;
  }

  void unwatch(String spaceId, {String? threadRootId}) {
    final key = _key(spaceId, threadRootId);
    final count = (_watching[key] ?? 1) - 1;
    if (count <= 0) {
      _watching.remove(key);
    } else {
      _watching[key] = count;
    }
  }

  void reset() {
    _offlineTimer?.cancel();
    _offlineTimer = null;
    _watching.clear();
    _socket?.dispose();
    _socket = null;
    _userId = null;
    connected = false;
    serverReachable = false;
    spaces = [];
    _lists.clear();
    _typing.clear();
    _store.close();
    notifyListeners();
  }

  void _connect() {
    _socket?.dispose();
    final socket = sio.io(
      ApiConstants.mediaBaseUrl,
      sio.OptionBuilder()
          // The Dart client has no long-polling transport: see _pollWhileOffline for the fallback
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(20000)
          .setAuth({'token': _api.token ?? ''})
          .build(),
    );
    _socket = socket;

    socket.on('ready', (_) {
      connected = true;
      notifyListeners();
      _catchUp();
    });
    socket.onDisconnect((_) {
      connected = false;
      notifyListeners();
    });
    // The access token may have been refreshed since the last attempt
    socket.onConnectError((error) async {
      socket.auth = {'token': _api.token ?? ''};
      // Refused for the token (expired while the app slept): renew it, the next attempt then succeeds
      if (error.toString().contains('UNAUTHORIZED')) await _renewTokenForSocket(force: true);
    });
    socket.on('message:new', (data) => _onNew(Map<String, dynamic>.from(data as Map)));
    socket.on('message:update', (data) => _onUpdate(Map<String, dynamic>.from(data as Map)));
    socket.on('read', (data) => _onRead(Map<String, dynamic>.from(data as Map)));
    socket.on('typing', (data) => _onTyping(Map<String, dynamic>.from(data as Map)));
    socket.on('space:update', (_) => refreshSpaces());
    socket.on('presence', (data) => _onPresence(Map<String, dynamic>.from(data as Map)));
    socket.connect();
  }

  /// After a reconnect: what happened meanwhile, then whatever waited in the queue.
  Future<void> _catchUp() async {
    await refreshSpaces();
    for (final key in _lists.keys.toList()) {
      final parts = key.split('|');
      await loadNewer(parts[0], threadRootId: parts[1].isEmpty ? null : parts[1]);
    }
    await flushOutbox();
  }

  Future<void> refreshSpaces() async {
    loadingSpaces = spaces.isEmpty;
    notifyListeners();
    final res = await _api.chatCall('GET', '/chat/spaces');
    loadingSpaces = false;
    serverReachable = res != null && res.statusCode < 500;
    if (res != null && res.statusCode == 200) {
      final data = jsonDecode(res.body) as List;
      spaces = data.map((s) => ChatSpace.fromJson(Map<String, dynamic>.from(s as Map))).toList();
      _sortSpaces();
    }
    notifyListeners();
  }

  void _sortSpaces() {
    int rank(ChatSpace s) => s.type == 'announcements' ? 0 : 1;
    spaces.sort((a, b) {
      final byRank = rank(a).compareTo(rank(b));
      if (byRank != 0) return byRank;
      return (b.lastActivity ?? DateTime(2000)).compareTo(a.lastActivity ?? DateTime(2000));
    });
  }

  /// Shows the saved messages at once, then replaces them with what the server has.
  Future<void> open(String spaceId, {String? threadRootId}) async {
    final key = _key(spaceId, threadRootId);
    if (_userId != null && !_lists.containsKey(key)) {
      final saved = await _store.loadMessages(_userId!, spaceId, threadRootId);
      if (saved.isNotEmpty) {
        _lists[key] = saved.map(ChatMessage.fromJson).toList();
        notifyListeners();
      }
    }
    final page = await _fetch(spaceId, threadRootId: threadRootId);
    if (page == null) return;
    final pending = (_lists[key] ?? []).where((m) => m.sendState != ChatSendState.sent).toList();
    if (_userId != null) {
      for (final item in await _store.loadOutbox(_userId!)) {
        final payload = Map<String, dynamic>.from(item['payload'] as Map);
        if (item['spaceId'] != spaceId || payload['threadRootId'] != threadRootId) continue;
        final known = pending.any((m) => m.clientMessageId == item['clientId']) || page.any((m) => m.clientMessageId == item['clientId']);
        if (!known) pending.add(_pendingFrom(spaceId, item['clientId'] as String, payload));
      }
    }
    _lists[key] = [...page, ...pending];
    notifyListeners();
    _save(page);
  }

  Future<List<ChatMessage>?> _fetch(String spaceId, {String? threadRootId, int? beforeSeq, int? afterSeq}) async {
    final query = {
      'threadRootId': ?threadRootId,
      if (beforeSeq != null) 'beforeSeq': '$beforeSeq',
      if (afterSeq != null) 'afterSeq': '$afterSeq',
    };
    final path = Uri(path: '/chat/spaces/$spaceId/messages', queryParameters: query.isEmpty ? null : query).toString();
    final res = await _api.chatCall('GET', path);
    if (res == null || res.statusCode != 200) return null;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final staff = data['staffTags'];
    if (staff is Map) {
      staff.forEach((id, tags) => _staffTags[id as String] = (tags as List).map((t) => Map<String, dynamic>.from(t as Map)).toList());
    }
    return (data['messages'] as List).map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m as Map))).toList();
  }

  /// Older messages when the user scrolls up. Returns false at the start of the conversation.
  Future<bool> loadOlder(String spaceId, {String? threadRootId}) async {
    final key = _key(spaceId, threadRootId);
    final current = _lists[key] ?? [];
    final sent = current.where((m) => m.seq > 0);
    if (sent.isEmpty) return false;
    final page = await _fetch(spaceId, threadRootId: threadRootId, beforeSeq: sent.first.seq);
    if (page == null || page.isEmpty) return false;
    _lists[key] = [...page, ...current];
    notifyListeners();
    return true;
  }

  Future<void> loadNewer(String spaceId, {String? threadRootId}) async {
    final key = _key(spaceId, threadRootId);
    final sent = (_lists[key] ?? []).where((m) => m.seq > 0);
    if (sent.isEmpty) return open(spaceId, threadRootId: threadRootId);
    final page = await _fetch(spaceId, threadRootId: threadRootId, afterSeq: sent.last.seq);
    if (page == null) return;
    for (final m in page) {
      _insert(m);
    }
    notifyListeners();
    _save(page);
  }

  ChatMessage _pendingFrom(String spaceId, String clientId, Map<String, dynamic> payload) => ChatMessage.fromJson({
        'id': 'pending-$clientId',
        'spaceId': spaceId,
        'seq': 0,
        'body': payload['body'] ?? '',
        'threadRootId': payload['threadRootId'],
        'clientMessageId': clientId,
        'createdAt': DateTime.now().toIso8601String(),
        'sender': payload['sender'],
      })
        ..sendState = ChatSendState.sending;

  void _save(List<ChatMessage> messages) {
    if (_userId != null) _store.saveMessages(_userId!, messages.map((m) => m.raw).toList());
  }

  /// Adds a message to its list, in place of the pending copy when it is the same message.
  void _insert(ChatMessage message) {
    final key = _key(message.spaceId, message.threadRootId);
    final list = _lists[key];
    if (list == null) return;
    final at = list.indexWhere((m) => m.id == message.id || (message.clientMessageId != null && m.clientMessageId == message.clientMessageId));
    if (at >= 0) {
      list[at] = message;
    } else {
      final firstPending = list.indexWhere((m) => m.seq == 0);
      list.insert(firstPending < 0 ? list.length : firstPending, message);
    }
  }

  void _onNew(Map<String, dynamic> json) {
    final message = ChatMessage.fromJson(json);
    _insert(message);
    if (message.threadRootId != null) _addThreadFace(message);
    final space = spaceById(message.spaceId);
    if (space == null) {
      refreshSpaces();
    } else {
      space.lastSeq = max(space.lastSeq, message.seq);
      if (message.senderId != _userId) space.unread += 1;
      if (message.threadRootId == null) {
        space.preview = message.body.isEmpty ? 'فایل' : message.body;
        space.previewSender = message.senderName;
        space.previewSenderId = message.senderId;
        space.lastActivity = message.createdAt;
        _sortSpaces();
      }
    }
    _typing.remove(message.spaceId);
    notifyListeners();
    _save([message]);
  }

  /// Someone replied under a message: their face joins the row beside the way into that conversation.
  void _addThreadFace(ChatMessage reply) {
    if (reply.senderId == null) return;
    final list = _lists[_key(reply.spaceId, null)];
    final at = list?.indexWhere((m) => m.id == reply.threadRootId) ?? -1;
    if (at < 0) return;
    final root = list![at];
    final faces = [
      {'id': reply.senderId, 'name': reply.senderName, 'avatarUrl': reply.senderAvatarUrl, 'gender': reply.senderGender, 'role': reply.senderIsMentor ? 'mentor' : 'student'},
      ...root.threadPeople.where((p) => p['id'] != reply.senderId),
    ].take(4).toList();
    list[at] = ChatMessage.fromJson({...root.raw, 'threadPeople': faces, 'threadOpen': true});
  }

  void _onUpdate(Map<String, dynamic> json) {
    final list = _lists[_key(json['spaceId'], json['threadRootId'])];
    final at = list?.indexWhere((m) => m.id == json['id']) ?? -1;
    // Live updates do not carry the faces of a thread: keep the ones already known
    if (at >= 0 && !json.containsKey('threadPeople')) json = {...json, 'threadPeople': list![at].raw['threadPeople'] ?? const []};
    final message = ChatMessage.fromJson(json);
    if (at >= 0) {
      list![at] = message;
      notifyListeners();
    }
    _save([message]);
  }

  void _onRead(Map<String, dynamic> json) {
    final space = spaceById(json['spaceId']);
    if (space == null) return;
    final seq = (json['seq'] as num).toInt();
    if (json['userId'] == _userId) {
      space.lastReadSeq = max(space.lastReadSeq, seq);
      space.unread = max(0, space.lastSeq - space.lastReadSeq);
    } else {
      space.peerReadSeq = max(space.peerReadSeq, seq);
    }
    notifyListeners();
  }

  /// Who is connected, as far as this device has heard (from the server lists and presence events).
  final Map<String, bool> _online = {};

  bool isOnline(String userId) => _online[userId] ?? false;

  /// Seeds presence from a list of people the server sent, each with an 'online' flag.
  void notePresence(Iterable<Map<String, dynamic>> people) {
    for (final p in people) {
      if (p['id'] is String) _online[p['id']] = p['online'] == true;
    }
  }

  void _onPresence(Map<String, dynamic> json) {
    final userId = json['userId'] as String?;
    if (userId == null) return;
    final online = json['online'] == true;
    _online[userId] = online;
    for (final s in spaces) {
      if (s.peerId == userId) s.peerOnline = online;
    }
    notifyListeners();
  }

  void _onTyping(Map<String, dynamic> json) {
    final spaceId = json['spaceId'] as String;
    _typing[spaceId] = json['name'] ?? '';
    _typingTimers[spaceId]?.cancel();
    _typingTimers[spaceId] = Timer(const Duration(seconds: 4), () {
      _typing.remove(spaceId);
      notifyListeners();
    });
    notifyListeners();
  }

  void sendTyping(String spaceId) {
    final now = DateTime.now();
    if (now.difference(_lastTypingSent).inSeconds < 3) return;
    _lastTypingSent = now;
    _socket?.emit('typing', spaceId);
  }

  void markRead(String spaceId) {
    final space = spaceById(spaceId);
    if (space == null || space.lastSeq <= space.lastReadSeq) return;
    final seq = space.lastSeq;
    space.lastReadSeq = seq;
    space.unread = 0;
    notifyListeners();
    _api.chatCall('POST', '/chat/spaces/$spaceId/read', body: {'seq': seq});
  }

  String _newClientId() => '${DateTime.now().microsecondsSinceEpoch}-${_random.nextInt(1 << 30)}';

  /// Shows the message immediately, queues it on the device and sends it.
  Future<void> send({
    required String spaceId,
    required Map<String, dynamic> sender,
    String body = '',
    String? threadRootId,
    ChatMessage? replyTo,
    List<String> mentions = const [],
    List<ChatAttachment> attachments = const [],
  }) async {
    final clientId = _newClientId();
    final payload = <String, dynamic>{
      'body': body,
      'sender': sender,
      'clientMessageId': clientId,
      'threadRootId': ?threadRootId,
      if (replyTo != null) 'replyToId': replyTo.id,
      if (mentions.isNotEmpty) 'mentions': mentions,
      if (attachments.isNotEmpty) 'attachmentIds': attachments.map((a) => a.id).toList(),
    };
    final pending = ChatMessage.fromJson({
      'id': 'pending-$clientId',
      'spaceId': spaceId,
      'seq': 0,
      'kind': attachments.isEmpty ? 'text' : 'file',
      'body': body,
      'threadRootId': threadRootId,
      'clientMessageId': clientId,
      'createdAt': DateTime.now().toIso8601String(),
      'sender': sender,
      'attachments': attachments.map((a) => {'id': a.id, 'name': a.name, 'kind': a.kind, 'size': a.size, 'url': a.url}).toList(),
      if (replyTo != null) 'replyTo': {'id': replyTo.id, 'senderName': replyTo.senderName, 'body': replyTo.body},
    })
      ..sendState = ChatSendState.sending;
    _lists.putIfAbsent(_key(spaceId, threadRootId), () => []).add(pending);
    notifyListeners();

    if (_userId != null) await _store.addToOutbox(_userId!, clientId, spaceId, payload);
    await _deliver(spaceId, clientId, payload, threadRootId);
  }

  Future<void> _deliver(String spaceId, String clientId, Map<String, dynamic> payload, String? threadRootId) async {
    final res = await _api.chatCall('POST', '/chat/spaces/$spaceId/messages', body: payload);
    final list = _lists[_key(spaceId, threadRootId)];
    final at = list?.indexWhere((m) => m.clientMessageId == clientId) ?? -1;

    if (res != null && (res.statusCode == 200 || res.statusCode == 201)) {
      if (_userId != null) await _store.removeFromOutbox(_userId!, clientId);
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (data['command'] == true) {
        if (at >= 0) list!.removeAt(at);
        commandResult.value = data['result']?.toString();
        notifyListeners();
        return;
      }
      final message = ChatMessage.fromJson(data);
      _insert(message);
      final space = spaceById(spaceId);
      if (space != null) {
        space.lastSeq = max(space.lastSeq, message.seq);
        space.lastReadSeq = max(space.lastReadSeq, message.seq);
      }
      _save([message]);
    } else {
      // Refused by the server: retrying cannot help, so it leaves the queue. A network failure stays in it.
      final refused = res != null && res.statusCode >= 400 && res.statusCode < 500 && res.statusCode != 429;
      if (refused && _userId != null) await _store.removeFromOutbox(_userId!, clientId);
      if (at >= 0) list![at].sendState = ChatSendState.failed;
      if (res != null && res.statusCode >= 400) commandResult.value = _errorOf(res.body);
    }
    notifyListeners();
  }

  String _errorOf(String body) {
    try {
      return (jsonDecode(body) as Map)['error']?.toString() ?? 'ارسال پیام انجام نشد.';
    } catch (_) {
      return 'ارسال پیام انجام نشد.';
    }
  }

  /// A call whose result a screen reads itself.
  Future<ChatApiResult> api(String method, String path, {Map<String, dynamic>? body}) async {
    final res = await _api.chatCall(method, path, body: body);
    if (res == null) return const ChatApiResult(false, null, 'اتصال اینترنت برقرار نیست. اگر فیلترشکن شما روشن است، لطفاً آن را خاموش کنید.');
    final ok = res.statusCode < 300;
    dynamic data;
    try {
      data = jsonDecode(res.body);
    } catch (_) {}
    return ChatApiResult(ok, data, ok ? '' : ((data is Map ? data['error']?.toString() : null) ?? 'خطایی رخ داد.'));
  }

  /// The export opens in the browser, which sends no auth header: the server gives a short-lived link.
  Future<String?> exportLink(String topicId) async {
    final res = await api('POST', '/chat/topics/$topicId/export-link', body: {});
    return res.ok ? (res.data as Map)['url'] as String? : null;
  }

  Future<bool> vote(ChatMessage message, int option) => _simple('POST', '/chat/messages/${message.id}/vote', {'option': option});
  Future<bool> report(ChatMessage message, String reason) => _simple('POST', '/chat/messages/${message.id}/report', {'reason': reason});
  Future<bool> mark(ChatMessage message, String mark) => _simple('POST', '/chat/messages/${message.id}/mark', {'mark': mark});
  Future<bool> toggleTag(ChatMessage message, String tagId) => _simple('POST', '/chat/messages/${message.id}/tags', {'tagId': tagId});

  Future<List<Map<String, dynamic>>> tags(String spaceId) => _people('/chat/spaces/$spaceId/tags');

  Future<List<ChatMessage>> taggedMessages(String spaceId, String tagId, {String? threadRootId}) async {
    final query = {'tagId': tagId, 'threadRootId': ?threadRootId};
    final res = await api('GET', Uri(path: '/chat/spaces/$spaceId/messages', queryParameters: query).toString());
    if (!res.ok) return [];
    return ((res.data as Map)['messages'] as List).map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m as Map))).toList();
  }

  Future<List<ChatMessage>> stationMessages(String spaceId, String stationId) async {
    final res = await api('GET', Uri(path: '/chat/spaces/$spaceId/messages', queryParameters: {'stationId': stationId}).toString());
    if (!res.ok) return [];
    return ((res.data as Map)['messages'] as List).map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m as Map))).toList();
  }

  /// The user's conversation with support.
  Future<ChatSpace?> openSupport() async {
    final res = await api('POST', '/chat/support/open', body: {});
    if (!res.ok) return null;
    await refreshSpaces();
    return spaceById((res.data as Map)['id'] as String);
  }

  Future<void> retry(ChatMessage message) async {
    final clientId = message.clientMessageId;
    if (clientId == null || _userId == null) return;
    message.sendState = ChatSendState.sending;
    notifyListeners();
    await _deliver(message.spaceId, clientId, {
      'body': message.body,
      'clientMessageId': clientId,
      if (message.threadRootId != null) 'threadRootId': message.threadRootId,
      if (message.replyToId != null) 'replyToId': message.replyToId,
      if (message.attachments.isNotEmpty) 'attachmentIds': message.attachments.map((a) => a.id).toList(),
    }, message.threadRootId);
  }

  /// Sends what was written while offline, including after the app was closed.
  Future<void> flushOutbox() async {
    if (_flushing || _userId == null) return;
    _flushing = true;
    try {
      for (final item in await _store.loadOutbox(_userId!)) {
        final payload = Map<String, dynamic>.from(item['payload'] as Map);
        await _deliver(item['spaceId'] as String, item['clientId'] as String, payload, payload['threadRootId'] as String?);
      }
    } finally {
      _flushing = false;
    }
  }

  Future<ChatAttachment?> upload(io.File file, String spaceId) async {
    final data = await _api.uploadChatFile(file, spaceId);
    if (data == null) return null;
    return ChatAttachment(
      id: data['id'],
      name: data['name'] ?? 'فایل',
      kind: data['kind'] ?? 'file',
      size: await file.length(),
      url: data['url'] ?? '',
    );
  }

  Future<bool> edit(ChatMessage message, String body) => _apply('PATCH', '/chat/messages/${message.id}', {'body': body});
  Future<bool> delete(ChatMessage message) => _apply('DELETE', '/chat/messages/${message.id}', null);

  /// Shows a change to [message] on this device only, while it can still be undone; [putBack] restores it.
  void showLocally(ChatMessage message, Map<String, dynamic> patch) =>
      _replaceLocal(message, ChatMessage.fromJson({...message.raw, ...patch}));
  void putBack(ChatMessage original) => _replaceLocal(original, original);
  void _replaceLocal(ChatMessage target, ChatMessage next) {
    final list = _lists[_key(target.spaceId, target.threadRootId)];
    final at = list?.indexWhere((m) => m.id == target.id) ?? -1;
    if (at < 0) return;
    list![at] = next;
    notifyListeners();
  }
  /// One reaction per person, kept per user: choosing another replaces only one's own, never anyone else's.
  /// The server does the same; the screen shows it at once, then takes the server's answer.
  Future<bool> react(ChatMessage message, String type) async {
    final list = _lists[_key(message.spaceId, message.threadRootId)];
    final at = list?.indexWhere((m) => m.id == message.id) ?? -1;
    if (at >= 0) {
      final current = list![at];
      final same = current.reactions.any((r) => r['userId'] == _userId && r['type'] == type);
      // The star is separate from one's ordinary reaction: toggling either leaves the other alone
      const star = 'star'; // ChatTheme.starReaction
      final isStar = type == star;
      final next = <Map<String, dynamic>>[
        ...current.reactions.where((r) => r['userId'] != _userId || (r['type'] == star) != isStar),
        if (!same) {'userId': _userId, 'type': type},
      ];
      list[at] = ChatMessage.fromJson({...current.raw, 'reactions': next});
      notifyListeners();
    }
    final ok = await _apply('POST', '/chat/messages/${message.id}/reactions', {'type': type});
    if (!ok && at >= 0) {
      final i = list!.indexWhere((m) => m.id == message.id);
      if (i >= 0) {
        list[i] = message;
        notifyListeners();
      }
    }
    return ok;
  }
  Future<bool> togglePin(ChatMessage message) => _apply('POST', '/chat/messages/${message.id}/pin', {});

  /// Like [_simple], but the message the server answers with replaces the one on screen at once,
  /// so a reaction, pin or edit shows even when the live connection is down.
  Future<bool> _apply(String method, String path, Map<String, dynamic>? body) async {
    final res = await _api.chatCall(method, path, body: body);
    if (res == null || res.statusCode >= 300) return false;
    try {
      final data = jsonDecode(res.body);
      if (data is Map && data['id'] is String && data['spaceId'] is String) _onUpdate(Map<String, dynamic>.from(data));
    } catch (_) {}
    return true;
  }

  Future<bool> setMuted(ChatSpace space, bool muted) async {
    final ok = await _simple('POST', '/chat/spaces/${space.id}/mute', {'muted': muted});
    if (ok) {
      space.muted = muted;
      notifyListeners();
    }
    return ok;
  }

  Future<bool> _simple(String method, String path, Map<String, dynamic>? body) async {
    final res = await _api.chatCall(method, path, body: body);
    return res != null && res.statusCode < 300;
  }

  Future<List<ChatMessage>> list(String path) async {
    final res = await _api.chatCall('GET', path);
    if (res == null || res.statusCode != 200) return [];
    return (jsonDecode(res.body) as List).map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m as Map))).toList();
  }

  Future<List<ChatMessage>> pins(String spaceId) => list('/chat/spaces/$spaceId/pins');
  Future<List<ChatMessage>> search(String spaceId, String query) =>
      list(Uri(path: '/chat/spaces/$spaceId/search', queryParameters: {'q': query}).toString());

  Future<List<Map<String, dynamic>>> _people(String path) async {
    final res = await _api.chatCall('GET', path);
    if (res == null || res.statusCode != 200) return [];
    return (jsonDecode(res.body) as List).map((u) => Map<String, dynamic>.from(u as Map)).toList();
  }

  Future<List<Map<String, dynamic>>> people(String spaceId) async {
    final list = await _people('/chat/spaces/$spaceId/people');
    notePresence(list);
    return list;
  }

  /// A group or channel: counts, rank and members.
  Future<Map<String, dynamic>?> spaceProfile(String spaceId) async {
    final res = await api('GET', '/chat/spaces/$spaceId/profile');
    if (!res.ok || res.data is! Map) return null;
    final data = Map<String, dynamic>.from(res.data as Map);
    notePresence(((data['members'] as List?) ?? []).map((m) => Map<String, dynamic>.from(m as Map)));
    return data;
  }

  /// Sets (a file) or removes (null) the caravan's picture. Returns the new URL through [ok]; keeps the space list in step.
  Future<({bool ok, String? url})> setSpaceCover(String spaceId, io.File? file) async {
    final data = await _api.setChatSpaceCover(spaceId, file);
    if (data == null) return (ok: false, url: null);
    final url = data['coverImageUrl']?.toString();
    final cleaned = (url == null || url.isEmpty) ? null : url;
    spaceById(spaceId)?.coverImageUrl = cleaned;
    notifyListeners();
    return (ok: true, url: cleaned);
  }

  /// A member as seen from a space, with participation numbers when the caller may see them.
  Future<Map<String, dynamic>?> memberProfile(String spaceId, String userId) async {
    final res = await api('GET', '/chat/spaces/$spaceId/members/$userId');
    if (!res.ok || res.data is! Map) return null;
    final data = Map<String, dynamic>.from(res.data as Map);
    notePresence([data]);
    return data;
  }

  /// Photos (image), voices (audio), links (link) or sessions (session) of a space, newest first.
  /// [before] (the createdAt of the last item held) and [limit] page through older ones; a server that
  /// does not know them simply returns its first page again.
  Future<List<Map<String, dynamic>>> media(String spaceId, String kind, {String? userId, String? before, int? limit}) =>
      _people(Uri(path: '/chat/spaces/$spaceId/media', queryParameters: {
        'kind': kind,
        'userId': ?userId,
        'before': ?before,
        if (limit != null) 'limit': '$limit',
      }).toString());
  Future<List<Map<String, dynamic>>> contacts() => _people('/chat/contacts');

  /// Opens a private conversation and returns it.
  Future<ChatSpace?> openDirect(String userId) async {
    final res = await _api.chatCall('POST', '/chat/direct', body: {'userId': userId});
    if (res == null || res.statusCode != 200) return null;
    final id = (jsonDecode(res.body) as Map<String, dynamic>)['id'] as String;
    await refreshSpaces();
    return spaceById(id);
  }
}

class ChatApiResult {
  final bool ok;
  final dynamic data;
  final String error;
  const ChatApiResult(this.ok, this.data, this.error);
}
