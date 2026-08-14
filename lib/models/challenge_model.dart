class ChallengeModel {
  final String id;
  final String title;
  final String description;
  final int reward;
  final double progress;
  final String type; // e.g., 'daily', 'weekly'

  ChallengeModel({
    required this.id,
    required this.title,
    required this.description,
    required this.reward,
    required this.progress,
    required this.type,
  });
}
