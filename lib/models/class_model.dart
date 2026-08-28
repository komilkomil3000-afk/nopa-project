class ClassModel {
  final String id;
  final String title;
  final String status; // e.g., 'completed', 'in_progress', 'locked'
  final String instructor;

  ClassModel({
    required this.id,
    required this.title,
    required this.status,
    required this.instructor,
  });

  factory ClassModel.fromJson(Map<String, dynamic> json) {
    return ClassModel(
      id: json['id'] ?? '',
      title: json['title'] ?? 'کلاس بدون نام',
      status: json['status'] ?? 'locked',
      instructor: json['instructor'] ?? 'استاد نامشخص',
    );
  }
}

class ClassCategoryModel {
  final String id;
  final String stationId;
  final String title;
  final int orderIndex;
  final List<SessionModel> sessions;

  ClassCategoryModel({
    required this.id,
    required this.stationId,
    required this.title,
    required this.orderIndex,
    required this.sessions,
  });

  factory ClassCategoryModel.fromJson(Map<String, dynamic> json) {
    var rawSessions = json['sessions'] as List? ?? [];
    return ClassCategoryModel(
      id: json['id'] ?? '',
      stationId: json['stationId'] ?? '',
      title: json['title'] ?? 'دسته کلاس',
      orderIndex: json['orderIndex'] ?? 0,
      sessions: rawSessions.map((s) => SessionModel.fromJson(s)).toList(),
    );
  }
}

class SessionModel {
  final String id;
  final String categoryId;
  final String title;
  final String? description;
  final int orderIndex;
  final List<VideoClipModel> videoClips;
  final List<PartQuizModel> quizzes;

  SessionModel({
    required this.id,
    required this.categoryId,
    required this.title,
    this.description,
    required this.orderIndex,
    required this.videoClips,
    required this.quizzes,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    var rawClips = json['videoClips'] as List? ?? [];
    var rawQuizzes = json['quizzes'] as List? ?? [];
    return SessionModel(
      id: json['id'] ?? '',
      categoryId: json['categoryId'] ?? '',
      title: json['title'] ?? 'جلسه',
      description: json['description'],
      orderIndex: json['orderIndex'] ?? 0,
      videoClips: rawClips.map((c) => VideoClipModel.fromJson(c)).toList(),
      quizzes: rawQuizzes.map((q) => PartQuizModel.fromJson(q)).toList(),
    );
  }
}

class VideoClipModel {
  final String id;
  final String sessionId;
  final String title;
  final String videoUrl;
  final int clipOrder;
  final int? duration;
  final List<PartQuizModel> quizzes;

  VideoClipModel({
    required this.id,
    required this.sessionId,
    required this.title,
    required this.videoUrl,
    required this.clipOrder,
    this.duration,
    required this.quizzes,
  });

  factory VideoClipModel.fromJson(Map<String, dynamic> json) {
    var rawQuizzes = json['quizzes'] as List? ?? [];
    return VideoClipModel(
      id: json['id'] ?? '',
      sessionId: json['sessionId'] ?? '',
      title: json['title'] ?? 'پارت ویدیو',
      videoUrl: json['videoUrl'] ?? '',
      clipOrder: json['clipOrder'] ?? 0,
      duration: json['duration'],
      quizzes: rawQuizzes.map((q) => PartQuizModel.fromJson(q)).toList(),
    );
  }
}

class PartQuizModel {
  final String id;
  final String sessionId;
  final String? clipId;
  final String title;
  final int rewardZarik;
  final String? questionsJson;

  PartQuizModel({
    required this.id,
    required this.sessionId,
    this.clipId,
    required this.title,
    required this.rewardZarik,
    this.questionsJson,
  });

  factory PartQuizModel.fromJson(Map<String, dynamic> json) {
    return PartQuizModel(
      id: json['id'] ?? '',
      sessionId: json['sessionId'] ?? '',
      clipId: json['clipId'],
      title: json['title'] ?? 'آزمونک پارت',
      rewardZarik: json['rewardZarik'] ?? 10,
      questionsJson: json['questionsJson'],
    );
  }
}
