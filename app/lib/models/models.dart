import 'package:nopa_app/core/asset_names.dart';
export 'user_model.dart';

class ChallengeModel {
  /// Reward as shown on a card: "+۱۰ تا ۵۰ کلاف", or the banner for inter-group challenges.
  String get rewardLabel {
    if (rewardAssetType == 'derafsh' || category == 'inter_group') return AssetNames.of('derafsh');
    final unit = AssetNames.of(rewardAssetType == 'nakh' ? 'nakh' : 'zarik');
    final amount = rewardMax > 0 ? (rewardMin == rewardMax ? '$rewardMax' : '$rewardMin تا $rewardMax') : '$rewardZarik';
    return '+$amount $unit';
  }

  /// Remaining time as plain text: "بدون مهلت", "پایان یافته", "کمتر از یک روز" or "N روز مانده" (ASCII digits).
  String get deadlineLabel {
    final due = dueDate;
    if (startDate != null && DateTime.now().isBefore(startDate!)) return 'هنوز شروع نشده';
    if (due == null) return 'بدون مهلت';
    final left = due.difference(DateTime.now());
    if (left.isNegative) return 'پایان یافته';
    if (left.inHours < 24) return 'کمتر از یک روز';
    return '${(left.inHours / 24).ceil()} روز مانده';
  }

  final String id;
  final String title;
  final String description;
  final int rewardZarik;
  final String type; // e.g. 'quiz', 'skill', 'file', 'text', 'multiple_choice'
  final List<Map<String, dynamic>>? questions; // List of questions with 'q', 'options', 'correct'
  final String createdByMentorId;
  final double progress;
  final String? caravanId;
  final String? stationId;
  final DateTime? dueDate;
  final DateTime? startDate; // null = open immediately
  final String? stationTitle;
  final String? mentorName;
  final String? caravanName;
  final String? myStatus;
  final String? mentorFeedback;
  final String? myAnswerText;
  final String? myFileUrl;
  final bool isByAdmin;
  final String? creatorName;
  final String? targetAudienceLabel;
  final String? category; // 'individual' (فردی), 'group' (گروهی), 'inter_group' (میان گروهی)
  final DateTime? createdAt;
  final int? durationDays;
  // Answers of the viewer's own students (filled for mentors only)
  // What an approved answer pays: 'zarik' or 'nakh', picked by the mentor between min and max (0/0 = fixed rewardZarik)
  final String rewardAssetType;
  final int rewardMin;
  final int rewardMax;
  final int totalSubmissions;
  final int pendingSubmissions;
  final int approvedSubmissions;

  ChallengeModel({
    required this.id,
    required this.title,
    required this.description,
    required this.rewardZarik,
    required this.type,
    this.questions,
    required this.createdByMentorId,
    this.progress = 0.0,
    this.caravanId,
    this.stationId,
    this.dueDate,
    this.startDate,
    this.stationTitle,
    this.mentorName,
    this.caravanName,
    this.myStatus,
    this.mentorFeedback,
    this.myAnswerText,
    this.myFileUrl,
    this.isByAdmin = false,
    this.creatorName,
    this.targetAudienceLabel,
    this.category,
    this.createdAt,
    this.durationDays,
    this.rewardAssetType = 'zarik',
    this.rewardMin = 0,
    this.rewardMax = 0,
    this.totalSubmissions = 0,
    this.pendingSubmissions = 0,
    this.approvedSubmissions = 0,
  });
}

class SubmissionModel {
  final String id;
  final String challengeId;
  final String studentId;
  final String studentName;
  final String answerText; // Answer or attached file representation
  final DateTime submittedAt;
  String status; // 'pending', 'approved', 'rejected'
  String scoreFeedback;

  SubmissionModel({
    required this.id,
    required this.challengeId,
    required this.studentId,
    required this.studentName,
    required this.answerText,
    required this.submittedAt,
    this.status = 'pending',
    this.scoreFeedback = '',
  });
}

class MentorRatingModel {
  final String mentorId;
  final String studentId;
  final double ratingValue; // 1.0 to 5.0
  final String comment;
  final DateTime createdAt;

  MentorRatingModel({
    required this.mentorId,
    required this.studentId,
    required this.ratingValue,
    required this.comment,
    required this.createdAt,
  });
}

class CaravanModel {
  final String id;
  final String name;
  int memberCount;
  double overallProgress;
  String activeStation;

  /// Capital totals across the caravan's students (a mentor holds none of their own).
  int totalZarik;
  int totalBeyragh;
  int totalNakh;
  int totalFarsh;

  CaravanModel({
    required this.id,
    required this.name,
    required this.memberCount,
    required this.overallProgress,
    required this.activeStation,
    this.totalZarik = 0,
    this.totalBeyragh = 0,
    this.totalNakh = 0,
    this.totalFarsh = 0,
  });
}

class CertificateModel {
  final String id;
  final String title;
  final String verifyId;
  final DateTime issuedAt;

  CertificateModel({
    required this.id,
    required this.title,
    required this.verifyId,
    required this.issuedAt,
  });
}

class MediaBannerModel {
  final String id;
  final String title;
  final String url;
  final String type;

  MediaBannerModel({
    required this.id,
    required this.title,
    required this.url,
    required this.type,
  });
}

class MentorDocumentModel {
  final String id;
  final String url;
  final String status;

  MentorDocumentModel({
    required this.id,
    required this.url,
    required this.status,
  });
}
