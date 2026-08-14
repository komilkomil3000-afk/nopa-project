export 'user_model.dart';

class ChallengeModel {
  final String id;
  final String title;
  final String description;
  final int rewardZarik;
  final String type; // e.g. 'quiz', 'skill', 'file', 'text', 'multiple_choice'
  final List<Map<String, dynamic>>? questions; // List of questions with 'q', 'options', 'correct'
  final String createdByMentorId;
  final double progress;

  ChallengeModel({
    required this.id,
    required this.title,
    required this.description,
    required this.rewardZarik,
    required this.type,
    this.questions,
    required this.createdByMentorId,
    this.progress = 0.0,
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

  CaravanModel({
    required this.id,
    required this.name,
    required this.memberCount,
    required this.overallProgress,
    required this.activeStation,
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
