import 'package:nopa_app/core/avatar_catalog.dart';
/// A conversation in the chat tab.
class ChatSpace {
  final String id;
  final String type;
  final String title;
  final String? peerId;
  final String? peerAvatarUrl;
  final String? peerGender;
  final bool peerIsMentor;
  /// The caravan's picture, set by its mentor; only a caravan group has one.
  String? coverImageUrl;
  bool peerOnline;
  int peerReadSeq;
  int lastSeq;
  int lastReadSeq;
  int unread;
  bool muted;
  final bool canPost;
  final bool canReply;
  final bool canModerate;
  final bool canTag;
  String preview;
  String previewSender;
  /// Sender of the last message, to tell one's own message (with read ticks) from others'.
  String? previewSenderId;
  DateTime? lastActivity;

  ChatSpace({
    required this.id,
    required this.type,
    required this.title,
    this.peerId,
    this.peerAvatarUrl,
    this.peerGender,
    this.peerIsMentor = false,
    this.coverImageUrl,
    this.peerOnline = false,
    this.peerReadSeq = 0,
    this.lastSeq = 0,
    this.lastReadSeq = 0,
    this.unread = 0,
    this.muted = false,
    this.canPost = true,
    this.canReply = true,
    this.canModerate = false,
    this.canTag = false,
    this.preview = '',
    this.previewSender = '',
    this.previewSenderId,
    this.lastActivity,
  });

  bool get isDirect => type == 'direct';

  /// One person on each side: no sender names, no sessions.
  bool get isPrivate => type == 'direct' || type == 'support';

  /// Broadcast spaces: posts read as full-width cards rather than chat bubbles.
  /// (announcements, the public channel and the inter-group arena; 'media' is a mentor's custom group).
  bool get isChannel => const {'announcements', 'public', 'arena'}.contains(type);

  /// Many people talking: bubbles with the sender's name and face.
  bool get isGroup => !isPrivate && !isChannel;

  factory ChatSpace.fromJson(Map<String, dynamic> json) {
    final peer = json['peer'] as Map<String, dynamic>?;
    final last = json['lastMessage'] as Map<String, dynamic>?;
    return ChatSpace(
      id: json['id'],
      type: json['type'],
      title: json['title'] ?? '',
      peerId: peer?['id'],
      peerAvatarUrl: peer?['avatarUrl'],
      peerGender: peer?['gender'],
      peerIsMentor: AvatarCatalog.isMentorRole(peer?['role']),
      coverImageUrl: (json['coverImageUrl']?.toString().trim().isNotEmpty ?? false) ? json['coverImageUrl'].toString().trim() : null,
      peerOnline: peer?['online'] == true,
      peerReadSeq: json['peerReadSeq'] ?? 0,
      lastSeq: json['lastSeq'] ?? 0,
      lastReadSeq: json['lastReadSeq'] ?? 0,
      unread: json['unread'] ?? 0,
      muted: json['muted'] == true,
      canPost: json['canPost'] == true,
      canReply: json['canReply'] != false,
      canModerate: json['canModerate'] == true,
      canTag: json['canTag'] == true,
      preview: last?['preview'] ?? '',
      previewSender: last?['senderName'] ?? '',
      previewSenderId: last?['senderId'],
      lastActivity: DateTime.tryParse(last?['createdAt'] ?? ''),
    );
  }
}

class ChatAttachment {
  final String id;
  final String name;
  final String kind;
  final int size;
  final String url;

  const ChatAttachment({required this.id, required this.name, required this.kind, required this.size, required this.url});

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
        id: json['id'],
        name: json['name'] ?? 'فایل',
        kind: json['kind'] ?? 'file',
        size: json['size'] ?? 0,
        url: json['url'] ?? '',
      );
}

enum ChatSendState { sent, sending, failed }

class ChatMessage {
  final String id;
  final String spaceId;
  final int seq;
  final String kind;
  final String body;
  final bool deleted;
  final bool edited;
  final bool pinned;
  final String? threadRootId;
  final int threadReplies;
  /// Replies may be written under it (a challenge, or a message a moderator opened).
  final bool threadOpen;
  /// A few of the people who replied under it, newest first.
  final List<Map<String, dynamic>> threadPeople;
  final String? clientMessageId;
  final DateTime createdAt;
  final String? senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final String? senderGender;
  final bool senderIsMentor;
  final List<Map<String, dynamic>> reactions;
  final List<ChatAttachment> attachments;
  final String? replyToId;
  final String? replyToSender;
  final String? replyToBody;
  final String? botKey;
  final Map<String, dynamic>? meta;
  final String? topicId;
  final String? topicStatus;
  final bool best;
  /// «شاهد امتیاز» and «پاسخ نهایی گروه»: marks a mentor puts on a message, shown on it to everyone.
  final bool evidence;
  final bool finalMark;
  /// The mentor chose to wear the mentor's badge on this message.
  final bool mentorMark;
  final List<Map<String, dynamic>> tags;
  final List<Map<String, dynamic>> pollVotes;
  final Map<String, dynamic> raw;
  ChatSendState sendState;

  ChatMessage({
    required this.id,
    required this.spaceId,
    required this.seq,
    required this.kind,
    required this.body,
    required this.deleted,
    required this.edited,
    required this.pinned,
    required this.threadRootId,
    required this.threadReplies,
    this.threadOpen = false,
    this.threadPeople = const [],
    required this.clientMessageId,
    required this.createdAt,
    required this.senderId,
    required this.senderName,
    required this.senderAvatarUrl,
    required this.senderGender,
    required this.senderIsMentor,
    required this.reactions,
    required this.attachments,
    required this.replyToId,
    required this.replyToSender,
    required this.replyToBody,
    required this.botKey,
    required this.meta,
    required this.topicId,
    required this.topicStatus,
    required this.best,
    this.evidence = false,
    this.finalMark = false,
    this.mentorMark = false,
    required this.tags,
    required this.pollVotes,
    required this.raw,
    this.sendState = ChatSendState.sent,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    final replyTo = json['replyTo'] as Map<String, dynamic>?;
    final topic = json['topic'] as Map<String, dynamic>?;
    List<Map<String, dynamic>> maps(String key) => ((json[key] as List?) ?? []).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    return ChatMessage(
      id: json['id'],
      spaceId: json['spaceId'],
      seq: json['seq'] ?? 0,
      kind: json['kind'] ?? 'text',
      body: json['body'] ?? '',
      deleted: json['deleted'] == true,
      edited: json['edited'] == true,
      pinned: json['pinned'] == true,
      threadRootId: json['threadRootId'],
      threadReplies: json['threadReplies'] ?? 0,
      threadOpen: json['threadOpen'] == true || (json['threadReplies'] ?? 0) > 0 || topic != null,
      threadPeople: maps('threadPeople'),
      clientMessageId: json['clientMessageId'],
      createdAt: DateTime.tryParse(json['createdAt'] ?? '')?.toLocal() ?? DateTime.now(),
      senderId: sender?['id'],
      senderName: sender?['name'] ?? (json['botKey'] != null ? 'ربات نپا' : 'نپا'),
      senderAvatarUrl: sender?['avatarUrl'],
      senderGender: sender?['gender'],
      senderIsMentor: AvatarCatalog.isMentorRole(sender?['role']),
      reactions: ((json['reactions'] as List?) ?? []).map((r) => Map<String, dynamic>.from(r as Map)).toList(),
      attachments: ((json['attachments'] as List?) ?? [])
          .map((a) => ChatAttachment.fromJson(Map<String, dynamic>.from(a as Map)))
          .toList(),
      replyToId: replyTo?['id'],
      replyToSender: replyTo?['senderName'],
      replyToBody: replyTo?['body'],
      botKey: json['botKey'],
      meta: json['meta'] is Map ? Map<String, dynamic>.from(json['meta'] as Map) : null,
      topicId: topic?['id'],
      topicStatus: topic?['status'],
      best: json['best'] == true,
      evidence: json['evidence'] == true,
      finalMark: json['final'] == true,
      mentorMark: json['mentorMark'] == true,
      tags: maps('tags'),
      pollVotes: maps('pollVotes'),
      raw: json,
    );
  }
}
